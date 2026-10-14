import React from "react";
import { Download, FileJson, FileSpreadsheet, Monitor, Moon, ShieldCheck, Sun, Upload } from "lucide-react";
import type {
  MeasurementLike,
  SettingsPatient
} from "../../../types/settings";
import { useTheme, type ThemeMode } from "../../../context/ThemeContext";
import { Field, SectionCard } from "../ui";
import { classNames } from "../classNames";

export interface ImportResult {
  ok: boolean;
  message: string;
}

interface Props {
  sessionTimeoutMin: number;
  onSessionTimeoutChange: (minutes: number) => void;
  sessionTimeoutError?: string;
  patients: SettingsPatient[];
  getMeasurements: (patientId: number) => MeasurementLike[];
  dietitianName: string;
  /** Yedek JSON'ı uygular; sonucu (başarı/mesaj) döndürür. */
  onImportData: (raw: unknown) => ImportResult;
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

/** JSON yedeği için üst sınır — büyük dosyaların tarayıcıyı kilitlemesini önler. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Tek bir CSV hücresini güvenli hale getirir: formül olarak yorumlanabilecek
 * (=, +, -, @, sekme, CR ile başlayan) metinlerin başına ' eklenir ve ayraç,
 * tırnak veya satır sonu içeren değerler çift tırnakla sarılır.
 */
const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (values: unknown[]): string => values.map(csvCell).join(";");

export const SecurityPanel: React.FC<Props> = ({
  sessionTimeoutMin,
  onSessionTimeoutChange,
  sessionTimeoutError,
  patients,
  getMeasurements,
  dietitianName,
  onImportData
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [exported, setExported] = React.useState<string | null>(null);
  const [importMsg, setImportMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (!file) {
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setImportMsg({ ok: false, text: "Dosya çok büyük — en fazla 5 MB'lık bir JSON yedeği seçin." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!window.confirm("Yedek içe aktarılsın mı? Mevcut danışan ve ölçüm verileri bu yedekle değiştirilecek.")) {
          return;
        }
        const result = onImportData(parsed);
        setImportMsg({ ok: result.ok, text: result.message });
      } catch {
        setImportMsg({ ok: false, text: "Dosya okunamadı — geçerli bir JSON yedeği seçin." });
      }
    };
    reader.onerror = () => setImportMsg({ ok: false, text: "Dosya okunamadı." });
    reader.readAsText(file);
  };

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
      const base = [patient.name, patient.plan, patient.compliance, patient.status];
      if (rows.length === 0) {
        return [csvRow([...base, "", "", "", "", "", "", "", ""])];
      }
      return rows.map((m) =>
        csvRow([
          ...base,
          m.date,
          m.weightKg,
          m.heightCm,
          m.bodyFatPercentage,
          m.muscleMassKg,
          m.waistCm,
          m.hipCm,
          m.notes ?? ""
        ])
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
        title="Danışan Verilerini Yedekle"
        description="Tüm danışanlar ve ölçüm geçmişleri — dışa aktarın veya bir yedekten geri yükleyin."
        icon={<Download size={15} />}
      >
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={exportJson}>
            <FileJson size={14} /> JSON İndir
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={exportCsv}>
            <FileSpreadsheet size={14} /> CSV İndir
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> JSON Yükle
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleImportFile}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        {exported ? <p className="muted muted-spaced">{exported}</p> : null}
        {importMsg ? (
          <p className={classNames("muted-spaced", importMsg.ok ? "import-ok" : "field-error")} role="status">
            {importMsg.text}
          </p>
        ) : null}
      </SectionCard>
    </>
  );
};
