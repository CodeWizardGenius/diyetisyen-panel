import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Update this value if your repository name differs.
const repoName = "diyetisyen-panel";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === "true" ? `/${repoName}/` : "/"
});

