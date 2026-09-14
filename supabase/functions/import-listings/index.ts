import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.1";
import { matchFeature } from "../_shared/propertyFeatures.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_XML_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS_PER_COMMIT = 10;

type Json = Record<string, unknown>;

interface ParsedListing {
  externalRef: string;
  title: string;
  description: string | null;
  property_type: string;
  listing_type: string;
  price: number;
  condo_fee: number | null;
  iptu: number | null;
  area: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  features: string[];
  images: string[];
  unmapped: string[];
  missing: string[];
}

/* ---------------------------- generic XML helpers --------------------------- */

const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Deep, case-insensitive lookup of the first leaf value for any of the given keys. */
const deepFind = (node: unknown, keys: string[]): string | null => {
  const wanted = new Set(keys.map(lower));
  const visit = (n: unknown): string | null => {
    if (n === null || n === undefined) return null;
    if (Array.isArray(n)) {
      for (const item of n) {
        const found = visit(item);
        if (found !== null) return found;
      }
      return null;
    }
    if (typeof n !== "object") return null;
    for (const [key, value] of Object.entries(n as Json)) {
      if (wanted.has(lower(key))) {
        const leaf = leafText(value);
        if (leaf) return leaf;
      }
    }
    for (const value of Object.values(n as Json)) {
      const found = visit(value);
      if (found !== null) return found;
    }
    return null;
  };
  return visit(node);
};

const leafText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const s = String(value).trim();
    return s === "" ? null : s;
  }
  if (Array.isArray(value)) return leafText(value[0]);
  if (typeof value === "object") {
    const obj = value as Json;
    if ("#text" in obj) return leafText(obj["#text"]);
  }
  return null;
};

/** Collects every string under keys that look like feature lists. */
const collectFeatures = (node: unknown): string[] => {
  const out: string[] = [];
  const push = (v: unknown) => {
    const t = leafText(v);
    if (t) out.push(t);
  };
  const visit = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== "object") return;
    for (const [key, value] of Object.entries(n as Json)) {
      const k = lower(key);
      if (k.includes("feature") || k.includes("caracteristica") || k.includes("comodidade") || k.includes("amenit")) {
        if (Array.isArray(value)) value.forEach(push);
        else if (value && typeof value === "object") {
          for (const inner of Object.values(value as Json)) {
            if (Array.isArray(inner)) inner.forEach(push);
            else push(inner);
          }
        } else push(value);
      } else {
        visit(value);
      }
    }
  };
  visit(node);
  return [...new Set(out)];
};

const IMG_RE = /^https?:\/\/\S+$/i;

/** Collects image URLs from any media/image-like node. */
const collectImages = (node: unknown): string[] => {
  const out: string[] = [];
  const push = (v: unknown) => {
    const t = leafText(v);
    if (t && IMG_RE.test(t)) out.push(t);
  };
  const visit = (n: unknown, inMedia = false) => {
    if (Array.isArray(n)) return n.forEach((i) => visit(i, inMedia));
    if (!n || typeof n !== "object") return;
    for (const [key, value] of Object.entries(n as Json)) {
      const k = lower(key);
      const mediaKey =
        inMedia ||
        k.includes("media") ||
        k.includes("image") ||
        k.includes("imagem") ||
        k.includes("foto") ||
        k.includes("photo") ||
        k.includes("picture");
      if (mediaKey) {
        if (typeof value === "string" || typeof value === "number") push(value);
        else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "string" || typeof item === "number") push(item);
            else visit(item, true);
          }
        } else visit(value, true);
      } else {
        visit(value, inMedia);
      }
    }
  };
  visit(node);
  return [...new Set(out)].slice(0, MAX_IMAGES);
};

const toNumber = (raw: string | null): number | null => {
  if (!raw) return null;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const toInt = (raw: string | null): number | null => {
  const n = toNumber(raw);
  return n === null ? null : Math.round(n);
};

const STATES: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  distritofederal: "DF", espiritosanto: "ES", goias: "GO", maranhao: "MA", matogrosso: "MT",
  matogrossodosul: "MS", minasgerais: "MG", para: "PA", paraiba: "PB", parana: "PR",
  pernambuco: "PE", piaui: "PI", riodejaneiro: "RJ", riograndedonorte: "RN",
  riograndedosul: "RS", rondonia: "RO", roraima: "RR", santacatarina: "SC",
  saopaulo: "SP", sergipe: "SE", tocantins: "TO",
};

const normalizeState = (raw: string | null): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const key = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return STATES[key] ?? trimmed.slice(0, 2).toUpperCase();
};

