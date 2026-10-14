import React from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Info,
  Leaf,
  LineChart,
  ShieldCheck,
  UserPlus,
  Users
} from "lucide-react";

interface Props {
  /** Ana çağrı butonu: giriş yapılmamışsa giriş ekranına, yapılmışsa panele götürür. */
  onStart: () => void;
  isAuthed: boolean;
}

const FEATURES: Array<{ icon: React.ReactNode; title: string; text: string }> = [
  {
    icon: <Users size={20} />,
    title: "Danışan ve uyum takibi",
    text: "Danışanları plan, tarih aralığı ve uyum yüzdesiyle listeleyin; riskli olanları tek bakışta görün."
  },
  {
    icon: <LineChart size={20} />,
    title: "Ölçüm ve VKİ grafikleri",
    text: "Kilo, yağ oranı, kas, bel ve kalça ölçümlerini kaydedin; değişimi grafik ve VKİ kategorisiyle izleyin."
  },
  {
    icon: <Calculator size={20} />,
    title: "BMR ve diyet planlayıcı",
    text: "Mifflin-St Jeor veya Harris-Benedict ile hedef kaloriyi hesaplayın, öğünleri sürükle-bırak ile düzenleyip PDF alın."
  },
  {
    icon: <CalendarDays size={20} />,
    title: "Randevu takvimi",
    text: "Çalışma günleriniz, seans süreniz ve tampon süreye göre çakışmasız randevu oluşturun."
  },
  {
    icon: <Bell size={20} />,
    title: "Uyarı ve risk merkezi",
    text: "Düşük uyum, kilo platosu ve biten planlar için otomatik uyarılar; sessiz saat ve WhatsApp mesaj taslağı."
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Yedekleme ve oturum güvenliği",
    text: "JSON/CSV yedek alın; hareketsizlikte otomatik çıkış ve paylaşımlı bilgisayarda verileri temizleyerek çıkış."
  }
];

const STEPS: Array<{ icon: React.ReactNode; title: string; text: string }> = [
  { icon: <UserPlus size={18} />, title: "Danışanı ekleyin", text: "Ad, plan ve tarihleri girin; ilk ölçümü kaydedin." },
  { icon: <ClipboardList size={18} />, title: "Planı hazırlayın", text: "Hedef kaloriyi hesaplayın, öğünleri düzenleyin ve PDF olarak paylaşın." },
  { icon: <Activity size={18} />, title: "Uyumu izleyin", text: "Öğün çizelgesi, ölçümler ve uyarılarla süreci takip edin." }
];

