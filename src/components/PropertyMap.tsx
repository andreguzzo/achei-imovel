import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & {
  property_images?: Tables<"property_images">[];
};

interface PropertyMapProps {
  properties: Property[];
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const formatPriceFull = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);

const formatPriceShort = (price: number) => {
  if (price >= 1_000_000) return `R$${(price / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (price >= 1_000) return `R$${(price / 1_000).toFixed(0)}k`;
  return `R$${price}`;
};

const CLUSTER_STYLE = `
  .marker-cluster-custom {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-family: 'DM Sans', sans-serif;
    font-weight: 800;
    font-size: 13px;
    color: white;
    border: 3px solid white;
    box-shadow: 0 3px 12px rgba(0,0,0,0.25);
    cursor: pointer;
  }
  .marker-cluster-small {
    background: hsl(215, 25%, 35%);
    width: 36px; height: 36px;
  }
  .marker-cluster-medium {
    background: hsl(215, 25%, 25%);
    width: 42px; height: 42px;
  }
  .marker-cluster-large {
    background: hsl(215, 25%, 15%);
    width: 50px; height: 50px;
  }
  .custom-price-marker {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .custom-price-marker > div {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;

const PropertyMap = ({ properties, center = [-14.24, -51.93], zoom = 4, onBoundsChange, selectedId, onSelect }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const prevPropertyIdsRef = useRef<string>("");

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Inject cluster styles
    const style = document.createElement("style");
    style.textContent = CLUSTER_STYLE;
    document.head.appendChild(style);
    styleRef.current = style;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);

    mapInstanceRef.current = map;

    if (onBoundsChange) {
      map.on("moveend", () => {
        const b = map.getBounds();
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      });
      setTimeout(() => {
        const b = map.getBounds();
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 500);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      styleRef.current?.remove();
    };
  }, []);

  // Update markers when properties change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove old cluster group
    if (clusterRef.current) {
      mapInstanceRef.current.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        let size: "small" | "medium" | "large" = "small";
        if (count >= 20) size = "large";
        else if (count >= 5) size = "medium";
        return L.divIcon({
          html: `<div class="marker-cluster-custom marker-cluster-${size}">+${count}</div>`,
          className: "custom-price-marker",
          iconSize: L.point(size === "large" ? 50 : size === "medium" ? 42 : 36, size === "large" ? 50 : size === "medium" ? 42 : 36),
        });
      },
    });

    const propsWithCoords = properties.filter((p) => p.latitude && p.longitude);

    propsWithCoords.forEach((p) => {
      const isSelected = p.id === selectedId;
      const isSale = p.listing_type === "sale";

      // Always solid color: red for sale, purple for rent
      const bgColor = isSale ? "hsl(0, 72%, 50%)" : "hsl(270, 60%, 50%)";
      const borderColor = isSelected
        ? "white"
        : (isSale ? "hsl(0, 72%, 38%)" : "hsl(270, 60%, 38%)");
      const shadow = isSelected
        ? "0 0 0 3px white, 0 4px 14px rgba(0,0,0,0.35)"
        : "0 2px 8px rgba(0,0,0,0.2)";
      const scale = isSelected ? "scale(1.2)" : "scale(1)";

      const icon = L.divIcon({
        className: "custom-price-marker",
        html: `<div style="
          background: ${bgColor};
          color: white;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
          white-space: nowrap;
          box-shadow: ${shadow};
          border: 2px solid ${borderColor};
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          ${isSelected ? "transform: translate(-50%, -50%) scale(1.2);" : "transform: translate(-50%, -50%);"}
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          text-align: center;
        ">${formatPriceShort(p.price)}</div>`,
        iconSize: [80, 28],
        iconAnchor: [40, 14],
      });

      const marker = L.marker([p.latitude!, p.longitude!], { icon });

      marker.on("click", () => {
        onSelect?.(p.id);
      });

      // Popup with share button
      const mapsUrl = `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
      const shareId = `share-${p.id}`;
      const imgHtml = p.property_images?.[0]?.url
        ? `<img src="${p.property_images[0].url}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />`
        : "";
      const popup = L.popup({ maxWidth: 250 }).setContent(
        `<div style="min-width:180px;font-family:'DM Sans',sans-serif;">
          ${imgHtml}
          <div style="font-weight:700;font-size:14px;color:${isSale ? 'hsl(0,72%,50%)' : 'hsl(270,60%,50%)'};">${formatPriceFull(p.price)}</div>
          <div style="font-size:13px;font-weight:600;margin-top:2px;">${p.title}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">${p.neighborhood ? p.neighborhood + ", " : ""}${p.city} - ${p.state}</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <a href="/imovel/${p.id}" style="font-size:12px;color:hsl(213,80%,50%);font-weight:600;">Ver detalhes →</a>
            <button id="${shareId}" style="
              background:hsl(215,25%,27%);color:white;border:none;border-radius:6px;
              padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;
              display:inline-flex;align-items:center;gap:4px;font-family:'DM Sans',sans-serif;
            ">📍 Compartilhar</button>
          </div>
          <span id="${shareId}-feedback" style="font-size:10px;color:hsl(150,60%,40%);display:none;margin-top:4px;">Link copiado!</span>
        </div>`
      );

      popup.on("add", () => {
        const btn = document.getElementById(shareId);
        btn?.addEventListener("click", async () => {
          const shareData = { title: p.title, text: `${p.title} — ${formatPriceFull(p.price)}`, url: mapsUrl };
          try {
            if (navigator.share) {
              await navigator.share(shareData);
            } else {
              await navigator.clipboard.writeText(mapsUrl);
              const fb = document.getElementById(`${shareId}-feedback`);
              if (fb) { fb.style.display = "inline"; setTimeout(() => { fb.style.display = "none"; }, 2000); }
            }
          } catch { /* user cancelled */ }
        });
      });

      marker.bindPopup(popup);

      cluster.addLayer(marker);
    });

    mapInstanceRef.current.addLayer(cluster);
    clusterRef.current = cluster;

    // Only fit bounds when the set of properties actually changes
    const currentIds = propsWithCoords.map((p) => p.id).sort().join(",");
    if (currentIds !== prevPropertyIdsRef.current && propsWithCoords.length > 0) {
      prevPropertyIdsRef.current = currentIds;
      const group = L.featureGroup(
        propsWithCoords.map((p) => L.marker([p.latitude!, p.longitude!]))
      );
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
    }
  }, [properties, selectedId, onSelect]);

  return <div ref={mapRef} className="h-full w-full" />;
};

export default PropertyMap;
