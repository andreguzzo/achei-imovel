import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { featureLabelPt } from "../_shared/propertyFeatures.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // eslint-disable-next-line no-control-regex -- Intencional: remove caracteres de controle para gerar XML válido
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const PROPERTY_TYPE: Record<string, string> = {
  apartment: "Residential / Apartment",
  house: "Residential / Home",
  land: "Residential / Land Lot",
  commercial: "Commercial / Building",
  farm: "Residential / Farm Ranch",
};

const MAX_LISTINGS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") ?? "").trim();
    if (!/^[a-f0-9]{16,64}$/i.test(token)) {
      return new Response("Token inválido", { status: 400, headers: corsHeaders });
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: tokenRow } = await service
      .from("broker_feed_tokens")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow?.user_id) {
      return new Response("Token inválido", { status: 404, headers: corsHeaders });
    }
    const userId = tokenRow.user_id as string;

    const [{ data: profile }, { data: properties }] = await Promise.all([
      service.from("profiles").select("full_name, commercial_name, phone, whatsapp").eq("user_id", userId).maybeSingle(),
      service
        .from("properties")
        .select("*, property_images(url, position)")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(MAX_LISTINGS),
    ]);

    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://abitzo.com.br";
    const contactName = profile?.commercial_name || profile?.full_name || "Abitzo";
    const contactPhone = profile?.whatsapp || profile?.phone || "";

    const listings = (properties ?? []).map((p) => {
      const images = [...((p.property_images as { url: string; position: number | null }[]) ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((i) => i.url);
      const isRent = p.listing_type === "rent";
      const features = (p.features as string[] | null) ?? [];

      return `    <Listing>
      <ListingID>${esc(p.reference_code ?? p.id)}</ListingID>
      <Title>${esc(p.title)}</Title>
      <TransactionType>${isRent ? "For Rent" : "For Sale"}</TransactionType>
      <DetailViewUrl>${esc(`${siteUrl}/imovel/${p.id}`)}</DetailViewUrl>
      <PublicationType>STANDARD</PublicationType>
      <ContactInfo>
        <Name>${esc(contactName)}</Name>
        ${contactPhone ? `<Telephone>${esc(contactPhone)}</Telephone>` : ""}
      </ContactInfo>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${esc(p.state)}">${esc(p.state)}</State>
        <City>${esc(p.city)}</City>
        ${p.neighborhood ? `<Neighborhood>${esc(p.neighborhood)}</Neighborhood>` : ""}
        ${p.address ? `<Address>${esc(p.address)}</Address>` : ""}
        ${p.zip_code ? `<PostalCode>${esc(p.zip_code)}</PostalCode>` : ""}
        ${p.latitude != null ? `<Latitude>${esc(p.latitude)}</Latitude>` : ""}
        ${p.longitude != null ? `<Longitude>${esc(p.longitude)}</Longitude>` : ""}
      </Location>
      <Details>
        <PropertyType>${esc(PROPERTY_TYPE[p.property_type as string] ?? "Residential / Apartment")}</PropertyType>
        <Description>${esc(p.description ?? p.title)}</Description>
        ${isRent ? `<RentalPrice currency="BRL">${esc(p.price)}</RentalPrice>` : `<ListPrice currency="BRL">${esc(p.price)}</ListPrice>`}
        ${p.condo_fee != null ? `<PropertyAdministrationFee currency="BRL">${esc(p.condo_fee)}</PropertyAdministrationFee>` : ""}
        ${p.iptu != null ? `<YearlyTax currency="BRL">${esc(p.iptu)}</YearlyTax>` : ""}
        ${p.area != null ? `<LivingArea unit="square metres">${esc(p.area)}</LivingArea>` : ""}
        ${p.bedrooms != null ? `<Bedrooms>${esc(p.bedrooms)}</Bedrooms>` : ""}
        ${p.bathrooms != null ? `<Bathrooms>${esc(p.bathrooms)}</Bathrooms>` : ""}
        ${p.suites != null ? `<Suites>${esc(p.suites)}</Suites>` : ""}
        ${p.parking_spots != null ? `<Garage type="Parking Space">${esc(p.parking_spots)}</Garage>` : ""}
        ${features.length ? `<Features>${features.map((f) => `<Feature>${esc(featureLabelPt(f))}</Feature>`).join("")}</Features>` : ""}
      </Details>
      ${images.length ? `<Media>${images.map((u) => `<Item medium="image" caption="${esc(p.title)}">${esc(u)}</Item>`).join("")}</Media>` : ""}
    </Listing>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>Abitzo</Provider>
    <ContactName>${esc(contactName)}</ContactName>
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>
${listings.join("\n")}
  </Listings>
</ListingDataFeed>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (e) {
    console.error("feed-xml error:", e);
    return new Response("Erro ao gerar feed", { status: 500, headers: corsHeaders });
  }
});