/** Giriş yapılmamış ziyaretçilere gösterilen ürün tanıtım sayfası. */
export const LandingPage: React.FC<Props> = ({ onStart, isAuthed }) => {
  // HashRouter kullanıldığı için "#bolum" bağlantıları rotayı değiştirir; kaydırma elle yapılır.
  const scrollTo = (id: string) => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };
  const ctaLabel = isAuthed ? "Panele Dön" : "Panele Giriş";

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <span className="lp-brand">
            <span className="lp-logo">
              <Leaf size={18} />
            </span>
            <span>
              <strong>NutriCare</strong>
              <small>Diyetisyen Paneli</small>
            </span>
          </span>
          <nav className="lp-nav-links" aria-label="Tanıtım bölümleri">
            <button type="button" onClick={() => scrollTo("ozellikler")}>Özellikler</button>
            <button type="button" onClick={() => scrollTo("nasil-calisir")}>Nasıl Çalışır</button>
          </nav>
          <button type="button" className="btn btn-primary btn-small" onClick={onStart}>
            {ctaLabel}
          </button>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Diyetisyenler için klinik paneli</span>
              <h1>Danışan takibi, diyet planı ve randevular tek panelde.</h1>
              <p className="lp-lead">
                NutriCare; ölçümleri, uyumu, diyet listelerini ve randevularınızı bir arada tutar. Hesaplamaları
                klinik ayarlarınıza göre yapar, riskli danışanları sizin için öne çıkarır.
              </p>
              <div className="lp-hero-actions">
                <button type="button" className="btn btn-primary" onClick={onStart}>
                  {isAuthed ? "Panele Dön" : "Demoyu Dene"} <ArrowRight size={16} />
                </button>
                <button type="button" className="btn btn-outline" onClick={() => scrollTo("ozellikler")}>
                  Özellikleri İncele
                </button>
              </div>
              {!isAuthed ? (
                <p className="lp-note">Demo sürümde herhangi bir e-posta ve şifreyle giriş yapabilirsiniz.</p>
              ) : null}
            </div>

            {/* Panelin sadeleştirilmiş, statik bir önizlemesi (örnek değerler). */}
            <div className="lp-preview" aria-hidden="true">
              <div className="lp-preview-head">
                <span className="lp-dot" />
                <span className="lp-dot" />
                <span className="lp-dot" />
                <small>Örnek görünüm</small>
              </div>
              <div className="lp-preview-stats">
                <div>
                  <small>Ortalama uyum</small>
                  <strong>%78</strong>
                  <span className="lp-bar"><span style={{ width: "78%" }} /></span>
                </div>
                <div>
                  <small>Riskli danışan</small>
                  <strong>2</strong>
                  <span className="lp-pill lp-pill-rose">takipte</span>
                </div>
              </div>
              <ul className="lp-preview-list">
                <li>
                  <span className="lp-avatar">A</span>
                  <span>
                    <strong>Ayşe K.</strong>
                    <small>2 Haftalık Fit Plan</small>
                  </span>
                  <span className="lp-pill">%86</span>
                </li>
                <li>
                  <span className="lp-avatar">M</span>
                  <span>
                    <strong>Mehmet T.</strong>
                    <small>Düşük Karbonhidrat</small>
                  </span>
                  <span className="lp-pill lp-pill-rose">%54</span>
                </li>
                <li>
                  <span className="lp-avatar">Z</span>
                  <span>
                    <strong>Zeynep A.</strong>
                    <small>Glütensiz 14G</small>
                  </span>
                  <span className="lp-pill">%91</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="ozellikler" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>Günlük işinizi kolaylaştıran özellikler</h2>
              <p>Ölçümden plana, randevudan uyarıya kadar danışan sürecinin tamamı.</p>
            </div>
            <div className="lp-features">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="lp-feature">
                  <span className="lp-feature-icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="nasil-calisir" className="lp-section lp-section-alt">
          <div className="lp-container">
            <div className="lp-section-head">
              <h2>Üç adımda başlayın</h2>
              <p>Kurulum gerekmez; tarayıcıdan açıp hemen kullanmaya başlayabilirsiniz.</p>
            </div>
            <ol className="lp-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="lp-step">
                  <span className="lp-step-num">{index + 1}</span>
                  <span className="lp-step-icon">{step.icon}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <p className="lp-disclaimer">
              <Info size={15} />
              Demo sürüm: veriler sunucuya gönderilmez, yalnızca bu tarayıcıda saklanır. Paylaşımlı bilgisayarlarda
              "Paylaşımlı bilgisayardan çık" seçeneğiyle oturumu kapatın.
            </p>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-cta">
              <div>
                <h2>Panelinizi şimdi deneyin</h2>
                <ul className="lp-cta-list">
                  <li><CheckCircle2 size={15} /> Kurulum yok</li>
                  <li><CheckCircle2 size={15} /> Örnek danışanlarla hazır</li>
                  <li><CheckCircle2 size={15} /> Açık ve koyu tema</li>
                </ul>
              </div>
              <button type="button" className="btn btn-primary" onClick={onStart}>
                {ctaLabel} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          © {new Date().getFullYear()} NutriCare · Diyetisyen Paneli
        </div>
      </footer>
    </div>
  );
};
