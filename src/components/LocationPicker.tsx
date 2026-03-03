import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  pt?: boolean;
}

const LocationPicker = ({ latitude, longitude, onLatChange, onLngChange, pt = true }: LocationPickerProps) => {
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const lat = latitude ? parseFloat(latitude) : null;
  const lng = longitude ? parseFloat(longitude) : null;
  const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

  // Initialize / destroy map
  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] = hasCoords ? [lat!, lng!] : [-14.24, -51.93];
    const zoom = hasCoords ? 15 : 4;

    const map = L.map(mapRef.current, { center, zoom, zoomControl: true });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);

    // Place marker if coords exist
    if (hasCoords) {
      markerRef.current = L.marker([lat!, lng!], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        onLatChange(pos.lat.toFixed(6));
        onLngChange(pos.lng.toFixed(6));
      });
    }

    // Click to place/move marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: cLat, lng: cLng } = e.latlng;
      onLatChange(cLat.toFixed(6));
      onLngChange(cLng.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng);
      } else {
        markerRef.current = L.marker(e.latlng, { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          onLatChange(pos.lat.toFixed(6));
          onLngChange(pos.lng.toFixed(6));
        });
      }
    });

    mapInstanceRef.current = map;

    // Fix map size after render
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [showMap]);

  // Sync marker when coords change externally (manual input)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (hasCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat!, lng!]);
      } else {
        markerRef.current = L.marker([lat!, lng!], { draggable: true }).addTo(mapInstanceRef.current);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          onLatChange(pos.lat.toFixed(6));
          onLngChange(pos.lng.toFixed(6));
        });
      }
      mapInstanceRef.current.setView([lat!, lng!], Math.max(mapInstanceRef.current.getZoom(), 13));
    }
  }, [latitude, longitude]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLatChange(pos.coords.latitude.toFixed(6));
        onLngChange(pos.coords.longitude.toFixed(6));
        if (!showMap) setShowMap(true);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            {pt ? "Latitude" : "Latitude"}
          </label>
          <Input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => onLatChange(e.target.value)}
            placeholder="-23.550520"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            {pt ? "Longitude" : "Longitude"}
          </label>
          <Input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => onLngChange(e.target.value)}
            placeholder="-46.633308"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((v) => !v)} className="gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {showMap
            ? (pt ? "Fechar mapa" : "Close map")
            : (pt ? "Selecionar no mapa" : "Pick on map")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleUseMyLocation} className="gap-1.5">
          <Navigation className="h-3.5 w-3.5" />
          {pt ? "Usar minha localização" : "Use my location"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {pt
          ? "Ideal para imóveis rurais, loteamentos ou endereços sem número. Clique no mapa ou arraste o marcador."
          : "Ideal for rural properties, subdivisions, or addresses without a number. Click the map or drag the marker."}
      </p>

      {showMap && (
        <div
          ref={mapRef}
          className="h-64 w-full rounded-lg border overflow-hidden"
          style={{ minHeight: 256 }}
        />
      )}
    </div>
  );
};

export default LocationPicker;
