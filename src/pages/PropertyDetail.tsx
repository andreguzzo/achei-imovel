import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Bed, Bath, Car, Maximize, MapPin, ArrowLeft, Users, Video, MessageCircle, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ContactForm from "@/components/ContactForm";
import PropertyMap from "@/components/PropertyMap";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

type BrokerProfile = {
  user_id: string;
  full_name: string | null;
  creci: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  username: string | null;
  commercial_name: string | null;
};

type GroupBroker = {
  broker_id: string;
  property_id: string;
  price: number;
  profile: BrokerProfile | null;
};

const formatPrice = (price: number, listingType: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  return listingType === "rent" ? `${formatted}/mês` : formatted;
};

const getEmbedUrl = (url: string): string => {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
};

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt-BR";
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerProfile, setOwnerProfile] = useState<BrokerProfile | null>(null);
  const [groupBrokers, setGroupBrokers] = useState<GroupBroker[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);

  // Increment view count
  useEffect(() => {
    if (!id) return;
    supabase.rpc("increment_view_count", { _property_id: id });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: prop } = await supabase
        .from("properties")
        .select("*, property_images(*)")
        .eq("id", id)
        .single();

      if (prop) {
        setProperty(prop as Property);

        // Fetch group members
        const { data: members } = await supabase
          .from("property_group_members")
          .select("broker_id, property_id")
          .eq("property_id", id);

        if (members && members.length > 0) {
          const { data: memberWithGroup } = await supabase
            .from("property_group_members")
            .select("group_id")
            .eq("property_id", id)
            .single();

          if (memberWithGroup) {
            const { data: allMembers } = await supabase
              .from("property_group_members")
              .select("broker_id, property_id")
              .eq("group_id", memberWithGroup.group_id);

            if (allMembers && allMembers.length > 1) {
              const brokers: GroupBroker[] = [];
              for (const m of allMembers) {
                const { data: brokerProp } = await supabase
                  .from("properties")
                  .select("price")
                  .eq("id", m.property_id)
                  .single();
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("full_name, creci, avatar_url, phone")
                  .eq("user_id", m.broker_id)
                  .single();
                brokers.push({
                  broker_id: m.broker_id,
                  property_id: m.property_id,
                  price: brokerProp?.price ?? 0,
                  profile: profile ?? null,
                });
              }
              setGroupBrokers(brokers);
            }
          }
        }

        // Fetch active partner brokers for the property owner
        const ownerId = (prop as Property).user_id;
        const { data: partnerships } = await supabase
          .from("broker_partnerships")
          .select("*")
          .eq("status", "active")
          .or(`broker_a_id.eq.${ownerId},broker_b_id.eq.${ownerId}`);

        if (partnerships && partnerships.length > 0) {
          const partnerIds = partnerships.map((p) =>
            p.broker_a_id === ownerId ? p.broker_b_id : p.broker_a_id
          );
          const { data: partnerProfiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, creci, avatar_url, phone")
            .in("user_id", partnerIds);
          setPartnerBrokers((partnerProfiles as PartnerBroker[]) ?? []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleProposPartnership = async () => {
    if (!user || !partnerBrokerId || !id) return;
    setSubmitting(true);

    // Get group_id
    const { data: member } = await supabase
      .from("property_group_members")
      .select("group_id")
      .eq("property_id", id)
      .single();

    if (!member) {
      toast({ title: "Erro", description: "Grupo não encontrado", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("broker_partnerships").insert({
      group_id: member.group_id,
      broker_a_id: user.id,
      broker_b_id: partnerBrokerId,
      commission_split: Number(commissionSplit),
      terms,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proposta enviada!", description: "O corretor receberá sua proposta de parceria." });
      setPartnerBrokerId(null);
      setTerms("");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg font-medium">Imóvel não encontrado</p>
        <Link to="/busca"><Button variant="link">Voltar à busca</Button></Link>
      </div>
    );
  }

  const images = property.property_images?.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) ?? [];

  const typeLabels: Record<string, Record<string, string>> = {
    "pt-BR": { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Comercial" },
    en: { apartment: "Apartment", house: "House", land: "Land", commercial: "Commercial" },
  };

  return (
    <div className="container py-8">
      <Link to="/busca" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.common.back}
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          <div className="space-y-2">
            <div className="aspect-[16/9] overflow-hidden rounded-xl bg-muted">
              {images.length > 0 ? (
                <img src={images[selectedImage]?.url} alt={property.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">Sem foto</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${i === selectedImage ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{typeLabels[locale]?.[property.property_type] ?? property.property_type}</Badge>
              {property.listing_type === "rent" && <Badge variant="secondary">Aluguel</Badge>}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{property.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {property.address && `${property.address}, `}{property.neighborhood && `${property.neighborhood}, `}{property.city} - {property.state}
            </p>
            <p className="mt-3 text-3xl font-bold text-primary">{formatPrice(property.price, property.listing_type)}</p>
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-6 rounded-lg border bg-card p-4">
            {property.bedrooms != null && property.bedrooms > 0 && (
              <div className="flex items-center gap-2 text-sm"><Bed className="h-5 w-5 text-muted-foreground" /> {property.bedrooms} {t.property.bedrooms}</div>
            )}
            {property.suites != null && property.suites > 0 && (
              <div className="flex items-center gap-2 text-sm"><Bed className="h-5 w-5 text-muted-foreground" /> {property.suites} {locale === "pt-BR" ? "Suítes" : "Suites"}</div>
            )}
            {property.bathrooms != null && property.bathrooms > 0 && (
              <div className="flex items-center gap-2 text-sm"><Bath className="h-5 w-5 text-muted-foreground" /> {property.bathrooms} {t.property.bathrooms}</div>
            )}
            {property.parking_spots != null && property.parking_spots > 0 && (
              <div className="flex items-center gap-2 text-sm"><Car className="h-5 w-5 text-muted-foreground" /> {property.parking_spots} {t.property.parking}</div>
            )}
            {property.area != null && (
              <div className="flex items-center gap-2 text-sm"><Maximize className="h-5 w-5 text-muted-foreground" /> {property.area} {t.property.area}</div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h2 className="font-display text-lg font-semibold">{t.property.description}</h2>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{property.description}</p>
            </div>
          )}

          {/* Features */}
          {property.features && property.features.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold">{t.property.features}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {property.features.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
              </div>
            </div>
          )}

          {/* Video */}
          {(property as any).video_url && (
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Video className="h-5 w-5" /> {locale === "pt-BR" ? "Vídeo" : "Video"}
              </h2>
              <div className="mt-2 aspect-video overflow-hidden rounded-lg">
                <iframe
                  src={getEmbedUrl((property as any).video_url)}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          )}

          {/* Map */}
          {property.latitude != null && property.longitude != null && (
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" /> {locale === "pt-BR" ? "Localização" : "Location"}
              </h2>
              <div className="mt-2 h-64 rounded-lg overflow-hidden border">
                <PropertyMap
                  properties={[property as any]}
                  center={[Number(property.latitude), Number(property.longitude)]}
                  zoom={15}
                />
              </div>
              <a
                href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <MapPin className="h-3 w-3" /> {locale === "pt-BR" ? "Abrir no Google Maps" : "Open in Google Maps"}
              </a>
            </div>
          )}

          {/* Costs */}
          <div className="flex gap-6">
            {property.iptu != null && property.iptu > 0 && (
              <div className="text-sm"><span className="text-muted-foreground">{t.property.iptu}:</span> <span className="font-medium">R$ {property.iptu.toLocaleString("pt-BR")}</span></div>
            )}
            {property.condo_fee != null && property.condo_fee > 0 && (
              <div className="text-sm"><span className="text-muted-foreground">{t.property.condo}:</span> <span className="font-medium">R$ {property.condo_fee.toLocaleString("pt-BR")}</span></div>
            )}
          </div>
        </div>

        {/* Sidebar: Brokers */}
        <div className="space-y-4">
          {groupBrokers.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  {locale === "pt-BR" ? `${groupBrokers.length} corretores anunciam este imóvel` : `${groupBrokers.length} brokers list this property`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupBrokers.map((b) => (
                  <div key={b.broker_id} className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-foreground">{b.profile?.full_name ?? "Corretor"}</p>
                      {b.profile?.creci && <p className="text-xs text-muted-foreground">CRECI: {b.profile.creci}</p>}
                      {b.profile?.phone && <p className="text-xs text-muted-foreground">{b.profile.phone}</p>}
                      <p className="mt-1 text-sm font-bold text-primary">{formatPrice(b.price, property.listing_type)}</p>
                    </div>
                    {user && user.id !== b.broker_id && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setPartnerBrokerId(b.broker_id)}>
                            <Handshake className="h-3.5 w-3.5" />
                            {locale === "pt-BR" ? "Parceria" : "Partner"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{locale === "pt-BR" ? "Propor Parceria" : "Propose Partnership"}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">{locale === "pt-BR" ? "Sua comissão (%)" : "Your commission (%)"}</label>
                              <Input type="number" value={commissionSplit} onChange={(e) => setCommissionSplit(e.target.value)} min="0" max="100" />
                            </div>
                            <div>
                              <label className="text-sm font-medium">{locale === "pt-BR" ? "Termos" : "Terms"}</label>
                              <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={locale === "pt-BR" ? "Descreva os termos da parceria..." : "Describe partnership terms..."} />
                            </div>
                            <Button onClick={handleProposPartnership} disabled={submitting} className="w-full">
                              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {locale === "pt-BR" ? "Enviar Proposta" : "Send Proposal"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <ContactForm propertyId={property.id} />
          )}
          {groupBrokers.length > 1 && <ContactForm propertyId={property.id} />}

          {/* Partner Brokers */}
          {partnerBrokers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Handshake className="h-4 w-4 text-primary" />
                  {locale === "pt-BR" ? "Corretores Parceiros" : "Partner Brokers"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {partnerBrokers.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
                          {(p.full_name ?? "?")[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.full_name ?? "Corretor"}</p>
                      {p.creci && <p className="text-xs text-muted-foreground">CRECI: {p.creci}</p>}
                      {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {locale === "pt-BR"
                    ? "Estes corretores são parceiros do anunciante e também podem intermediar este imóvel."
                    : "These brokers are partners of the listing agent and can also help with this property."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
