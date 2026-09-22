import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    host: "0.0.0.0",
  },

  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1"),
  },
});