const normalizeText = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const mapPropertyType = (raw: string | null): string => {
  const s = normalizeText(raw ?? "");
  if (/(fazenda|chacara|sitio|rural|farm|haras)/.test(s)) return "farm";
  if (/(terreno|lote|land|area)/.test(s)) return "land";
  if (/(comercial|commercial|sala|loja|galpao|escritorio|conjunto|predio|hotel|industrial|office|store)/.test(s)) return "commercial";
  if (/(casa|house|sobrado|condominio|townhouse|home|residence)/.test(s)) return "house";
  return "apartment";
};

const mapListingType = (raw: string | null, hasRentPrice: boolean): string => {
  const s = normalizeText(raw ?? "");
  if (/(rent|aluguel|locacao|alugar|for rent)/.test(s)) return "rent";
  if (/(sale|venda|vender|for sale)/.test(s)) return "sale";
  return hasRentPrice ? "rent" : "sale";
};

/* ------------------------------- XML parsing ------------------------------- */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
});

/** Finds every listing node in a VivaReal/ZAP or OLX style feed. */
const findListingNodes = (root: unknown): Json[] => {
  const out: Json[] = [];
  const LISTING_KEYS = ["listing", "ad", "anuncio", "imovel", "property", "item"];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== "object") return;
    for (const [key, value] of Object.entries(n as Json)) {
      if (LISTING_KEYS.includes(lower(key))) {
        const nodes = Array.isArray(value) ? value : [value];
        for (const node of nodes) if (node && typeof node === "object") out.push(node as Json);
      } else {
        visit(value);
      }
    }
  };
  visit(root);
  return out;
};

const mapListing = (node: Json): ParsedListing | null => {
  const externalRef =
    deepFind(node, ["ListingID", "ListingId", "id", "codigo", "CodigoImovel", "reference", "ad_id", "Referencia", "codigoanuncio"]) ??
    null;

  const title = deepFind(node, ["Title", "titulo", "Subject", "nome"]) ?? "";
  const description = deepFind(node, ["Description", "descricao", "Body", "observacao"]);
  const rentPrice = toNumber(deepFind(node, ["RentalPrice", "valoraluguel", "precoaluguel"]));
  const salePrice = toNumber(deepFind(node, ["ListPrice", "SalePrice", "valorvenda", "precovenda"]));
  const genericPrice = toNumber(deepFind(node, ["price", "preco", "valor", "Price"]));
  const transaction = deepFind(node, ["TransactionType", "operation", "operacao", "finalidade", "tipooperacao", "modalidade"]);
  const listing_type = mapListingType(transaction, rentPrice !== null && salePrice === null);
  const price = (listing_type === "rent" ? rentPrice : salePrice) ?? genericPrice ?? rentPrice ?? salePrice ?? 0;

  const propertyTypeRaw = deepFind(node, ["PropertyType", "UsageType", "type", "tipo", "tipoimovel", "categoria", "Category"]);
  const city = deepFind(node, ["City", "cidade", "municipio"]) ?? "";
  const state = normalizeState(deepFind(node, ["State", "estado", "uf"]));
  const addressBase = deepFind(node, ["Address", "endereco", "logradouro", "street"]);
  const number = deepFind(node, ["StreetNumber", "numero", "number"]);

  const rawFeatures = collectFeatures(node);
  const features: string[] = [];
  const unmapped: string[] = [];
  for (const raw of rawFeatures) {
    const slug = matchFeature(raw);
    if (slug) {
      if (!features.includes(slug)) features.push(slug);
    } else if (!unmapped.includes(raw)) {
      unmapped.push(raw);
    }
  }

  const item: ParsedListing = {
    externalRef: externalRef ?? "",
    title: title || (city ? `Imóvel em ${city}` : "Imóvel importado"),
    description: description ?? null,
    property_type: mapPropertyType(propertyTypeRaw),
    listing_type,
    price: price > 0 ? price : 0,
    condo_fee: toNumber(deepFind(node, ["PropertyAdministrationFee", "condominio", "condofee", "condominium", "valorcondominio"])),
    iptu: toNumber(deepFind(node, ["YearlyTax", "iptu", "tax", "valoriptu"])),
    area:
      toNumber(deepFind(node, ["LivingArea", "UsableArea", "areautil", "size", "area", "ConstructedArea", "areaconstruida"])) ??
      toNumber(deepFind(node, ["LotArea", "areaterreno", "TotalArea"])),
    bedrooms: toInt(deepFind(node, ["Bedrooms", "quartos", "rooms", "dormitorios"])),
    suites: toInt(deepFind(node, ["Suites", "suites"])),
    bathrooms: toInt(deepFind(node, ["Bathrooms", "banheiros", "bathroom"])),
    parking_spots: toInt(deepFind(node, ["Garage", "vagas", "garage", "parkingspots", "parkingspaces", "garagem"])),
    address: addressBase ? (number ? `${addressBase}, ${number}` : addressBase) : null,
    neighborhood: deepFind(node, ["Neighborhood", "bairro", "district"]),
    city,
    state,
    zip_code: deepFind(node, ["PostalCode", "cep", "zipcode", "zip"]),
    latitude: toNumber(deepFind(node, ["Latitude", "lat"])),
    longitude: toNumber(deepFind(node, ["Longitude", "lng", "long"])),
    features,
    images: collectImages(node),
    unmapped,
    missing: [],
  };

  if (!item.externalRef) return null;

  if (!city) item.missing.push("cidade");
  if (!state) item.missing.push("estado");
  if (!item.price) item.missing.push("preço");
  if (!title) item.missing.push("título");
  if (item.images.length === 0) item.missing.push("fotos");

  return item;
};

