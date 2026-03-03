import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import PropertyCard from "@/components/PropertyCard";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

const Index = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<PropertyWithImages[]>([]);
  const [recent, setRecent] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [featuredRes, recentRes] = await Promise.all([
        supabase
          .from("properties")
          .select("*, property_images(*)")
          .eq("status", "active")
          .order("view_count", { ascending: false, nullsFirst: false })
          .limit(6),
        supabase
          .from("properties")
          .select("*, property_images(*)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      setFeatured((featuredRes.data as PropertyWithImages[]) ?? []);
      setRecent((recentRes.data as PropertyWithImages[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/busca?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="container relative z-10 text-center">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {t.hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {t.hero.subtitle}
          </p>

          <form
            onSubmit={handleSearch}
            className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-xl border bg-card p-2 shadow-elevated"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.hero.searchPlaceholder}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" size="lg" className="shrink-0 rounded-lg px-6">
              {t.hero.searchButton}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {[
              { label: t.filters.apartment, type: "apartment" },
              { label: t.filters.house, type: "house" },
              { label: t.filters.land, type: "land" },
              { label: t.filters.commercial, type: "commercial" },
            ].map((item) => (
              <Button
                key={item.type}
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/busca?tipo_imovel=${item.type}`)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-semibold text-foreground">{t.common.featured}</h2>
        <p className="mt-1 text-muted-foreground">{t.common.mostViewed}</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : featured.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nenhum imóvel disponível no momento.</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </section>

      {/* Recently added */}
      {recent.length > 0 && (
        <section className="container pb-16">
          <h2 className="font-display text-2xl font-semibold text-foreground">{t.common.recentlyAdded}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
};

export default Index;
