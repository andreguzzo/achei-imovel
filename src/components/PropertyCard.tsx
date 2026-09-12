import { Link } from "react-router-dom";
import { Bed, Bath, Car, Maximize, Heart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & {
  property_images?: Tables<"property_images">[];
};

const currency = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

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
  const pt = locale === "pt-BR";
  const imageUrl = property.property_images?.[0]?.url;
  const label = typeLabels[locale]?.[property.property_type] ?? property.property_type;
  const hasRange =
    priceFrom != null && priceTo != null && priceTo > priceFrom;


  return (
    <Link
      to={`/imovel/${property.id}`}
      className="group overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/20 block"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Sem foto</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <Badge className="absolute left-3 top-3 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[11px] shadow-sm">{label}</Badge>
        {property.listing_type === "rent" && (
          <Badge variant="secondary" className="absolute right-12 top-3 text-[11px] backdrop-blur-sm">Aluguel</Badge>
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
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-lg font-bold text-primary">{formatPrice(property.price, property.listing_type)}</p>
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{property.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {property.neighborhood ? `${property.neighborhood}, ` : ""}{property.city} - {property.state}
        </p>
        <div className="flex gap-4 pt-2 text-xs text-muted-foreground border-t border-border/50 mt-2">
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
          {property.area != null && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {property.area} m²</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;
