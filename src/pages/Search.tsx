import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { Loader2, Map as MapIcon, List, ArrowDownUp, X, Crosshair, SearchX, AlertCircle } from "lucide-react";
import { PropertyCardSkeletonGrid } from "@/components/PropertyCardSkeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PropertyCard from "@/components/PropertyCard";
import PropertyMap from "@/components/PropertyMap";
import SearchFilters, {
  type SearchFiltersState,
  defaultFilters,
} from "@/components/SearchFilters";
import { dedupeByGroup, type GroupInfo } from "@/lib/partnerships";
import Seo from "@/components/Seo";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

type MapBounds = { north: number; south: number; east: number; west: number };

const PAGE_SIZE = 24;

// URL param helpers
const filtersToParams = (f: SearchFiltersState, showMap: boolean): URLSearchParams => {
  const p = new URLSearchParams();
  if (f.query) p.set("q", f.query);
  if (f.listingType !== "all") p.set("tipo", f.listingType === "rent" ? "alugar" : "comprar");
  if (f.propertyTypes.length) p.set("tipo_imovel", f.propertyTypes.join(","));
  if (f.minPrice) p.set("preco_min", f.minPrice);
  if (f.maxPrice) p.set("preco_max", f.maxPrice);
  if (f.bedrooms) p.set("quartos", f.bedrooms);
  if (f.suites) p.set("suites", f.suites);
  if (f.bathrooms) p.set("banheiros", f.bathrooms);
  if (f.minArea) p.set("area_min", f.minArea);
  if (f.maxArea) p.set("area_max", f.maxArea);
  if (f.parkingSpots) p.set("vagas", f.parkingSpots);
  if (f.maxCondo) p.set("condo_max", f.maxCondo);
  if (f.keywords.length) p.set("keywords", f.keywords.join(","));
  if (f.sortBy !== "newest") p.set("ordenar", f.sortBy);
  if (showMap) p.set("mapa", "true");
  return p;
};

const paramsToFilters = (sp: URLSearchParams): SearchFiltersState => ({
  query: sp.get("q") ?? "",
  listingType:
    sp.get("tipo") === "alugar" ? "rent" : sp.get("tipo") === "comprar" ? "sale" : "all",
  propertyTypes: sp.get("tipo_imovel")?.split(",").filter(Boolean) ?? [],
  minPrice: sp.get("preco_min") ?? "",
  maxPrice: sp.get("preco_max") ?? "",
  bedrooms: sp.get("quartos") ?? "",
  suites: sp.get("suites") ?? "",
  bathrooms: sp.get("banheiros") ?? "",
  minArea: sp.get("area_min") ?? "",
  maxArea: sp.get("area_max") ?? "",
  parkingSpots: sp.get("vagas") ?? "",
  maxCondo: sp.get("condo_max") ?? "",
  keywords: sp.get("keywords")?.split(",").filter(Boolean) ?? [],
  sortBy: (sp.get("ordenar") as SearchFiltersState["sortBy"]) ?? "newest",
});

