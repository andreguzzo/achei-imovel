import { useEffect, useState } from "react"; // Shared Google Maps script loader

const SCRIPT_ID = "google-maps-script";

declare global {
  interface Window {
    google?: typeof google;
  }
}

export const useGoogleMaps = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      const check = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(check);
          setReady(true);
        }
      }, 50);
      return () => clearInterval(check);
    }

    const callbackName = `initGoogleMaps_${Math.random().toString(36).substring(2, 9)}`;
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

    if (!key) {
      console.error("Google Maps browser key is not configured.");
      return;
    }

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      setReady(true);
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=${callbackName}${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Script is shared across components; do not remove on unmount.
    };
  }, []);

  return ready;
};
