import React from "react";
import { classNames } from "./classNames";

/** Tutarlı form satırı: erişilebilir label + yardımcı açıklama + doğrulama mesajı. */
export const Field: React.FC<{
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, error, children }) => (
  <div className="set-field">
    <label className="label" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {hint && !error ? <p className="muted muted-tight">{hint}</p> : null}
    {error ? (
      <p className="field-error" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

export const SectionCard: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, children }) => (
  <div className="card set-section">
    <div className="card-head">
      <h3>
        {icon}
        {title}
      </h3>
    </div>
    {description ? <p className="muted set-section-desc">{description}</p> : null}
    {children}
  </div>
);

/** Erişilebilir açma/kapama anahtarı. */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={classNames("toggle", checked && "toggle-on")}
    onClick={() => onChange(!checked)}
  >
    <span className="toggle-knob" />
  </button>
);
