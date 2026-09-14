import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bed, Bath, Car, Maximize, MapPin, ArrowLeft, Users, Video, MessageCircle, Phone as PhoneIcon, Share2, Heart, Copy, Check, Home } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ImageWithFallback from "@/components/ImageWithFallback";
import ContactForm from "@/components/ContactForm";
import PropertyMap, { type MapProperty } from "@/components/PropertyMap";
import { asBoundary, boundaryCenter } from "@/lib/kmlParser";
import { getEmbedUrl } from "@/lib/video";
import Seo from "@/components/Seo";

import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { partnershipKindLabel, type MemberRole, type PartnershipKind } from "@/lib/partnerships";


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
  role: MemberRole;
  partnership_type: PartnershipKind | null;
  profile: BrokerProfile | null;
};


const formatPrice = (price: number, listingType: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  return listingType === "rent" ? `${formatted}/mês` : formatted;
};




const brokerWhatsAppUrl = (phone: string, propertyTitle: string) =>
  buildWhatsAppUrl(
    phone,
    `Olá! Gostaria de informações sobre o imóvel "${propertyTitle}", visto na Abitzo.`,
  );

const BrokerCard = ({
  profile,
  propertyTitle,
  pt,
  tagline,
  price,
  highlight = false,
}: {
  profile: BrokerProfile;
  propertyTitle: string;
  pt: boolean;
  tagline?: string;
  price?: number;
  highlight?: boolean;
}) => {
  const whatsappNumber = profile.whatsapp || profile.phone;
  const waUrl = whatsappNumber ? brokerWhatsAppUrl(whatsappNumber, propertyTitle) : null;


  return (
    <div className={`flex items-start gap-3 rounded-xl border bg-card p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <Link to={profile.username ? `/corretor/${profile.username}` : "#"}>
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-lg font-bold">{(profile.full_name ?? "?")[0]}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={profile.username ? `/corretor/${profile.username}` : "#"}
          className="font-semibold text-foreground hover:text-primary transition-colors"
        >
          {profile.commercial_name || profile.full_name || "Corretor"}
        </Link>
        {tagline && (
          <Badge variant={highlight ? "default" : "outline"} className="ml-2 align-middle text-[10px]">
            {tagline}
          </Badge>
        )}
        {price != null && price > 0 && (
          <p className="text-sm font-semibold text-primary">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)}
          </p>
        )}
        {profile.creci && (
          <p className="text-xs text-muted-foreground">CRECI: {profile.creci}</p>
        )}

        {profile.phone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <PhoneIcon className="h-3 w-3" /> {profile.phone}
          </p>
        )}
        {whatsappNumber ? (
          <a
            href={buildWhatsAppUrl(whatsappNumber, propertyTitle)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex"
          >
            <Button size="sm" className="gap-1.5 bg-[#25D366] hover:bg-[#1fb855] text-white">
              <MessageCircle className="h-4 w-4" />
              {pt ? "Falar no WhatsApp" : "Chat on WhatsApp"}
            </Button>
          </a>
        ) : (
          <Link to="/login" className="mt-2 inline-flex">
            <Button size="sm" variant="outline" className="gap-1.5">
              <PhoneIcon className="h-4 w-4" />
              {pt ? "Entrar para ver o contato" : "Sign in to see contact"}
            </Button>
          </Link>
        )}

      </div>
    </div>
  );
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
  const [ownerRole, setOwnerRole] = useState<MemberRole | null>(null);
  const [ownerPartnershipType, setOwnerPartnershipType] = useState<PartnershipKind | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [copied, setCopied] = useState(false);
  const { isFavorited: isFavFn, toggle: toggleFav } = useFavorites();

  useEffect(() => {
    if (!id) return;
    supabase.rpc("increment_view_count", { _property_id: id }).then(({ error }) => {
      if (error) console.warn("View count error:", error.message);
    });
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: property?.title, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: pt ? "Link copiado!" : "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

        // Fetch owner public profile (contact details are loaded separately for signed-in users)
        const { data: ownerProf } = await supabase
          .from("brokers_public")
          .select("user_id, full_name, creci, avatar_url, username, commercial_name")
          .eq("user_id", (prop as Property).user_id)
          .single();
        if (ownerProf) setOwnerProfile({ ...ownerProf, phone: null, whatsapp: null } as BrokerProfile);


        // Fetch group members (other brokers listing the same property)
        const { data: memberWithGroup } = await supabase
          .from("property_group_members")
          .select("group_id, role, partnership_type")
          .eq("property_id", id)
          .eq("status", "approved")
          .limit(1)
          .maybeSingle();

        if (memberWithGroup) {
          setOwnerRole(memberWithGroup.role);
          setOwnerPartnershipType(memberWithGroup.partnership_type);

          const { data: allMembers } = await supabase
            .from("property_group_members")
            .select("broker_id, property_id, role, partnership_type")
            .eq("group_id", memberWithGroup.group_id)
            .eq("status", "approved")
            .neq("broker_id", (prop as Property).user_id);

          if (allMembers && allMembers.length > 0) {
            // Batch fetch all broker profiles and property prices
            const brokerIds = allMembers.map((m) => m.broker_id);
            const propertyIds = allMembers.map((m) => m.property_id);

            const [profilesRes, pricesRes] = await Promise.all([
              supabase
                .from("brokers_public")
                .select("user_id, full_name, creci, avatar_url, username, commercial_name")
                .in("user_id", brokerIds),
              supabase
                .from("properties")
                .select("id, price")
                .in("id", propertyIds),
            ]);

            const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
            const priceMap = new Map((pricesRes.data ?? []).map((p) => [p.id, p.price]));

            const brokers: GroupBroker[] = allMembers.map((m) => ({
              broker_id: m.broker_id,
              property_id: m.property_id,
              price: priceMap.get(m.property_id) ?? 0,
              role: m.role,
              partnership_type: m.partnership_type,
              profile: profileMap.has(m.broker_id)
                ? ({ ...profileMap.get(m.broker_id), phone: null, whatsapp: null } as BrokerProfile)
                : null,
            }));

            setGroupBrokers(brokers);
          }
        }

      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  // Contact details (phone/WhatsApp) are only available to signed-in visitors
  const ownerId = ownerProfile?.user_id;
  const groupBrokerIds = groupBrokers.map((b) => b.broker_id).join(",");
  useEffect(() => {
    if (!user || !ownerId) return;
    let cancelled = false;
    const ids = [ownerId, ...groupBrokerIds.split(",").filter(Boolean)];
    const load = async () => {
      const results = await Promise.all(
        ids.map((uid) => supabase.rpc("get_broker_contact", { _user_id: uid })),
      );
      if (cancelled) return;
      const contacts = new Map<string, { phone: string | null; whatsapp: string | null }>();
      results.forEach((res) => {
        const row = (res.data as { user_id: string; phone: string | null; whatsapp: string | null }[] | null)?.[0];
        if (row) contacts.set(row.user_id, { phone: row.phone, whatsapp: row.whatsapp });
      });
      setOwnerProfile((prev) => (prev && contacts.has(prev.user_id) ? { ...prev, ...contacts.get(prev.user_id)! } : prev));
      setGroupBrokers((prev) =>
        prev.map((b) =>
          b.profile && contacts.has(b.broker_id)
            ? { ...b, profile: { ...b.profile, ...contacts.get(b.broker_id)! } }
            : b,
        ),
      );
    };
    load();
    return () => { cancelled = true; };
  }, [user, ownerId, groupBrokerIds]);

  // JSON-LD structured data for RealEstateListing
  useEffect(() => {
    if (!property) return;
    const url = window.location.href.split("?")[0];
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: property.title,
      description: property.description ?? `${property.title} em ${property.city}/${property.state}`,
      url,
      image: property.property_images?.map((i) => i.url).slice(0, 5),
      price: Number(property.price),
      priceCurrency: "BRL",
      numberOfRooms: property.bedrooms ?? undefined,
      floorSize: property.area ? { "@type": "QuantitativeValue", value: property.area, unitCode: "MTK" } : undefined,
      address: {
        "@type": "PostalAddress",
        addressLocality: property.city,
        addressRegion: property.state,
        addressCountry: "BR",
      },
    });
    document.head.appendChild(ld);
    return () => { ld.remove(); };
  }, [property]);


  if (loading) {
    return <PropertyDetailSkeleton />;
  }

  if (!property) {
    return (
      <div className="container py-20 text-center">
        <Home className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {pt ? "Imóvel não encontrado" : "Property not found"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {pt
            ? "Este imóvel não existe, foi removido ou está desativado no momento."
            : "This property doesn't exist, was removed or is currently deactivated."}
        </p>
        <Link to="/busca">
          <Button className="mt-6">{pt ? "Ver outros imóveis" : "Browse other properties"}</Button>
        </Link>
      </div>
    );
  }

  const images = property.property_images?.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) ?? [];
  const typeLabels: Record<string, Record<string, string>> = {
    "pt-BR": { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Comercial" },
    en: { apartment: "Apartment", house: "House", land: "Land", commercial: "Commercial" },
  };

  const typeLabel = typeLabels[locale]?.[property.property_type] ?? property.property_type;
  const seoDescription = `${typeLabel} ${property.listing_type === "rent" ? (pt ? "para alugar" : "for rent") : (pt ? "à venda" : "for sale")}${property.bedrooms ? `, ${property.bedrooms} ${t.property.bedrooms}` : ""}${property.area ? `, ${property.area}m²` : ""}, por ${formatPrice(property.price, property.listing_type)} em ${property.city}/${property.state}.`;

  const propertyBoundary = asBoundary((property as { boundary?: unknown }).boundary);
  const mapCenter =
    property.latitude != null && property.longitude != null
      ? { lat: Number(property.latitude), lng: Number(property.longitude) }
      : propertyBoundary
        ? boundaryCenter(propertyBoundary)
        : null;

  type BrokerEntry = { profile: BrokerProfile; tagline?: string; price?: number; highlight?: boolean };
  const brokerEntries: BrokerEntry[] = [];
  if (ownerProfile) {
    brokerEntries.push({
      profile: ownerProfile,
      highlight: ownerRole === "captador",
      tagline:
        ownerRole === "captador"
          ? pt ? "Captador" : "Listing broker"
          : ownerRole === "parceiro"
            ? partnershipKindLabel(ownerPartnershipType, pt)
            : undefined,
      price: groupBrokers.length > 0 ? property.price : undefined,
    });
  }
  groupBrokers.forEach((gb) => {
    if (!gb.profile) return;
    brokerEntries.push({
      profile: gb.profile,
      highlight: gb.role === "captador",
      tagline:
        gb.role === "captador"
          ? pt ? "Captador" : "Listing broker"
          : partnershipKindLabel(gb.partnership_type, pt),
      price: gb.price,
    });
  });
  brokerEntries.sort((a, b) => Number(!!b.highlight) - Number(!!a.highlight));


  return (
    <>
      <Seo
        title={`${property.title} — ${property.city}/${property.state} | Abitzo`}
        description={seoDescription}
        canonical={`/imovel/${property.id}`}
        image={images[0]?.url}
      />
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
                <ImageWithFallback src={images[selectedImage]?.url} alt={property.title} className="h-full w-full object-cover" loading="eager" decoding="async" fetchPriority="high" width={1280} height={720} />
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
                    <ImageWithFallback src={img.url} alt="" className="h-full w-full object-cover" width={96} height={64} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{typeLabels[locale]?.[property.property_type] ?? property.property_type}</Badge>
              {property.listing_type === "rent" && <Badge variant="secondary">{pt ? "Aluguel" : "Rent"}</Badge>}
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground">{property.title}</h1>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => id && toggleFav(id)} className="h-9 w-9">
                  <Heart className={`h-5 w-5 ${id && isFavFn(id) ? "fill-destructive text-destructive" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9">
                  {copied ? <Check className="h-5 w-5 text-primary" /> : <Share2 className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {property.address && `${property.address}, `}{property.neighborhood && `${property.neighborhood}, `}{property.city} - {property.state}
            </p>
            {property.reference_code && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {pt ? "Código" : "Ref."}: {property.reference_code}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(property.reference_code!);
                    toast({ title: pt ? "Código copiado!" : "Code copied!" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {pt ? "Copiar" : "Copy"}
                </Button>
              </div>
            )}
            <p className="mt-3 text-3xl font-bold text-primary">{formatPrice(property.price, property.listing_type)}</p>
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-6 rounded-lg border bg-card p-4">
            {property.bedrooms != null && property.bedrooms > 0 && (
              <div className="flex items-center gap-2 text-sm"><Bed className="h-5 w-5 text-muted-foreground" /> {property.bedrooms} {t.property.bedrooms}</div>
            )}
            {property.suites != null && property.suites > 0 && (
              <div className="flex items-center gap-2 text-sm"><Bed className="h-5 w-5 text-muted-foreground" /> {property.suites} {pt ? "Suítes" : "Suites"}</div>
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
          {property.video_url && (
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Video className="h-5 w-5" /> {pt ? "Vídeo" : "Video"}
              </h2>
              <div className="mt-2 aspect-video overflow-hidden rounded-lg">
                <iframe
                  src={getEmbedUrl(property.video_url)}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          )}

          {/* Map */}
          {mapCenter && (
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" /> {pt ? "Localização" : "Location"}
              </h2>
              <div className="mt-2 h-64 rounded-lg overflow-hidden border">
                <PropertyMap
                  properties={[property as unknown as MapProperty]}
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={15}
                />
              </div>
              {propertyBoundary && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {pt
                    ? "A área destacada em azul indica os limites aproximados da propriedade."
                    : "The blue highlighted area shows the approximate property boundaries."}
                </p>
              )}
              <a
                href={`https://www.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <MapPin className="h-3 w-3" /> {pt ? "Abrir no Google Maps" : "Open in Google Maps"}
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Broker(s) Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                {brokerEntries.length > 1
                  ? (pt ? "Corretores deste imóvel" : "Brokers for this listing")
                  : (pt ? "Corretor responsável" : "Listing agent")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {brokerEntries.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {pt
                    ? "Este imóvel é anunciado em parceria. Fale com qualquer um dos corretores abaixo."
                    : "This listing is shared in partnership. Contact any of the brokers below."}
                </p>
              )}
              {brokerEntries.map((e) => (
                <BrokerCard
                  key={e.profile.user_id}
                  profile={e.profile}
                  propertyTitle={property.title}
                  pt={pt}
                  tagline={e.tagline}
                  price={e.price}
                  highlight={e.highlight}
                />
              ))}
              {brokerEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">{pt ? "Informações do corretor não disponíveis." : "Broker info not available."}</p>

              )}
            </CardContent>
          </Card>

          {/* Contact Form */}
          <div id="contato" className="scroll-mt-24">
            <ContactForm propertyId={property.id} />
          </div>

        </div>
      </div>
    </div>
  </>
  );
};

/** Skeleton loader for the property detail page (gallery + data). */
const PropertyDetailSkeleton = () => (
  <div className="container py-8">
    <Skeleton className="mb-6 h-4 w-24" />
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="space-y-2">
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-24 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

export default PropertyDetail;
