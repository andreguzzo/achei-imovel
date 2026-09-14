import { useEffect, useRef } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { asBoundary, boundaryToPaths } from "@/lib/kmlParser";
import type { Tables } from "@/integrations/supabase/types";

export type MapProperty = Tables<"properties"> & {
  property_images?: Tables<"property_images">[];
};

interface PropertyMapProps {
  properties: Property[];
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** When false, the map no longer auto-fits to the results (used while searching by map area) */
  autoFit?: boolean;
}


const formatPriceFull = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);

const formatPriceShort = (price: number) => {
  if (price >= 1_000_000) return `R$${(price / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (price >= 1_000) return `R$${(price / 1_000).toFixed(0)}k`;
  return `R$${price}`;
};

const createPriceIcon = (priceText: string, isSale: boolean, isSelected: boolean): google.maps.Icon => {
  const bgColor = isSale ? "#dc2626" : "#9333ea";
  const borderColor = isSelected ? "#ffffff" : isSale ? "#b91c1c" : "#7e22ce";
  const width = Math.max(60, priceText.length * 8 + 20);
  const height = 28;

  const shadowFilter = isSelected
    ? `<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="white"/><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.35)"/></filter>`
    : `<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.2)"/></filter>`;

  const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>${shadowFilter}</defs>
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="14" fill="${bgColor}" stroke="${borderColor}" stroke-width="${isSelected ? 3 : 2}" filter="url(#s)"/>
      <text x="${width / 2}" y="${height / 2 + 4}" font-family="DM Sans, sans-serif" font-size="11" font-weight="800" fill="white" text-anchor="middle" letter-spacing="0.02em">${priceText}</text>
    </svg>`
  )}`;

  return {
    url: svg,
    scaledSize: new google.maps.Size(width, height),
    anchor: new google.maps.Point(width / 2, height / 2),
  };
};

