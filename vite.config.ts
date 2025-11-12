import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Basit ve güvenli yaklaşım: custom domain kullanıyorsanız base kök olmalı ('/').
// Eğer farklı bir base gerekiyorsa build sırasında VITE_BASE environment variable ile geçilebilir.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  plugins: [react()],
  base,
});

