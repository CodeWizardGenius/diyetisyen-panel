import React from "react";
import { Download, FileJson, FileSpreadsheet, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import type {
  MeasurementLike,
  SettingsPatient
} from "../../../types/settings";
import { useTheme, type ThemeMode } from "../../../context/ThemeContext";
import { Field, SectionCard } from "../ui";
import { classNames } from "../classNames";

interface Props {
  sessionTimeoutMin: number;
  onSessionTimeoutChange: (minutes: number) => void;
  sessionTimeoutError?: string;
  patients: SettingsPatient[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  dietitianName: string;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Açık", icon: <Sun size={15} /> },
  { value: "dark", label: "Koyu", icon: <Moon size={15} /> },
  { value: "system", label: "Sistem", icon: <Monitor size={15} /> }
];

const downloadFile = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const todayStamp = (): string => new Date().toISOString().slice(0, 10);

export const SecurityPanel: React.FC<Props> = ({
  sessionTimeoutMin,
  onSessionTimeoutChange,
  sessionTimeoutError,
  patients,
  getMeasurements,
  dietitianName
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [exported, setExported] = React.useState<string | null>(null);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: dietitianName,
      patients: patients.map((patient) => ({
        ...patient,
        measurements: getMeasurements(patient.id)
      }))
    };
    downloadFile(
      `danisanlar-yedek-${todayStamp()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
    setExported("JSON yedeği indirildi.");
  };

  const exportCsv = () => {
    const header = "danisan;plan;uyum;durum;tarih;kilo_kg;boy_cm;yag_yuzde;kas_kg;bel_cm;kalca_cm;not";
    const lines = patients.flatMap((patient) => {
      const rows = getMeasurements(patient.id);
      if (rows.length === 0) {
        return [`${patient.name};${patient.plan};${patient.compliance};${patient.status};;;;;;;`];
      }
      return rows.map(
        (m) =>
          `${patient.name};${patient.plan};${patient.compliance};${patient.status};${m.date};${m.weightKg};${m.heightCm};${m.bodyFatPercentage};${m.muscleMassKg};${m.waistCm};${m.hipCm};${(m.notes ?? "").replace(/;/g, ",")}`
      );
    });
    downloadFile(
      `danisanlar-yedek-${todayStamp()}.csv`,
      `﻿${[header, ...lines].join("\n")}`,
      "text/csv;charset=utf-8"
    );
    setExported("CSV yedeği indirildi.");
  };

  return (
    <>
      <SectionCard
        title="Oturum Güvenliği"
        description="Değişiklik Kaydet'e bastığınızda yeni süre mevcut oturuma da uygulanır."
        icon={<ShieldCheck size={15} />}
      >
        <Field
          label="Oturum Zaman Aşımı (dakika)"
          htmlFor="set-timeout"
          hint="Hareketsiz kalınan bu sürenin sonunda otomatik çıkış yapılır."
          error={sessionTimeoutError}
        >
          <input
            id="set-timeout"
            type="number"
            min={5}
            max={180}
            className="input set-input-sm"
            value={sessionTimeoutMin}
            onChange={(event) => onSessionTimeoutChange(Number(event.target.value) || 0)}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Tema"
        description="Panelin görünümü anında değişir ve tarayıcıda hatırlanır. Diğer sekmeleri etkilemez."
        icon={resolvedTheme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
      >
        <div className="set-theme-group" role="radiogroup" aria-label="Tema tercihi">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={classNames("set-theme-card", theme === option.value && "active")}
              onClick={() => setTheme(option.value)}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
        {theme === "system" ? (
          <p className="muted muted-spaced">
            Sistem teması kullanılıyor — şu an {resolvedTheme === "dark" ? "koyu" : "açık"} görünümde.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Danışan Verilerini Dışa Aktar"
        description="Tüm danışanlar ve ölçüm geçmişleri — acil durum yedeği için."
        icon={<Download size={15} />}
      >
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={exportJson}>
            <FileJson size={14} /> JSON İndir
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={exportCsv}>
            <FileSpreadsheet size={14} /> CSV İndir
          </button>
        </div>
        {exported ? <p className="muted muted-spaced">{exported}</p> : null}
      </SectionCard>
    </>
  );
};
