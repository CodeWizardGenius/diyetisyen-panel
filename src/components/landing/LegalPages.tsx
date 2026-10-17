import React from "react";
import { ArrowLeft, Leaf, Mail, ShieldCheck } from "lucide-react";

/** Footer ve iletişim sayfalarında kullanılan destek e-posta adresi. */
export const SUPPORT_EMAIL = "destek@diyetisyen-panel.com.tr";

export type LegalSlug = "iletisim" | "kvkk" | "gizlilik" | "kullanim-sartlari";

export const LEGAL_LINKS: Array<{ slug: LegalSlug; label: string }> = [
  { slug: "iletisim", label: "İletişim" },
  { slug: "kvkk", label: "KVKK Aydınlatma Metni" },
  { slug: "gizlilik", label: "Gizlilik Politikası" },
  { slug: "kullanim-sartlari", label: "Kullanım Şartları" }
];

/** URL yolunu (baştaki eğik çizgi olmadan) hukuki sayfa anahtarına çevirir. */
export const legalSlugFromPath = (pathname: string): LegalSlug | null => {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  return LEGAL_LINKS.some((link) => link.slug === slug) ? (slug as LegalSlug) : null;
};

type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };

type LegalContent = { title: string; intro: string; updated: string; sections: Section[] };

const CONTENT: Record<LegalSlug, LegalContent> = {
  iletisim: {
    title: "İletişim",
    intro:
      "NutriCare Diyetisyen Paneli ile ilgili sorularınız, destek talepleriniz ve geri bildirimleriniz için bize ulaşın.",
    updated: "Ekim 2026",
    sections: [
      {
        heading: "Destek ve genel iletişim",
        paragraphs: ["Tüm sorularınız için aşağıdaki e-posta adresinden bize yazabilirsiniz. En geç 2 iş günü içinde dönüş yapıyoruz."],
        bullets: [
          `Destek e-postası: ${SUPPORT_EMAIL}`,
          "Çalışma saatleri: Hafta içi 09:00 – 18:00"
        ]
      },
      {
        heading: "Klinik iletişim bilgileri",
        paragraphs: [
          "Diyet listelerinizin ve PDF çıktılarınızın üzerinde görünen klinik adı, telefon ve e-posta bilgileri panel içindeki Ayarlar > Profil & Klinik bölümünden düzenlenir. Bu bilgileri güncelleyerek danışanlarınızla paylaştığınız belgeleri kişiselleştirebilirsiniz."
        ]
      },
      {
        heading: "Veri sahibi başvuruları",
        paragraphs: [
          "Kişisel verilerinize ilişkin taleplerinizi (KVKK madde 11 kapsamındaki haklarınız) aydınlatma metnindeki yöntemlerle iletebilirsiniz."
        ]
      }
    ]
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    intro:
      "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, NutriCare Diyetisyen Paneli tarafından kişisel verilerinizin, özellikle özel nitelikli sağlık verilerinizin, nasıl işlendiğini açıklamak amacıyla hazırlanmıştır.",
    updated: "Ekim 2026",
    sections: [
      {
        heading: "1. Veri sorumlusu",
        paragraphs: [
          "Veri sorumlusu, hizmeti sunan diyetisyen/kliniktir. Veri sorumlusunun kimliği ve iletişim bilgileri, panel içindeki Ayarlar > Profil & Klinik bölümünde tanımlıdır. Taleplerinizi buradaki e-posta üzerinden iletebilirsiniz."
        ]
      },
      {
        heading: "2. İşlenen kişisel veri kategorileri",
        bullets: [
          "Kimlik ve iletişim verileri: ad-soyad, e-posta, telefon.",
          "Sağlık verileri (özel nitelikli kişisel veri): kilo, boy, vücut kitle indeksi (VKİ), vücut yağ oranı, kas kütlesi, bel ve kalça ölçümleri, ölçüm notları ve öğün takip kayıtları.",
          "Randevu verileri: randevu tarihi, saati, türü ve durumu.",
          "Beslenme planı verileri: atanan diyet programı, hedef kalori, makro besin dağılımı ve diyetisyen notları."
        ]
      },
      {
        heading: "3. İşleme amaçları",
        bullets: [
          "Kişiye özel beslenme ve diyet programı oluşturmak ve uygulamak.",
          "Danışanın ölçüm ve uyum gelişimini takip ederek gerekli durumlarda planı revize etmek.",
          "Randevu ve hatırlatma süreçlerini yürütmek.",
          "Sağlık hizmetinin sunulması için gerekli kayıtları mevzuata uygun biçimde tutmak."
        ]
      },
      {
        heading: "4. Hukuki sebepler",
        paragraphs: [
          "Sağlık verileri KVKK kapsamında özel nitelikli kişisel veri olup, kural olarak açık rızanız olmadan işlenemez. Bu veriler; beslenme ve diyet hizmetinin sunulabilmesi için yalnızca gerekli olduğu ölçüde ve açık rızanıza dayanılarak işlenir. Diğer kişisel veriler ise KVKK madde 5 kapsamında sözleşmenin kurulması/ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak işlenir."
        ]
      },
      {
        heading: "5. Aktarım",
        paragraphs: [
          "Bu demo sürümde veriler sunucuya gönderilmez; yalnızca kullandığınız tarayıcının yerel depolama alanında (localStorage) saklanır. Hizmetin bir sağlık kuruluşu tarafından sunulması hâlinde veriler; randevu, muhasebe ve bilgi işlem desteği sağlayan hizmet sağlayıcılarla, mevzuatın öngördüğü sınırlar içinde ve gerekli gizlilik taahhütleri alınarak paylaşılabilir. Yurt dışına aktarım yapılmaz."
        ]
      },
      {
        heading: "6. Saklama süresi",
        paragraphs: [
          "Kişisel ve sağlık verileri, hizmet ilişkisinin sona ermesinden sonra ilgili mevzuatta öngörülen azami süre boyunca ve yalnızca gerekli olduğu kadar saklanır; sürenin sonunda silinir, yok edilir veya anonim hâle getirilir."
        ]
      },
      {
        heading: "7. KVKK madde 11 kapsamındaki haklarınız",
        bullets: [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
          "İşlenmişse bilgi talep etme ve işlenme amacını öğrenme.",
          "Amaç doğrultusunda kullanılıp kullanılmadığını öğrenme.",
          "Eksik veya yanlış işlenmişse düzeltilmesini isteme.",
          "Silinmesini veya yok edilmesini isteme.",
          "Aktarıldığı üçüncü kişileri öğrenme ve düzeltme/silme işlemlerinin aktarıldığı kişilere bildirilmesini isteme.",
          "Otomatik sistemlerle analiz sonucu aleyhinize çıkan sonuçlara itiraz etme.",
          "Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme."
        ]
      },
      {
        heading: "8. Başvuru yöntemi",
        paragraphs: [
          `Haklarınıza ilişkin başvurularınızı, Ayarlar > Profil & Klinik bölümündeki veri sorumlusu iletişim bilgilerine veya ${SUPPORT_EMAIL} adresine yazılı olarak iletebilirsiniz. Başvurunuz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`
        ]
      }
    ]
  },
  gizlilik: {
    title: "Gizlilik Politikası",
    intro:
      "Bu Gizlilik Politikası, NutriCare Diyetisyen Paneli'ni kullanırken hangi bilgilerin toplandığını, nasıl kullanıldığını ve korunduğunu açıklar.",
    updated: "Ekim 2026",
    sections: [
      {
        heading: "Toplanan bilgiler",
        paragraphs: [
          "Panel; sizin girdiğiniz danışan bilgilerini (ad, plan, tarihler, uyum) ve ölçüm/not kayıtlarını yalnızca tarayıcınızın yerel depolama alanında tutar. Bu demo sürümde veriler herhangi bir sunucuya gönderilmez."
        ]
      },
      {
        heading: "Yerel depolama ve çerezler",
        paragraphs: [
          "Oturum durumu, tema tercihi ve klinik ayarları gibi bilgiler tarayıcıda saklanır. Uygulama reklam amaçlı izleme çerezi kullanmaz. Tarayıcı verilerini temizlediğinizde yerel kayıtlar da silinir."
        ]
      },
      {
        heading: "Veri güvenliği",
        paragraphs: [
          "Verilerin gizliliğini korumak için hareketsizlikte otomatik çıkış ve paylaşımlı bilgisayarlarda yerel verileri temizleyerek çıkış gibi güvenlik önlemleri sunulur. Sağlık verilerini üçüncü kişilerle paylaşmamanızı öneririz."
        ]
      },
      {
        heading: "Üçüncü taraf hizmetler",
        paragraphs: [
          "Yazı tipi gibi görsel varlıklar harici bir içerik dağıtım ağından yüklenebilir. Bu süreçte ilgili sağlayıcı, IP adresiniz gibi teknik verilere erişebilir."
        ]
      },
      {
        heading: "Politika değişiklikleri",
        paragraphs: [
          "Bu politika gerektiğinde güncellenebilir. Önemli değişiklikler panel üzerinden duyurulur."
        ]
      }
    ]
  },
  "kullanim-sartlari": {
    title: "Kullanım Şartları",
    intro:
      "NutriCare Diyetisyen Paneli'ni kullanmadan önce lütfen bu Kullanım Şartları'nı okuyun. Paneli kullanmanız bu şartları kabul ettiğiniz anlamına gelir.",
    updated: "Ekim 2026",
    sections: [
      {
        heading: "Hizmetin tanımı",
        paragraphs: [
          "NutriCare Diyetisyen Paneli; danışan takibi, ölçüm kaydı, diyet planı hazırlama, randevu yönetimi ve uyarı üretimi gibi işlevler sunan bir yazılımdır. Sunulan hesaplama sonuçları bilgilendirme amaçlıdır."
        ]
      },
      {
        heading: "Tıbbi sorumluluk reddi",
        paragraphs: [
          "Bu panel tıbbi tavsiye, teşhis veya tedavi yerine geçmez. Beslenme ve diyet kararları yetkili bir diyetisyen/hekim tarafından danışanın bireysel durumu değerlendirilerek verilmelidir. Hesaplanan kalori ve makro değerleri yalnızca yardımcı araçtır."
        ]
      },
      {
        heading: "Kullanıcı yükümlülükleri",
        bullets: [
          "Girdiğiniz verilerin doğru ve güncel olmasını sağlamak.",
          "Danışan verilerinin işlenmesinde KVKK başta olmak üzere ilgili mevzuata uymak ve gerekli açık rızaları almak.",
          "Hesabınızı ve yerel verilerinizi yetkisiz erişime karşı korumak.",
          "Paneli hukuka ve amacına aykırı biçimde kullanmamak."
        ]
      },
      {
        heading: "Fikri mülkiyet",
        paragraphs: [
          "Panelin yazılımı, tasarımı ve içeriği ilgili hak sahiplerine aittir. İzinsiz kopyalanamaz, çoğaltılamaz veya ticari amaçla dağıtılamaz."
        ]
      },
      {
        heading: "Sorumluluğun sınırlandırılması",
        paragraphs: [
          "Hizmet “olduğu gibi” sunulur. Demo sürümde veriler yalnızca tarayıcıda saklanır; veri kaybı, tarayıcı verilerinin silinmesi veya cihaz arızası gibi durumlardan doğabilecek zararlardan hizmet sağlayıcı sorumlu tutulamaz. Düzenli yedek almanız önerilir."
        ]
      },
      {
        heading: "Uygulanacak hukuk",
        paragraphs: [
          "Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Türkiye'deki yetkili mahkemeler ve icra daireleri yetkilidir."
        ]
      }
    ]
  }
};

