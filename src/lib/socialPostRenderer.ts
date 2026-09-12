/**
 * Canvas-based renderer for social media post images (Instagram / Facebook).
 * Generates branded images from a property listing, fully client-side.
 */

export type SocialFormat = "square" | "carousel";

export interface SocialBroker {
  name: string;
  creci?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface SocialProperty {
  title: string;
  price: number;
  listingType: string;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpots?: number | null;
  area?: number | null;
}

export interface RenderOptions {
  format: SocialFormat;
  property: SocialProperty;
  broker: SocialBroker;
  images: string[];
  locale?: "pt-BR" | "en";
}

export interface RenderedSlide {
  blob: Blob;
  dataUrl: string;
  index: number;
}

const SIZES: Record<SocialFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  carousel: { w: 1080, h: 1350 },
};

const MAX_CAROUSEL_SLIDES = 10;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    if (words.join(" ") !== lines.join(" ")) lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

async function renderSlide(
  url: string,
  opts: RenderOptions,
  slideIndex: number,
  total: number,
): Promise<RenderedSlide> {
  const { w, h } = SIZES[opts.format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const pt = (opts.locale ?? "pt-BR") === "pt-BR";

  // Background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);

  const img = await loadImage(url);
  if (img) drawCover(ctx, img, w, h);

  // Bottom gradient for legibility
  const grad = ctx.createLinearGradient(0, h * 0.35, 0, h);
  grad.addColorStop(0, "rgba(6, 18, 38, 0)");
  grad.addColorStop(0.55, "rgba(6, 18, 38, 0.72)");
  grad.addColorStop(1, "rgba(6, 18, 38, 0.96)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.35, w, h * 0.65);

  const pad = 64;

  // Top badge (listing type)
  const badgeLabel = opts.property.listingType === "rent" ? (pt ? "ALUGUEL" : "FOR RENT") : (pt ? "VENDA" : "FOR SALE");
  ctx.font = "600 28px 'DM Sans', system-ui, sans-serif";
  const badgeW = ctx.measureText(badgeLabel).width + 48;
  ctx.fillStyle = "#2563eb";
  roundRect(ctx, pad, pad, badgeW, 60, 30);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeLabel, pad + 24, pad + 31);

  // Slide counter for carousels
  if (total > 1) {
    const counter = `${slideIndex + 1}/${total}`;
    ctx.font = "600 26px 'DM Sans', system-ui, sans-serif";
    const cw = ctx.measureText(counter).width + 40;
    ctx.fillStyle = "rgba(6, 18, 38, 0.6)";
    roundRect(ctx, w - pad - cw, pad, cw, 56, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(counter, w - pad - cw + 20, pad + 29);
  }

  let y = h - pad;

  // Broker line
  const brokerBits = [opts.broker.name, opts.broker.creci ? `CRECI ${opts.broker.creci}` : null, opts.broker.phone]
    .filter(Boolean)
    .join("  ·  ");
  ctx.font = "500 30px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(brokerBits, pad, y);
  y -= 56;

  // Divider
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(pad, y, w - pad * 2, 2);
  y -= 46;

  // Features
  const feats: string[] = [];
  if (opts.property.bedrooms) feats.push(`${opts.property.bedrooms} ${pt ? "quartos" : "beds"}`);
  if (opts.property.bathrooms) feats.push(`${opts.property.bathrooms} ${pt ? "banheiros" : "baths"}`);
  if (opts.property.parkingSpots) feats.push(`${opts.property.parkingSpots} ${pt ? "vagas" : "parking"}`);
  if (opts.property.area) feats.push(`${opts.property.area} m²`);
  if (feats.length) {
    ctx.font = "500 34px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(feats.join("   •   "), pad, y);
    y -= 66;
  }

  // Price
  ctx.font = "700 66px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "#93c5fd";
  ctx.fillText(brl(opts.property.price), pad, y);
  y -= 66;

  // Location
  const loc = [opts.property.neighborhood, opts.property.city, opts.property.state].filter(Boolean).join(", ");
  if (loc) {
    ctx.font = "500 34px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(loc, pad, y);
    y -= 62;
  }

  // Title (Playfair display headings)
  ctx.font = "700 60px 'Playfair Display', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  const lines = wrapText(ctx, opts.property.title, w - pad * 2, 2);
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], pad, y);
    y -= 74;
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92),
  );

  return { blob, dataUrl: canvas.toDataURL("image/jpeg", 0.85), index: slideIndex };
}

export async function renderSocialPost(opts: RenderOptions): Promise<RenderedSlide[]> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts optional */
    }
  }

  const urls = opts.format === "square" ? opts.images.slice(0, 1) : opts.images.slice(0, MAX_CAROUSEL_SLIDES);
  if (urls.length === 0) throw new Error("no-images");

  const slides: RenderedSlide[] = [];
  for (let i = 0; i < urls.length; i++) {
    slides.push(await renderSlide(urls[i], opts, i, urls.length));
  }
  return slides;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
