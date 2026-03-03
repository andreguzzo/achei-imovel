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

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);

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
      const icon = L.divIcon({
        className: "custom-price-marker",
        html: `<div style="
          background: ${isSelected ? "hsl(213, 80%, 50%)" : "white"};
          color: ${isSelected ? "white" : "hsl(215, 25%, 12%)"};
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          border: 2px solid ${isSelected ? "hsl(213, 80%, 40%)" : "hsl(214, 20%, 90%)"};
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        ">${formatPrice(p.price)}</div>`,
        iconSize: [0, 0],
        iconAnchor: [40, 15],
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
          <div style="font-weight:700;font-size:14px;color:hsl(213,80%,50%);">${formatPrice(p.price)}</div>
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
