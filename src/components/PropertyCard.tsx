import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bed, Bath, Car, Maximize, Heart, Users, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & {
  property_images?: Tables<"property_images">[];
};

const currency = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);

const formatPrice = (price: number, listingType: string) => {
  const formatted = currency(price);
  return listingType === "rent" ? `${formatted}/mês` : formatted;
};

const typeLabels: Record<string, Record<string, string>> = {
  "pt-BR": { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Comercial" },
  en: { apartment: "Apartment", house: "House", land: "Land", commercial: "Commercial" },
};

interface PropertyCardProps {
  property: Property;
  favorited?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  /** Number of brokers advertising this same property (consolidated listing) */
  brokerCount?: number;
  priceFrom?: number;
  priceTo?: number;
}

const PropertyCard = ({
  property,
  favorited = false,
  onToggleFavorite,
  brokerCount,
  priceFrom,
  priceTo,
}: PropertyCardProps) => {
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";
  const images = (property.property_images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [imgIdx, setImgIdx] = useState(0);
  const current = images[Math.min(imgIdx, Math.max(images.length - 1, 0))];
  const label = typeLabels[locale]?.[property.property_type] ?? property.property_type;
  const hasRange = priceFrom != null && priceTo != null && priceTo > priceFrom;

  const step = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    setImgIdx((i) => (i + dir + images.length) % images.length);
  };

  // "Apartamento para comprar com 60 m², 2 quartos, 1 suíte, 1 vaga"
  const summary = (() => {
    const action = property.listing_type === "rent"
      ? (pt ? "para alugar" : "for rent")
      : (pt ? "para comprar" : "for sale");
    const parts: string[] = [];
    if (property.area != null) parts.push(`${property.area} m²`);
    if (property.bedrooms) parts.push(`${property.bedrooms} ${pt ? (property.bedrooms > 1 ? "quartos" : "quarto") : property.bedrooms > 1 ? "bedrooms" : "bedroom"}`);
    if (property.suites) parts.push(`${property.suites} ${pt ? (property.suites > 1 ? "suítes" : "suíte") : property.suites > 1 ? "suites" : "suite"}`);
    if (property.bathrooms) parts.push(`${property.bathrooms} ${pt ? (property.bathrooms > 1 ? "banheiros" : "banheiro") : property.bathrooms > 1 ? "bathrooms" : "bathroom"}`);
    if (property.parking_spots) parts.push(`${property.parking_spots} ${pt ? (property.parking_spots > 1 ? "vagas" : "vaga") : property.parking_spots > 1 ? "parking spots" : "parking spot"}`);
    return `${label} ${action}${parts.length ? ` ${pt ? "com" : "with"} ${parts.join(", ")}` : ""}`;
  })();

  const fees: string[] = [];
  if (property.condo_fee) fees.push(`${pt ? "Cond." : "HOA"} ${currency(property.condo_fee)}`);
  if (property.iptu) fees.push(`IPTU ${currency(property.iptu)}`);

  return (
    <Link
      to={`/imovel/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/20"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {current ? (
          <ImageWithFallback
            src={current.url}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            width={640}
            height={480}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {pt ? "Sem foto" : "No photo"}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => step(e, -1)}
              aria-label={pt ? "Foto anterior" : "Previous photo"}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/85 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => step(e, 1)}
              aria-label={pt ? "Próxima foto" : "Next photo"}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/85 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.slice(0, 8).map((img, i) => (
                <span
                  key={img.id}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-card" : "bg-card/50"}`}
                />
              ))}
            </div>
          </>
        )}

        <Badge className="absolute left-3 top-3 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[11px] shadow-sm">{label}</Badge>
        {property.listing_type === "rent" && (
          <Badge variant="secondary" className="absolute right-12 top-3 text-[11px] backdrop-blur-sm">
            {pt ? "Aluguel" : "Rent"}
          </Badge>
        )}
        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-all hover:bg-card hover:scale-110 active:scale-95"
            aria-label="Favoritar"
          >
            <Heart className={`h-4 w-4 transition-colors ${favorited ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
          </button>
        )}
        <span
          className={`absolute top-12 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm [&>button]:h-8 [&>button]:w-8`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <ShareMenu
            url={`${window.location.origin}/imovel/${property.id}`}
            title={property.title}
            whatsappMessage={buildPropertyShareText({
              title: property.title,
              referenceCode: property.reference_code,
              priceText: formatPrice(property.price, property.listing_type),
              url: `${window.location.origin}/imovel/${property.id}`,
              pt,
            })}
            pt={pt}
            className="h-8 w-8"
            iconClassName="h-4 w-4"
          />
        </span>
        {brokerCount != null && brokerCount > 1 && (
          <Badge
            variant="secondary"
            className="absolute bottom-3 left-3 gap-1 text-[11px] backdrop-blur-sm"
          >
            <Users className="h-3 w-3" />
            {brokerCount} {pt ? "corretores" : "brokers"}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {property.reference_code && (
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {pt ? "Cód." : "Ref."} {property.reference_code}
          </p>
        )}
        <p className="line-clamp-2 text-xs text-muted-foreground">{summary}</p>
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
          {property.neighborhood ? `${property.neighborhood}, ` : ""}{property.city} - {property.state}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {property.address || (pt ? "Endereço não informado" : "Address not provided")}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground border-t border-border/50 mt-1">
          {property.area != null && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {property.area} m²</span>
          )}
          {property.bedrooms != null && property.bedrooms > 0 && (
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>
          )}
          {property.suites != null && property.suites > 0 && (
            <span className="flex items-center gap-1" title="Suítes"><Bed className="h-3.5 w-3.5" /> {property.suites}s</span>
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
          )}
          {property.parking_spots != null && property.parking_spots > 0 && (
            <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {property.parking_spots}</span>
          )}
        </div>

        <p className="mt-2 text-lg font-bold text-primary">
          {hasRange
            ? `${currency(priceFrom!)} – ${currency(priceTo!)}${property.listing_type === "rent" ? "/mês" : ""}`
            : formatPrice(property.price, property.listing_type)}
        </p>
        {fees.length > 0 && (
          <p className="text-xs text-muted-foreground">{fees.join(" • ")}</p>
        )}

        <Button
          type="button"
          className="mt-3 w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(`/imovel/${property.id}#contato`);
          }}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          {pt ? "Contatar" : "Contact"}
        </Button>
      </div>
    </Link>
  );
};

export default PropertyCard;
