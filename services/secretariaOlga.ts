import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './auth';
import { Expediente, PlazoProcesal } from '../types';

const getTodayIsoAsuncionLocal = (): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const calcDaysUntilLocal = (fechaIso?: string): number | null => {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}/.test(fechaIso)) return null;
  const cleanTarget = fechaIso.slice(0, 10);
  const todayIso = getTodayIsoAsuncionLocal();
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [fy, fm, fd] = cleanTarget.split('-').map(Number);
  if (!ty || !tm || !td || !fy || !fm || !fd) return null;
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const targetUtc = Date.UTC(fy, fm - 1, fd);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
};

export interface LinkedDocResumen {
  id: string;
  tipo?: string;
  categoria?: string;
  storageUrl?: string;
  pdfUrl?: string;
  expedienteId?: string;
  createdAt?: string;
  texto?: string;
}

const STORAGE_WA_PREFIX = 'olga_abogado_whatsapp_secretaria_';
const STORAGE_WA_CLEARED_PREFIX = 'olga_abogado_whatsapp_cleared_';

const cleanBucketId = (raw?: string | null): string => String(raw || '').trim() || 'anon';

export const normalizeAbogadoWhatsAppPhone = (raw?: string | null): string => {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0') && digits.length >= 9) {
    return `595${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith('9')) {
    return `595${digits}`;
  }
  return digits;
};

export const formatAbogadoWhatsAppDisplay = (raw?: string | null): string => {
  const digits = normalizeAbogadoWhatsAppPhone(raw);
  if (!digits) return '';
  if (digits.startsWith('595') && digits.length >= 11) {
    const rest = digits.slice(3);
    if (rest.length === 9) {
      return `+595 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    return `+595 ${rest}`;
  }
  return `+${digits}`;
};

