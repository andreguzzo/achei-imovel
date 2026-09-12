import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Button } from "@/components/ui/button";
import { Upload, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  type BoundaryGeometry,
  boundaryToPaths,
  parseBoundaryFile,
  pathToBoundary,
} from "@/lib/kmlParser";

interface BoundaryEditorProps {
  boundary: BoundaryGeometry | null;
  onChange: (boundary: BoundaryGeometry | null) => void;
  center?: google.maps.LatLngLiteral | null;
  pt?: boolean;
}

const FILL = "#2563eb";

const BoundaryEditor = ({ boundary, onChange, center, pt = true }: BoundaryEditorProps) => {
  const ready = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const drawingRef = useRef<{ polyline: google.maps.Polyline; markers: google.maps.Marker[] } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [parsing, setParsing] = useState(false);

  const t = (ptText: string, enText: string) => (pt ? ptText : enText);

  // Keep the initial center out of the effect deps so the map is created once
  const initialCenterRef = useRef(center ?? null);
  if (!mapInstanceRef.current && center) initialCenterRef.current = center;

  // Initialize map
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;

    const initialCenter = initialCenterRef.current;
    const map = new google.maps.Map(mapRef.current, {
      center: initialCenter ?? { lat: -14.24, lng: -51.93 },
      zoom: initialCenter ? 15 : 4,
      mapTypeId: "hybrid",
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: false,
      clickableIcons: false,
    });

    mapInstanceRef.current = map;

    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
      mapInstanceRef.current = null;
    };
  }, [ready]);

  // Render the saved boundary
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !ready) return;

    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    if (!boundary || drawing) return;

    const paths = boundaryToPaths(boundary);
    if (paths.length === 0) return;

    const polygon = new google.maps.Polygon({
      paths,
      map,
      strokeColor: FILL,
      strokeWeight: 2,
      fillColor: FILL,
      fillOpacity: 0.2,
      editable: true,
      draggable: false,
    });

    const commit = () => {
      const ring = polygon
        .getPath()
        .getArray()
        .map((p) => ({ lat: p.lat(), lng: p.lng() }));
      const updated = pathToBoundary(ring);
      if (updated) onChange(updated);
    };

    const path = polygon.getPath();
    path.addListener("set_at", commit);
    path.addListener("insert_at", commit);
    path.addListener("remove_at", commit);

    polygonsRef.current = [polygon];

    const bounds = new google.maps.LatLngBounds();
    paths.forEach((ring) => ring.forEach((p) => bounds.extend(p)));
    map.fitBounds(bounds, 30);
  }, [boundary, ready, drawing, onChange]);

  const clearDrawing = () => {
    drawingRef.current?.polyline.setMap(null);
    drawingRef.current?.markers.forEach((m) => m.setMap(null));
    drawingRef.current = null;
  };

  // Manual drawing mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !ready || !drawing) return;

    const polyline = new google.maps.Polyline({
      map,
      path: [],
      strokeColor: FILL,
      strokeWeight: 2,
    });
    drawingRef.current = { polyline, markers: [] };

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      polyline.getPath().push(e.latLng);
      const marker = new google.maps.Marker({
        position: e.latLng,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: FILL,
          strokeWeight: 2,
        },
      });
      drawingRef.current?.markers.push(marker);
    });

    return () => {
      google.maps.event.removeListener(listener);
      clearDrawing();
    };
  }, [drawing, ready]);

  const startDrawing = () => {
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];
    setDrawing(true);
  };

  const finishDrawing = () => {
    const line = drawingRef.current?.polyline;
    const ring =
      line
        ?.getPath()
        .getArray()
        .map((p) => ({ lat: p.lat(), lng: p.lng() })) ?? [];
    const geometry = pathToBoundary(ring);
    setDrawing(false);
    if (!geometry) {
      toast({
        title: t("Marque pelo menos 3 pontos", "Mark at least 3 points"),
        variant: "destructive",
      });
      onChange(boundary);
      return;
    }
    onChange(geometry);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setParsing(true);
    try {
      const geometry = await parseBoundaryFile(file);
      if (!geometry) {
        toast({
          title: t("Nenhuma área encontrada no arquivo", "No area found in the file"),
          description: t(
            "O arquivo não contém um polígono válido. Verifique se ele foi exportado com os limites do terreno.",
            "The file has no valid polygon. Make sure it was exported with the land boundaries."
          ),
          variant: "destructive",
        });
        return;
      }
      setDrawing(false);
      onChange(geometry);
      toast({ title: t("Área importada com sucesso", "Area imported successfully") });
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      const messages: Record<string, string> = {
        FILE_TOO_LARGE: t("Arquivo muito grande (máximo 5 MB)", "File too large (max 5 MB)"),
        UNSUPPORTED_TYPE: t("Envie um arquivo .kmz ou .kml", "Please upload a .kmz or .kml file"),
        NO_KML: t("O arquivo KMZ não contém um mapa", "The KMZ file has no map inside"),
        INVALID_FILE: t("Não foi possível ler o arquivo", "Could not read the file"),
      };
      toast({
        title: messages[code] ?? t("Não foi possível ler o arquivo", "Could not read the file"),
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept=".kmz,.kml"
            className="hidden"
            onChange={handleFile}
            disabled={parsing}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t("Enviar KMZ/KML", "Upload KMZ/KML")}
          </span>
        </label>

        {drawing ? (
          <Button type="button" size="sm" onClick={finishDrawing} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {t("Concluir área", "Finish area")}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={startDrawing} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            {t("Desenhar no mapa", "Draw on map")}
          </Button>
        )}

        {(boundary || drawing) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={() => {
              setDrawing(false);
              onChange(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("Limpar área", "Clear area")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {drawing
          ? t(
              "Clique no mapa para marcar os limites do terreno e depois clique em Concluir área.",
              "Click the map to mark the land boundaries, then click Finish area."
            )
          : t(
              "Envie o arquivo KMZ/KML do georreferenciamento ou desenhe os limites no mapa. Depois é possível arrastar os pontos para ajustar.",
              "Upload the KMZ/KML file or draw the boundaries on the map. You can drag the points to adjust afterwards."
            )}
      </p>

      <div ref={mapRef} className="h-80 w-full overflow-hidden rounded-lg border" style={{ minHeight: 320 }} />
    </div>
  );
};

export default BoundaryEditor;
