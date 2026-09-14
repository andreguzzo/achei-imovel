import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Phone, MapPin, Handshake, Building2, MessageCircle, Mail, Shield, ChevronLeft, ChevronRight, Instagram, Facebook, Youtube, Linkedin, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Seo from "@/components/Seo";

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
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  tiktok: string | null;
  linkedin: string | null;
}

interface BrokerPhoto {
  id: string;
  url: string;
  is_cover: boolean;
  is_banner: boolean;
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

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
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const displayName = broker?.commercial_name || broker?.full_name || "Corretor";
  const coverPhoto = photos.find(p => p.is_cover);
  const avatarSrc = coverPhoto?.url || broker?.avatar_url || undefined;

  useEffect(() => {
    if (!username) return;
    const fetchBroker = async () => {
      setLoading(true);
      const { data: profileData } = await supabase
        .from("brokers_public")
        .select("user_id, full_name, avatar_url, bio, creci, commercial_name, username, instagram, facebook, youtube, tiktok, linkedin")
        .eq("username", username.toLowerCase())
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = { ...profileData, phone: null, whatsapp: null } as any as BrokerData;
      setBroker(profile);

      // Contact details are only available to signed-in visitors
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data: contact } = await supabase.rpc("get_broker_contact", { _user_id: profile.user_id });
        const row = (contact as { phone: string | null; whatsapp: string | null }[] | null)?.[0];
        if (row) setBroker((prev) => (prev ? { ...prev, phone: row.phone, whatsapp: row.whatsapp } : prev));
      }


      const [photosRes, propsRes, partnershipsRes] = await Promise.all([
        supabase.from("broker_photos").select("id, url, is_cover, is_banner").eq("user_id", profile.user_id).order("position"),
        supabase.from("properties").select("id, title, city, state, price, property_type, listing_type, bedrooms, area, property_images(url)").eq("user_id", profile.user_id).eq("status", "active").order("created_at", { ascending: false }).limit(50),
        supabase.from("broker_partnerships").select("broker_a_id, broker_b_id").or(`broker_a_id.eq.${profile.user_id},broker_b_id.eq.${profile.user_id}`).eq("status", "active"),
      ]);

      setPhotos((photosRes.data as any) ?? []);
      setProperties((propsRes.data as any) ?? []);

      const parts = (partnershipsRes.data as any[]) ?? [];
      const partnerIds = parts.map((p) =>
        p.broker_a_id === profile.user_id ? p.broker_b_id : p.broker_a_id
      );
      if (partnerIds.length > 0) {
        const { data: partnerProfiles } = await supabase
          .from("brokers_public")
          .select("full_name, avatar_url, creci, username")
          .in("user_id", partnerIds);
        setPartners((partnerProfiles as any) ?? []);
      }

      setLoading(false);
    };
    fetchBroker();
  }, [username]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!showGallery) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowGallery(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showGallery]);

  if (loading) {
    return <BrokerProfileSkeleton />;
  }

  if (notFound || !broker) {
    return (
      <div className="container py-20 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold text-foreground">{pt ? "Corretor não encontrado" : "Broker not found"}</h1>
          <p className="mt-2 text-muted-foreground">{pt ? "O perfil que você procura não existe." : "The profile you're looking for doesn't exist."}</p>
          <Link to="/"><Button className="mt-6">{pt ? "Voltar ao início" : "Go home"}</Button></Link>
        </motion.div>
      </div>
    );
  }

  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const bannerPhoto = photos.find(p => p.is_banner);
  const galleryPhotos = photos.filter(p => !p.is_cover && !p.is_banner);

  return (
    <div className="min-h-screen">
      {/* Hero Cover - uses banner photo */}
      <div className="relative h-48 sm:h-64 md:h-72 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 overflow-hidden">
        {bannerPhoto && (
          <img src={bannerPhoto.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container relative -mt-24 pb-16 space-y-8">
        {/* Profile Header */}
        <motion.div
          initial="hidden" animate="visible" custom={0} variants={fadeUp}
          className="flex flex-col sm:flex-row items-center sm:items-end gap-5"
        >
          <Avatar className="h-32 w-32 border-4 border-background shadow-xl ring-2 ring-primary/20">
            <AvatarImage src={avatarSrc} className="object-cover" />
            <AvatarFallback className="text-4xl font-display bg-primary/10 text-primary">{(displayName)[0]}</AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left flex-1 min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">{displayName}</h1>
            {broker.commercial_name && broker.full_name && broker.commercial_name !== broker.full_name && (
              <p className="text-sm text-muted-foreground mt-0.5">{broker.full_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
              <span className="text-sm text-muted-foreground">@{broker.username}</span>
              {broker.creci && (
                <Badge variant="outline" className="gap-1 font-mono text-xs">
                  <Shield className="h-3 w-3" /> CRECI {broker.creci}
                </Badge>
              )}
            </div>
          </div>
          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end shrink-0">
            {broker.whatsapp && (
              <a
                href={`https://wa.me/${broker.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(pt ? "Olá! Vi seu perfil e gostaria de conversar." : "Hi! I saw your profile and would like to chat.")}`}
                target="_blank" rel="noopener noreferrer"
              >
                <Button className="gap-2 bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white shadow-md">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
            {broker.phone && (
              <a href={`tel:${broker.phone}`}>
                <Button variant="outline" className="gap-2">
                  <Phone className="h-4 w-4" /> {pt ? "Ligar" : "Call"}
                </Button>
              </a>
            )}
            {!broker.whatsapp && !broker.phone && (
              <Link to="/login">
                <Button variant="outline" className="gap-2">
                  <Phone className="h-4 w-4" /> {pt ? "Entrar para ver o contato" : "Sign in to see contact"}
                </Button>
              </Link>
            )}
          </div>

        </motion.div>

        {/* Bio */}
        {broker.bio && (
          <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
            <Card className="border-none shadow-sm bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {pt ? "Sobre" : "About"}
                </h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{broker.bio}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Social Media Links */}
        {(broker.instagram || broker.facebook || broker.youtube || broker.tiktok || broker.linkedin) && (
          <motion.div initial="hidden" animate="visible" custom={1.5} variants={fadeUp}>
            <div className="flex flex-wrap gap-2">
              {broker.instagram && (
                <a href={broker.instagram.startsWith("http") ? broker.instagram : `https://instagram.com/${broker.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Instagram className="h-4 w-4" /> Instagram
                  </Button>
                </a>
              )}
              {broker.facebook && (
                <a href={broker.facebook.startsWith("http") ? broker.facebook : `https://facebook.com/${broker.facebook}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Facebook className="h-4 w-4" /> Facebook
                  </Button>
                </a>
              )}
              {broker.youtube && (
                <a href={broker.youtube.startsWith("http") ? broker.youtube : `https://youtube.com/${broker.youtube}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Youtube className="h-4 w-4" /> YouTube
                  </Button>
                </a>
              )}
              {broker.tiktok && (
                <a href={broker.tiktok.startsWith("http") ? broker.tiktok : `https://tiktok.com/@${broker.tiktok.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13v-3.5a6.37 6.37 0 0 0-.88-.07 6.26 6.26 0 0 0 0 12.52 6.27 6.27 0 0 0 6.26-6.27V8.87a8.16 8.16 0 0 0 3.84.96V6.69Z"/></svg>
                    TikTok
                  </Button>
                </a>
              )}
              {broker.linkedin && (
                <a href={broker.linkedin.startsWith("http") ? broker.linkedin : `https://linkedin.com/in/${broker.linkedin}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </Button>
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Photo Gallery Button */}
        {galleryPhotos.length > 0 && (
          <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { setGalleryIndex(0); setShowGallery(true); }}
            >
              <Camera className="h-4 w-4" />
              {pt ? `Ver fotos (${galleryPhotos.length})` : `View photos (${galleryPhotos.length})`}
            </Button>
          </motion.div>
        )}

        {/* Photo Gallery Lightbox */}
        <AnimatePresence>
          {showGallery && galleryPhotos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
              onClick={() => setShowGallery(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="relative max-h-[90vh] max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
              >
                <img src={galleryPhotos[galleryIndex].url} alt="" className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl" />
                {galleryPhotos.length > 1 && (
                  <>
                    <Button
                      size="icon" variant="ghost"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 text-white bg-black/40 hover:bg-black/60"
                      onClick={() => setGalleryIndex((i) => (i - 1 + galleryPhotos.length) % galleryPhotos.length)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-white bg-black/40 hover:bg-black/60"
                      onClick={() => setGalleryIndex((i) => (i + 1) % galleryPhotos.length)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                  {galleryIndex + 1} / {galleryPhotos.length}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partnerships */}
        {partners.length > 0 && (
          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Handshake className="h-4 w-4" /> {pt ? "Corretores Parceiros" : "Partner Brokers"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {partners.map((p, i) => {
                const partnerLink = (p as any).username ? `/corretor/${(p as any).username}` : null;
                const content = (
                  <div className="flex items-center gap-3 rounded-xl border p-3 hover:bg-accent/50 hover:shadow-sm transition-all duration-200">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-sm">{(p.full_name ?? "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.full_name}</p>
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
          </motion.div>
        )}

        {/* Properties */}
        <motion.div initial="hidden" animate="visible" custom={4} variants={fadeUp}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {pt ? "Imóveis" : "Properties"}
              <Badge variant="secondary" className="ml-1 text-xs">{properties.length}</Badge>
            </h2>
          </div>
          {properties.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">{pt ? "Nenhum imóvel disponível no momento." : "No properties available at the moment."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <Link to={`/imovel/${p.id}`}>
                    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-transparent hover:border-primary/20">
                      <div className="aspect-video overflow-hidden bg-muted relative">
                        {p.property_images?.[0]?.url ? (
                          <img src={p.property_images[0].url} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Building2 className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium text-foreground truncate text-sm">{p.title}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" /> {p.city} - {p.state}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-base font-bold text-primary">{fmt.format(p.price)}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {p.bedrooms != null && <span>{p.bedrooms} {pt ? "qts" : "beds"}</span>}
                            {p.area != null && <span>{p.area}m²</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

/** Skeleton loader for broker profile */
const BrokerProfileSkeleton = () => (
  <div className="min-h-screen">
    <div className="h-48 sm:h-64 md:h-72 bg-gradient-to-br from-muted to-muted/50" />
    <div className="container relative -mt-24 pb-16 space-y-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
        <Skeleton className="h-32 w-32 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

export default BrokerProfile;
