/*
 * React yüklenmeden önce kayıtlı temayı uygular: açılışta yanlış temayla boyama (FOUC)
 * ve Ayarlar'a geçince karanlığa "atlama" tamamen önlenir.
 * CSP `script-src 'self'` altında çalışabilmesi için inline script yerine harici dosya.
 */
(function () {
  try {
    var mode = localStorage.getItem("dp_theme") || "light";
    var resolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode === "dark"
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = resolved;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();