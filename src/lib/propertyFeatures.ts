/**
 * Canonical list of property features shared by the listing form and the search filters.
 * The `slug` is the only value ever stored in `properties.features`.
 */
export interface PropertyFeature {
  slug: string;
  pt: string;
  en: string;
}

export const PROPERTY_FEATURES: PropertyFeature[] = [
  // Building / condo
  { slug: "elevador", pt: "Elevador", en: "Elevator" },
  { slug: "piscina", pt: "Piscina", en: "Pool" },
  { slug: "academia", pt: "Academia", en: "Gym" },
  { slug: "churrasqueira", pt: "Churrasqueira", en: "BBQ area" },
  { slug: "portaria-24h", pt: "Portaria 24h", en: "24h concierge" },
  { slug: "playground", pt: "Playground", en: "Playground" },
  { slug: "salao-de-festas", pt: "Salão de festas", en: "Party room" },
  { slug: "quadra", pt: "Quadra", en: "Sports court" },
  { slug: "sauna", pt: "Sauna", en: "Sauna" },
  { slug: "coworking", pt: "Coworking", en: "Coworking" },

  // Indoor
  { slug: "varanda", pt: "Varanda", en: "Balcony" },
  { slug: "varanda-gourmet", pt: "Varanda gourmet", en: "Gourmet balcony" },
  { slug: "sacada", pt: "Sacada", en: "Terrace" },
  { slug: "suite", pt: "Suíte", en: "Suite" },
  { slug: "suite-master", pt: "Suíte master", en: "Master suite" },
  { slug: "lavabo", pt: "Lavabo", en: "Powder room" },
  { slug: "closet", pt: "Closet", en: "Walk-in closet" },
  { slug: "escritorio", pt: "Escritório", en: "Home office" },
  { slug: "cozinha-americana", pt: "Cozinha americana", en: "Open kitchen" },
  { slug: "area-de-servico", pt: "Área de serviço", en: "Laundry room" },
  { slug: "deposito", pt: "Depósito", en: "Storage room" },
  { slug: "mobiliado", pt: "Mobiliado", en: "Furnished" },
  { slug: "ar-condicionado", pt: "Ar-condicionado", en: "Air conditioning" },

  // Outdoor / land
  { slug: "jardim", pt: "Jardim", en: "Garden" },
  { slug: "quintal", pt: "Quintal", en: "Backyard" },
  { slug: "vista-mar", pt: "Vista mar", en: "Sea view" },
  { slug: "energia-solar", pt: "Energia solar", en: "Solar power" },
  { slug: "poco-artesiano", pt: "Poço artesiano", en: "Artesian well" },

  // Security
  { slug: "portao-eletronico", pt: "Portão eletrônico", en: "Electric gate" },
  { slug: "cerca-eletrica", pt: "Cerca elétrica", en: "Electric fence" },

  // Conditions
  { slug: "aceita-pet", pt: "Aceita pet", en: "Pet friendly" },
  { slug: "aceita-financiamento", pt: "Aceita financiamento", en: "Financing accepted" },
  { slug: "aceita-permuta", pt: "Aceita permuta", en: "Trade accepted" },
];

const BY_SLUG = new Map(PROPERTY_FEATURES.map((f) => [f.slug, f]));

/** Lowercase, strip accents, collapse separators — used for matching legacy free text. */
export const slugifyFeature = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ALIASES: Record<string, string> = {
  "pet-friendly": "aceita-pet",
  "pet": "aceita-pet",
  "aceita-pets": "aceita-pet",
  "portaria-24-h": "portaria-24h",
  "portaria-24-horas": "portaria-24h",
  "portaria": "portaria-24h",
  "ar-condicionado-split": "ar-condicionado",
  "salao-festas": "salao-de-festas",
  "area-servico": "area-de-servico",
  "vista-para-o-mar": "vista-mar",
  "vista-do-mar": "vista-mar",
  "poco": "poco-artesiano",
  "home-office": "escritorio",
  "quadra-esportiva": "quadra",
  "quadra-poliesportiva": "quadra",
};

/** Returns the canonical slug for any value, or null when it does not match the list. */
export const matchFeature = (value: string): string | null => {
  const slug = slugifyFeature(value);
  const resolved = ALIASES[slug] ?? slug;
  return BY_SLUG.has(resolved) ? resolved : null;
};

export const featureLabel = (slug: string, pt: boolean): string => {
  const feature = BY_SLUG.get(slug);
  if (!feature) return slug;
  return pt ? feature.pt : feature.en;
};
