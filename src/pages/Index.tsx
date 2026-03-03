import { Search, MapPin, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import PropertyCard from "@/components/PropertyCard";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

const HERO_IMAGES = [
  "/images/interiors/hero-living.jpg",
  "/images/interiors/living-room.jpg",
  "/images/interiors/kitchen.jpg",
  "/images/interiors/cta-pool.jpg",
];

const AMBIENTES = [
  { name: "Cozinhas", label: "kitchen", image: "/images/interiors/kitchen.jpg" },
  { name: "Salas de estar", label: "living", image: "/images/interiors/living-room.jpg" },
  { name: "Banheiros", label: "bathroom", image: "/images/interiors/bathroom.jpg" },
  { name: "Quartos", label: "bedroom", image: "/images/interiors/bedroom.jpg" },
  { name: "Áreas externas", label: "backyard", image: "/images/interiors/backyard.jpg" },
  { name: "Salas de jantar", label: "dining", image: "/images/interiors/dining.jpg" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const Index = () => {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState<PropertyWithImages[]>([]);
  const [recent, setRecent] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);

  // Rotate hero image
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [featuredRes, recentRes] = await Promise.all([
        supabase.from("properties").select("*, property_images(*)").eq("status", "active").order("view_count", { ascending: false, nullsFirst: false }).limit(6),
        supabase.from("properties").select("*, property_images(*)").eq("status", "active").order("created_at", { ascending: false }).limit(6),
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
      {/* Hero */}
      <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt="Interior"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === heroIdx ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/65 via-foreground/45 to-foreground/80" />
        </div>

        <div className="container relative z-10 text-center">
          <motion.div
            initial="hidden" animate="visible"
            className="mx-auto max-w-3xl"
          >
            <motion.h1
              custom={0} variants={fadeUp}
              className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-lg"
            >
              {t.hero.title}
            </motion.h1>
            <motion.p custom={1} variants={fadeUp} className="mx-auto mt-4 max-w-xl text-lg text-white/85 drop-shadow">
              {t.hero.subtitle}
            </motion.p>

            <motion.form
              custom={2} variants={fadeUp}
              onSubmit={handleSearch}
              className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-border/50"
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
              <Button type="submit" size="lg" className="shrink-0 rounded-xl px-6 shadow-md">
                {t.hero.searchButton}
              </Button>
            </motion.form>

            <motion.div custom={3} variants={fadeUp} className="mt-6 flex flex-wrap justify-center gap-3">
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
                  className="rounded-full bg-white/15 text-white backdrop-blur-md border border-white/25 hover:bg-white/25 transition-all"
                  onClick={() => navigate(`/busca?tipo_imovel=${item.type}`)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full bg-white/15 text-white backdrop-blur-md border border-white/25 hover:bg-white/25 gap-1.5 transition-all"
                onClick={() => navigate("/busca?mapa=true")}
              >
                <MapPin className="h-3.5 w-3.5" />
                {locale === "pt-BR" ? "Buscar no mapa" : "Search on map"}
              </Button>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* Inspiração por ambientes */}
      <section className="container py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {locale === "pt-BR" ? "Inspire-se por ambientes" : "Get inspired by spaces"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {locale === "pt-BR" ? "Descubra espaços que combinam conforto e design" : "Discover spaces that combine comfort and design"}
          </p>
        </motion.div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AMBIENTES.map((amb, i) => (
            <motion.div
              key={amb.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <Link
                to={`/busca?keywords=${encodeURIComponent(amb.label)}`}
                className="group relative h-48 overflow-hidden rounded-2xl block"
              >
                <img
                  src={amb.image}
                  alt={amb.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <h3 className="font-display text-xl font-bold text-white drop-shadow">{amb.name}</h3>
                  <ArrowRight className="h-5 w-5 text-white opacity-0 translate-x-[-4px] transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container py-16 border-t border-border">
        <div className="flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-2xl font-semibold text-foreground">{t.common.featured}</h2>
            <p className="mt-1 text-muted-foreground">{t.common.mostViewed}</p>
          </motion.div>
          <Link to="/busca">
            <Button variant="outline" size="sm" className="gap-1.5">
              {t.common.seeMore} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {locale === "pt-BR" ? "Nenhum imóvel disponível no momento." : "No properties available at the moment."}
          </p>
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
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-foreground">{t.common.recentlyAdded}</h2>
            <Link to="/busca">
              <Button variant="outline" size="sm" className="gap-1.5">
                {t.common.seeMore} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/interiors/cta-pool.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-primary/85 backdrop-blur-sm" />
        </div>
        <div className="container relative z-10 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
              {locale === "pt-BR" ? "Quer anunciar seu imóvel?" : "Want to list your property?"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">
              {locale === "pt-BR"
                ? "Cadastre seu imóvel gratuitamente e alcance milhares de compradores interessados."
                : "List your property for free and reach thousands of interested buyers."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/anunciar">
                <Button size="lg" className="rounded-xl bg-white text-primary hover:bg-white/90 font-semibold px-8 shadow-lg">
                  {locale === "pt-BR" ? "Anunciar grátis" : "List for free"}
                </Button>
              </Link>
              <Link to="/busca?mapa=true">
                <Button size="lg" variant="outline" className="rounded-xl border-white/30 text-white hover:bg-white/10 px-8 gap-2">
                  <MapPin className="h-5 w-5" />
                  {locale === "pt-BR" ? "Explorar no mapa" : "Explore on map"}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Index;
