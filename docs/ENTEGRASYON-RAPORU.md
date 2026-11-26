# Diyetisyen Paneli ↔ Backend Entegrasyon Raporu

Tarih: 2026-11-27  
Kapsam: `diyetisyen-panel` istemcisinin `nutricare-backend` API'sine bağlanması.  
Durum: **Kod entegrasyonu tamamlandı; 2. tur (A–I) uygulandı; `mock` modu korundu. Backend testleri
94/94, panel tip kontrolü ve http/mock derlemeleri yeşil. Tarayıcı kabul turu gerçek backend'e karşı
yapıldı (bkz. §9.3; iki senaryo kısmi).**

## 1. Mimari

```
src/api/
  config.ts     VITE_API_MODE, VITE_API_BASE_URL, API_ORIGIN, token anahtarları
  client.ts     fetch sarmalayıcı: zarf açma, hata eşleme, 401→refresh (tek uçuş), 429 retry
  auth.ts       giriş / yenile / çıkış / ben / şifre değiştir
  endpoints.ts  patients, measurements, plans, tracking, appointments, insight,
                messages, notifications, settings, consent, public
  cache.ts      http modunda sunucu verisinin bellek içi önbelleği
  bootstrap.ts  giriş sonrası çekirdek veri + danışan detayının tembel yüklenmesi
```

- Ekranlar `http` modunda `localStorage`'a danışan/klinik verisi yazmaz; veri `cache` üzerinden
  okunur ve API'ye yazılır. `mock` modunda eski `localStorage` yolu aynen çalışır. Mock, ikinci bir
  uygulama kopyası yerine `IS_HTTP` dallarıyla korunur; böylece ekran davranışı iki modda aynı kalır.
- `usePersistentState` http modunda yalnızca `dp_ui`, `dp_plan_*`, `dp_plan_patient` gibi istemci
  tercihi/taslak anahtarlarını kalıcı tutar.
- Access token bellekte, refresh token `sessionStorage`'da (`nutricare.refresh_token`).
- 401'de tek bir refresh promise paylaşılır; başarısızsa oturum kapatılır ve giriş ekranına dönülür.

## 2. `dp_*` → uç eşlemesi