const Search = () => {
  const { t, locale } = useLanguage();
  const pt = locale === "pt-BR";
  const { isFavorited, toggle: toggleFav } = useFavorites();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [groupInfo, setGroupInfo] = useState<Map<string, GroupInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [showMap, setShowMap] = useState(searchParams.get("mapa") !== "false");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [filters, setFilters] = useState<SearchFiltersState>(() => paramsToFilters(searchParams));
  const [visibleBounds, setVisibleBounds] = useState<MapBounds | null>(null);
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialFetchDone = useRef(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchProperties = useCallback(
    async (f: SearchFiltersState, pageLimit: number, bounds: MapBounds | null) => {
      if (pageLimit > PAGE_SIZE) setLoadingMore(true);
      else setLoading(true);
      setError(false);

      // Build sorting
      let orderCol = "created_at";
      let orderAsc = false;
      if (f.sortBy === "price_asc") { orderCol = "price"; orderAsc = true; }
      else if (f.sortBy === "price_desc") { orderCol = "price"; orderAsc = false; }
      else if (f.sortBy === "area_desc") { orderCol = "area"; orderAsc = false; }

      let q = supabase
        .from("properties")
        .select("*, property_images(*)")
        .eq("status", "active")
        .order(orderCol, { ascending: orderAsc });

      if (f.query.trim()) {
        // Sanitize user input for PostgREST .or() filter
        const sanitized = f.query.trim().replace(/[%_(),.]/g, "");
        if (sanitized) {
          q = q.or(
            `city.ilike.%${sanitized}%,neighborhood.ilike.%${sanitized}%,title.ilike.%${sanitized}%,state.ilike.%${sanitized}%,address.ilike.%${sanitized}%`
          );
        }
      }
      if (f.propertyTypes.length === 1) {
        q = q.eq("property_type", f.propertyTypes[0] as never);
      } else if (f.propertyTypes.length > 1) {
        q = q.in("property_type", f.propertyTypes as never[]);
      }
      if (f.listingType !== "all") q = q.eq("listing_type", f.listingType as never);
      if (f.minPrice) q = q.gte("price", Number(f.minPrice));
      if (f.maxPrice) q = q.lte("price", Number(f.maxPrice));
      if (f.bedrooms) q = q.gte("bedrooms", Number(f.bedrooms));
      if (f.suites) q = q.gte("suites", Number(f.suites));
      if (f.bathrooms) q = q.gte("bathrooms", Number(f.bathrooms));
      if (f.minArea) q = q.gte("area", Number(f.minArea));
      if (f.maxArea) q = q.lte("area", Number(f.maxArea));
      if (f.parkingSpots) q = q.gte("parking_spots", Number(f.parkingSpots));
      if (f.maxCondo) q = q.lte("condo_fee", Number(f.maxCondo));
      if (f.keywords.length) {
        q = q.overlaps("features", f.keywords);
      }
      if (bounds) {
        q = q
          .gte("latitude", bounds.south)
          .lte("latitude", bounds.north)
          .gte("longitude", bounds.west)
          .lte("longitude", bounds.east);
      }

      const { data, error: fetchError } = await q.range(0, pageLimit - 1);
      if (fetchError) {
        console.warn("Search error:", fetchError.message);
        setError(true);
        setProperties([]);
        setGroupInfo(new Map());
        setHasMore(false);
      } else {
        const rows = (data as PropertyWithImages[]) ?? [];
        const { items, groupInfo } = await dedupeByGroup(rows);
        setProperties(items);
        setGroupInfo(groupInfo);
        setHasMore(rows.length >= pageLimit);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    []
  );

  const retrySearch = useCallback(() => {
    fetchProperties(filters, limit, areaBounds);
  }, [fetchProperties, filters, limit, areaBounds]);

  // Auto-apply filters with debounce (also handles initial fetch)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const delay = initialFetchDone.current ? 300 : 0;
    debounceRef.current = setTimeout(() => {
      setSearchParams(filtersToParams(filters, showMap), { replace: true });
      fetchProperties(filters, limit, areaBounds);
      initialFetchDone.current = true;
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [filters, showMap, limit, areaBounds, fetchProperties, setSearchParams]);

  // Reset pagination whenever filters or the searched area change
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [filters, areaBounds]);

  const toggleMap = () => {
    setShowMap((v) => {
      if (v) setAreaBounds(null);
      return !v;
    });
  };

  const handleSelect = useCallback((id: string) => {
    setSelectedPropertyId(id);
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const boundsChanged =
    visibleBounds &&
    (!areaBounds ||
      Math.abs(visibleBounds.north - areaBounds.north) > 0.0005 ||
      Math.abs(visibleBounds.south - areaBounds.south) > 0.0005 ||
      Math.abs(visibleBounds.east - areaBounds.east) > 0.0005 ||
      Math.abs(visibleBounds.west - areaBounds.west) > 0.0005);

  const countLabel = loading
    ? t.common.loading
    : areaBounds
    ? `${properties.length} ${pt ? "imóveis nesta área do mapa" : "properties in this map area"}`
    : `${properties.length} ${t.filters.results}`;

  const listingLabel = useMemo(() => {
    if (filters.listingType === "sale") return pt ? "Imóveis à venda" : "Properties for sale";
    if (filters.listingType === "rent") return pt ? "Imóveis para alugar" : "Properties for rent";
    return pt ? "Imóveis" : "Properties";
  }, [filters.listingType, pt]);

  const typeLabel = useMemo(() => {
    if (filters.propertyTypes.length === 0) return "";
    const labels: Record<string, string> = {
      apartment: pt ? "Apartamentos" : "Apartments",
      house: pt ? "Casas" : "Houses",
      land: pt ? "Terrenos" : "Land",
      commercial: pt ? "Comerciais" : "Commercial",
    };
    return filters.propertyTypes.map((t) => labels[t] || t).join(", ");
  }, [filters.propertyTypes, pt]);

  const searchTitle = filters.query.trim()
    ? `${listingLabel} em ${filters.query.trim()}${typeLabel ? ` - ${typeLabel}` : ""} | Abitzo`
    : typeLabel
      ? `${typeLabel} ${pt ? "no Brasil" : "in Brazil"} | Abitzo`
      : `${listingLabel} ${pt ? "no Brasil" : "in Brazil"} | Abitzo`;

  const searchDescription = filters.query.trim()
    ? pt
      ? `Encontre ${typeLabel || listingLabel.toLowerCase()} em ${filters.query.trim()} no Abitzo. Filtre por preço, quartos, área e mais.`
      : `Find ${typeLabel || listingLabel.toLowerCase()} in ${filters.query.trim()} on Abitzo. Filter by price, bedrooms, area and more.`
    : pt
      ? `Busque ${typeLabel || listingLabel.toLowerCase()} em todo o Brasil no Abitzo. Mapa, filtros e corretores verificados.`
      : `Search ${typeLabel || listingLabel.toLowerCase()} across Brazil on Abitzo. Map, filters and verified brokers.`;

  const sortOptions = [
    { value: "newest", label: t.filters.sortNewest },
    { value: "price_asc", label: t.filters.sortPriceAsc },
    { value: "price_desc", label: t.filters.sortPriceDesc },
    { value: "area_desc", label: t.filters.sortArea },
  ] as const;

  const resultsHeader = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{countLabel}</p>
      <div className="flex items-center gap-2">
        {areaBounds && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setAreaBounds(null)}>
            <X className="h-3.5 w-3.5" />
            {pt ? "Limpar área" : "Clear area"}
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowDownUp className="h-4 w-4" />
              {t.filters.sortBy}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 z-[1000]">
            <div className="space-y-1">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters((f) => ({ ...f, sortBy: opt.value }))}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    filters.sortBy === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={toggleMap} className="gap-1.5">
          {showMap ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          {showMap ? (pt ? "Fechar mapa" : "Close map") : t.filters.map}
        </Button>
      </div>
    </div>
  );

  const loadMoreButton = hasMore && (
    <div className="mt-6 flex justify-center">
      <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)} disabled={loadingMore}>
        {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {pt ? "Carregar mais imóveis" : "Load more properties"}
      </Button>
    </div>
  );

  return (
    <>
      <Seo
        title={searchTitle}
        description={searchDescription}
        canonical={`/busca?${searchParams.toString()}`}
      />
      <div className={showMap ? "flex h-[calc(100vh-64px)] flex-col" : "container py-8"}>
      {/* Filter bar */}
      <div className={showMap ? "border-b bg-card px-4 py-3" : ""}>
        <SearchFilters filters={filters} onChange={setFilters} />
      </div>

      {showMap ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-full overflow-y-auto border-r bg-background sm:w-96 lg:w-[440px]">
            <div className="p-4">
              {resultsHeader}
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : properties.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-lg font-medium text-foreground">{t.filters.noResults}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.filters.noResultsHint}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {properties.map((p) => (
                      <div
                        key={p.id}
                        ref={(el) => { cardRefs.current[p.id] = el; }}
                        className={`rounded-xl transition-shadow ${p.id === selectedPropertyId ? "ring-2 ring-primary shadow-elevated" : ""}`}
                        onMouseEnter={() => setSelectedPropertyId(p.id)}
                        onMouseLeave={() => setSelectedPropertyId(undefined)}
                      >
                        <PropertyCard
                          property={p}
                          favorited={isFavorited(p.id)}
                          onToggleFavorite={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(p.id); }}
                          brokerCount={groupInfo.get(p.id)?.brokerCount}
                          priceFrom={groupInfo.get(p.id)?.priceFrom}
                          priceTo={groupInfo.get(p.id)?.priceTo}
                        />
                      </div>
                    ))}
                  </div>
                  {loadMoreButton}
                </>
              )}
            </div>
          </div>
          <div className="relative flex-1 min-h-[300px]">
            <PropertyMap
              properties={properties}
              selectedId={selectedPropertyId}
              onSelect={handleSelect}
              onBoundsChange={setVisibleBounds}
              autoFit={!areaBounds}
            />
            {boundsChanged && (
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                <Button
                  size="sm"
                  className="pointer-events-auto gap-1.5 shadow-lg"
                  onClick={() => visibleBounds && setAreaBounds(visibleBounds)}
                >
                  <Crosshair className="h-4 w-4" />
                  {pt ? "Buscar nesta área" : "Search this area"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {resultsHeader}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-lg font-medium text-foreground">{t.filters.noResults}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.filters.noResultsHint}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {properties.map((p) => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    favorited={isFavorited(p.id)}
                    onToggleFavorite={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(p.id); }}
                    brokerCount={groupInfo.get(p.id)?.brokerCount}
                    priceFrom={groupInfo.get(p.id)?.priceFrom}
                    priceTo={groupInfo.get(p.id)?.priceTo}
                  />
                ))}
              </div>
              {loadMoreButton}
            </>
          )}
        </div>
      )}
    </div>
  </>
  );
};

export default Search;
