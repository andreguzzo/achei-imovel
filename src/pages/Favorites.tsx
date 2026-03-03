import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/PropertyCard";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

const Favorites = () => {
  const { t, locale } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const fetchFavorites = async () => {
      setLoading(true);
      const { data: favs } = await supabase
        .from("favorites")
        .select("property_id")
        .eq("user_id", user.id);

      if (!favs || favs.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      const ids = favs.map((f) => f.property_id);
      const { data } = await supabase
        .from("properties")
        .select("*, property_images(*)")
        .in("id", ids);

      setProperties((data as PropertyWithImages[]) ?? []);
      setLoading(false);
    };
    fetchFavorites();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">{locale === "pt-BR" ? "Faça login para ver seus favoritos" : "Log in to see your favorites"}</p>
        <Link to="/login"><Button className="mt-4">{t.nav.login}</Button></Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">{t.nav.favorites}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {properties.length} {locale === "pt-BR" ? "imóveis salvos" : "saved properties"}
      </p>

      {properties.length === 0 ? (
        <div className="py-20 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">{locale === "pt-BR" ? "Nenhum favorito ainda" : "No favorites yet"}</p>
          <Link to="/busca"><Button variant="link">{locale === "pt-BR" ? "Explorar imóveis" : "Browse properties"}</Button></Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} initialFavorited />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
