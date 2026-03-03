import { Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";

const Index = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="container relative z-10 text-center">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {t.hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {t.hero.subtitle}
          </p>

          {/* Search Bar */}
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

          {/* Quick filters */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {[t.filters.apartment, t.filters.house, t.filters.land, t.filters.commercial].map((label) => (
              <Button key={label} variant="secondary" size="sm" className="rounded-full">
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Sections placeholders */}
      <section className="container py-16">
        <h2 className="font-display text-2xl font-semibold text-foreground">{t.common.featured}</h2>
        <p className="mt-1 text-muted-foreground">{t.hero.subtitle}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="group cursor-pointer overflow-hidden rounded-xl border bg-card shadow-card transition-shadow hover:shadow-elevated"
            >
              <div className="aspect-[4/3] bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="flex gap-4 pt-2">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="h-3 w-12 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default Index;