interface Props {
  slug: LegalSlug;
  /** Giriş yapılmışsa panele, yapılmamışsa tanıtım sayfasına dönüş. */
  homeHref: string;
}

/** Tanıtım sayfasıyla aynı görsel dili kullanan, herkese açık hukuki metin sayfası. */
export const LegalView: React.FC<Props> = ({ slug, homeHref }) => {
  const content = CONTENT[slug];

  return (
    <div className="lp legal-page">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <a className="lp-brand" href={homeHref}>
            <span className="lp-logo">
              <Leaf size={18} />
            </span>
            <span>
              <strong>NutriCare</strong>
              <small>Diyetisyen Paneli</small>
            </span>
          </a>
          <a className="btn btn-outline btn-small legal-back" href={homeHref}>
            <ArrowLeft size={14} /> Geri Dön
          </a>
        </div>
      </header>

      <main className="legal-main">
        <div className="lp-container">
          <div className="legal-head">
            <span className="lp-eyebrow">
              <ShieldCheck size={13} /> Yasal Bilgilendirme
            </span>
            <h1>{content.title}</h1>
            <p className="lp-lead legal-intro">{content.intro}</p>
            <p className="muted legal-updated">Son güncelleme: {content.updated}</p>
          </div>

          <article className="card legal-content">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-container legal-footer">
          <p>© {new Date().getFullYear()} NutriCare · Diyetisyen Paneli</p>
          <nav className="legal-footer-links" aria-label="Yasal bağlantılar">
            {LEGAL_LINKS.map((link) => (
              <a key={link.slug} href={`#/${link.slug}`} aria-current={link.slug === slug ? "page" : undefined}>
                {link.label}
              </a>
            ))}
          </nav>
          <p className="legal-contact">
            <Mail size={14} /> İletişim: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </footer>
    </div>
  );
};