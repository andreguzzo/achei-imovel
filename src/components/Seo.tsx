import { useEffect } from "react";

interface SeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: string;
}

const DEFAULT_ORIGIN = "https://abitzo.lovable.app";

function resolveCanonical(canonical?: string): string | null {
  if (!canonical) return null;
  if (/^https?:\/\//i.test(canonical)) return canonical;
  const origin = typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN;
  const path = canonical.startsWith("/") ? canonical : `/${canonical}`;
  return `${origin}${path}`;
}

function getOrCreateMeta(selector: string, attribute: "name" | "property", value: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, value);
    document.head.appendChild(el);
  }
  return el;
}

export function Seo({ title, description, canonical, image, type = "website" }: SeoProps) {
  useEffect(() => {
    const previousTitle = document.title;
    const previousMeta: { el: HTMLMetaElement; content: string | null }[] = [];

    if (title) {
      document.title = title;
    }

    if (description) {
      const el = getOrCreateMeta('meta[name="description"]', "name", "description");
      previousMeta.push({ el, content: el.getAttribute("content") });
      el.setAttribute("content", description);
    }

    const ogTitle = getOrCreateMeta('meta[property="og:title"]', "property", "og:title");
    previousMeta.push({ el: ogTitle, content: ogTitle.getAttribute("content") });
    ogTitle.setAttribute("content", title || previousTitle);

    const ogDesc = getOrCreateMeta('meta[property="og:description"]', "property", "og:description");
    previousMeta.push({ el: ogDesc, content: ogDesc.getAttribute("content") });
    ogDesc.setAttribute("content", description || ogDesc.getAttribute("content") || "");

    const ogType = getOrCreateMeta('meta[property="og:type"]', "property", "og:type");
    previousMeta.push({ el: ogType, content: ogType.getAttribute("content") });
    ogType.setAttribute("content", type);

    const ogUrl = getOrCreateMeta('meta[property="og:url"]', "property", "og:url");
    previousMeta.push({ el: ogUrl, content: ogUrl.getAttribute("content") });
    const canonicalUrl = resolveCanonical(canonical) || window.location.href.split("#")[0];
    ogUrl.setAttribute("content", canonicalUrl);

    const twTitle = getOrCreateMeta('meta[name="twitter:title"]', "name", "twitter:title");
    previousMeta.push({ el: twTitle, content: twTitle.getAttribute("content") });
    twTitle.setAttribute("content", title || previousTitle);

    const twDesc = getOrCreateMeta('meta[name="twitter:description"]', "name", "twitter:description");
    previousMeta.push({ el: twDesc, content: twDesc.getAttribute("content") });
    twDesc.setAttribute("content", description || twDesc.getAttribute("content") || "");

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonicalLink;
    const previousCanonical = canonicalLink?.href || "";
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogImage: HTMLMetaElement | null = null;
    let twImage: HTMLMetaElement | null = null;
    let previousOgImage: string | null = null;
    let previousTwImage: string | null = null;

    if (image) {
      ogImage = getOrCreateMeta('meta[property="og:image"]', "property", "og:image");
      previousOgImage = ogImage.getAttribute("content");
      ogImage.setAttribute("content", image);

      twImage = getOrCreateMeta('meta[name="twitter:image"]', "name", "twitter:image");
      previousTwImage = twImage.getAttribute("content");
      twImage.setAttribute("content", image);
    }

    return () => {
      document.title = previousTitle;

      previousMeta.forEach(({ el, content }) => {
        if (content === null) {
          el.remove();
        } else {
          el.setAttribute("content", content);
        }
      });

      if (createdCanonical) {
        canonicalLink?.remove();
      } else if (canonicalLink) {
        canonicalLink.href = previousCanonical;
      }

      if (ogImage && previousOgImage === null) {
        ogImage.remove();
      } else if (ogImage && previousOgImage !== null) {
        ogImage.setAttribute("content", previousOgImage);
      }

      if (twImage && previousTwImage === null) {
        twImage.remove();
      } else if (twImage && previousTwImage !== null) {
        twImage.setAttribute("content", previousTwImage);
      }
    };
  }, [title, description, canonical, image, type]);

  return null;
}

export default Seo;
