/// <reference types="vite/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./main.css";

// GitHub Pages statik bir host; HTML5 BrowserRouter ile alt rotada (ör. /settings)
// yapılan hard refresh, sunucuda o yolda fiziksel dosya aranmasına ve 404'e yol açar.
// HashRouter rotayı "#" sonrasında tutar; bu kısım sunucuya hiç gitmediğinden
// yenileme her zaman index.html'i yükler ve 404 oluşmaz.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);

