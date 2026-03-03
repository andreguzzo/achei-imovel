import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import PropertyCard from "@/components/PropertyCard";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

const Search = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [propertyType, setPropertyType] = useState(searchParams.get("tipo_imovel") ?? "all");
  const [listingType, setListingType] = useState(searchParams.get("tipo") === "alugar" ? "rent" : searchParams.get("tipo") === "comprar" ? "sale" : "all");
  const [minPrice, setMinPrice] = useState(searchParams.get("preco_min") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("preco_max") ?? "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("quartos") ?? "");

  const fetchProperties = async () => {
    setLoading(true);
    let q = supabase
      .from("properties")
      .select("*, property_images(*)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (query.trim()) {
      q = q.or(`city.ilike.%${query.trim()}%,neighborhood.ilike.%${query.trim()}%,title.ilike.%${query.trim()}%,state.ilike.%${query.trim()}%,address.ilike.%${query.trim()}%`);
    }
    if (propertyType !== "all") q = q.eq("property_type", propertyType as "apartment" | "house" | "land" | "commercial");
    if (listingType !== "all") q = q.eq("listing_type", listingType as "sale" | "rent");
    if (minPrice) q = q.gte("price", Number(minPrice));
    if (maxPrice) q = q.lte("price", Number(maxPrice));
    if (bedrooms) q = q.gte("bedrooms", Number(bedrooms));

    const { data } = await q.limit(50);
    setProperties((data as PropertyWithImages[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (listingType !== "all") params.set("tipo", listingType === "rent" ? "alugar" : "comprar");
    setSearchParams(params);
    fetchProperties();
  };

  return (
    <div className="container py-8">
      {/* Search bar + filters toggle */}
      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3 shadow-sm">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.hero.searchPlaceholder}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="submit">{t.hero.searchButton}</Button>
        <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? <X className="mr-1 h-4 w-4" /> : <SlidersHorizontal className="mr-1 h-4 w-4" />}
          Filtros
        </Button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="mt-4 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.filters.type}</label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="apartment">{t.filters.apartment}</SelectItem>
                <SelectItem value="house">{t.filters.house}</SelectItem>
                <SelectItem value="land">{t.filters.land}</SelectItem>
                <SelectItem value="commercial">{t.filters.commercial}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Comprar / Alugar</label>
            <Select value={listingType} onValueChange={setListingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sale">{t.nav.buy}</SelectItem>
                <SelectItem value="rent">{t.nav.rent}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.filters.minPrice}</label>
            <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.filters.maxPrice}</label>
            <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.filters.bedrooms}</label>
            <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="0+" />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 md:col-span-5">
            <Button onClick={() => { fetchProperties(); }} size="sm">{t.filters.apply}</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPropertyType("all");
                setListingType("all");
                setMinPrice("");
                setMaxPrice("");
                setBedrooms("");
              }}
            >
              {t.filters.clear}
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="mt-6">
        <p className="mb-4 text-sm text-muted-foreground">
          {loading ? t.common.loading : `${properties.length} ${t.filters.results}`}
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : properties.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium text-foreground">Nenhum imóvel encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Tente ajustar seus filtros de busca</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
