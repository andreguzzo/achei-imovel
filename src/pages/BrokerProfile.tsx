import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, Mail, MapPin, Handshake, Building2, MessageCircle } from "lucide-react";

interface BrokerData {
  user_id: string;
  full_name: string | null;
  commercial_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  creci: string | null;
}

interface BrokerPhoto {
  id: string;
  url: string;
  is_cover: boolean;
}

interface PartnerProfile {
  full_name: string | null;
  avatar_url: string | null;
  creci: string | null;
  username: string | null;
}

interface PropertyItem {
  id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  property_type: string;
  listing_type: string;
  bedrooms: number | null;
  area: number | null;
  property_images: { url: string }[];
}

const BrokerProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [broker, setBroker] = useState<BrokerData | null>(null);
  const [photos, setPhotos] = useState<BrokerPhoto[]>([]);
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    const fetchBroker = async () => {
      setLoading(true);
      // Find profile by username
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, phone, bio, creci, commercial_name, username, whatsapp" as any)
        .eq("username", username.toLowerCase())
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = profileData as any as BrokerData;
      setBroker(profile);

      // Fetch photos, properties and partnerships in parallel
      const [photosRes, propsRes, partnershipsRes] = await Promise.all([
        supabase
          .from("broker_photos")
          .select("id, url, is_cover")
          .eq("user_id", profile.user_id)
          .order("position"),
        supabase
          .from("properties")
          .select("id, title, city, state, price, property_type, listing_type, bedrooms, area, property_images(url)")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("broker_partnerships")
          .select("broker_a_id, broker_b_id")
          .or(`broker_a_id.eq.${profile.user_id},broker_b_id.eq.${profile.user_id}`)
          .eq("status", "active"),
      ]);

      setPhotos((photosRes.data as any) ?? []);
      setProperties((propsRes.data as any) ?? []);

      // Fetch partner profiles
      const parts = (partnershipsRes.data as any[]) ?? [];
      const partnerIds = parts.map((p) =>
        p.broker_a_id === profile.user_id ? p.broker_b_id : p.broker_a_id
      );
      if (partnerIds.length > 0) {
        const { data: partnerProfiles } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, creci, username" as any)
          .in("user_id", partnerIds);
        setPartners((partnerProfiles as any) ?? []);
      }

      setLoading(false);
    };
    fetchBroker();
  }, [username]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (notFound || !broker) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">{pt ? "Corretor não encontrado" : "Broker not found"}</h1>
        <p className="mt-2 text-muted-foreground">{pt ? "O perfil que você procura não existe." : "The profile you're looking for doesn't exist."}</p>
        <Link to="/"><Button className="mt-4">{pt ? "Voltar ao início" : "Go home"}</Button></Link>
      </div>
    );
  }

  const displayName = broker.commercial_name || broker.full_name || "Corretor";
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <Avatar className="h-28 w-28 border-4 border-primary/20">
          <AvatarImage src={broker.avatar_url ?? undefined} />
          <AvatarFallback className="text-3xl">{(displayName)[0]}</AvatarFallback>
        </Avatar>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
          {broker.commercial_name && broker.full_name && broker.commercial_name !== broker.full_name && (
            <p className="text-sm text-muted-foreground">{broker.full_name}</p>
          )}
          <p className="text-sm text-muted-foreground">@{broker.username}</p>
          {broker.creci && <Badge variant="outline" className="mt-1">CRECI: {broker.creci}</Badge>}
          <div className="mt-3 flex flex-wrap gap-3 justify-center sm:justify-start">
            {broker.phone && (
              <a href={`tel:${broker.phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Phone className="h-4 w-4" /> {broker.phone}
              </a>
            )}
            {broker.whatsapp && (
              <a
                href={`https://wa.me/${broker.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(pt ? "Olá! Vi seu perfil e gostaria de conversar." : "Hi! I saw your profile and would like to chat.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {broker.bio && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-foreground whitespace-pre-line">{broker.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">{pt ? "Fotos" : "Photos"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedPhoto(photo.url)}
              >
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}

      {/* Partnerships */}
      {partners.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Handshake className="h-5 w-5" /> {pt ? "Corretores Parceiros" : "Partner Brokers"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {partners.map((p, i) => {
              const partnerLink = (p as any).username ? `/corretor/${(p as any).username}` : null;
              const content = (
                <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{(p.full_name ?? "?")[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{p.full_name}</p>
                    {p.creci && <p className="text-xs text-muted-foreground">CRECI: {p.creci}</p>}
                  </div>
                </div>
              );
              return partnerLink ? (
                <Link key={i} to={partnerLink}>{content}</Link>
              ) : (
                <div key={i}>{content}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Properties */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5" /> {pt ? "Imóveis à Venda" : "Properties for Sale"} ({properties.length})
        </h2>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pt ? "Nenhum imóvel disponível no momento." : "No properties available at the moment."}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <Link key={p.id} to={`/imovel/${p.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video overflow-hidden bg-muted">
                    {p.property_images?.[0]?.url ? (
                      <img src={p.property_images[0].url} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Building2 className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-foreground truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {p.city} - {p.state}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">{fmt.format(p.price)}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {p.bedrooms != null && <span>{p.bedrooms} {pt ? "quartos" : "beds"}</span>}
                        {p.area != null && <span>{p.area}m²</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrokerProfile;
