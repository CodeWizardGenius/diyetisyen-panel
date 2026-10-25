/** Danışan başına paylaşılabilir randevu talebi linki (token eşlemesi). */

export const PATIENT_LINKS_STORAGE_KEY = "dp_patient_links";

export interface PatientLinkTokenData {
  token: string;
  patientId: number;
  dietitianId?: number;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

const readLinkMap = (): Record<string, PatientLinkTokenData> => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = localStorage.getItem(PATIENT_LINKS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PatientLinkTokenData>) : {};
  } catch {
    return {};
  }
};

const writeLinkMap = (map: Record<string, PatientLinkTokenData>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(PATIENT_LINKS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // depolama kullanılamıyor — yoksay
  }
};

/**
 * Danışan için yeni bir randevu talebi token'ı oluşturur.
 * Token: crypto.randomUUID() + 24-48 saat geçerlilik + dietitianId + tek kullanımlık.
 */
export const createPatientLinkToken = (
  patientId: number,
  options?: { dietitianId?: number; ttlHours?: number; singleUse?: boolean }
): PatientLinkTokenData => {
  const { dietitianId, ttlHours = 24, singleUse = true } = options ?? {};
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  const tokenData: PatientLinkTokenData = {
    token: crypto.randomUUID(),
    patientId,
    dietitianId,
    expiresAt,
    used: false,
    createdAt: now.toISOString(),
  };
  const map = readLinkMap();
  writeLinkMap({ ...map, [patientId]: tokenData });
  return tokenData;
};

/** Danışanın aktif token'ını getirir (yoksa/yoksa yeni oluşturur). */
export const getPatientLinkToken = (patientId: number, options?: { dietitianId?: number; ttlHours?: number; singleUse?: boolean }): PatientLinkTokenData => {
  const map = readLinkMap();
  const existing = map[patientId];
  const now = new Date().toISOString();
  if (existing && !existing.used && existing.expiresAt > now) {
    return existing;
  }
  return createPatientLinkToken(patientId, options);
};

/** Link doğrulaması: hasta id + token eşleşiyor mu, geçerli mi, kullanılmamış mı? */
export const isValidPatientLink = (patientId: number, token: string): boolean => {
  const map = readLinkMap();
  const existing = map[patientId];
  if (!existing || existing.token !== token) {
    return false;
  }
  if (existing.used) {
    return false;
  }
  if (existing.expiresAt <= new Date().toISOString()) {
    return false;
  }
  return true;
};

/** Token'ı kullanılmış olarak işaretler (tek kullanımlık token'lar için). */
export const markPatientLinkUsed = (patientId: number): void => {
  const map = readLinkMap();
  const existing = map[patientId];
  if (existing && !existing.used) {
    writeLinkMap({ ...map, [patientId]: { ...existing, used: true } });
  }
};

/** Danışanın paylaşılabilir randevu talebi adresi (`#/randevu-talep?d=..&k=..`). */
export const buildAppointmentRequestUrl = (patientId: number, options?: { dietitianId?: number; ttlHours?: number; singleUse?: boolean }): string => {
  const tokenData = getPatientLinkToken(patientId, options);
  const base =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  return `${base}#/randevu-talep?d=${patientId}&k=${encodeURIComponent(tokenData.token)}`;
};

/** Tüm token'ları temizler (test/debug için). */
export const clearPatientLinks = (): void => {
  writeLinkMap({});
};