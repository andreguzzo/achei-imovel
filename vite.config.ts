import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "recharts";
          if (id.includes("node_modules/@radix-ui")) return "radix";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion")) return "framer-motion";
          if (
            id.includes("node_modules/@googlemaps") ||
            id.includes("node_modules/@react-google-maps") ||
            id.includes("node_modules/google-maps")
          )
            return "google-maps";
        },
      },
    },
  },
}));