/* --------------------------------- handler -------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Não autorizado" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Json;
    const action = String(body.action ?? "preview");

    /* --------------------------- plan limit context -------------------------- */
    const limitInfo = async () => {
      const [{ count }, profileRes, subRes] = await Promise.all([
        service.from("properties").select("id", { count: "exact", head: true }).eq("user_id", userId),
        service.from("profiles").select("account_type").eq("user_id", userId).maybeSingle(),
        service
          .from("billing_subscriptions")
          .select("plan_slug, status")
          .eq("user_id", userId)
          .in("status", ["active", "trialing"])
          .maybeSingle(),
      ]);

      let max: number | null = null; // null = unlimited
      const accountType = (profileRes.data?.account_type as string) ?? "owner";
      const planSlug = subRes.data?.plan_slug ?? null;

      if (planSlug) {
        const { data: plan } = await service
          .from("subscription_plans")
          .select("max_properties")
          .eq("slug", planSlug)
          .maybeSingle();
        max = plan?.max_properties === null || plan?.max_properties === undefined ? null : Number(plan.max_properties);
      } else {
        max = accountType === "owner" ? 1 : null;
      }
      return { current: count ?? 0, max };
    };

    /* -------------------------------- preview -------------------------------- */
    if (action === "preview") {
      let xml = typeof body.xml === "string" ? body.xml : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";

      if (!xml && url) {
        if (!/^https?:\/\//i.test(url)) return json({ error: "Informe uma URL http(s) válida." }, 400);
        const res = await fetch(url, { headers: { "User-Agent": "Abitzo-Feed-Importer/1.0" } });
        if (!res.ok) return json({ error: `Não foi possível baixar o feed (HTTP ${res.status}).` }, 400);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > MAX_XML_BYTES) return json({ error: "Arquivo XML maior que 25 MB." }, 400);
        xml = new TextDecoder("utf-8").decode(buf);
      }
      if (!xml.trim()) return json({ error: "Envie a URL do feed ou o arquivo XML." }, 400);
      if (xml.length > MAX_XML_BYTES) return json({ error: "Arquivo XML maior que 25 MB." }, 400);

      let root: unknown;
      try {
        root = parser.parse(xml);
      } catch (_e) {
        return json({ error: "XML inválido ou fora do padrão dos portais." }, 400);
      }

      const nodes = findListingNodes(root);
      const seen = new Set<string>();
      const items: ParsedListing[] = [];
      let invalid = 0;
      for (const node of nodes) {
        const mapped = mapListing(node);
        if (!mapped) { invalid++; continue; }
        if (seen.has(mapped.externalRef)) continue;
        seen.add(mapped.externalRef);
        items.push(mapped);
      }
      if (items.length === 0) {
        return json({ error: "Nenhum anúncio reconhecido no arquivo. Verifique se o feed é do padrão VivaReal/ZAP ou OLX." }, 400);
      }

      const { data: existing } = await service
        .from("properties")
        .select("id, external_ref, title")
        .eq("user_id", userId)
        .in("external_ref", items.map((i) => i.externalRef));

      const existingRefs = new Set((existing ?? []).map((r) => r.external_ref as string));
      const limits = await limitInfo();

      return json({
        items: items.map((i) => ({ ...i, exists: existingRefs.has(i.externalRef) })),
        summary: {
          total: items.length,
          newCount: items.filter((i) => !existingRefs.has(i.externalRef)).length,
          existingCount: items.filter((i) => existingRefs.has(i.externalRef)).length,
          invalid,
        },
        limits,
      });
    }

    /* --------------------------------- commit -------------------------------- */
    if (action === "commit") {
      const rawItems = Array.isArray(body.items) ? (body.items as ParsedListing[]) : [];
      if (rawItems.length === 0) return json({ error: "Nenhum anúncio selecionado." }, 400);
      if (rawItems.length > MAX_ITEMS_PER_COMMIT) {
        return json({ error: `Envie no máximo ${MAX_ITEMS_PER_COMMIT} anúncios por chamada.` }, 400);
      }

      const source = typeof body.source === "string" ? body.source : "portal";
      const limits = await limitInfo();

      const { data: existing } = await service
        .from("properties")
        .select("id, external_ref")
        .eq("user_id", userId)
        .in("external_ref", rawItems.map((i) => String(i.externalRef)));
      const existingMap = new Map((existing ?? []).map((r) => [r.external_ref as string, r.id as string]));

      let created = 0;
      let updated = 0;
      let imagesSaved = 0;
      const errors: { ref: string; message: string }[] = [];
      const skippedByLimit: string[] = [];

      for (const item of rawItems) {
        const ref = String(item.externalRef ?? "").trim();
        if (!ref) continue;
        if (!item.city || !item.state || !Number(item.price)) {
          errors.push({ ref, message: "Faltam cidade, estado ou preço." });
          continue;
        }

        const existingId = existingMap.get(ref);
        if (!existingId && limits.max !== null && limits.current + created >= limits.max) {
          skippedByLimit.push(ref);
          continue;
        }

        const payload = {
          user_id: userId,
          title: String(item.title ?? "").slice(0, 200) || `Imóvel ${ref}`,
          description: item.description ? String(item.description).slice(0, 8000) : null,
          property_type: item.property_type,
          listing_type: item.listing_type,
          price: Number(item.price),
          condo_fee: item.condo_fee ?? null,
          iptu: item.iptu ?? null,
          area: item.area ?? null,
          bedrooms: item.bedrooms ?? null,
          suites: item.suites ?? null,
          bathrooms: item.bathrooms ?? null,
          parking_spots: item.parking_spots ?? null,
          address: item.address ?? null,
          neighborhood: item.neighborhood ?? null,
          city: String(item.city),
          state: String(item.state).slice(0, 2),
          zip_code: item.zip_code ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          features: Array.isArray(item.features) ? item.features : [],
          external_ref: ref,
          external_source: source,
        };

        let propId = existingId ?? null;
        if (propId) {
          const { error } = await service.from("properties").update(payload).eq("id", propId).eq("user_id", userId);
          if (error) { errors.push({ ref, message: error.message }); continue; }
          updated++;
        } else {
          const { data, error } = await service
            .from("properties")
            .insert({ ...payload, status: "active" })
            .select("id")
            .single();
          if (error || !data) {
            errors.push({ ref, message: error?.message ?? "Falha ao criar imóvel." });
            continue;
          }
          propId = data.id as string;
          created++;
        }

        // Only download photos when the listing has none yet — avoids duplicating on re-import
        const { count: imgCount } = await service
          .from("property_images")
          .select("id", { count: "exact", head: true })
          .eq("property_id", propId);

        if ((imgCount ?? 0) === 0) {
          const urls = (Array.isArray(item.images) ? item.images : []).slice(0, MAX_IMAGES);
          let position = 0;
          for (const imgUrl of urls) {
            try {
              const res = await fetch(imgUrl);
              if (!res.ok) continue;
              const type = res.headers.get("content-type") ?? "image/jpeg";
              if (!type.startsWith("image/")) continue;
              const bytes = new Uint8Array(await res.arrayBuffer());
              if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) continue;
              const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
              const path = `${propId}/import-${Date.now()}-${position}.${ext}`;
              const { error: upErr } = await service.storage
                .from("property-images")
                .upload(path, bytes, { contentType: type, upsert: true });
              if (upErr) continue;
              const { data: pub } = service.storage.from("property-images").getPublicUrl(path);
              await service.from("property_images").insert({
                property_id: propId,
                url: pub.publicUrl,
                position,
              });
              position++;
              imagesSaved++;
            } catch (e) {
              console.error("image import failed", imgUrl, e);
            }
          }
        }
      }

      return json({ created, updated, imagesSaved, errors, skippedByLimit, limits });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("import-listings error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
