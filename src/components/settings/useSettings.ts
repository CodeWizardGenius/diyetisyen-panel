import React from "react";
import {
  ClinicSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings
} from "../../types/settings";

const clone = (value: ClinicSettings): ClinicSettings =>
  JSON.parse(JSON.stringify(value)) as ClinicSettings;

export interface UseSettingsResult {
  /** Kaydedilmiş (persist edilen) ayarlar */
  settings: ClinicSettings;
  /** Formda düzenlenen taslak */
  draft: ClinicSettings;
  updateDraft: (updater: (prev: ClinicSettings) => ClinicSettings) => void;
  isDirty: boolean;
  save: () => void;
  resetDefaults: () => void;
  toast: string | null;
}

/**
 * Ayarlar için merkezi state: taslak düzenleme, localStorage kalıcılığı,
 * kaydet/sıfırla aksiyonları ve geçici başarı bildirimi.
 */
export const useSettings = (): UseSettingsResult => {
  const [settings, setSettings] = React.useState<ClinicSettings>(() => loadSettings());
  const [draft, setDraft] = React.useState<ClinicSettings>(() => loadSettings());
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = React.useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const isDirty = React.useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(draft),
    [settings, draft]
  );

  const updateDraft = React.useCallback((updater: (prev: ClinicSettings) => ClinicSettings) => {
    setDraft((prev) => updater(clone(prev)));
  }, []);

  const save = React.useCallback(() => {
    const next = clone(draft);
    saveSettings(next);
    setSettings(next);
    showToast("Değişiklikler kaydedildi.");
  }, [draft, showToast]);

  const resetDefaults = React.useCallback(() => {
    const next = clone(DEFAULT_SETTINGS);
    saveSettings(next);
    setSettings(next);
    setDraft(next);
    showToast("Ayarlar varsayılanlara sıfırlandı.");
  }, [showToast]);

  return { settings, draft, updateDraft, isDirty, save, resetDefaults, toast };
};
