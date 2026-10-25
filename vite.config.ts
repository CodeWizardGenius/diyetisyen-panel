import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

// Basit ve güvenli yaklaşım: custom domain kullanıyorsanız base kök olmalı ('/').
// Eğer farklı bir base gerekiyorsa build sırasında VITE_BASE environment variable ile geçilebilir.
const base = process.env.VITE_BASE ?? '/';

// Üretim CSP'si. `frame-ancestors` meta ile yok sayıldığı için burada YOKTUR;
// o direktif HTTP başlığı gerektirir ve public/_headers içinde tanımlıdır.
// Not: React `style={{...}}` nitelikleri kullandığı için `style-src-attr 'unsafe-inline'` gerekir.
// `style-src 'self'` ile enjekte edilmiş inline <style> blokları yine de yasak kalır.
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';";

/**
 * CSP meta etiketini YALNIZCA build çıktısına ekler.
 * Dev sunucusu React Fast Refresh için inline <script type="module"> enjekte ettiğinden,
 * statik bir `script-src 'self'` meta geliştirmeyi bozar. Bu yüzden dev'de CSP yok,
 * üretimde tam koruma uygulanır. (İdeali CSP'yi HTTP başlığı olarak sunmaktır → public/_headers.)
 */
function injectCspMeta(): Plugin {
  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />\n`;
      return html.replace("</head>", `${meta}  </head>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), injectCspMeta()],
  base,
  build: {
    rollupOptions: {
      output: {
        // Büyük 3. parti kütüphaneleri ayrı chunk'lara böl: ilk yükleme ve cache verimliliği için.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});