const clusterRenderer = {
  render: (cluster: { count: number; position: google.maps.LatLng | google.maps.LatLngLiteral }) => {
    const count = cluster.count;
    let size = 36;
    let bg = "#475569";
    if (count >= 20) {
      size = 50;
      bg = "#1e293b";
    } else if (count >= 5) {
      size = 42;
      bg = "#334155";
    }

    const svg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${bg}" stroke="white" stroke-width="3"/>
        <text x="${size / 2}" y="${size / 2 + 4}" font-family="DM Sans, sans-serif" font-size="13" font-weight="800" fill="white" text-anchor="middle">+${count}</text>
      </svg>`
    )}`;

    return new google.maps.Marker({
      position: cluster.position,
      icon: {
        url: svg,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      zIndex: 1000 + count,
    });
  },
};

const PropertyMap = ({ properties, center = [-14.24, -51.93], zoom = 4, onBoundsChange, selectedId, onSelect, autoFit = true }: PropertyMapProps) => {
  const ready = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const prevPropertyIdsRef = useRef<string>("");
  const boundsCbRef = useRef(onBoundsChange);
  boundsCbRef.current = onBoundsChange;

  // Initialize / destroy map
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      clickableIcons: false,
      scrollwheel: true,
      gestureHandling: "greedy",
    });

    mapInstanceRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();

    let userMoved = false;
    const reportBounds = () => {
      const b = map.getBounds();
      if (!b || !boundsCbRef.current || !userMoved) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      boundsCbRef.current({
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      });
    };
    // Only offer "search this area" after the visitor actually moves the map
    const markMoved = () => { userMoved = true; };
    map.addListener("dragend", markMoved);
    mapRef.current.addEventListener("wheel", markMoved, { passive: true });
    mapRef.current.addEventListener("dblclick", markMoved);
    map.addListener("idle", reportBounds);



    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polygonsRef.current.forEach((poly) => poly.setMap(null));
      polygonsRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);


  // Update markers when properties change
  useEffect(() => {
    if (!mapInstanceRef.current || !ready) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    clustererRef.current?.clearMarkers();
    clustererRef.current = null;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();

    const propsWithCoords = properties.filter((p) => p.latitude && p.longitude);

    const markers = propsWithCoords.map((p) => {
      const isSelected = p.id === selectedId;
      const isSale = p.listing_type === "sale";
      const priceText = formatPriceShort(p.price);
      const position = { lat: p.latitude!, lng: p.longitude! };

      const marker = new google.maps.Marker({
        position,
        map,
        icon: createPriceIcon(priceText, isSale, isSelected),
        zIndex: isSelected ? 1000 : 1,
      });

      marker.addListener("click", () => {
        onSelect?.(p.id);

        const mapsUrl = `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
        const imgHtml = p.property_images?.[0]?.url
          ? `<img src="${p.property_images[0].url}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />`
          : "";

        const content = `
          <div style="min-width:180px;font-family:'DM Sans',sans-serif;">
            ${imgHtml}
            <div style="font-weight:700;font-size:14px;color:${isSale ? "#dc2626" : "#9333ea"};">${formatPriceFull(p.price)}</div>
            <div style="font-size:13px;font-weight:600;margin-top:2px;">${p.title}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${p.neighborhood ? p.neighborhood + ", " : ""}${p.city} - ${p.state}</div>
            <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
              <a href="/imovel/${p.id}" style="font-size:12px;color:#2563eb;font-weight:600;">Ver detalhes →</a>
              <button id="share-${p.id}" style="
                background:#334155;color:white;border:none;border-radius:6px;
                padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;
                display:inline-flex;align-items:center;gap:4px;font-family:'DM Sans',sans-serif;
              ">📍 Compartilhar</button>
            </div>
            <span id="share-${p.id}-feedback" style="font-size:10px;color:#16a34a;display:none;margin-top:4px;">Link copiado!</span>
          </div>
        `;

        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(map, marker);

        google.maps.event.addListenerOnce(infoWindowRef.current!, "domready", () => {
          const btn = document.getElementById(`share-${p.id}`);
          btn?.addEventListener("click", async () => {
            const shareData = { title: p.title, text: `${p.title} — ${formatPriceFull(p.price)}`, url: mapsUrl };
            try {
              if (navigator.share) {
                await navigator.share(shareData);
              } else {
                await navigator.clipboard.writeText(mapsUrl);
                const fb = document.getElementById(`share-${p.id}-feedback`);
                if (fb) {
                  (fb as HTMLElement).style.display = "inline";
                  setTimeout(() => { (fb as HTMLElement).style.display = "none"; }, 2000);
                }
              }
            } catch {
              // user cancelled
            }
          });
        });
      });

      return marker;
    });

    markersRef.current = markers;

    if (markers.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers,
        renderer: clusterRenderer,
      });
    }

    // Draw rural boundaries when properties carry one
    polygonsRef.current.forEach((poly) => poly.setMap(null));
    polygonsRef.current = properties.flatMap((p) => {
      const geometry = asBoundary((p as { boundary?: unknown }).boundary);
      if (!geometry) return [];
      const paths = boundaryToPaths(geometry);
      if (paths.length === 0) return [];
      return [
        new google.maps.Polygon({
          paths,
          map,
          strokeColor: "#2563eb",
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.18,
          clickable: false,
        }),
      ];
    });

    // Only fit bounds when the set of properties actually changes
    const currentIds = propsWithCoords.map((p) => p.id).sort().join(",");
    if (autoFit && currentIds !== prevPropertyIdsRef.current && propsWithCoords.length > 0) {
      prevPropertyIdsRef.current = currentIds;
      const bounds = new google.maps.LatLngBounds();
      propsWithCoords.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }));
      polygonsRef.current.forEach((poly) =>
        poly.getPaths().forEach((ring) => ring.forEach((pt) => bounds.extend(pt)))
      );
      map.fitBounds(bounds, 40);
    } else {
      prevPropertyIdsRef.current = currentIds;
    }
  }, [properties, selectedId, onSelect, ready, autoFit]);


  return <div ref={mapRef} className="h-full w-full" />;
};

export default PropertyMap;
