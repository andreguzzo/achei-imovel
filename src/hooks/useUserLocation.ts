import { useState, useEffect } from "react";

interface LocationInfo {
  state: string;
  stateName: string;
  city: string;
  lat: number;
  lng: number;
}

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const STATE_IMAGES: Record<string, { image: string; landmark: string }> = {
  ES: { image: "/images/states/es.jpg", landmark: "Convento da Penha, Vila Velha" },
  RJ: { image: "/images/states/rj.jpg", landmark: "Cristo Redentor, Rio de Janeiro" },
  SP: { image: "/images/states/sp.jpg", landmark: "Avenida Paulista, São Paulo" },
  MG: { image: "/images/states/mg.jpg", landmark: "Serra da Canastra, Minas Gerais" },
  BA: { image: "/images/states/ba.jpg", landmark: "Pelourinho, Salvador" },
  SC: { image: "/images/states/sc.jpg", landmark: "Florianópolis, Santa Catarina" },
  PR: { image: "/images/states/pr.jpg", landmark: "Cataratas do Iguaçu, Paraná" },
};

const DEFAULT_IMAGE = { image: "/images/states/default.jpg", landmark: "Brasil" };

export const getStateImage = (state: string) => {
  return STATE_IMAGES[state.toUpperCase()] ?? DEFAULT_IMAGE;
};

export const useUserLocation = () => {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try geolocation API first, fallback to timezone heuristic
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=pt-BR`,
              { headers: { "User-Agent": "Abitzo/1.0" } }
            );
            const data = await res.json();
            const state = data.address?.state_code?.toUpperCase() ?? 
                          data.address?.state?.substring(0, 2)?.toUpperCase() ?? "SP";
            setLocation({
              state,
              stateName: STATE_NAMES[state] ?? state,
              city: data.address?.city ?? data.address?.town ?? "",
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          } catch {
            setLocation({ state: "SP", stateName: "São Paulo", city: "São Paulo", lat: -23.55, lng: -46.63 });
          }
          setLoading(false);
        },
        () => {
          // Geolocation denied - default to SP
          setLocation({ state: "SP", stateName: "São Paulo", city: "São Paulo", lat: -23.55, lng: -46.63 });
          setLoading(false);
        },
        { timeout: 5000 }
      );
    } else {
      setLocation({ state: "SP", stateName: "São Paulo", city: "São Paulo", lat: -23.55, lng: -46.63 });
      setLoading(false);
    }
  }, []);

  return { location, loading };
};
