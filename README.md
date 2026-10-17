# Diyetisyen Paneli (NutriCare)

Diyetisyenler için danışan takibi, ölçüm geçmişi, diyet planı oluşturma ve uyarı yönetimi sağlayan tek sayfalık (SPA) yönetim paneli. React + TypeScript + Vite ile geliştirilmiştir.

> Not: Bu bir **demo**'dur. Başlangıç verileri statik mock'tur ve gerçek bir backend yoktur; giriş ekranı herhangi bir e-posta/şifre kombinasyonunu kabul eder. Oturum, danışanlar, randevular, ölçümler ve diyet planı düzenleyicisinin içeriği tarayıcının `localStorage`'ında saklanır (sayfa yenilense de korunur).

## Özellikler

- **Dashboard** — uyum yüzdesi ve öğün tamamlama grafikleri, hızlı danışan tablosu.
- **Danışanlar** — danışan ekleme/düzenleme (ad, plan, tarih, uyum, durum), kartlardan detay görüntüleme ve plana atama.
- **Ölçüm takibi** — kilo, yağ oranı, kas kütlesi, bel/kalça girişi; canlı VKİ (BMI) hesabı ve validasyon.
- **Diyet planları** — sürükle-bırak öğün düzenleyici, BMR/TDEE ve makro hesaplayıcı.
- **Randevular** — randevu oluşturma, düzenleme ve silme; tarihe göre sıralı liste.
- **Uyarılar** — eşik tabanlı kurallar, sessize alma, otomasyon.
- **Ayarlar** — profil, bildirim, beslenme, program ve güvenlik (oturum zaman aşımı) ayarları.

## Teknolojiler

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (build) ve `@vitejs/plugin-react-swc`
- [Recharts](https://recharts.org/) (grafikler)
- [lucide-react](https://lucide.dev/) (ikonlar)

## Gereksinimler

- Node.js 20+
- npm

## Kurulum ve Çalıştırma

```bash
npm install      # bağımlılıkları yükle
npm run dev      # geliştirme sunucusu (http://localhost:5173)
```

## Komutlar

| Komut             | Açıklama                                               |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Geliştirme sunucusunu başlatır.                        |
| `npm run build`   | Tip kontrolü (`tsc`) + production derlemesi (`dist/`). |
| `npm run preview` | Üretim derlemesini yerelde önizler.                    |
| `npm run deploy`  | `dist/` klasörünü GitHub Pages'e (`gh-pages`) atar.    |

## Dağıtım (Deployment)

Proje `diyetisyen-panel.com.tr` özel alan adıyla GitHub Pages üzerinde yayınlanır:

- `main` dalına her push'ta `.github/workflows/deploy.yml` otomatik derleyip yayınlar.
- Özel alan adı `public/CNAME` içinde tanımlıdır; SPA yönlendirmesi için build sonrası `index.html`, `404.html` olarak kopyalanır.

## Proje Yapısı

```
src/
├── App.tsx                 # Ana uygulama kabuğu, layout, sekmeler ve iş mantığı
├── main.tsx                # Giriş noktası (React root + Router)
├── main.css                # Global stiller
├── components/
│   ├── alerts/             # Uyarı motoru ve görünümleri
│   └── settings/           # Ayarlar görünümü ve panelleri
└── types/                  # Paylaşılan tip tanımları (alerts, settings)
```
