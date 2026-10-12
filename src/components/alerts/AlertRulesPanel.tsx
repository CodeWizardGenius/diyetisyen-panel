import React from "react";
import { BellRing, Moon, RotateCcw, Save, SlidersHorizontal, Zap } from "lucide-react";
import type { AlertRules } from "../../types/alerts";
import { isValidTime } from "../../types/settings";
import { SectionCard, Toggle } from "../settings/ui";

interface Props {
  rules: AlertRules;
  onChange: (patch: Partial<AlertRules>) => void;
  onSave: () => void;
  onReset: () => void;
  isDirty: boolean;
}

/** Değer rozetli erişilebilir aralık (range) kaydırıcısı. */
const SliderField: React.FC<{
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  valueLabel: string;
  accent: string;
  onChange: (value: number) => void;
}> = ({ id, label, hint, min, max, step = 1, value, valueLabel, accent, onChange }) => {
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="slider-field">
      <div className="slider-field-head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span className="slider-badge" style={{ color: accent, borderColor: accent }}>
          {valueLabel}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="range"
        style={{ background: `linear-gradient(90deg, ${accent} ${pct}%, var(--slate-200, #e2e8f0) ${pct}%)` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="muted muted-tight">{hint}</p> : null}
    </div>
  );
};

export const AlertRulesPanel: React.FC<Props> = ({ rules, onChange, onSave, onReset, isDirty }) => {
  const [start, end] = rules.quietHoursRange;
  const quietError =
    rules.quietHoursEnabled && (!isValidTime(start) || !isValidTime(end))
      ? "Sessiz saatler HH:MM formatında olmalı."
      : undefined;

  return (
    <div className="rules-view">
      <div className="rules-grid">
        <SectionCard
          title="Klinik Eşikler"
          description="Kaydırıcılarla eşikleri ayarlayın; uyarı akışı anında yeniden hesaplanır."
          icon={<SlidersHorizontal size={15} />}
        >
          <div className="slider-stack">
            <SliderField
              id="rule-compliance"
              label="Uyum Eşiği"
              hint="Danışanın uyumu bu değerin altına düşerse uyarı üretilir."
              min={0}
              max={100}
              value={rules.complianceThreshold}
              valueLabel={`%${rules.complianceThreshold}`}
              accent="#ef4444"
              onChange={(value) => onChange({ complianceThreshold: value })}
            />
            <SliderField
              id="rule-missed"
              label="İşaretlenmeyen Öğün Süresi"
              hint="Öğün bu süre içinde tamamlanmazsa uyar."
              min={1}
              max={24}
              value={rules.missedMealHours}
              valueLabel={`${rules.missedMealHours} saat`}
              accent="#f59e0b"
              onChange={(value) => onChange({ missedMealHours: value })}
            />
            <SliderField
              id="rule-expiry"
              label="Plan Bitiş Hatırlatması"
              hint="Plan bitişine bu kadar gün kala uyar."
              min={0}
              max={30}
              value={rules.planExpiryNoticeDays}
              valueLabel={rules.planExpiryNoticeDays === 0 ? "Bitiş günü" : `${rules.planExpiryNoticeDays} gün önce`}
              accent="#3b82f6"
              onChange={(value) => onChange({ planExpiryNoticeDays: value })}
            />
            <SliderField
              id="rule-plateau"
              label="Kilo Platosu Penceresi"
              hint="Bu kadar hafta durağan kilo seyri plato sayılır."
              min={1}
              max={8}
              value={rules.plateauWeeks}
              valueLabel={`${rules.plateauWeeks} hafta`}
              accent="#8b5cf6"
              onChange={(value) => onChange({ plateauWeeks: value })}
            />
          </div>
        </SectionCard>

        <div className="rules-col">
          <SectionCard
            title="Otomatik Senaryolar"
            description="Uyarı tetiklendiğinde çalışacak otomasyonlar."
            icon={<Zap size={15} />}
          >
            <ul className="set-auto-list">
              <li>
                <div>
                  <strong>Kaçan öğünde hastaya push</strong>
                  <p className="muted muted-tight">48 saatte 3 öğün kaçarsa danışanı anında bilgilendir.</p>
                </div>
                <Toggle
                  checked={rules.autoNotifyPatient}
                  onChange={(checked) => onChange({ autoNotifyPatient: checked })}
                  label="Hastaya otomatik bildirim"
                />
              </li>
              <li>
                <div>
                  <strong>Uyum düşüşünde diyetisyene e-posta</strong>
                  <p className="muted muted-tight">Kritik ve uyarı seviyelerinde acil e-posta gönder.</p>
                </div>
                <Toggle
                  checked={rules.autoEmailDietitian}
                  onChange={(checked) => onChange({ autoEmailDietitian: checked })}
                  label="Diyetisyene otomatik e-posta"
                />
              </li>
              <li>
                <div>
                  <strong>Plan bitişinde yenileme önerisi</strong>
                  <p className="muted muted-tight">Hatırlatma penceresine göre yeni plan taslağı öner.</p>
                </div>
                <Toggle
                  checked={rules.autoRenewalPrompt}
                  onChange={(checked) => onChange({ autoRenewalPrompt: checked })}
                  label="Otomatik yenileme önerisi"
                />
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="Sessize Alma"
            description="Bu aralıkta otomatik bildirimler duraklatılır, akış kaydı sürer."
            icon={<Moon size={15} />}
          >
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={rules.quietHoursEnabled}
                onChange={(event) => onChange({ quietHoursEnabled: event.target.checked })}
              />
              <span>Sessiz saatleri etkinleştir</span>
            </label>
            <div className="quiet-times">
              <div className="set-field">
                <label className="label" htmlFor="rule-quiet-start">Başlangıç</label>
                <input
                  id="rule-quiet-start"
                  type="time"
                  className="input set-time"
                  value={start}
                  disabled={!rules.quietHoursEnabled}
                  onChange={(event) => onChange({ quietHoursRange: [event.target.value, end] })}
                />
              </div>
              <div className="set-field">
                <label className="label" htmlFor="rule-quiet-end">Bitiş</label>
                <input
                  id="rule-quiet-end"
                  type="time"
                  className="input set-time"
                  value={end}
                  disabled={!rules.quietHoursEnabled}
                  onChange={(event) => onChange({ quietHoursRange: [start, event.target.value] })}
                />
              </div>
            </div>
            {quietError ? <p className="field-error" role="alert">{quietError}</p> : null}
          </SectionCard>
        </div>
      </div>

      <div className="rules-footer">
        <span className="muted">
          <BellRing size={14} /> {isDirty ? "Kaydedilmemiş kural değişikliği var." : "Kurallar güncel."}
        </span>
        <div className="card-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={onReset}>
            <RotateCcw size={14} /> Varsayılanlara Sıfırla
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={onSave} disabled={!isDirty}>
            <Save size={14} /> Değişiklikleri Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};
