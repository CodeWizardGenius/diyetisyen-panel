# Diyetisyen Paneli (NutriCare)

Diyetisyenler için danışan takibi, ölçüm geçmişi, diyet planı oluşturma ve uyarı yönetimi sağlayan tek sayfalık (SPA) yönetim paneli. React + TypeScript + Vite ile geliştirilmiştir.

> Veri kaynağı iki modludur: `VITE_API_MODE=http` gerçek `nutricare-backend` API'sine bağlanır; `VITE_API_MODE=mock` ise backend olmadan tarayıcı içi demo verisiyle çalışır. Ayrıntı ve taşınan anahtarlar: `docs/ENTEGRASYON-RAPORU.md`.

> **Durum (2026-11-27):** 2. tur tamamlandı — sunucu yedeği/denetim kaydı, okunmamış aktivite sayacı,
> randevu linki durumu, birleşik ayarlar, danışan özeti, sağlık verisi, plan ve mesaj şablonları API'ye bağlı.
> Backend testleri 94/94; panel `tsc` ve http/mock derlemeleri temiz.

## API modları

| Mod | Davranış |
|---|---|
| `http` | Giriş/JWT, danışan, ölçüm, plan, randevu, uyarı, mesaj, bildirim ve ayarlar sunucudan gelir. Tarayıcıda danışan/klinik verisi tutulmaz; yalnız tema, UI ve plan taslağı gibi istemci tercihleri `localStorage`'da kalır. |
| `mock` | Backend gerekmez; demo verisi `localStorage`'da tutulur. Geliştirme/demo içindir. |

`.env.example` dosyasını `.env.local` olarak kopyalayın:

```bash
VITE_API_MODE=http
VITE_API_BASE_URL=http://localhost:3000
```

Üretim derlemesi `VITE_API_MODE` verilmeden güvenli varsayılan olarak `mock` ile derlenir.
`http` seçilip `VITE_API_BASE_URL` verilmezse derleme bilinçli olarak hata verir (sessizce mock'a düşmez).
Gerçek API ile yayın için `VITE_API_MODE=http` ve `VITE_API_BASE_URL` birlikte verilmelidir.

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

Backend'i yerelde ayağa kaldırmak için `nutricare-backend` kökünde `docker compose up --build -d`
çalıştırın (gateway `http://localhost:3000`, Swagger `http://localhost:3000/docs`). Test hesapları
`dyt@test.nutricare` / `TestD-2026` yalnızca yerel seed içindir.

## Komutlar

| Komut             | Açıklama                                               |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Geliştirme sunucusunu başlatır.                        |
| `npm run build`   | Tip kontrolü (`tsc`) + production derlemesi (`dist/`). |
| `npm run preview` | Üretim derlemesini yerelde önizler.                    |
| `npm run deploy`  | `dist/` klasörünü GitHub Pages'e (`gh-pages`) atar.    |

Üretim derlemesinde mod **açıkça** verilmelidir; verilmezse derleme hata verir:

```bash
VITE_API_MODE=mock npm run build                                            # demo (backend'siz)
VITE_API_MODE=http VITE_API_BASE_URL=https://api.ornek.com npm run build     # gerçek API
```

> GitHub Pages yayını için repo ayarlarında `VITE_API_BASE_URL` değişkeni tanımlı olmalı
> (Settings → Secrets and variables → Actions → Variables). Yoksa yayın derlemesi hata verir.

## Dağıtım (Deployment)

Proje `diyetisyen-panel.com.tr` özel alan adıyla GitHub Pages üzerinde yayınlanır:

- `main` dalına her push'ta `.github/workflows/deploy.yml` otomatik derleyip yayınlar.
- Derleme adımı `VITE_API_MODE` ve `VITE_API_BASE_URL` değerlerini repo değişkenlerinden
  (`vars.VITE_API_MODE`, `vars.VITE_API_BASE_URL`) okur.
- `public/CNAME` özel alan adını tanımlar; SPA yönlendirmesi için build sonrası `index.html`,
  `404.html` olarak kopyalanır.
- CSP (`connect-src`) ve `_headers` derleme zamanında API kökeninden üretilir; API adresi değişince
  yeniden derleyin.

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
