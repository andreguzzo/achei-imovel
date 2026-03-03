import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

const PropertyMap = ({ properties, center = [-14.24, -51.93], zoom = 4, onBoundsChange, selectedId, onSelect }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
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
      // Trigger initial bounds
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
    };
  }, []);

  // Update markers when properties change
  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;
    markersRef.current.clearLayers();

    const propsWithCoords = properties.filter((p) => p.latitude && p.longitude);

    propsWithCoords.forEach((p) => {
      const isSelected = p.id === selectedId;
      const isSale = p.listing_type === "sale";
      // Sale = red tones, Rent = purple tones
      const bgColor = isSelected
        ? (isSale ? "hsl(0, 72%, 50%)" : "hsl(270, 60%, 50%)")
        : (isSale ? "hsl(0, 72%, 96%)" : "hsl(270, 60%, 96%)");
      const textColor = isSelected
        ? "white"
        : (isSale ? "hsl(0, 72%, 40%)" : "hsl(270, 60%, 35%)");
      const borderColor = isSelected
        ? (isSale ? "hsl(0, 72%, 40%)" : "hsl(270, 60%, 40%)")
        : (isSale ? "hsl(0, 50%, 80%)" : "hsl(270, 40%, 80%)");
      const shadow = isSelected
        ? "0 4px 12px rgba(0,0,0,0.3)"
        : "0 2px 6px rgba(0,0,0,0.15)";

      const icon = L.divIcon({
        className: "custom-price-marker",
        html: `<div style="
          background: ${bgColor};
          color: ${textColor};
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
          white-space: nowrap;
          box-shadow: ${shadow};
          border: 2px solid ${borderColor};
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transform: ${isSelected ? "scale(1.15)" : "scale(1)"};
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        ">${formatPriceShort(p.price)}</div>`,
        iconSize: [0, 0],
        iconAnchor: [35, 15],
      });

      const marker = L.marker([p.latitude!, p.longitude!], { icon }).addTo(markersRef.current!);

      marker.on("click", () => {
        onSelect?.(p.id);
      });

      // Popup
      const imgHtml = p.property_images?.[0]?.url
        ? `<img src="${p.property_images[0].url}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />`
        : "";
      marker.bindPopup(
        `<div style="min-width:180px;font-family:'DM Sans',sans-serif;">
          ${imgHtml}
          <div style="font-weight:700;font-size:14px;color:${isSale ? 'hsl(0,72%,50%)' : 'hsl(270,60%,50%)'};">${formatPriceFull(p.price)}</div>
          <div style="font-size:13px;font-weight:600;margin-top:2px;">${p.title}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">${p.neighborhood ? p.neighborhood + ", " : ""}${p.city} - ${p.state}</div>
          <a href="/imovel/${p.id}" style="display:inline-block;margin-top:6px;font-size:12px;color:hsl(213,80%,50%);font-weight:600;">Ver detalhes →</a>
        </div>`,
        { maxWidth: 250 }
      );
    });

    // Fit bounds if there are coords
    if (propsWithCoords.length > 0) {
      const group = L.featureGroup(
        propsWithCoords.map((p) => L.marker([p.latitude!, p.longitude!]))
      );
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
    }
  }, [properties, selectedId, onSelect]);

  return <div ref={mapRef} className="h-full w-full" />;
};

export default PropertyMap;
