import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bed, Bath, Car, Maximize, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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

const PropertyCard = ({ property, initialFavorited }: { property: Property; initialFavorited?: boolean }) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const [toggling, setToggling] = useState(false);
  const imageUrl = property.property_images?.[0]?.url;
  const label = typeLabels[locale]?.[property.property_type] ?? property.property_type;

  useEffect(() => {
    if (!user || initialFavorited !== undefined) return;
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", property.id)
      .maybeSingle()
      .then(({ data }) => setFavorited(!!data));
  }, [user, property.id, initialFavorited]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: locale === "pt-BR" ? "Faça login para favoritar" : "Log in to save favorites", variant: "destructive" });
      return;
    }
    setToggling(true);
    if (favorited) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", property.id);
      setFavorited(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, property_id: property.id });
      setFavorited(true);
    }
    setToggling(false);
  };

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
        <button
          onClick={toggleFavorite}
          disabled={toggling}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 backdrop-blur transition-colors hover:bg-card"
          aria-label="Favoritar"
        >
          <Heart className={`h-4 w-4 transition-colors ${favorited ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </button>
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
