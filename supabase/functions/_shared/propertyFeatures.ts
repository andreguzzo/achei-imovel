/**
 * Canonical property feature slugs — mirror of src/lib/propertyFeatures.ts.
 * Kept duplicated because edge functions cannot import from src/.
 */
export const PROPERTY_FEATURES: { slug: string; pt: string }[] = [
  { slug: "elevador", pt: "Elevador" },
  { slug: "piscina", pt: "Piscina" },
  { slug: "academia", pt: "Academia" },
  { slug: "churrasqueira", pt: "Churrasqueira" },
  { slug: "portaria-24h", pt: "Portaria 24h" },
  { slug: "playground", pt: "Playground" },
  { slug: "salao-de-festas", pt: "Salão de festas" },
  { slug: "quadra", pt: "Quadra" },
  { slug: "sauna", pt: "Sauna" },
  { slug: "coworking", pt: "Coworking" },
  { slug: "varanda", pt: "Varanda" },
  { slug: "varanda-gourmet", pt: "Varanda gourmet" },
  { slug: "sacada", pt: "Sacada" },
  { slug: "suite", pt: "Suíte" },
  { slug: "suite-master", pt: "Suíte master" },
  { slug: "lavabo", pt: "Lavabo" },
  { slug: "closet", pt: "Closet" },
  { slug: "escritorio", pt: "Escritório" },
  { slug: "cozinha-americana", pt: "Cozinha americana" },
  { slug: "area-de-servico", pt: "Área de serviço" },
  { slug: "deposito", pt: "Depósito" },
  { slug: "mobiliado", pt: "Mobiliado" },
  { slug: "ar-condicionado", pt: "Ar-condicionado" },
  { slug: "jardim", pt: "Jardim" },
  { slug: "quintal", pt: "Quintal" },
  { slug: "vista-mar", pt: "Vista mar" },
  { slug: "energia-solar", pt: "Energia solar" },
  { slug: "poco-artesiano", pt: "Poço artesiano" },
  { slug: "portao-eletronico", pt: "Portão eletrônico" },
  { slug: "cerca-eletrica", pt: "Cerca elétrica" },
  { slug: "aceita-pet", pt: "Aceita pet" },
  { slug: "aceita-financiamento", pt: "Aceita financiamento" },
  { slug: "aceita-permuta", pt: "Aceita permuta" },
];

const BY_SLUG = new Map(PROPERTY_FEATURES.map((f) => [f.slug, f]));

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
  "portaria-eletronica": "portaria-24h",
  "ar-condicionado-split": "ar-condicionado",
  "split": "ar-condicionado",
  "salao-festas": "salao-de-festas",
  "salao-de-festa": "salao-de-festas",
  "area-servico": "area-de-servico",
  "vista-para-o-mar": "vista-mar",
  "vista-do-mar": "vista-mar",
  "poco": "poco-artesiano",
  "home-office": "escritorio",
  "quadra-esportiva": "quadra",
  "quadra-poliesportiva": "quadra",
  "spa": "sauna",
  "gourmet": "varanda-gourmet",
  "terraco": "sacada",
  "elevadores": "elevador",
  "piscina-adulto": "piscina",
  "piscina-infantil": "piscina",
  "academia-fitness": "academia",
  "fitness": "academia",
  "espaco-gourmet": "churrasqueira",
  "seguranca-24-horas": "portaria-24h",
  "moveis-planejados": "mobiliado",
  "semi-mobiliado": "mobiliado",
  "armarios-embutidos": "closet",
  "despensa": "deposito",
  "lavanderia": "area-de-servico",
  "sala-de-jogos": "salao-de-festas",
  "aquecimento-solar": "energia-solar",
  "cerca-eletrificada": "cerca-eletrica",
};

export const matchFeature = (value: string): string | null => {
  const slug = slugifyFeature(value);
  const resolved = ALIASES[slug] ?? slug;
  return BY_SLUG.has(resolved) ? resolved : null;
};

export const featureLabelPt = (slug: string): string => BY_SLUG.get(slug)?.pt ?? slug;
