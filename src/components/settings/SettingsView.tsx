import React from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Save,
  ShieldCheck,
  User,
  Utensils
} from "lucide-react";
import type {
  ClinicSettings,
  MeasurementLike,
  SettingsPatient,
  SettingsSectionKey
} from "../../types/settings";
import { isValidEmail, isValidTime } from "../../types/settings";
import { useSettings } from "./useSettings";
import { classNames } from "./classNames";
import { ProfilePanel } from "./panels/ProfilePanel";
import { NutritionPanel } from "./panels/NutritionPanel";
import { NotificationsPanel } from "./panels/NotificationsPanel";
import { SchedulePanel } from "./panels/SchedulePanel";
import { SecurityPanel } from "./panels/SecurityPanel";

interface Props {
  patients: SettingsPatient[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  /** Kaydetmede yeni zaman aşımını mevcut auth oturumuna uygular. */
  onSessionTimeoutSave: (minutes: number) => void;
}

const SECTIONS: Array<{ key: SettingsSectionKey; label: string; icon: React.ReactNode }> = [
  { key: "profil", label: "Profil & Klinik", icon: <User size={16} /> },
  { key: "beslenme", label: "Beslenme & Hesaplama", icon: <Utensils size={16} /> },
  { key: "bildirim", label: "Bildirimler & Risk", icon: <Bell size={16} /> },
  { key: "calisma", label: "Çalışma & Seanslar", icon: <Calendar size={16} /> },
  { key: "guvenlik", label: "Güvenlik & Sistem", icon: <ShieldCheck size={16} /> }
];

const collectErrors = (draft: ClinicSettings): string[] => {
  const errors: string[] = [];
  if (!draft.profile.dietitianName.trim()) {
    errors.push("Diyetisyen adı zorunludur.");
  }
  if (!isValidEmail(draft.profile.email)) {
    errors.push("E-posta adresi geçersiz.");
  }
  const macros = draft.nutrition.customMacros;
  if (macros.carbsPct + macros.proteinPct + macros.fatPct !== 100) {
    errors.push("Makro yüzdeleri toplamı %100 olmalı.");
  }
  if (draft.nutrition.hydrationMlPerKg < 20 || draft.nutrition.hydrationMlPerKg > 50) {
    errors.push("Hidrasyon çarpanı 20–50 ml/kg aralığında olmalı.");
  }
  if (
    draft.nutrition.mealSlots.some((slot) => !slot.label.trim() || !isValidTime(slot.time)) ||
    draft.notifications.reminderSlots.some((slot) => !slot.label.trim() || !isValidTime(slot.time))
  ) {
    errors.push("Tüm öğün ve hatırlatma slotlarında ad ve geçerli saat (HH:MM) gerekli.");
  }
  if (draft.notifications.complianceThreshold < 0 || draft.notifications.complianceThreshold > 100) {
    errors.push("Uyum eşiği 0–100 aralığında olmalı.");
  }
  if (draft.notifications.missedMealHours < 1 || draft.notifications.missedMealHours > 24) {
    errors.push("İşaretlenmeyen öğün eşiği 1–24 saat aralığında olmalı.");
  }
  if (!isValidTime(draft.notifications.quietStart) || !isValidTime(draft.notifications.quietEnd)) {
    errors.push("Sessiz saatler HH:MM formatında olmalı.");
  }
  if (
    draft.schedule.workingDays.some(
      (day) =>
        day.enabled &&
        (!isValidTime(day.start) || !isValidTime(day.end) || day.start >= day.end)
    )
  ) {
    errors.push("Açık günlerde bitiş saati başlangıçtan sonra olmalı.");
  }
  if (draft.schedule.bufferMin < 0 || draft.schedule.bufferMin > 60) {
    errors.push("Tampon süre 0–60 dakika aralığında olmalı.");
  }
  if (draft.security.sessionTimeoutMin < 5 || draft.security.sessionTimeoutMin > 180) {
    errors.push("Oturum zaman aşımı 5–180 dakika aralığında olmalı.");
  }
  return errors;
};

export const SettingsView: React.FC<Props> = ({ patients, getMeasurements, onSessionTimeoutSave }) => {
  const { draft, updateDraft, isDirty, save, resetDefaults, toast } = useSettings();
  const [section, setSection] = React.useState<SettingsSectionKey>("profil");

  const updateSection = React.useCallback(
    <K extends keyof ClinicSettings>(key: K, patch: Partial<ClinicSettings[K]>) => {
      updateDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    [updateDraft]
  );

  const errors = React.useMemo(() => collectErrors(draft), [draft]);
  const sessionTimeoutError =
    draft.security.sessionTimeoutMin < 5 || draft.security.sessionTimeoutMin > 180
      ? "5–180 dakika aralığında olmalı."
      : undefined;

  const handleSave = () => {
    if (errors.length > 0) {
      return;
    }
    onSessionTimeoutSave(draft.security.sessionTimeoutMin);
    save();
  };

  return (
    <div className="settings-layout">
      <nav className="settings-subnav" aria-label="Ayar kategorileri">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={classNames("settings-subnav-item", section === item.key && "active")}
            onClick={() => setSection(item.key)}
            aria-current={section === item.key ? "page" : undefined}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {toast ? (
          <div className="toast" role="status">
            <CheckCircle2 size={16} />
            {toast}
          </div>
        ) : null}

        <div className="settings-panels">
          {section === "profil" ? <ProfilePanel draft={draft} updateSection={updateSection} /> : null}
          {section === "beslenme" ? <NutritionPanel draft={draft} updateSection={updateSection} /> : null}
          {section === "bildirim" ? (
            <NotificationsPanel draft={draft} updateSection={updateSection} />
          ) : null}
          {section === "calisma" ? <SchedulePanel draft={draft} updateSection={updateSection} /> : null}
          {section === "guvenlik" ? (
            <SecurityPanel
              sessionTimeoutMin={draft.security.sessionTimeoutMin}
              onSessionTimeoutChange={(minutes) => updateSection("security", { sessionTimeoutMin: minutes })}
              sessionTimeoutError={sessionTimeoutError}
              patients={patients}
              getMeasurements={getMeasurements}
              dietitianName={draft.profile.dietitianName}
            />
          ) : null}
        </div>

        <div className="settings-actionbar">
          <div className="settings-actionbar-info">
            {isDirty ? (
              <span className="badge badge-amber">Kaydedilmemiş değişiklik</span>
            ) : (
              <span className="muted">Tüm değişiklikler kayıtlı.</span>
            )}
            {errors.length > 0 ? (
              <span className="field-error" role="alert">
                {errors.length} alan düzeltme bekliyor — ilki: {errors[0]}
              </span>
            ) : null}
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline" onClick={resetDefaults}>
              <RotateCcw size={15} /> Varsayılanlara Sıfırla
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!isDirty || errors.length > 0}
            >
              <Save size={15} /> Değişiklikleri Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
