import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    ),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    ),
  },
});