| Anahtar | Yerine geçen uç | Durum |
|---|---|---|
| `dp_auth_token/user/expires_at/auth` | `POST /panel/auth/giris`, `/yenile`, `/cikis`, `GET /panel/ben` | ✅ taşındı |
| `dp_auth_user_hash` | — | ✅ kaldırıldı (hash istemcide tutulmuyor) |
| `dp_patients` | `GET/POST /panel/danisanlar`, `PATCH/DELETE /panel/danisanlar/{no}` | ✅ |
| `dp_measurements` | `GET/POST /panel/danisanlar/{no}/olcumler`, `PATCH/DELETE /panel/olcumler/{id}` | ✅ (PATCH backend'e eklendi) |
| `dp_patient_plans` | `GET/PUT /panel/danisanlar/{no}/plan` | ✅ |
| `dp_plan_*` taslakları | İstemci taslağı; kaydet → `PUT .../plan` | ✅ istemcide kaldı / yazma API'ye |
| `dp_plan_profile` | Danışan kartı + `PATCH /panel/danisanlar/{no}` | ✅ |
| `dp_patient_notes` | `GET/PUT .../notlar` | ✅ |
| `dp_patient_reminders` | `GET/PUT .../hatirlatmalar` | ✅ |
| `dp_meal_grid_<id>` | `GET/PUT .../ogun-cizelgesi?planStart=` | ✅ |
| `dp_mobile_events` | `GET /panel/aktiviteler`, `.../olaylar`, `.../zaman-cizelgesi`, `GET /panel/aktiviteler/okunmamis?since=` | ✅ (gösterim + sunucu okunmamış sayısı) |
| `dp_appointments` | `GET/POST /panel/randevular`, `PATCH/DELETE /panel/randevular/{id}` | ✅ |
| Çalışma saatleri / randevu ayarları | `GET/PUT /panel/calisma-saatleri`, `/panel/randevu-ayarlari` | ✅ |
| `dp_patient_links` | `GET/POST .../randevu-linki`, `/panel/randevu-talepleri` (+ onay/red) | ✅ link durumu + üretim |
| Herkese açık talep sayfası | `GET/POST /acik/randevu-talebi/{token}` | ✅ |
| `dp_notifications` | `GET /panel/bildirimler`, `POST/{id}/okundu`, `POST /okundu`, `DELETE` | ✅ |
| Mesajlar | `GET/POST .../mesajlar`, `POST /panel/mesajlar/{id}/okundu` | ✅ |
| Mesaj şablonları | `GET /panel/mesaj-sablonlari` | ✅ sunucu şablonları; hata olursa sabit liste |
| `dp_alert_rules_v1` | `GET/PUT /panel/uyari-kurallari` | ✅ |
| `dp_alert_state_v1`, `dp_alert_dismissed_v1` | `GET /panel/uyarilar`, `POST .../coz`, `.../yoksay` | ✅ |
| Dashboard / öncelik | `GET /panel/dashboard`, `/panel/oncelik` | ✅ sunucu verisi (etkin uyum = elle ?? hesaplanan) |
| `dp_report_sent_v1` | `GET .../haftalik-rapor`, `POST .../gonder` | ✅ rapor sunucudan; gönderim durumu oturum içi |
| `dp_clinic_settings_v1` | `GET /panel/ayarlar` + bölüm `PUT` uçları | ✅ tek çağrı + bölüm bazlı uyarı |
| KVKK / silme | `GET .../kvkk`, `POST .../silme-talebi`, `.../onayla` | ✅ |
| Sağlık verisi | `GET .../saglik/riza`, `GET .../saglik` | ✅ rıza kapısı + 7/30 gün özeti |
| Plan şablonları | `GET/POST /panel/plan-sablonlari`, `GET/PATCH/DELETE /{id}`, `POST /{id}/ata` | ✅ kaydet/yükle/ata/sil |
| Danışan özeti | `GET .../ozet` | ✅ kart + not + hatırlatma tek istek |
| `dp_export_audit_log`, yedek | `GET/POST /panel/yedek`, `GET /panel/disa-aktarimlar` | ✅ yedek + sunucu denetim kaydı |
| `dp_theme`, `dp_ui`, `dp_plan_patient`, `dp_feed_last_read_at` | — | ✅ istemcide kaldı |

### Ayarlar

`GET /panel/ayarlar` tek çağrıda profile/security/nutrition/notifications/schedule bölümlerini döner.
Bölüm servisi yanıt vermezse ilgili bölüm `{ "status": "alınamadı" }` olur; panel o bölümde varsayılana
düşer ve "Bu bölüm şu an yüklenemedi, tekrar deneyin" uyarısı gösterir.

- Profil: `GET /panel/ayarlar` + `PUT /panel/ayarlar/profil` (profil okuma ayrıca `GET /panel/ben`)
- Güvenlik: `PUT /panel/ayarlar/guvenlik` (`session_timeout_min`)
- Beslenme: `PUT /panel/ayarlar/beslenme`
- Bildirim: `PUT /panel/ayarlar/bildirimler`
- Çalışma: `PUT /panel/ayarlar/calisma`

## 3. Backend'de yapılan sınırlı eklemeler

| Eksik | Çözüm |
|---|---|
| `PUT /panel/ayarlar/profil` | identity'ye eklendi; `dietitians` satırını günceller, `GET /panel/ben` genişletildi |
| `PUT /panel/ayarlar/guvenlik` | identity'ye eklendi; `session_timeout_min` (5–180) migration'ı |
| `PATCH /panel/olcumler/{id}` | tracking'e eklendi; yalnız gönderilen alanlar güncellenir, 404 kiracı kontrolü |
| `GET /panel/ayarlar` birleşik | ✅ backend'de var (identity); panel tek çağrı kullanır |
| `GET /panel/aktiviteler/okunmamis?since=` | ✅ backend'de var (tracking); panel rozet sayısını sunucudan alır |
| `GET .../randevu-linki` | ✅ backend'de var (appointment); panel aktif link durumunu gösterir |
| `GET .../ozet` | ✅ backend'de var (patient); panel tek istekle kart+not+hatırlatma yükler |
| `GET/POST /panel/yedek`, `GET /panel/disa-aktarimlar` | ✅ backend'de var (consent); panel yedekleme ve denetim kaydını kullanır |
| CORS tek köken | `CORS_ORIGIN` virgülle ayrılmış listeye çevrildi; gateway testi eklendi |

Ek backend değişiklikleri: `PatientSchema.compliance` nullable (veri yok = null), 84 test geçiyor,
`openapi.json` yeniden üretildi (103 uç).

## 4. Doğrulama

| Kontrol | Sonuç |
|---|---|
| Backend `pnpm typecheck` | ✅ |
| Backend `pnpm lint` | ✅ |
| Backend `pnpm test` | ✅ 84/84 |
| Backend `pnpm openapi` + openapi snapshot testi | ✅ |
| Panel `npm run build` (`VITE_API_MODE=http`, `VITE_API_BASE_URL=http://localhost:3000`) | ✅ |
| Panel `npm run build` (env yok) | ✅ beklenen hata: "VITE_API_MODE belirtin" (bkz. §8) |
| `VITE_API_MODE=http` + taban adres yok | ✅ beklenen derleme hatası |
| Panel `npx tsc --noEmit` | ⚠️ bir tip hatası bulunup düzeltildi; sonrasında kabuk (pwsh) başlatma hatası nedeniyle yeniden koşulamadı |
| Üretim CSP meta + `dist/_headers` | ✅ `connect-src 'self' <API kökeni>` |
| Tarayıcı: gerçek backend ile giriş + dashboard | ✅ (dyt@test.nutricare) |
| Tarayıcı: sayfa yenilendikten sonra oturum (refresh) | ✅ dashboard korundu |
| Tarayıcı: danışan ekle → yenile → kalıcı | ✅ (`Panel Test Danışan`, sonra silindi) |
| Tarayıcı: profil kaydet → yenile → kalıcı | ✅ (`PUT /panel/ayarlar/profil`) |
| Tarayıcı: randevu talebi onayla | ✅ talepler 3→2, randevu listesine düştü |
| Tarayıcı: dashboard/öncelik/aktivite sunucudan | ✅ |
| Tarayıcı: http modunda `localStorage` boş | ✅ yalnız `sessionStorage` token/idle |
| Tarayıcı: backend kapalıyken hata mesajı | ✅ "Sunucuya ulaşılamıyor..." + tekrar dene |
| Tarayıcı: uçtan uca tüm kabul listesi | ⚠️ kısmi (aşağıdaki açık işler) |

**Not:** İlk turda Vite sunucusu 5175’teydi ve gateway CORS varsayılanı 5173 olduğu için tarayıcı
testleri geçici bir aynı-köken proxy ile yapıldı. İkinci turda 5173 kullanıldı ve kalıcı Vite dev
proxy’si (`/panel`, `/mobil`, `/acik`) eklendi. Üretim/standart akış `VITE_API_BASE_URL=http://localhost:3000`
ve gateway CORS köken listesiyle çalışır; `PUT`/`PATCH` için gateway’in yeniden derlenmesi gerekir.

## 5. Kabul ölçütleri (§10) durumu

| # | Ölçüt | Durum | Not |
|---|---|---|---|
| 1 | Yanlış şifre → Türkçe hata; doğru şifre → dashboard; yenilemede oturum | ✅ (giriş + yenileme) / ⚠️ yanlış şifre UI denenmedi | `dyt@test.nutricare` ile giriş, sayfa yenilenince oturum korundu; hata mesajı `error.message` |
| 2 | Access süresi dolunca sessiz yenileme; refresh geçersizse giriş | ⚠️ kod hazır, kısa TTL ile denenmedi | Tek uçuşlu refresh + 401'de tek retry |
| 3 | Çıkışta `/panel/auth/cikis`, eski token 401 | ⚠️ kod hazır, tarayıcıda denenmedi | `authApi.cikis` + `clearTokens` |
| 4 | Danışan ekle/düzenle/sil, başka tarayıcıda görünür | ✅ (ekle + yenile) | `Panel Test Danışan` eklendi, yenilemede korundu, sonra silindi; `localStorage` boş kaldı |
| 5 | Ölçüm/not/hatırlatma/plan/çizelge/randevu/uyarı/mesaj/bildirim kalıcı | ⚠️ kısmi | Profil ve randevu talebi onayı yazıldı; diğer yazma uçları kod bağlı |
| 6 | Dashboard/öncelik/uyarı/rapor sunucudan | ✅ dashboard/öncelik/aktivite | `cache.dashboard/priority/alerts`; haftalık rapor `insightApi` |
| 7 | Public randevu linki → talep → onay | ✅ onay / ⚠️ link üretimi denenmedi | Panelde talep onaylandı (3→2, randevuya düştü) |
| 8 | Panelden mobil davet → `POST /mobil/auth/davet/{token}` | ⚠️ UI eklendi, denenmedi | Danışan çekmecesinde “Mobil Davet” kartı `patientsApi.davet` çağırır |
| 9 | İki diyetisyen birbirini göremez (404) | ✅ backend entegrasyon testi | Çapraz erişim 404 testi mevcut |
| 10 | Backend kapalıyken çökmez, anlaşılır hata + tekrar dene | ✅ | “Sunucuya ulaşılamıyor…” + giriş butonuyla tekrar deneme |
| 11 | `VITE_API_MODE=mock` ile backend'siz çalışma | ✅ tarayıcıda denendi | Demo 3 danışan, `localStorage` yolu korundu |
| 12 | Üretim derlemesi hatasız; CSP API'ye izin verir | ✅ | `npm run build` yeşil; meta + `_headers` `connect-src 'self' <API kökeni>` |
| 13 | http modunda `localStorage`'da danışan/klinik verisi yok | ✅ tarayıcıda denendi | Yalnız `sessionStorage` token/idle; `localStorage` boş |

**Tarayıcı turu notu:** giriş, oturum yenileme, danışan ekleme/silme, profil kaydetme, randevu
talebi onaylama, dashboard/öncelik/aktivite, hata durumu ve `mock` modu gerçek backend'e karşı
denendi. Kalan yazma uçları (ölçüm, not, hatırlatma, plan, öğün çizelgesi, mesaj, bildirim, KVKK,
davet) aynı API katmanından çağrılıyor ancak bu turda tek tek denenmedi.

## 5.1 Bilinen sınırlar / açık işler

- **Uçtan uca tarayıcı turu kısmi:** giriş, oturum yenileme, danışan ekleme/silme, profil
  kaydetme, randevu talebi onaylama, dashboard/öncelik/aktivite, hata durumu ve `mock` modu gerçek
  backend'e karşı denendi. Ölçüm/not/plan/öğün çizelgesi/mesaj/bildirim/KVKK/davet akışları bu turda
  tek tek denenmedi.
- **Yedek kapsamı:** sunucu yedeği danışan + ölçüm içerir; plan/not/hatırlatma/öğün çizelgesi taşınmaz.
- **Uyarı yeniden açma** sunucuda yok; koşul sürüyorsa motor uyarıyı kendisi yeniden açar.
- **Dashboard 7 günlük grafikleri** istemcideki öğün çizelgesi verisinden üretiliyor; sunucu
  dashboard'u yalnız özet/öncelik/uyarı/aktivite sağlar. http modunda öğün verisi yokken artık
  sahte "örnek veri" yerine boş durum metni gösterilir (§8).
- **Sağlık verisi** yalnız danışanın mobil rızası varsa gösterilir; rıza yoksa panel veri istemez.
- **Paket/ödeme alanları** patient DTO'sunda opsiyonel; formdan temizleme gönderilmiyor.
- **Refresh token** `sessionStorage`'da; sekme kapanınca oturum biter (bilinçli XSS azaltması).

## 6. Yapılandırma

- `.env.example` eklendi. Geliştirmede varsayılan `http` + `http://localhost:3000`.
- Üretim derlemesinde `VITE_API_MODE` zorunludur (http veya mock); verilmezse derleme hata verir.
  `http` için `VITE_API_BASE_URL` de zorunludur.
- GitHub Actions `vars.VITE_API_MODE` / `vars.VITE_API_BASE_URL` değişkenlerini kullanır.
- `public/_headers` kaldırıldı; CSP ve güvenlik başlıkları `vite.config.ts` tarafından derleme
  çıktısına yazılır. Meta CSP ile başlık CSP'si aynı API kökenini içerir; joker yok.

## 7. Ek doğrulama ve düzeltmeler (aynı gün, ikinci tur)

Bu turda gerçek backend’e karşı ek olarak şunlar denendi ve geçti:

| Akış | Sonuç |
|---|---|
| Yanlış şifre → “Bilgiler hatalı.” | ✅ |
| Doğru şifre → dashboard; sayfa yenilemede oturum | ✅ |
| Danışan ekle → reload → sunucudan gelir | ✅ (`E2E Panel Test`) |
| Ölçüm ekle → reload → görünür; ölçüm düzenle (PATCH) | ✅ (62.5 → 63.1 kg) |
| Plan kaydet (PUT) | ✅ |
| Randevu oluştur (POST) | ✅ |
| Public link üret → oturumsuz talep → tek kullanım reddi → panelde onay | ✅ |
| Mesaj gönder (POST) | ✅ |
| Haftalık rapor sunucudan + “Onayla ve Gönder” | ✅ |
| Profil/ayarlar kaydet (PUT) → reload → kalıcı | ✅ |
| Çıkış → giriş ekranı; refresh token silinir | ✅ |
| `localStorage`’da yalnız `dp_plan_*` taslakları | ✅ |

### Bulunan ek hatalar ve düzeltmeleri

1. **`SecurityPanel.tsx` çift `IS_HTTP` importu** — SWC “Identifier already declared” hatası tüm
   modül grafiğini düşürüyordu; tek importa indirildi.
2. **CORS `Access-Control-Allow-Methods`** — gateway yalnız varsayılan metotlara izin veriyordu;
   `PUT`/`PATCH` preflight’ta engelleniyordu. `services/api-gateway/src/app.ts` içine
   `GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS` eklendi, test yazıldı. Gateway yeniden derlendi;
   tarayıcıdan `PATCH /panel/olcumler/:id` **200** döndü. Backend testleri **85/85**.
3. **Public uçlar `Authorization` istiyordu** — `publicApi` çağrıları `auth:false` yapıldı; randevu
   talebi sayfası token’ı okuyabiliyor.
4. **HashRouter sorgusu** — `#/randevu-talep?d=..&k=..` için `location.search` boş kalabiliyordu;
   hash sorgusu da okunuyor.
5. **Ölçüm sekmesi geç hidrasyon** — çekmece açıldıktan sonra gelen ölçümler listeye yansımıyordu;
   `subscribeServerData` ile tazeleniyor.
6. **Vite dev proxy** — `/panel`, `/mobil`, `/acik` → `localhost:3000`; farklı dev portlarında CORS
   sorunu yaşanmaması için eklendi (üretim derlemesini etkilemez).

## 8. Düzeltme turu (`DUZELTMELER-PROMPT.md`, 2026-11-21)

Bağımsız tarayıcı testinde bulunan eksikler giderildi ve yerel backend'e (`docker compose`) karşı tarayıcıda doğrulandı.

| # | Konu | Sonuç | Değişen dosya |
|---|---|---|---|
| 1 | Ölçüm formu: alanlar isteğe bağlı (yalnız tarih zorunlu, en az bir değer); boş alan `0` değil `null` | ✅ yalnız kiloyla ölçüm kaydedildi, diğer alanlar ve VKİ "—" | `src/App.tsx` |
| 2 | Danışan formu: uyum boş bırakılabilir | ✅ kod değişikliği gerekmedi; uyum boş danışan oluşturuldu, sunucuda `compliance: null` | — |
| 3 | http modunda dashboard'da sahte grafik | ✅ öğün verisi yokken "Henüz öğün verisi yok…" metni; mock modunda örnek veri korunur | `src/App.tsx`, `src/main.css` |
| 4 | Açılış sayfası "herhangi bir e-posta" notu | ✅ http modunda "kliniğinizin size verdiği hesap bilgileri" | `src/components/landing/LandingPage.tsx` |
| 5 | `VITE_API_MODE` verilmeden üretim derlemesi | ✅ artık hata verir; mock ve http derlemeleri geçer; README'ye komutlar ve GitHub `VITE_API_BASE_URL` notu | `vite.config.ts`, `README.md` |
| 6 | Kısa ağ kopukluğu oturumu kapatıyordu | ✅ yenileme sonucu `ok / invalid / network`; ağ hatası ve 5xx'te oturum korunur, `AG_YOK` döner | `src/api/client.ts` |
| 7 | Dashboard/öncelik eksik: yerel compose'da outbox işçisi yoktu (100+ olay bekliyordu) | ✅ `outbox-worker` servisi eklendi; 109 olay aktarıldı, insight 12 danışanın hepsini görüyor, aktivite akışı gerçek kayıtlarla doluyor | `nutricare-backend/docker-compose.yml` |
| 8 | UUID olmayan kimlik 500 dönüyordu | ✅ ortak hata işleyicisinde PostgreSQL `22P02` → `404 BULUNAMADI`; entegrasyon testi eklendi | `nutricare-backend/packages/platform/src/http.ts`, `test/integration.test.ts` |
| — | Ek: boy yokken VKİ rozeti "0" gösteriyordu | ✅ "—" | `src/App.tsx` |

Doğrulama: panel `npx tsc --noEmit` temiz; üç derleme modu beklendiği gibi; backend `typecheck`, `lint`,
`test`, `openapi:check` yeşil. Test sırasında oluşturulan danışan silindi.

### Hâlâ açık (bu turun kapsamı dışı)

- **Ortalama uyum ve öncelik:** ✅ §9'da çözüldü; insight artık etkin uyumu (`manual ?? computed`) kullanıyor.
  Yerel `id: 0` / "Danışan" duman testi kaydı yerel veritabanından temizlendi.
- **Ağ kesikken sayfa yenileme:** giriş ekranı görünür; yenileme token'ı silinmez, bağlantı dönünce sayfa
  yenilenince oturum geri gelir.
- **Kısa TTL ile sessiz yenileme ve çevrimdışı senaryosu** (madde 6) tarayıcıda simüle edilmedi; mantık kod incelemesiyle doğrulandı.
- Backend 2. tur eksikleri (`BACKEND-EKSIKLER-2-PROMPT.md`) ve canlı (tünel) yayının güncellenmesi bekliyor.

## 9. 2. tur (`PANEL-ENTEGRASYON-2-PROMPT.md`, 2026-11-27)

### 9.1 Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/api/types.ts` | Yedek/denetim, randevu linki durumu, sağlık, danışan özeti, plan ve mesaj şablonu tipleri |
| `src/api/endpoints.ts` | `backupApi`, `healthApi`, `plansApi` şablon uçları, `appointmentsApi.linkDurumu`, `trackingApi.okunmamis`; `settingsApi.tumu` artık `GET /panel/ayarlar` kullanır |
| `src/api/cache.ts` | `settingsUnavailable`, `planTemplates`, `healthByPatient` |
| `src/api/bootstrap.ts` | Danışan detayı `GET .../ozet` ile; plan şablonları ön yükleme; birleşik ayarlar |
| `src/components/settings/panels/SecurityPanel.tsx` | Sunucu yedeği indir/yükle, CSV istemcide, sunucu denetim kaydı listesi |
| `src/components/settings/useSettings.ts`, `SettingsView.tsx` | Birleşik ayarlar + bölüm bazlı "yüklenemedi" uyarısı ve tekrar dene |
| `src/components/dashboard/ActivityFeed.tsx` | Okunmamış sayısı `GET /panel/aktiviteler/okunmamis`, 99+ rozet, hata halinde gizleme |
| `src/components/messaging/MessageComposer.tsx` | Mesaj şablonları sunucudan; hata halinde sabit liste |
| `src/components/reports/WeeklyReport.tsx` | Elle girilen uyum etiketi |
| `src/App.tsx` | Randevu linki durumu; Sağlık sekmesi; plan şablonu kaydet/yükle/ata/sil; danışan özeti sonrası liste tazeleme |
| `nutricare-backend/services/insight/migrations/002_insight_manual_compliance.sql` | `patient_metrics.compliance_manual` |
| `nutricare-backend/services/insight/src/engine.ts`, `app.ts` | Etkin uyum = `manual ?? computed`; dashboard/öncelik/uyarı/rapor |
| `nutricare-backend/services/patient/src/app.ts` | `patient.*` olayına `complianceManual` |
| `nutricare-backend/packages/contracts/src/events.ts` | Olay şemasına `complianceManual` |
| `nutricare-backend/test/integration.test.ts` | Etkin uyum testleri + migration |

### 9.2 Kararlar

- Yedek içe aktarma **yalnızca ekler**; panel bunu onay metninde ve sonuç mesajında açıkça söyler.
- CSV dışa aktarımı yeni backend ucu açmadan, `GET /panel/yedek` yanıtından istemcide üretilir.
- Danışan detayında kart/not/hatırlatma `GET .../ozet` ile tek istekte gelir; ölçüm/plan/çizelge/mesaj ayrı kalır.
- Sağlık sekmesi rıza yoksa veri istemez; rıza varsa son 7/30 gün adım/uyku/nabız özeti gösterir.
- Plan şablonları http modunda sunucudadır; mock modundaki yerel kopyalama davranışı korunur.
- Insight etkin uyumu tek yerde (`effectiveCompliance`) hesaplar; haftalık raporda elle değer varsa `compliance.score` ona döner ve `source: "manual"` işaretlenir.

### 9.3 Doğrulama

| # | Kontrol | Sonuç | Kanıt |
|---|---|---|---|
| 1 | A: yedek indir/yükle | ✅ | `GET /panel/yedek` 200 → JSON/CSV indi; aynı dosya yüklendi → "1 danışan ve 0 ölçüm eklendi"; denetim listesinde iki yeni kayıt; içe aktarılan kopya sonra silindi |
| 2 | B: okunmamış rozeti | ✅ | `GET /panel/aktiviteler/okunmamis?since=...` 200; hesapta olay olmadığı için sayı 0 ve rozet gizli; `since` geri alınınca da sunucuyla aynı |
| 3 | C: randevu linki durumu | ✅ | İlk açılışta "Link üret"; `POST` sonrası ham link bir kez; sayfa yenilenince `GET` 200 → "Aktif link var — 27.11.2026 … / 28.11.2026 …" + "Yeni link üret" |
| 4 | D: birleşik ayarlar | ✅ (kısmi) | Ayarlar açılışında yalnız `GET /panel/ayarlar` 200; `beslenme` bölüm çağrısı 0. Servis düşürme senaryosu bu turda denenmedi; `status: "alınamadı"` dalı ve uyarı UI'ı kodda hazır |
| 5 | E: danışan özeti | ✅ | Çekmece açılışında `GET /panel/danisanlar/1/ozet` 200; `notlar`/`hatirlatmalar` GET'i yok |
| 6 | F: sağlık verisi | ✅ (kısmi) | Rızasız danışanda "izin vermedi" metni; `GET .../saglik` çağrılmadı. Rızalı/verili danışan bu yerel veride yok; grafik dalı kod incelemesiyle doğrulandı |
| 7 | G: plan şablonları | ✅ | `POST` 201 → listede; `POST /{id}/ata` 200 + `PATCH /panel/danisanlar/1` 200; `DELETE` 204 → liste boş |
| 8 | H: mesaj şablonları | ✅ | `GET /panel/mesaj-sablonlari` 200; şablon seçenekleri sunucudan geldi |
| 9 | I: etkin uyum | ✅ | Backend testleri: elle 40/hesap null → 40; elle null/hesap 80 → 80; elle 82/hesap 83 → 82; öncelik ve uyum uyarısı 40'ı kullandı |
| 10 | mock modu | ✅ | `VITE_API_MODE=mock npm run build` geçti; yedek/mesaj/link dalları eski davranışta |
| 11 | Tip/derleme/localStorage | ✅ | `npx tsc --noEmit` temiz; http ve mock derlemeleri geçti; http modunda `localStorage` yalnız `dp_plan_*`, `dp_feed_last_read_at` |

Backend: `corepack pnpm typecheck`, `lint`, `test` (**94/94, atlanan 0**) ve `openapi:check` (**109 uç**) temiz.
Yerel insight veritabanına `002_insight_manual_compliance.sql` uygulandı; `id: 0` / "Danışan" duman testi kaydı
bu yerel veritabanında bulunmadı (daha önce temizlenmiş).

### 9.4 Bilinen sınırlar

- Sağlık verisi grafiği rızalı gerçek veriyle bu turda görsel olarak denenmedi.
- Ayarlar bölüm hatası, bir servis kasıtlı durdurularak denenmedi; birleşik uç ve kod dalı doğrulandı.
- Yedek danışan + ölçüm kapsamındadır; plan/not/hatırlatma/öğün çizelgesi taşınmaz.
- Yerel test sırasında oluşturulan randevu linki ve denetim kayıtları veritabanında kaldı; danışan kopyası silindi.
