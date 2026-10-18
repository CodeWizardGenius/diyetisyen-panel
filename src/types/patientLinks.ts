/** Danışan başına paylaşılabilir randevu talebi linki (token eşlemesi). */

export const PATIENT_LINKS_STORAGE_KEY = "dp_patient_links";

const readLinkMap = (): Record<string, string> => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(PATIENT_LINKS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/** Danışanın link token'ı: yoksa üretilir ve kalıcılaştırılır. */
export const patientLinkToken = (patientId: number): string => {
  const map = readLinkMap();
  const existing = map[patientId];
  if (typeof existing === "string" && existing.length >= 8) {
    return existing;
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PATIENT_LINKS_STORAGE_KEY, JSON.stringify({ ...map, [patientId]: token }));
    } catch {
      // depolama kullanılamıyor — yoksay
    }
  }
  return token;
};

/** Link doğrulaması: hasta id + token eşleşiyor mu? */
export const isValidPatientLink = (patientId: number, token: string): boolean => {
  const existing = readLinkMap()[patientId];
  return typeof existing === "string" && existing.length > 0 && existing === token;
};

/** Danışanın paylaşılabilir randevu talebi adresi (`#/randevu-talep?d=..&k=..`). */
export const buildAppointmentRequestUrl = (patientId: number): string => {
  const token = patientLinkToken(patientId);
  const base =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  return `${base}#/randevu-talep?d=${patientId}&k=${encodeURIComponent(token)}`;
};
