import React from "react";
import {
  ClinicSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings
} from "../../types/settings";
import { syncAlertRulesWithClinic } from "../../types/alerts";
import { IS_HTTP, errorMessage, notifyServerData, settingsApi, subscribeServerData, cache } from "../../api";

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
  /** Sunucudan yüklenemeyen bölümler (http modu). */
  unavailable: string[];
  /** Birleşik ayarları yeniden dener. */
  reload: () => void;
}

/**
 * Ayarlar için merkezi state: taslak düzenleme, localStorage kalıcılığı,
 * kaydet/sıfırla aksiyonları ve geçici başarı bildirimi.
 */
export const useSettings = (): UseSettingsResult => {
  const [settings, setSettings] = React.useState<ClinicSettings>(() => loadSettings());
  const [draft, setDraft] = React.useState<ClinicSettings>(() => loadSettings());
  const [unavailable, setUnavailable] = React.useState<string[]>(() => [...cache.settingsUnavailable]);
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (!IS_HTTP) {
      return;
    }
    return subscribeServerData(() => {
      const server = loadSettings();
      setSettings(server);
      setDraft(server);
      setUnavailable([...cache.settingsUnavailable]);
    });
  }, []);

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
    if (IS_HTTP) {
      void Promise.all([
        settingsApi.profil(next.profile),
        settingsApi.guvenlik(next.security),
        settingsApi.beslenmeKaydet(next.nutrition),
        settingsApi.bildirimlerKaydet(next.notifications),
        settingsApi.calisma(next.schedule)
      ])
        .then(() => {
          cache.settings = next;
          setSettings(next);
          notifyServerData();
          showToast("Değişiklikler kaydedildi.");
        })
        .catch((error: unknown) => showToast(errorMessage(error)));
      return;
    }
    saveSettings(next);
    syncAlertRulesWithClinic(next.notifications);
    setSettings(next);
    showToast("Değişiklikler kaydedildi.");
  }, [draft, showToast]);

  const resetDefaults = React.useCallback(() => {
    const next = clone(DEFAULT_SETTINGS);
    if (IS_HTTP) {
      void Promise.all([
        settingsApi.profil(next.profile),
        settingsApi.guvenlik(next.security),
        settingsApi.beslenmeKaydet(next.nutrition),
        settingsApi.bildirimlerKaydet(next.notifications),
        settingsApi.calisma(next.schedule)
      ])
        .then(() => {
          cache.settings = next;
          setSettings(next);
          setDraft(next);
          notifyServerData();
          showToast("Ayarlar varsayılanlara sıfırlandı.");
        })
        .catch((error: unknown) => showToast(errorMessage(error)));
      return;
    }
    saveSettings(next);
    syncAlertRulesWithClinic(next.notifications);
    setSettings(next);
    setDraft(next);
    showToast("Ayarlar varsayılanlara sıfırlandı.");
  }, [showToast]);

  const reload = React.useCallback(() => {
    if (!IS_HTTP) {
      return;
    }
    void settingsApi
      .tumu(loadSettings(), {})
      .then((bundle) => {
        cache.settings = bundle.settings;
        cache.settingsUnavailable = bundle.unavailable;
        notifyServerData();
        showToast(
          bundle.unavailable.length > 0
            ? "Bazı bölümler şu an yüklenemedi; tekrar deneyin."
            : "Ayarlar sunucudan yenilendi."
        );
      })
      .catch((error: unknown) => showToast(errorMessage(error)));
  }, [showToast]);

  return { settings, draft, updateDraft, isDirty, save, resetDefaults, toast, unavailable, reload };
};
