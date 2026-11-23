import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Basit ve güvenli yaklaşım: custom domain kullanıyorsanız base kök olmalı ('/').
// Farklı bir base gerekiyorsa build sırasında VITE_BASE environment variable ile geçilebilir.
const base = process.env.VITE_BASE ?? "/";

const apiModeRaw = (process.env.VITE_API_MODE ?? "").trim().toLowerCase();
const apiBase = (process.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

/**
 * Üretim derlemesi sessizce mock'a düşmez: mod ve taban adres açıkça verilmelidir.
 * `VITE_API_MODE=mock` bilinçli demo derlemesidir ve API adresi istemez.
 */
function assertApiConfig(command: "serve" | "build"): void {
  if (command !== "build") {
    return;
  }
  if (apiModeRaw !== "mock" && apiModeRaw !== "http") {
    // Mod açıkça verilmeli: sessizce demo (mock) derlemesine düşmek canlıya yanlış panel çıkarır.
    if (apiModeRaw === "") {
      throw new Error(
        "VITE_API_MODE belirtin: 'http' (gerçek API) veya 'mock' (demo). Örn. VITE_API_MODE=mock npm run build"
      );
    }
    throw new Error("VITE_API_MODE yalnızca 'http' veya 'mock' olabilir.");
  }
  if (apiModeRaw === "http" && !apiBase) {
    throw new Error("VITE_API_MODE=http için VITE_API_BASE_URL zorunludur.");
  }
}

const apiOrigin = (() => {
  if (!apiBase) {
    return "";
  }
  try {
    return new URL(apiBase).origin;
  } catch {
    return "";
  }
})();

// CSP: `connect-src` yalnızca derleme zamanındaki API kökenine izin verir; joker yok.
// `frame-ancestors` meta ile yok sayıldığı için HTTP başlığına yazılır.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const SECURITY_HEADERS_POLICY = `${CONTENT_SECURITY_POLICY}; frame-ancestors 'self'`;

/**
 * CSP meta etiketini YALNIZCA build çıktısına ekler.
 * Dev sunucusu React Fast Refresh için inline <script type="module"> enjekte ettiğinden,
 * statik bir `script-src 'self'` meta geliştirmeyi bozar. Bu yüzden dev'de CSP yok,
 * üretimde tam koruma uygulanır.
 */
function injectCspMeta(): Plugin {
  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />\n`;
      return html.replace("</head>", `${meta}  </head>`);
    }
  };
}

/**
 * Cloudflare Pages / Netlify `_headers` dosyasını derleme zamanında üretir; böylece
 * API kökeni hem meta hem başlıkta aynı kalır. GitHub Pages bu dosyayı yok sayar.
 */
function emitSecurityHeaders(): Plugin {
  return {
    name: "emit-security-headers",
    apply: "build",
    async writeBundle(options) {
      const outDir = options.dir ?? join(process.cwd(), "dist");
      const body = [
        "/*",
        `  Content-Security-Policy: ${SECURITY_HEADERS_POLICY}`,
        "  X-Frame-Options: SAMEORIGIN",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()",
        ""
      ].join("\n");
      await writeFile(join(outDir, "_headers"), body, "utf8");
    }
  };
}

export default defineConfig(({ command }) => {
  assertApiConfig(command);
  return {
    plugins: [react(), injectCspMeta(), emitSecurityHeaders()],
    base,
    server: {
      // Geliştirmede gateway'e aynı köken üzerinden git: CORS/port farkı sorun olmaz.
      proxy: {
        "/panel": "http://localhost:3000",
        "/mobil": "http://localhost:3000",
        "/acik": "http://localhost:3000"
      }
    },
    build: {
      rollupOptions: {
        output: {
          // Büyük 3. parti kütüphaneleri ayrı chunk'lara böl: ilk yükleme ve cache verimliliği için.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            icons: ["lucide-react"]
          }
        }
      }
    }
  };
});