export const loadAbogadoWhatsappSecretaria = (
  uid?: string | null,
  userData?: any,
  workspaceId?: string | null
): string => {
  const candidates = Array.from(
    new Set([cleanBucketId(uid), cleanBucketId(workspaceId), 'anon'].filter(Boolean))
  );

  for (const keyId of candidates) {
    try {
      const cleared = localStorage.getItem(`${STORAGE_WA_CLEARED_PREFIX}${keyId}`) === '1';
      const stored = localStorage.getItem(`${STORAGE_WA_PREFIX}${keyId}`);
      if (stored && stored.trim()) {
        return stored.trim();
      }
      if (cleared) {
        return String(userData?.whatsappSecretaria || '').trim();
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  const explicitWa = String(userData?.whatsappSecretaria || '').trim();
  if (explicitWa) return explicitWa;

  return String(userData?.telefono || userData?.phoneNumber || '').trim();
};

export const saveAbogadoWhatsappSecretaria = async (params: {
  uid?: string | null;
  workspaceId?: string | null;
  phone: string;
}): Promise<{ savedPhone: string; syncedCloud: boolean }> => {
  const { uid, workspaceId, phone } = params;
  const trimmed = String(phone || '').trim();
  const normalized = trimmed ? normalizeAbogadoWhatsAppPhone(trimmed) : '';
  const storageKeyIds = Array.from(
    new Set(
      [
        cleanBucketId(uid),
        workspaceId ? cleanBucketId(workspaceId) : '',
      ].filter(Boolean)
    )
  );

  for (const keyId of storageKeyIds) {
    try {
      if (normalized) {
        localStorage.setItem(`${STORAGE_WA_PREFIX}${keyId}`, normalized);
        localStorage.removeItem(`${STORAGE_WA_CLEARED_PREFIX}${keyId}`);
      } else {
        localStorage.removeItem(`${STORAGE_WA_PREFIX}${keyId}`);
        localStorage.setItem(`${STORAGE_WA_CLEARED_PREFIX}${keyId}`, '1');
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  let syncedCloud = false;
  const targetUid = String(auth?.currentUser?.uid || uid || workspaceId || '').trim();
  if (targetUid && auth?.currentUser?.uid) {
    const userRef = doc(db, 'users', targetUid);
    const payload = {
      whatsappSecretaria: normalized,
      whatsappSecretariaUpdatedAt: new Date().toISOString(),
    };
    try {
      await updateDoc(userRef, payload);
      syncedCloud = true;
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      if (code.includes('not-found')) {
        try {
          await setDoc(userRef, payload, { merge: true });
          syncedCloud = true;
        } catch {
          syncedCloud = false;
        }
      }
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent('olga_abogado_wa_updated', {
        detail: { uid: targetUid, phone: normalized },
      })
    );
  } catch {
    // Ignorar en entornos sin window
  }

  return { savedPhone: normalized, syncedCloud };
};

export interface SecretariaReminderSchedule {
  frecuenciaDias: number;
  horaEnvio: string; // HH:mm
  incluirSabado: boolean;
  incluirDomingo: boolean;
  recordatorioActivo: boolean;
  ultimoEnvioFecha?: string | null; // YYYY-MM-DD
  updatedAt?: string;
}

export const DEFAULT_SECRETARIA_SCHEDULE: SecretariaReminderSchedule = {
  frecuenciaDias: 1,
  horaEnvio: '05:00',
  incluirSabado: true,
  incluirDomingo: false,
  recordatorioActivo: true,
  ultimoEnvioFecha: null,
};

const STORAGE_SCHEDULE_PREFIX = 'olga_abogado_secretaria_schedule_';
const SESSION_PROMPTED_PREFIX = 'olga_abogado_secretaria_session_prompted_';

export const sanitizeFrecuenciaDias = (raw: unknown): number => {
  const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(365, Math.floor(num));
};

export const sanitizeHoraEnvio = (raw: unknown): string => {
  const clean = String(raw ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(clean);
  if (!match) return DEFAULT_SECRETARIA_SCHEDULE.horaEnvio;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return DEFAULT_SECRETARIA_SCHEDULE.horaEnvio;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const normalizeSecretariaSchedule = (
  raw?: Partial<SecretariaReminderSchedule> | Record<string, any> | null
): SecretariaReminderSchedule => {
  const src = raw || {};
  const lastRaw = typeof src.ultimoEnvioFecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(src.ultimoEnvioFecha)
    ? src.ultimoEnvioFecha.slice(0, 10)
    : null;
  return {
    frecuenciaDias: sanitizeFrecuenciaDias(src.frecuenciaDias),
    horaEnvio: sanitizeHoraEnvio(src.horaEnvio),
    incluirSabado: typeof src.incluirSabado === 'boolean' ? src.incluirSabado : DEFAULT_SECRETARIA_SCHEDULE.incluirSabado,
    incluirDomingo: typeof src.incluirDomingo === 'boolean' ? src.incluirDomingo : DEFAULT_SECRETARIA_SCHEDULE.incluirDomingo,
    recordatorioActivo:
      typeof src.recordatorioActivo === 'boolean'
        ? src.recordatorioActivo
        : DEFAULT_SECRETARIA_SCHEDULE.recordatorioActivo,
    ultimoEnvioFecha: lastRaw,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : undefined,
  };
};

export const loadAbogadoSecretariaSchedule = (
  uid?: string | null,
  userData?: any,
  workspaceId?: string | null
): SecretariaReminderSchedule => {
  const candidates = Array.from(
    new Set([cleanBucketId(uid), cleanBucketId(workspaceId), 'anon'].filter(Boolean))
  );

  let localSchedule: SecretariaReminderSchedule | null = null;
  for (const keyId of candidates) {
    try {
      const raw = localStorage.getItem(`${STORAGE_SCHEDULE_PREFIX}${keyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          localSchedule = normalizeSecretariaSchedule(parsed);
          break;
        }
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  const cloudRaw =
    userData?.secretariaOlgaSchedule && typeof userData.secretariaOlgaSchedule === 'object'
      ? userData.secretariaOlgaSchedule
      : userData &&
          (userData.frecuenciaDias !== undefined ||
            userData.horaEnvio !== undefined ||
            userData.incluirSabado !== undefined ||
            userData.incluirDomingo !== undefined ||
            userData.recordatorioActivo !== undefined)
        ? {
            frecuenciaDias: userData.frecuenciaDias,
            horaEnvio: userData.horaEnvio,
            incluirSabado: userData.incluirSabado,
            incluirDomingo: userData.incluirDomingo,
            recordatorioActivo: userData.recordatorioActivo,
            ultimoEnvioFecha: userData.ultimoEnvioSecretariaFecha ?? null,
          }
        : null;

  const cloudSchedule = cloudRaw ? normalizeSecretariaSchedule(cloudRaw) : null;

  if (localSchedule && cloudSchedule) {
    const localMs = Date.parse(localSchedule.updatedAt || '') || 0;
    const cloudMs = Date.parse(cloudSchedule.updatedAt || '') || 0;
    const picked = cloudMs > localMs ? cloudSchedule : localSchedule;
    const newerLastSent = [localSchedule.ultimoEnvioFecha, cloudSchedule.ultimoEnvioFecha]
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() || null;
    return { ...picked, ultimoEnvioFecha: newerLastSent };
  }

  return localSchedule || cloudSchedule || { ...DEFAULT_SECRETARIA_SCHEDULE };
};

export const saveAbogadoSecretariaSchedule = async (params: {
  uid?: string | null;
  workspaceId?: string | null;
  schedule: Partial<SecretariaReminderSchedule>;
}): Promise<{ schedule: SecretariaReminderSchedule; syncedCloud: boolean }> => {
  const { uid, workspaceId, schedule } = params;
  const normalized = normalizeSecretariaSchedule({
    ...schedule,
    updatedAt: new Date().toISOString(),
  });

  const storageKeyIds = Array.from(
    new Set(
      [
        cleanBucketId(uid),
        workspaceId ? cleanBucketId(workspaceId) : '',
      ].filter(Boolean)
    )
  );

  for (const keyId of storageKeyIds) {
    try {
      localStorage.setItem(`${STORAGE_SCHEDULE_PREFIX}${keyId}`, JSON.stringify(normalized));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  let syncedCloud = false;
  const targetUid = String(auth?.currentUser?.uid || uid || workspaceId || '').trim();
  if (targetUid && auth?.currentUser?.uid) {
    const userRef = doc(db, 'users', targetUid);
    const payload = {
      secretariaOlgaSchedule: normalized,
      frecuenciaDias: normalized.frecuenciaDias,
      horaEnvio: normalized.horaEnvio,
      incluirSabado: normalized.incluirSabado,
      incluirDomingo: normalized.incluirDomingo,
      recordatorioActivo: normalized.recordatorioActivo,
      ultimoEnvioSecretariaFecha: normalized.ultimoEnvioFecha || null,
    };
    try {
      await updateDoc(userRef, payload);
      syncedCloud = true;
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      if (code.includes('not-found')) {
        try {
          await setDoc(userRef, payload, { merge: true });
          syncedCloud = true;
        } catch {
          syncedCloud = false;
        }
      }
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent('olga_abogado_schedule_updated', {
        detail: { uid: targetUid, schedule: normalized },
      })
    );
  } catch {
    // Ignorar en entornos sin window
  }

  return { schedule: normalized, syncedCloud };
};

export const markSecretariaReminderSentToday = async (params: {
  uid?: string | null;
  workspaceId?: string | null;
  currentSchedule?: Partial<SecretariaReminderSchedule> | null;
  fechaIso?: string;
}): Promise<SecretariaReminderSchedule> => {
  const { uid, workspaceId, currentSchedule, fechaIso } = params;
  const base = currentSchedule
    ? normalizeSecretariaSchedule(currentSchedule)
    : loadAbogadoSecretariaSchedule(uid, null, workspaceId);
  const todayIso = fechaIso && /^\d{4}-\d{2}-\d{2}/.test(fechaIso)
    ? fechaIso.slice(0, 10)
    : getTodayIsoAsuncionLocal();
  const res = await saveAbogadoSecretariaSchedule({
    uid,
    workspaceId,
    schedule: {
      ...base,
      ultimoEnvioFecha: todayIso,
    },
  });
  markSecretariaReminderPromptedSession(uid || workspaceId, todayIso);
  return res.schedule;
};

export const wasSecretariaReminderPromptedSession = (
  uid?: string | null,
  todayIso: string = getTodayIsoAsuncionLocal()
): boolean => {
  try {
    const key = `${SESSION_PROMPTED_PREFIX}${cleanBucketId(uid)}`;
    return sessionStorage.getItem(key) === todayIso;
  } catch {
    return false;
  }
};

export const markSecretariaReminderPromptedSession = (
  uid?: string | null,
  todayIso: string = getTodayIsoAsuncionLocal()
): void => {
  try {
    const key = `${SESSION_PROMPTED_PREFIX}${cleanBucketId(uid)}`;
    sessionStorage.setItem(key, todayIso);
  } catch {
    // Ignorar si sessionStorage no está disponible
  }
};

export interface EvaluateSecretariaReminderParams {
  schedule: Partial<SecretariaReminderSchedule> | SecretariaReminderSchedule;
  now?: Date;
  timeZone?: string;
  ultimoEnvioFecha?: string | null;
}

export interface SecretariaReminderEvaluation {
  shouldSend: boolean;
  reason:
    | 'ok'
    | 'inactive'
    | 'sunday_excluded'
    | 'saturday_excluded'
    | 'already_sent_today'
    | 'frequency_wait'
    | 'before_scheduled_time';
  todayIso: string;
  currentTimeHHmm: string;
  dayOfWeek: number; // 0 = Domingo ... 6 = Sábado
  daysSinceLastSend: number | null;
  statusLabel: string;
}

const getZonedDateParts = (
  date: Date,
  timeZone: string
): { todayIso: string; currentTimeHHmm: string; dayOfWeek: number } => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    const year = map.year || String(date.getFullYear());
    const month = map.month || String(date.getMonth() + 1).padStart(2, '0');
    const day = map.day || String(date.getDate()).padStart(2, '0');
    const rawHour = Number(map.hour ?? date.getHours());
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(map.minute ?? date.getMinutes());
    const wk = String(map.weekday || '').toLowerCase();
    const wkMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const dayOfWeek = wkMap[wk.slice(0, 3)] ?? date.getDay();
    return {
      todayIso: `${year}-${month}-${day}`,
      currentTimeHHmm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      dayOfWeek,
    };
  } catch {
    return {
      todayIso: date.toISOString().slice(0, 10),
      currentTimeHHmm: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      dayOfWeek: date.getDay(),
    };
  }
};

const toMinutesOfDay = (hhmm: string): number => {
  const [h, m] = sanitizeHoraEnvio(hhmm).split(':').map(Number);
  return h * 60 + m;
};

const diffIsoDays = (fromIso: string, toIso: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}/.test(toIso)) return null;
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return null;
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / (1000 * 60 * 60 * 24));
};

export const shouldTriggerSecretariaReminder = ({
  schedule,
  now = new Date(),
  timeZone = 'America/Asuncion',
  ultimoEnvioFecha,
}: EvaluateSecretariaReminderParams): SecretariaReminderEvaluation => {
  const norm = normalizeSecretariaSchedule(schedule);
  const { todayIso, currentTimeHHmm, dayOfWeek } = getZonedDateParts(now, timeZone);

  const effectiveLast =
    ultimoEnvioFecha && /^\d{4}-\d{2}-\d{2}/.test(ultimoEnvioFecha)
      ? ultimoEnvioFecha.slice(0, 10)
      : norm.ultimoEnvioFecha || null;

  const daysSinceLastSend = effectiveLast ? diffIsoDays(effectiveLast, todayIso) : null;

  if (!norm.recordatorioActivo) {
    return {
      shouldSend: false,
      reason: 'inactive',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: 'Recordatorio automático pausado',
    };
  }

  if (dayOfWeek === 0 && !norm.incluirDomingo) {
    return {
      shouldSend: false,
      reason: 'sunday_excluded',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: 'Hoy es domingo (omitido según tu preferencia)',
    };
  }

  if (dayOfWeek === 6 && !norm.incluirSabado) {
    return {
      shouldSend: false,
      reason: 'saturday_excluded',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: 'Hoy es sábado (omitido según tu preferencia)',
    };
  }

  if (effectiveLast && effectiveLast === todayIso) {
    return {
      shouldSend: false,
      reason: 'already_sent_today',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: 'Recordatorio de hoy ya enviado/gestionado',
    };
  }

  if (daysSinceLastSend !== null && daysSinceLastSend >= 0 && daysSinceLastSend < norm.frecuenciaDias) {
    const remaining = norm.frecuenciaDias - daysSinceLastSend;
    return {
      shouldSend: false,
      reason: 'frequency_wait',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: `Frecuencia cada ${norm.frecuenciaDias} días (próximo en ${remaining} día${remaining === 1 ? '' : 's'})`,
    };
  }

  if (toMinutesOfDay(currentTimeHHmm) < toMinutesOfDay(norm.horaEnvio)) {
    return {
      shouldSend: false,
      reason: 'before_scheduled_time',
      todayIso,
      currentTimeHHmm,
      dayOfWeek,
      daysSinceLastSend,
      statusLabel: `Programado para las ${norm.horaEnvio} hs (ahora: ${currentTimeHHmm} hs)`,
    };
  }

  return {
    shouldSend: true,
    reason: 'ok',
    todayIso,
    currentTimeHHmm,
    dayOfWeek,
    daysSinceLastSend,
    statusLabel: `Listo para enviar hoy (${norm.horaEnvio} hs)`,
  };
};

export const formatSecretariaScheduleSummary = (
  schedule: SecretariaReminderSchedule
): string => {
  const norm = normalizeSecretariaSchedule(schedule);
  if (!norm.recordatorioActivo) return 'Pausado';
  const freq = norm.frecuenciaDias === 1 ? 'Diario' : `Cada ${norm.frecuenciaDias} días`;
  const sab = norm.incluirSabado ? 'Sáb: Sí' : 'Sáb: No';
  const dom = norm.incluirDomingo ? 'Dom: Sí' : 'Dom: No';
  return `${freq} · ${norm.horaEnvio} hs · ${sab} · ${dom}`;
};

export const buildCausaDirectUrl = (expedienteId: string): string => {
  const cleanId = String(expedienteId || '').trim();
  if (!cleanId) return 'https://olgatech.com.py/consola?tab=expedientes';
  return `https://olgatech.com.py/consola?tab=expedientes&expedienteId=${encodeURIComponent(cleanId)}`;
};

export const buildDocumentoDirectUrl = (docItem?: LinkedDocResumen | null): string => {
  if (!docItem) return '';
  const direct = String(docItem.pdfUrl || docItem.storageUrl || '').trim();
  if (direct) return direct;
  const id = String(docItem.id || '').trim();
  if (!id || id.startsWith('temp-')) return '';
  return `https://olgatech.com.py/consola?tab=escritos&docId=${encodeURIComponent(id)}`;
};

export const findLinkedDocumentosForExpediente = (
  exp: Expediente,
  docs: LinkedDocResumen[]
): LinkedDocResumen[] => {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const expId = String(exp.id || '').trim();
  const nroClean = String(exp.nroExpediente || '').trim().toLowerCase();
  const caratulaTokens = String(exp.caratula || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['sobre', 'contra', 'juicio', 'ordinario', 'ejecutivo'].includes(w))
    .slice(0, 4);

  const matched = docs.filter((d) => {
    if (!d) return false;
    if (d.expedienteId && expId && String(d.expedienteId).trim() === expId) return true;
    const hay = `${d.tipo || ''} ${d.texto ? d.texto.slice(0, 500) : ''}`.toLowerCase();
    if (nroClean && nroClean.length >= 2 && hay.includes(nroClean)) return true;
    if (caratulaTokens.length >= 2) {
      const hits = caratulaTokens.filter((t) => hay.includes(t)).length;
      if (hits >= 2) return true;
    }
    return false;
  });

  return matched.slice(0, 3);
};

const formatSpanishFullDate = (isoDate?: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return 'A definir / Sin fecha';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  try {
    const weekday = new Intl.DateTimeFormat('es-PY', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(dt);
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dd}/${mm}/${y}`;
  } catch {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
};

const getAsuncionNowDateTime = (): { fechaStr: string; horaStr: string } => {
  const now = new Date();
  try {
    const fechaStr = new Intl.DateTimeFormat('es-PY', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Asuncion',
    }).format(now);
    const horaStr = new Intl.DateTimeFormat('es-PY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Asuncion',
    }).format(now);
    return {
      fechaStr: `${fechaStr.charAt(0).toUpperCase()}${fechaStr.slice(1)}`,
      horaStr,
    };
  } catch {
    return {
      fechaStr: getTodayIsoAsuncionLocal(),
      horaStr: '08:00',
    };
  }
};

const extractContraparteFromCaratula = (caratula: string, rolParte?: string): string => {
  const clean = String(caratula || '').trim();
  if (!clean) return 'Según carátula del expediente';
  const beforeSobre = clean.split(/\s+s\/\s+|\s+sobre\s+/i)[0] || clean;
  const parts = beforeSobre.split(/\s+c\/\s+|\s+contra\s+/i);
  if (parts.length >= 2) {
    const actor = parts[0].trim();
    const demandado = parts.slice(1).join(' / ').trim();
    if (rolParte === 'Demandado' && actor) return `${actor} (Actor/a)`;
    if (rolParte === 'Actor / Demandante' && demandado) return `${demandado} (Demandado/a)`;
    return `${actor} c/ ${demandado}`;
  }
  return 'Según carátula / constancias del expediente';
};

export interface BuildParteSecretariaParams {
  expediente: Expediente;
  plazo?: PlazoProcesal | null;
  userData?: any;
  currentUser?: any;
  linkedDocs?: LinkedDocResumen[];
  horaFranja?: string;
}

export const buildSecretariaOlgaParte = ({
  expediente,
  plazo,
  userData,
  currentUser,
  linkedDocs = [],
  horaFranja,
}: BuildParteSecretariaParams): string => {
  const pendingPlazos = (Array.isArray(expediente.plazos) ? expediente.plazos : [])
    .filter((p) => p && !p.completado)
    .sort(
      (a, b) =>
        (calcDaysUntilLocal(a.fechaVencimiento) ?? 9999) -
        (calcDaysUntilLocal(b.fechaVencimiento) ?? 9999)
    );

  const targetPlazo = plazo || pendingPlazos[0] || null;
  const diasRestantes = targetPlazo ? calcDaysUntilLocal(targetPlazo.fechaVencimiento) : null;

  const abogadoNombre =
    String(
      userData?.nombreTitular ||
        userData?.nombre ||
        userData?.razonSocial ||
        userData?.nombreInstitucion ||
        currentUser?.displayName ||
        currentUser?.email?.split('@')[0] ||
        'Abogado Responsable'
    ).trim();
  const matricula = String(
    userData?.matriculaAbogado || userData?.matricula || ''
  ).trim();
  const estudioNombre = String(
    userData?.razonSocial || userData?.nombreInstitucion || ''
  ).trim();

  const cliente = String(expediente.clienteNombre || '').trim() || 'Mandante / Cliente a confirmar';
  const contraparte = extractContraparteFromCaratula(expediente.caratula, expediente.rolParte);
  const juzgado = String(expediente.juzgado || '').trim() || 'Juzgado a confirmar en despacho';
  const nroExpte = expediente.nroExpediente
    ? `N.º ${expediente.nroExpediente}${expediente.anio ? `/${expediente.anio}` : ''}`
    : 'N.º pendiente de asignar';

  const { fechaStr: hoyAsuncionStr, horaStr: horaActualStr } = getAsuncionNowDateTime();
  const franjaHora =
    (horaFranja && horaFranja.trim()) ||
    `${horaActualStr} hs (Control sugerido de despacho: 07:30 a 12:00 hs)`;

  let estadoPlazoLabel = 'Sin vencimiento cargado';
  if (diasRestantes !== null) {
    if (diasRestantes < 0) {
      estadoPlazoLabel = `VENCIDO hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? '' : 's'} — ATENCIÓN INMEDIATA`;
    } else if (diasRestantes === 0) {
      estadoPlazoLabel = 'VENCE HOY — PRIORIDAD MÁXIMA';
    } else if (diasRestantes === 1) {
      estadoPlazoLabel = 'Vence MAÑANA (queda 1 día)';
    } else {
      estadoPlazoLabel = `Faltan ${diasRestantes} días`;
    }
  }

  const cuandoLinea = targetPlazo
    ? `${formatSpanishFullDate(targetPlazo.fechaVencimiento)} (${estadoPlazoLabel})`
    : `${hoyAsuncionStr} (Revisión de impulso / estado: ${expediente.estado})`;

  const queHacer = targetPlazo
    ? `${targetPlazo.titulo} [${targetPlazo.tipo === 'impulso' ? 'Impulso procesal' : 'Plazo legal'}]`
    : `Revisar estado "${expediente.estado}" y definir próximo impulso procesal`;

  const fundamento = String(expediente.ultimoAnalisisIA?.fundamentoCPC || '').trim();
  const porQueParaQue = targetPlazo
    ? targetPlazo.tipo === 'plazo_legal'
      ? `Evitar vencimiento perentorio/preclusión del plazo en juicio ${expediente.tipoJuicio}, resguardar el derecho del cliente y presentar el escrito en tiempo y forma.${fundamento ? ` Base: ${fundamento}.` : ''}`
      : `Impulsar activamente la causa (${expediente.tipoJuicio}) para destrabar el despacho y avanzar a la siguiente etapa procesal.${fundamento ? ` Base: ${fundamento}.` : ''}`
    : `Mantener control preventivo sobre la causa (${expediente.tipoJuicio}), evitar paralización de trámites y detectar nuevas notificaciones.${fundamento ? ` Base: ${fundamento}.` : ''}`;

  const resumenHechos = String(expediente.ultimoAnalisisIA?.resumenHechos || '').trim();
  const notas = String(expediente.notas || '').trim();
  const otrosPendientes = pendingPlazos
    .filter((p) => !targetPlazo || p.id !== targetPlazo.id)
    .slice(0, 3);

  const puntosAIncluir: string[] = [];
  if (resumenHechos) {
    puntosAIncluir.push(`• Contexto/Hechos: ${resumenHechos.slice(0, 260)}${resumenHechos.length > 260 ? '...' : ''}`);
  }
  if (fundamento) {
    puntosAIncluir.push(`• Fundamento CPC / Normativa: ${fundamento}`);
  }
  if (notas) {
    puntosAIncluir.push(`• Notas del estudio: ${notas.slice(0, 220)}${notas.length > 220 ? '...' : ''}`);
  }
  if (otrosPendientes.length > 0) {
    puntosAIncluir.push(
      `• Otras actuaciones pendientes: ${otrosPendientes
        .map((p) => `${p.titulo} (${p.fechaVencimiento ? p.fechaVencimiento.split('-').reverse().join('/') : 's/f'})`)
        .join(' | ')}`
    );
  }
  if (puntosAIncluir.length === 0) {
    puntosAIncluir.push(
      `• Verificar personería, copias de traslado, constancias de notificación y pruebas documentales del caso (${expediente.tipoJuicio}).`
    );
  }

  const causaUrl = buildCausaDirectUrl(expediente.id);
  const docLinks: string[] = [`• Abrir causa en O.L.G.A.: ${causaUrl}`];

  if (linkedDocs.length > 0) {
    linkedDocs.forEach((d) => {
      const url = buildDocumentoDirectUrl(d);
      const label = String(d.tipo || 'Documento / Escrito vinculado').trim();
      if (url) {
        docLinks.push(`• ${label}: ${url}`);
      } else {
        docLinks.push(`• Escrito guardado en O.L.G.A.: ${label}`);
      }
    });
  }

  if (expediente.ultimoAnalisisIA?.archivoNombre) {
    docLinks.push(
      `• Documento PDF/archivo analizado en la ficha: ${expediente.ultimoAnalisisIA.archivoNombre}`
    );
  }

  const lines: string[] = [
    `📋 *PARTE SECRETARÍA O.L.G.A.*`,
    `*Causa:* ${expediente.caratula}`,
    `*Expediente:* ${nroExpte} · *Juicio:* ${expediente.tipoJuicio} · *Estado:* ${expediente.estado}`,
    ``,
    `👤 *QUIÉN / PARA QUIÉN / CON QUIÉN*`,
    `• *Responsable:* ${abogadoNombre}${matricula ? ` (Mat. CSJ ${matricula})` : ''}${estudioNombre && estudioNombre !== abogadoNombre ? ` — ${estudioNombre}` : ''}`,
    `• *Para quién (Cliente):* ${cliente} (Rol: ${expediente.rolParte})`,
    `• *Con quién / Sede:* ${contraparte} | ${juzgado}`,
    ``,
    `🗓️ *CUÁNDO, DÍA Y HORA*`,
    `• *Vencimiento / Fecha clave:* ${cuandoLinea}`,
    `• *Emisión / Franja horaria:* ${hoyAsuncionStr} · ${franjaHora}`,
    ``,
    `📌 *QUÉ HACER Y QUÉ ATENDER*`,
    `• ${queHacer}`,
    ``,
    `🎯 *POR QUÉ Y PARA QUÉ*`,
    `• ${porQueParaQue}`,
    ``,
    `🔎 *QUÉ BUSCAR Y QUÉ CARGAR*`,
    `• Ingresar a *Judisoft*, revisar providencias, autos, oficios y cédulas de notificación electrónica del ${nroExpte}.`,
    `• *Cargar las actualizaciones (PDF o foto) en O.L.G.A.* para recalcular plazos y continuar la causa sin demoras.`,
    ``,
    `📎 *QUÉ INCLUIR*`,
    ...puntosAIncluir,
    ``,
    `🔗 *DÓNDE IR (ENLACES DIRECTOS)*`,
    ...docLinks,
  ];

  return lines.join('\n');
};

export interface BuildParteGeneralSecretariaParams {
  expedientes: Expediente[];
  userData?: any;
  currentUser?: any;
  horaFranja?: string;
}

const formatCompactDateShort = (isoDate?: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return 's/f';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const formatCompactUrgencyLabel = (dias: number | null): string => {
  if (dias === null) return 'SIN FECHA';
  if (dias < 0) {
    const abs = Math.abs(dias);
    return `VENCIDO hace ${abs} día${abs === 1 ? '' : 's'}`;
  }
  if (dias === 0) return 'VENCE HOY';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
};

export const buildSecretariaOlgaParteGeneral = ({
  expedientes,
  userData,
  currentUser,
  horaFranja,
}: BuildParteGeneralSecretariaParams): string => {
  const activeCauses = (Array.isArray(expedientes) ? expedientes : []).filter(
    (exp) =>
      exp &&
      exp.id &&
      exp.anulado !== true &&
      exp.eliminado !== true &&
      (exp.estado || 'En trámite') !== 'Finalizado'
  );

  interface CompactCauseEntry {
    expediente: Expediente;
    plazoPrincipal: PlazoProcesal;
    diasRestantes: number | null;
    extraPendientes: number;
  }

  const entries: CompactCauseEntry[] = [];
  let totalHoy = 0;
  let totalVencidos = 0;
  let totalCriticos = 0;
  let totalProximos = 0;

  activeCauses.forEach((exp) => {
    const pending = (Array.isArray(exp.plazos) ? exp.plazos : [])
      .filter((p) => p && p.completado !== true)
      .sort(
        (a, b) =>
          (calcDaysUntilLocal(a.fechaVencimiento) ?? 9999) -
          (calcDaysUntilLocal(b.fechaVencimiento) ?? 9999)
      );

    if (pending.length === 0) return;

    pending.forEach((p) => {
      const d = calcDaysUntilLocal(p.fechaVencimiento);
      if (d !== null) {
        if (d < 0) totalVencidos += 1;
        if (d === 0) totalHoy += 1;
        if (d <= 3) totalCriticos += 1;
        else if (d >= 4 && d <= 7) totalProximos += 1;
      }
    });

    const first = pending[0];
    entries.push({
      expediente: exp,
      plazoPrincipal: first,
      diasRestantes: calcDaysUntilLocal(first.fechaVencimiento),
      extraPendientes: Math.max(0, pending.length - 1),
    });
  });

  entries.sort((a, b) => (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999));

  const urgentes = entries.filter(
    (item) => item.diasRestantes !== null && item.diasRestantes <= 3
  );
  const proximos = entries.filter(
    (item) => item.diasRestantes !== null && item.diasRestantes >= 4 && item.diasRestantes <= 7
  );
  const siguientes = entries.filter(
    (item) => item.diasRestantes === null || item.diasRestantes > 7
  );

  const { fechaStr: hoyAsuncionStr, horaStr: horaActualStr } = getAsuncionNowDateTime();
  const franjaLabel =
    (horaFranja && horaFranja.trim()) || `${horaActualStr} hs`;
  const abogadoNombre = String(
    userData?.nombreTitular ||
      userData?.nombre ||
      userData?.razonSocial ||
      userData?.nombreInstitucion ||
      currentUser?.displayName ||
      currentUser?.email?.split('@')[0] ||
      ''
  ).trim();

  const formatEntryLines = (item: CompactCauseEntry): string[] => {
    const { expediente, plazoPrincipal, diasRestantes, extraPendientes } = item;
    const urgLabel = formatCompactUrgencyLabel(diasRestantes);
    const fechaTxt = formatCompactDateShort(plazoPrincipal.fechaVencimiento);
    const nroTxt = expediente.nroExpediente
      ? `Expte. ${expediente.nroExpediente}${expediente.anio ? `/${expediente.anio}` : ''}`
      : 'S/N';
    const extraTxt =
      extraPendientes > 0
        ? ` (+${extraPendientes} actuación${extraPendientes === 1 ? '' : 'es'} más)`
        : '';
    const link = buildCausaDirectUrl(expediente.id);
    return [
      `• *${urgLabel}* (${fechaTxt}) — *${expediente.caratula || 'Expediente sin carátula'}* (${nroTxt})`,
      `  Atender: ${plazoPrincipal.titulo}${extraTxt}`,
      `  ${link}`,
    ];
  };

  const lines: string[] = [
    `📋 *PARTE GENERAL — SECRETARÍA O.L.G.A.*`,
    `*Fecha:* ${hoyAsuncionStr} · ${franjaLabel}${abogadoNombre ? ` · *${abogadoNombre}*` : ''}`,
    `*Resumen:* ${totalHoy} vencen hoy${totalVencidos > 0 ? ` (${totalVencidos} vencido${totalVencidos === 1 ? '' : 's'})` : ''} | ${totalCriticos} críticos (≤3d) | ${totalProximos} próximos (4–7d) · *${entries.length} causa${entries.length === 1 ? '' : 's'} con pendientes*`,
    `🔎 *Judisoft:* Entrá a *Judisoft* para revisar si hay nuevas cédulas o providencias y cargalas en O.L.G.A.`,
  ];

  if (entries.length === 0) {
    lines.push(
      ``,
      `✅ No hay plazos ni impulsos pendientes en tus causas activas (${activeCauses.length} causa${activeCauses.length === 1 ? '' : 's'} en seguimiento).`,
      `🔗 Panel de expedientes: https://olgatech.com.py/consola?tab=expedientes`
    );
    return lines.join('\n');
  }

  if (urgentes.length > 0) {
    lines.push(``, `🔴 *URGENTES (Hoy o ≤ 3 días)*`);
    urgentes.forEach((item) => {
      lines.push(...formatEntryLines(item));
    });
  }

  if (proximos.length > 0) {
    lines.push(``, `🟡 *PRÓXIMOS (4–7 días)*`);
    proximos.forEach((item) => {
      lines.push(...formatEntryLines(item));
    });
  }

  if (siguientes.length > 0) {
    lines.push(``, `📅 *SIGUIENTES (> 7 días)*`);
    siguientes.forEach((item) => {
      lines.push(...formatEntryLines(item));
    });
  }

  return lines.join('\n');
};

export const buildWhatsAppSelfSendUrl = (phone: string, message: string): string => {
  const digits = normalizeAbogadoWhatsAppPhone(phone);
  if (!digits || digits.length < 8) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};
