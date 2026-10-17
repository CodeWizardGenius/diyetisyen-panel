import React from "react";
import { Building2, FileText, User } from "lucide-react";
import type { ClinicSettings } from "../../../types/settings";
import { isValidEmail } from "../../../types/settings";
import { Field, SectionCard } from "../ui";

interface Props {
  draft: ClinicSettings;
  updateSection: <K extends keyof ClinicSettings>(
    section: K,
    patch: Partial<ClinicSettings[K]>
  ) => void;
}

export const ProfilePanel: React.FC<Props> = ({ draft, updateSection }) => {
  const profile = draft.profile;
  const set = (patch: Partial<ClinicSettings["profile"]>) => updateSection("profile", patch);
  const emailError = isValidEmail(profile.email) ? undefined : "Geçerli bir e-posta girin.";

  return (
    <>
      <SectionCard
        title="Diyetisyen Bilgileri"
        description="Bu bilgiler diyet listesi PDF çıktısında ve danışan ekranlarında görünür."
        icon={<User size={15} />}
      >
        <div className="set-grid-2">
          <Field label="Ad Soyad" htmlFor="set-name" error={!profile.dietitianName.trim() ? "Ad soyad zorunludur." : undefined}>
            <input
              id="set-name"
              className="input"
              value={profile.dietitianName}
              onChange={(event) => set({ dietitianName: event.target.value })}
              placeholder="Uzm. Dyt. Ad Soyad"
              autoComplete="name"
            />
          </Field>
          <Field label="Unvan" htmlFor="set-title">
            <input
              id="set-title"
              className="input"
              value={profile.title}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="Uzman Diyetisyen"
            />
          </Field>
          <Field
            label="Diploma / Oda Sicil No"
            htmlFor="set-diploma"
            hint="Opsiyonel — PDF çıktısında imza bloğunda yer alır."
          >
            <input
              id="set-diploma"
              className="input"
              value={profile.diplomaNo}
              onChange={(event) => set({ diplomaNo: event.target.value })}
              placeholder="örn. 34-XXXX"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Klinik & İletişim" icon={<Building2 size={15} />}>
        <div className="set-grid-2">
          <Field label="Klinik Adı" htmlFor="set-clinic">
            <input
              id="set-clinic"
              className="input"
              value={profile.clinicName}
              onChange={(event) => set({ clinicName: event.target.value })}
              placeholder="Klinik adı"
            />
          </Field>
          <Field label="Telefon" htmlFor="set-phone">
            <input
              id="set-phone"
              className="input"
              value={profile.phone}
              onChange={(event) => set({ phone: event.target.value })}
              placeholder="0 (___) ___ __ __"
              autoComplete="tel"
            />
          </Field>
          <Field label="E-posta" htmlFor="set-email" error={emailError}>
            <input
              id="set-email"
              type="email"
              className="input"
              value={profile.email}
              onChange={(event) => set({ email: event.target.value })}
              placeholder="klinik@ornek.com"
              autoComplete="email"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Diyet Listesi Alt Bilgisi"
        description="PDF çıktısının en altında yer alan bilgilendirme metni."
        icon={<FileText size={15} />}
      >
        <Field label="Alt Bilgi Metni" htmlFor="set-footer">
          <textarea
            id="set-footer"
            className="input"
            rows={3}
            value={profile.footerText}
            onChange={(event) => set({ footerText: event.target.value })}
          />
        </Field>
      </SectionCard>
    </>
  );
};
