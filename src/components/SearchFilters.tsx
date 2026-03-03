import { useCallback, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Search as SearchIcon,
  ChevronDown,
  X,
  Map,
  List,
  SlidersHorizontal,
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
  showMap: boolean;
  onToggleMap: () => void;
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

export default function SearchFilters({ filters, onChange, showMap, onToggleMap }: SearchFiltersProps) {
  const { t } = useLanguage();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const update = useCallback(
    (patch: Partial<SearchFiltersState>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

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
      label: `${filters.suites}+ Suítes`,
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
  const bedsCount = (filters.bedrooms ? 1 : 0) + (filters.suites ? 1 : 0) + (filters.bathrooms ? 1 : 0);
  const typeCount = filters.propertyTypes.length;
  const moreCount =
    (filters.minArea || filters.maxArea ? 1 : 0) +
    (filters.parkingSpots ? 1 : 0) +
    (filters.maxCondo ? 1 : 0) +
    filters.keywords.length;

  return (
    <div className="space-y-2">
      {/* Main filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border bg-card px-3 shadow-sm">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder={t.hero.searchPlaceholder}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
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

        {/* Price */}
        <FilterButton label={t.filters.price} active={!!priceCount} count={priceCount}>
          <div className="space-y-4">
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
          </div>
        </FilterButton>

        {/* Beds & Baths */}
        <FilterButton label={t.filters.bedsAndBaths} active={!!bedsCount} count={bedsCount}>
          <div className="space-y-4">
            <StepSelector
              label={t.filters.bedrooms}
              value={filters.bedrooms}
              onChange={(v) => update({ bedrooms: v })}
              anyLabel={t.filters.any}
            />
            <StepSelector
              label="Suítes"
              value={filters.suites}
              onChange={(v) => update({ suites: v })}
              anyLabel={t.filters.any}
            />
            <StepSelector
              label={t.filters.bathrooms}
              value={filters.bathrooms}
              onChange={(v) => update({ bathrooms: v })}
              anyLabel={t.filters.any}
            />
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

        {/* More filters */}
        <FilterButton
          label={t.filters.moreFilters}
          active={!!moreCount}
          count={moreCount}
        >
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
              label={t.filters.parkingSpots}
              value={filters.parkingSpots}
              onChange={(v) => update({ parkingSpots: v })}
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

        {/* Sort */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {t.filters.sortBy}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 z-[1000]">
            <div className="space-y-1">
              {(
                [
                  { value: "newest", label: t.filters.sortNewest },
                  { value: "price_asc", label: t.filters.sortPriceAsc },
                  { value: "price_desc", label: t.filters.sortPriceDesc },
                  { value: "area_desc", label: t.filters.sortArea },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ sortBy: opt.value })}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    filters.sortBy === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Map toggle */}
        <Button variant={showMap ? "default" : "outline"} size="sm" onClick={onToggleMap} className="gap-1">
          {showMap ? <List className="h-4 w-4" /> : <Map className="h-4 w-4" />}
          {showMap ? t.filters.list : t.filters.map}
        </Button>
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
