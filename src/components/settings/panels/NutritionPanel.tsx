import React from "react";
import { Calculator, Droplets, Plus, Trash2, Utensils } from "lucide-react";
import type { ClinicSettings } from "../../../types/settings";
import { isValidTime, MACRO_PRESETS } from "../../../types/settings";
import { Field, SectionCard } from "../ui";

interface Props {
  draft: ClinicSettings;
  updateSection: <K extends keyof ClinicSettings>(
    section: K,
    patch: Partial<ClinicSettings[K]>
  ) => void;
}

const uid = (): string => `slot-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const NutritionPanel: React.FC<Props> = ({ draft, updateSection }) => {
  const nutrition = draft.nutrition;
  const set = (patch: Partial<ClinicSettings["nutrition"]>) => updateSection("nutrition", patch);

  const macroSum =
    nutrition.customMacros.carbsPct + nutrition.customMacros.proteinPct + nutrition.customMacros.fatPct;
  const macroError = macroSum === 100 ? undefined : `Makro toplamı %${macroSum} — %100 olmalı.`;

  const applyPreset = (presetId: string) => {
    const preset = MACRO_PRESETS.find((item) => item.id === presetId);
    if (!preset || preset.id === "custom") {
      set({ macroPresetId: presetId });
      return;
    }
    set({
      macroPresetId: presetId,
      customMacros: { carbsPct: preset.carbsPct, proteinPct: preset.proteinPct, fatPct: preset.fatPct }
    });
  };

  const editMacro = (key: "carbsPct" | "proteinPct" | "fatPct", value: number) => {
    set({
      macroPresetId: "custom",
      customMacros: { ...nutrition.customMacros, [key]: Math.max(0, Math.min(100, value || 0)) }
    });
  };

  return (
    <>
      <SectionCard
        title="BMR Formülü"
        description="Planlayıcıdaki bazal metabolizma hesabında kullanılacak varsayılan formül."
        icon={<Calculator size={15} />}
      >
        <div className="set-radio-group" role="radiogroup" aria-label="BMR formülü">
          <label className="set-radio">
            <input
              type="radio"
              name="bmr-formula"
              checked={nutrition.bmrFormula === "mifflin"}
              onChange={() => set({ bmrFormula: "mifflin" })}
            />
            <span>
              <strong>Mifflin-St Jeor</strong>
              <small className="muted">Modern standart · 10·kg + 6.25·cm − 5·yaş ± cinsiyet</small>
            </span>
          </label>
          <label className="set-radio">
            <input
              type="radio"
              name="bmr-formula"
              checked={nutrition.bmrFormula === "harris"}
              onChange={() => set({ bmrFormula: "harris" })}
            />
            <span>
              <strong>Harris-Benedict (Revize)</strong>
              <small className="muted">Klasik formül · farklı katsayılarla hesaplanır</small>
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Varsayılan Makro Dağılımı"
        description="Yeni planlarda otomatik uygulanacak karbonhidrat / protein / yağ yüzdeleri."
        icon={<Utensils size={15} />}
      >
        <Field label="Hazır Dağılım" htmlFor="set-macro-preset">
          <select
            id="set-macro-preset"
            className="input"
            value={nutrition.macroPresetId}
            onChange={(event) => applyPreset(event.target.value)}
          >
            {MACRO_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="set-grid-3">
          <Field label="Karb %" htmlFor="set-carb" error={macroError}>
            <input
              id="set-carb"
              type="number"
              min={0}
              max={100}
              className="input"
              value={nutrition.customMacros.carbsPct}
              onChange={(event) => editMacro("carbsPct", Number(event.target.value))}
            />
          </Field>
          <Field label="Protein %" htmlFor="set-protein">
            <input
              id="set-protein"
              type="number"
              min={0}
              max={100}
              className="input"
              value={nutrition.customMacros.proteinPct}
              onChange={(event) => editMacro("proteinPct", Number(event.target.value))}
            />
          </Field>
          <Field label="Yağ %" htmlFor="set-fat">
            <input
              id="set-fat"
              type="number"
              min={0}
              max={100}
              className="input"
              value={nutrition.customMacros.fatPct}
              onChange={(event) => editMacro("fatPct", Number(event.target.value))}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Hidrasyon" icon={<Droplets size={15} />}>
        <Field
          label="Varsayılan Hidrasyon Çarpanı (ml/kg)"
          htmlFor="set-hydration"
          hint="örn. 70 kg × 35 ml = 2450 ml/gün su önerisi."
          error={
            nutrition.hydrationMlPerKg < 20 || nutrition.hydrationMlPerKg > 50
              ? "20–50 ml/kg aralığında olmalı."
              : undefined
          }
        >
          <input
            id="set-hydration"
            type="number"
            min={20}
            max={50}
            className="input set-input-sm"
            value={nutrition.hydrationMlPerKg}
            onChange={(event) => set({ hydrationMlPerKg: Number(event.target.value) || 0 })}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Varsayılan Öğün Slotları"
        description="Bildirim ve plan ekranlarında kullanılan öğün saatleri."
        icon={<Utensils size={15} />}
      >
        <ul className="set-slot-list">
          {nutrition.mealSlots.map((slot) => (
            <li key={slot.id} className="set-slot-row">
              <input
                className="input"
                value={slot.label}
                onChange={(event) =>
                  set({
                    mealSlots: nutrition.mealSlots.map((item) =>
                      item.id === slot.id ? { ...item, label: event.target.value } : item
                    )
                  })
                }
                aria-label="Öğün adı"
              />
              <input
                type="time"
                className="input set-time"
                value={slot.time}
                onChange={(event) =>
                  set({
                    mealSlots: nutrition.mealSlots.map((item) =>
                      item.id === slot.id ? { ...item, time: event.target.value } : item
                    )
                  })
                }
                aria-label={`${slot.label} saati`}
              />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                aria-label={`${slot.label} slotunu sil`}
                onClick={() =>
                  set({ mealSlots: nutrition.mealSlots.filter((item) => item.id !== slot.id) })
                }
              >
                <Trash2 size={14} />
              </button>
              {!isValidTime(slot.time) ? (
                <p className="field-error" role="alert">
                  Saat HH:MM formatında olmalı.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() =>
            set({
              mealSlots: [...nutrition.mealSlots, { id: uid(), label: "Yeni Öğün", time: "12:00" }]
            })
          }
        >
          <Plus size={14} /> Slot Ekle
        </button>
      </SectionCard>
    </>
  );
};
