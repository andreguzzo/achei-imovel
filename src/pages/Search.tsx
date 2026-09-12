import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { Loader2 } from "lucide-react";
import PropertyCard from "@/components/PropertyCard";
import PropertyMap from "@/components/PropertyMap";
import SearchFilters, {
  type SearchFiltersState,
  defaultFilters,
} from "@/components/SearchFilters";
import { dedupeByGroup, type GroupInfo } from "@/lib/partnerships";
import type { Tables } from "@/integrations/supabase/types";


type PropertyWithImages = Tables<"properties"> & {
  property_images: Tables<"property_images">[];
};

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
  const { t } = useLanguage();
  const { isFavorited, toggle: toggleFav } = useFavorites();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [groupInfo, setGroupInfo] = useState<Map<string, GroupInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  const [showMap, setShowMap] = useState(searchParams.get("mapa") !== "false");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [filters, setFilters] = useState<SearchFiltersState>(() => paramsToFilters(searchParams));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialFetchDone = useRef(false);

  const fetchProperties = useCallback(async (f: SearchFiltersState) => {
    setLoading(true);

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
      q = q.eq("property_type", f.propertyTypes[0] as any);
    } else if (f.propertyTypes.length > 1) {
      q = q.in("property_type", f.propertyTypes as any);
    }
    if (f.listingType !== "all") q = q.eq("listing_type", f.listingType as any);
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

    const { data } = await q.limit(100);
    const rows = (data as PropertyWithImages[]) ?? [];
    const { items, groupInfo } = await dedupeByGroup(rows);
    setProperties(items);
    setGroupInfo(groupInfo);
    setLoading(false);
  }, []);


  // Auto-apply filters with debounce (also handles initial fetch)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const delay = initialFetchDone.current ? 300 : 0;
    debounceRef.current = setTimeout(() => {
      setSearchParams(filtersToParams(filters, showMap), { replace: true });
      fetchProperties(filters);
      initialFetchDone.current = true;
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [filters, showMap, fetchProperties, setSearchParams]);

  const toggleMap = () => setShowMap((v) => !v);

  return (
    <div className={showMap ? "flex h-[calc(100vh-64px)] flex-col" : "container py-8"}>
      {/* Filter bar */}
      <div className={showMap ? "border-b bg-card px-4 py-3" : ""}>
        <SearchFilters filters={filters} onChange={setFilters} showMap={showMap} onToggleMap={toggleMap} />
      </div>

      {showMap ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-full overflow-y-auto border-r bg-background sm:w-96 lg:w-[440px]">
            <div className="p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {loading ? t.common.loading : `${properties.length} ${t.filters.results}`}
              </p>
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : properties.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-lg font-medium text-foreground">{t.filters.noResults}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {properties.map((p) => (
                    <div
                      key={p.id}
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
              )}
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <PropertyMap properties={properties} selectedId={selectedPropertyId} onSelect={setSelectedPropertyId} />
          </div>
        </div>
      ) : (
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
              <p className="text-lg font-medium text-foreground">{t.filters.noResults}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.filters.noResultsHint}</p>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
