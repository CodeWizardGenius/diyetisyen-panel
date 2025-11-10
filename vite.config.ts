import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// GitHub Pages için base path
// Eğer repo adı "username.github.io" ise base "/" olmalı
// Diğer durumlarda "/repo-name/" olmalı
function getBasePath() {
  // GitHub Actions'ta GITHUB_REPOSITORY environment variable'ı var
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    const [, repoName] = repo.split('/');
    // User/Organization pages için base "/"
    if (repoName.endsWith('.github.io')) {
      return '/';
    }
    // Project pages için base "/repo-name/"
    return `/${repoName}/`;
  }
  
  // Lokal geliştirme veya manuel build
  if (process.env.GITHUB_PAGES === "true") {
    // Manuel build için repo adını buraya yazın
    const repoName = "diyetisyen-panel";
    return `/${repoName}/`;
  }
  
  return "/";
}

export default defineConfig({
  plugins: [react()],
  base: getBasePath()
});

