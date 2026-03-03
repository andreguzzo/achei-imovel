import { Link } from "react-router-dom";
import { Bed, Bath, Car, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & {
  property_images?: Tables<"property_images">[];
};

const formatPrice = (price: number, listingType: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  return listingType === "rent" ? `${formatted}/mês` : formatted;
};

const typeLabels: Record<string, Record<string, string>> = {
  "pt-BR": { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Comercial" },
  en: { apartment: "Apartment", house: "House", land: "Land", commercial: "Commercial" },
};

const PropertyCard = ({ property }: { property: Property }) => {
  const { locale } = useLanguage();
  const imageUrl = property.property_images?.[0]?.url;
  const label = typeLabels[locale]?.[property.property_type] ?? property.property_type;

  return (
    <Link
      to={`/imovel/${property.id}`}
      className="group overflow-hidden rounded-xl border bg-card shadow-card transition-shadow hover:shadow-elevated"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={property.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Sem foto</div>
        )}
        <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">{label}</Badge>
        {property.listing_type === "rent" && (
          <Badge variant="secondary" className="absolute right-3 top-3">Aluguel</Badge>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-lg font-bold text-primary">{formatPrice(property.price, property.listing_type)}</p>
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{property.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {property.neighborhood ? `${property.neighborhood}, ` : ""}{property.city} - {property.state}
        </p>
        <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
          {property.bedrooms != null && property.bedrooms > 0 && (
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>
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
