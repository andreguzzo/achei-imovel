import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search as SearchIcon,
  ChevronDown,
  X,
  MapPin,
} from "lucide-react";

export interface SearchFiltersState {
  query: string;
  listingType: "all" | "sale" | "rent";
  propertyTypes: string[];
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  minArea: string;
  maxArea: string;
  parkingSpots: string;
  maxCondo: string;
  keywords: string[];
  sortBy: "newest" | "price_asc" | "price_desc" | "area_desc";
}

export const defaultFilters: SearchFiltersState = {
  query: "",
  listingType: "all",
  propertyTypes: [],
  minPrice: "",
  maxPrice: "",
  bedrooms: "",
  suites: "",
  bathrooms: "",
  minArea: "",
  maxArea: "",
  parkingSpots: "",
  maxCondo: "",
  keywords: [],
  sortBy: "newest",
};

const KEYWORD_SUGGESTIONS = [
  "elevador", "piscina", "academia", "churrasqueira", "portaria 24h",
  "playground", "salão de festas", "sauna", "varanda", "suíte",
  "ar condicionado", "jardim", "quadra", "coworking", "pet friendly",
  "vista mar", "mobiliado", "lavabo", "closet", "depósito",
];

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
}

const formatPrice = (value: string) => {
  if (!value) return "";
  const num = Number(value);
  if (num >= 1_000_000) return `R$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `R$${(num / 1_000).toFixed(0)}k`;
  return `R$${num}`;
};

// Stepped button selector for beds/baths/parking
const StepSelector = ({
  label,
  value,
  onChange,
  anyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  anyLabel: string;
}) => {
  const options = ["", "1", "2", "3", "4", "5"];
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`h-8 min-w-[40px] rounded-md border px-2 text-xs font-medium transition-colors ${
              value === opt
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent"
            }`}
          >
            {opt === "" ? anyLabel : `${opt}+`}
          </button>
        ))}
      </div>
    </div>
  );
};

const FilterButton = ({
  label,
  active,
  count,
  children,
}: {
  label: string;
  active?: boolean;
  count?: number;
  children: React.ReactNode;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={`gap-1 ${active ? "border-primary bg-primary/10 text-primary" : ""}`}
      >
        {label}
        {count ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {count}
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 z-[1000]">
      {children}
    </PopoverContent>
  </Popover>
);

export default function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const { t, locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [locations, setLocations] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  const update = useCallback(
    (patch: Partial<SearchFiltersState>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

  // Load available cities / neighborhoods for autocomplete
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("properties")
        .select("city, state, neighborhood")
        .eq("status", "active")
        .limit(1000);
      if (!active || !data) return;
      const set = new Set<string>();
      data.forEach((row) => {
        if (row.city) set.add(`${row.city} - ${row.state}`);
        if (row.neighborhood) set.add(`${row.neighborhood}, ${row.city} - ${row.state}`);
      });
      setLocations([...set].sort((a, b) => a.localeCompare(b, "pt-BR")));
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    if (q.length < 2) return [];
    return locations.filter((l) => l.toLowerCase().includes(q)).slice(0, 8);
  }, [filters.query, locations]);

  // Active filter chips
  const chips: { label: string; clear: () => void }[] = [];

  if (filters.listingType !== "all") {
    chips.push({
      label: filters.listingType === "sale" ? t.filters.buy : t.filters.rent,
      clear: () => update({ listingType: "all" }),
    });
  }
  if (filters.propertyTypes.length > 0) {
    const typeLabels: Record<string, string> = {
      apartment: t.filters.apartment,
      house: t.filters.house,
      land: t.filters.land,
      commercial: t.filters.commercial,
    };
    filters.propertyTypes.forEach((pt) =>
      chips.push({
        label: typeLabels[pt] || pt,
        clear: () => update({ propertyTypes: filters.propertyTypes.filter((x) => x !== pt) }),
      })
    );
  }
  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      label: `${formatPrice(filters.minPrice) || "R$0"} – ${formatPrice(filters.maxPrice) || "∞"}`,
      clear: () => update({ minPrice: "", maxPrice: "" }),
    });
  }
  if (filters.bedrooms) {
    chips.push({
      label: `${filters.bedrooms}+ ${t.filters.bedrooms}`,
      clear: () => update({ bedrooms: "" }),
    });
  }
  if (filters.suites) {
    chips.push({
      label: `${filters.suites}+ ${pt ? "Suítes" : "Suites"}`,
      clear: () => update({ suites: "" }),
    });
  }
  if (filters.bathrooms) {
    chips.push({
      label: `${filters.bathrooms}+ ${t.filters.bathrooms}`,
      clear: () => update({ bathrooms: "" }),
    });
  }
  if (filters.minArea || filters.maxArea) {
    chips.push({
      label: `${filters.minArea || "0"} – ${filters.maxArea || "∞"} m²`,
      clear: () => update({ minArea: "", maxArea: "" }),
    });
  }
  if (filters.parkingSpots) {
    chips.push({
      label: `${filters.parkingSpots}+ ${t.filters.parking}`,
      clear: () => update({ parkingSpots: "" }),
    });
  }
  if (filters.maxCondo) {
    chips.push({
      label: `Condo ≤ R$${filters.maxCondo}`,
      clear: () => update({ maxCondo: "" }),
    });
  }
  if (filters.keywords.length > 0) {
    filters.keywords.forEach((kw) =>
      chips.push({
        label: kw,
        clear: () => update({ keywords: filters.keywords.filter((x) => x !== kw) }),
      })
    );
  }

  const propertyTypeOptions = [
    { value: "apartment", label: t.filters.apartment },
    { value: "house", label: t.filters.house },
    { value: "land", label: t.filters.land },
    { value: "commercial", label: t.filters.commercial },
  ];

  const priceCount = (filters.minPrice || filters.maxPrice) ? 1 : 0;
  const typeCount = filters.propertyTypes.length;
  const moreCount =
    (filters.minArea || filters.maxArea ? 1 : 0) +
    (filters.suites ? 1 : 0) +
    (filters.maxCondo ? 1 : 0) +
    filters.keywords.length;

  return (
    <div className="space-y-2">
      {/* Main filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input with location autocomplete */}
        <div className="relative flex-1 min-w-[220px]" ref={suggestionBoxRef}>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 shadow-sm">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => {
                update({ query: e.target.value });
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              placeholder={pt ? "Bairro, cidade ou nome do imóvel" : "Neighborhood, city or listing name"}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => update({ query: "" })}
                aria-label={pt ? "Limpar busca" : "Clear search"}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-[1100] mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    update({ query: s.split(" - ")[0] });
                    setShowSuggestions(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Listing type (Buy/Rent) */}
        <FilterButton
          label={
            filters.listingType === "all"
              ? t.filters.buyRent
              : filters.listingType === "sale"
              ? t.filters.buy
              : t.filters.rent
          }
          active={filters.listingType !== "all"}
        >
          <div className="flex gap-1">
            {(["all", "sale", "rent"] as const).map((lt) => (
              <button
                key={lt}
                onClick={() => update({ listingType: lt })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  filters.listingType === lt
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {lt === "all" ? t.filters.all : lt === "sale" ? t.filters.buy : t.filters.rent}
              </button>
            ))}
          </div>
        </FilterButton>

        {/* Property Type */}
        <FilterButton label={t.filters.type} active={!!typeCount} count={typeCount}>
          <div className="space-y-2">
            {propertyTypeOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.propertyTypes.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...filters.propertyTypes, opt.value]
                      : filters.propertyTypes.filter((x) => x !== opt.value);
                    update({ propertyTypes: next });
                  }}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </FilterButton>

        {/* Price */}
        <FilterButton label={t.filters.price} active={!!priceCount} count={priceCount}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.filters.minPrice}</label>
              <Input
                type="number"
                value={filters.minPrice}
                onChange={(e) => update({ minPrice: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.filters.maxPrice}</label>
              <Input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => update({ maxPrice: e.target.value })}
                placeholder="∞"
              />
            </div>
          </div>
        </FilterButton>

        {/* Quick: bedrooms */}
        <FilterButton
          label={filters.bedrooms ? `${filters.bedrooms}+ ${t.filters.bedrooms}` : t.filters.bedrooms}
          active={!!filters.bedrooms}
        >
          <StepSelector
            label={t.filters.bedrooms}
            value={filters.bedrooms}
            onChange={(v) => update({ bedrooms: v })}
            anyLabel={t.filters.any}
          />
        </FilterButton>

        {/* Quick: bathrooms */}
        <FilterButton
          label={filters.bathrooms ? `${filters.bathrooms}+ ${t.filters.bathrooms}` : t.filters.bathrooms}
          active={!!filters.bathrooms}
        >
          <StepSelector
            label={t.filters.bathrooms}
            value={filters.bathrooms}
            onChange={(v) => update({ bathrooms: v })}
            anyLabel={t.filters.any}
          />
        </FilterButton>

        {/* Quick: parking */}
        <FilterButton
          label={filters.parkingSpots ? `${filters.parkingSpots}+ ${t.filters.parking}` : t.filters.parking}
          active={!!filters.parkingSpots}
        >
          <StepSelector
            label={t.filters.parkingSpots}
            value={filters.parkingSpots}
            onChange={(v) => update({ parkingSpots: v })}
            anyLabel={t.filters.any}
          />
        </FilterButton>

        {/* More filters */}
        <FilterButton label={t.filters.moreFilters} active={!!moreCount} count={moreCount}>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t.filters.minArea}</label>
                <Input
                  type="number"
                  value={filters.minArea}
                  onChange={(e) => update({ minArea: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t.filters.maxArea}</label>
                <Input
                  type="number"
                  value={filters.maxArea}
                  onChange={(e) => update({ maxArea: e.target.value })}
                  placeholder="∞"
                />
              </div>
            </div>
            <StepSelector
              label={pt ? "Suítes" : "Suites"}
              value={filters.suites}
              onChange={(v) => update({ suites: v })}
              anyLabel={t.filters.any}
            />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.filters.maxCondo}</label>
              <Input
                type="number"
                value={filters.maxCondo}
                onChange={(e) => update({ maxCondo: e.target.value })}
                placeholder="∞"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.filters.keywords}</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {KEYWORD_SUGGESTIONS.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      const next = filters.keywords.includes(kw)
                        ? filters.keywords.filter((x) => x !== kw)
                        : [...filters.keywords, kw];
                      update({ keywords: next });
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      filters.keywords.includes(kw)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FilterButton>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t.filters.activeFilters}:</span>
          {chips.map((chip, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1"
              onClick={chip.clear}
            >
              {chip.label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {chips.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() =>
                onChange({
                  ...defaultFilters,
                  query: filters.query,
                  sortBy: filters.sortBy,
                })
              }
            >
              {t.filters.clear}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
