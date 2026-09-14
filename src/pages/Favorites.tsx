import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/PropertyCard";
import { PropertyCardSkeletonGrid } from "@/components/PropertyCardSkeleton";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

const Favorites = () => {
  const { t, locale } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { favoriteIds, isFavorited, toggle, loading: favLoading } = useFavorites();
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pt = locale === "pt-BR";

  useEffect(() => {
    if (favLoading) return;
    const ids = Array.from(favoriteIds);
    if (ids.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    const fetchProps = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("properties")
        .select("*, property_images(*)")
        .in("id", ids);
      setProperties((data as PropertyWithImages[]) ?? []);
      setLoading(false);
    };
    fetchProps();
  }, [favoriteIds, favLoading]);

  if (favLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">{t.nav.favorites}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {properties.length} {pt ? "imóveis salvos" : "saved properties"}
        {!user && <span className="ml-1 text-xs">({pt ? "salvos localmente" : "saved locally"})</span>}
      </p>

      {properties.length === 0 ? (
        <div className="py-20 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">{pt ? "Nenhum favorito ainda" : "No favorites yet"}</p>
          <Link to="/busca"><Button variant="link">{pt ? "Explorar imóveis" : "Browse properties"}</Button></Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              favorited={isFavorited(p.id)}
              onToggleFavorite={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
