import { unzipSync, strFromU8 } from "fflate";

export type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type BoundaryGeometry = Polygon | MultiPolygon;

export const MAX_KMZ_SIZE = 5 * 1024 * 1024;

const parseCoordString = (text: string): number[][] => {
  return text
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const parts = tuple.split(",");
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lng, lat];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
};

const ringsFromPolygonEl = (poly: Element): number[][][] => {
  const rings: number[][][] = [];

  const outer = poly.getElementsByTagName("outerBoundaryIs")[0];
  const outerCoords = outer?.getElementsByTagName("coordinates")[0]?.textContent;
  if (outerCoords) {
    const ring = parseCoordString(outerCoords);
    if (ring.length >= 3) rings.push(ring);
  }

  if (rings.length === 0) return rings;

  const inners = poly.getElementsByTagName("innerBoundaryIs");
  for (let i = 0; i < inners.length; i++) {
    const coords = inners[i].getElementsByTagName("coordinates")[0]?.textContent;
    if (!coords) continue;
    const ring = parseCoordString(coords);
    if (ring.length >= 3) rings.push(ring);
  }

  return rings;
};

/** Extracts every polygon found in a KML document as a GeoJSON geometry. */
export const parseKmlString = (kml: string): BoundaryGeometry | null => {
  const doc = new DOMParser().parseFromString(kml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const polygonEls = doc.getElementsByTagName("Polygon");
  const polygons: number[][][][] = [];

  for (let i = 0; i < polygonEls.length; i++) {
    const rings = ringsFromPolygonEl(polygonEls[i]);
    if (rings.length > 0) polygons.push(rings);
  }

  if (polygons.length === 0) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] };
  return { type: "MultiPolygon", coordinates: polygons };
};

/** Reads a .kml or .kmz file and returns its polygons as GeoJSON. */
export const parseBoundaryFile = async (file: File): Promise<BoundaryGeometry | null> => {
  if (file.size > MAX_KMZ_SIZE) {
    throw new Error("FILE_TOO_LARGE");
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".kml")) {
    return parseKmlString(await file.text());
  }

  if (name.endsWith(".kmz")) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(buffer);
    } catch {
      throw new Error("INVALID_FILE");
    }

    const kmlEntries = Object.keys(files).filter((k) => k.toLowerCase().endsWith(".kml"));
    if (kmlEntries.length === 0) throw new Error("NO_KML");

    // doc.kml is the conventional main document
    const main = kmlEntries.find((k) => k.toLowerCase().endsWith("doc.kml")) ?? kmlEntries[0];

    for (const entry of [main, ...kmlEntries.filter((k) => k !== main)]) {
      const geometry = parseKmlString(strFromU8(files[entry]));
      if (geometry) return geometry;
    }
    return null;
  }

  throw new Error("UNSUPPORTED_TYPE");
};

/** Flattens a boundary geometry into rings of {lat,lng} paths for Google Maps. */
export const boundaryToPaths = (geometry: BoundaryGeometry): google.maps.LatLngLiteral[][] => {
  const polygons: number[][][][] =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons.flatMap((rings) =>
    rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
  );
};

/** Builds a GeoJSON Polygon from a single Google Maps ring. */
export const pathToBoundary = (path: google.maps.LatLngLiteral[]): Polygon | null => {
  if (path.length < 3) return null;
  const ring = path.map((p) => [p.lng, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: "Polygon", coordinates: [ring] };
};

/** Best-effort validation of an unknown value stored in the database. */
export const asBoundary = (value: unknown): BoundaryGeometry | null => {
  if (!value || typeof value !== "object") return null;
  const geo = value as { type?: string; coordinates?: unknown };
  if ((geo.type === "Polygon" || geo.type === "MultiPolygon") && Array.isArray(geo.coordinates)) {
    return value as BoundaryGeometry;
  }
  return null;
};

/** Average of all vertices — good enough for centering a map. */
export const boundaryCenter = (geometry: BoundaryGeometry): google.maps.LatLngLiteral | null => {
  const paths = boundaryToPaths(geometry);
  let lat = 0;
  let lng = 0;
  let count = 0;
  paths.forEach((ring) =>
    ring.forEach((p) => {
      lat += p.lat;
      lng += p.lng;
      count++;
    })
  );
  if (count === 0) return null;
  return { lat: lat / count, lng: lng / count };
};
