import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileCheck2,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  Gavel,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Scale,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  EstadoExpediente,
  Expediente,
  ExpedienteAnalisisIA,
  ExpedienteDocumentoMemoria,
  OrigenDocumentoExpediente,
  Persona,
  PlazoProcesal,
  RolParteExpediente,
  TipoJuicioExpediente,
  TipoPlazoProcesal,
} from '../types';
import {
  analyzeExpedientePdf,
  ExpedientePdfAnalysisPayload,
  limpiarLatexJuridico,
  MemoriaDocumentoEscritoPayload,
  redactarEscritoJudicialConIA,
} from '../services/gemini';
import { auth, db } from '../services/auth';
import { incrementarUsoIA } from '../services/firestore';
import { ParteSecretariaModal, ParteSecretariaMode } from './ParteSecretariaModal';
import {
  DEFAULT_SECRETARIA_SCHEDULE,
  fetchConnectedWorkspaceWhatsApp,
  findLinkedDocumentosForExpediente,
  formatAbogadoWhatsAppDisplay,
  formatSecretariaScheduleSummary,
  LinkedDocResumen,
  loadAbogadoCustomWhatsappSecretaria,
  loadAbogadoSecretariaSchedule,
  markSecretariaReminderPromptedSession,
  normalizeAbogadoWhatsAppPhone,
  normalizeSecretariaSchedule,
  resolveEffectiveAbogadoWhatsapp,
  sanitizeFrecuenciaDias,
  sanitizeHoraEnvio,
  saveAbogadoSecretariaSchedule,
  saveAbogadoWhatsappSecretaria,
  SecretariaReminderSchedule,
  shouldTriggerSecretariaReminder,
  wasSecretariaReminderPromptedSession,
} from '../services/secretariaOlga';

interface ExpedientesTabProps {
  expedientes: Expediente[];
  personas?: Persona[];
  userData?: any;
  currentUser?: any;
  workspaceId?: string;
  esPlanFull?: boolean;
  isSoftBlocked?: boolean;
  isSuperAdminView?: boolean;
  initialSelectedExpedienteId?: string | null;
  onClearInitialSelectedExpediente?: () => void;
  onSaveExpediente: (expediente: Expediente) => Promise<void>;
  onDeleteExpediente: (expedienteId: string) => Promise<void>;
  onOpenDocument: (
    text: string,
    docId?: string,
    tipo?: string,
    categoria?: string,
    tipoHoja?: 'blanca' | 'protocolo',
    includeHeader?: boolean
  ) => void;
}

const TIPOS_JUICIO: TipoJuicioExpediente[] = [
  'Ordinario',
  'Ejecutivo',
  'Laboral',
  'Niñez y Adolescencia',
  'Penal',
  'Sucesorio',
  'Otro',
];

const ROLES_PARTE: RolParteExpediente[] = [
  'Demandado',
  'Actor / Demandante',
  'Tercero',
];

const ESTADOS_EXPEDIENTE: EstadoExpediente[] = [
  'En trámite',
  'Pendiente de contestación',
  'Período probatorio',
  'Autos para sentencia',
  'Finalizado',
];

export const getTodayIsoAsuncion = (): string => {
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

export const calcDaysUntil = (fechaIso: string): number | null => {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}/.test(fechaIso)) return null;
  const cleanTarget = fechaIso.slice(0, 10);
  const todayIso = getTodayIsoAsuncion();
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [fy, fm, fd] = cleanTarget.split('-').map(Number);
  if (!ty || !tm || !td || !fy || !fm || !fd) return null;
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const targetUtc = Date.UTC(fy, fm - 1, fd);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
};

const addCalendarDaysIso = (days: number): string => {
  const base = getTodayIsoAsuncion();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Math.max(1, days)));
  return dt.toISOString().slice(0, 10);
};

const formatDateShort = (isoDate: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate || 'Sin fecha';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx !== -1 ? result.slice(commaIdx + 1) : result;
      if (!base64) {
        reject(new Error('No se pudo leer el contenido del archivo.'));
        return;
      }
      resolve({
        base64,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });

const normalizeTipoJuicio = (raw: string): TipoJuicioExpediente => {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('ejecutivo')) return 'Ejecutivo';
  if (lower.includes('laboral')) return 'Laboral';
  if (lower.includes('niñez') || lower.includes('ninez') || lower.includes('adolesc')) return 'Niñez y Adolescencia';
  if (lower.includes('penal')) return 'Penal';
  if (lower.includes('sucesor')) return 'Sucesorio';
  if (lower.includes('ordinario')) return 'Ordinario';
  return 'Otro';
};

const normalizeRolParte = (raw: string): RolParteExpediente => {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('demandad')) return 'Demandado';
  if (lower.includes('tercer')) return 'Tercero';
  return 'Actor / Demandante';
};

const buildStablePlazoId = (p: any, idx: number): string => {
  const existing = String(p?.id || '').trim();
  if (existing) return existing;
  const slugTitulo = String(p?.titulo || 'plazo')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const fecha = String(p?.fechaVencimiento || '').slice(0, 10);
  return `plazo-${idx}-${slugTitulo || 'item'}-${fecha || 'sin-fecha'}`;
};

const buildPlazoFallbackKey = (p: Partial<PlazoProcesal>, idx: number): string => {
  const titulo = String(p?.titulo || '').trim().toLowerCase();
  const fecha = String(p?.fechaVencimiento || '').slice(0, 10);
  return `sig:${idx}|${titulo}|${fecha}`;
};

const pickNonEmptyOwnerId = (...candidates: Array<unknown>): string => {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value && value !== 'anon') return value;
  }
  return '';
};

interface SuggestedNextStep {
  titulo: string;
  diasPlazo: number;
  fechaVencimiento: string;
  tipo: TipoPlazoProcesal;
  fundamentoOrientativo: string;
}

const normProceduralText = (raw: string): string =>
  String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const suggestNextProceduralStep = (
  exp: Expediente,
  completedPlazo: PlazoProcesal
): SuggestedNextStep => {
  const tipoJuicio = exp.tipoJuicio || 'Ordinario';
  const titleNorm = normProceduralText(completedPlazo.titulo || '');

  const build = (
    titulo: string,
    diasPlazo: number,
    tipo: TipoPlazoProcesal,
    fundamentoOrientativo: string
  ): SuggestedNextStep => ({
    titulo,
    diasPlazo,
    fechaVencimiento: addCalendarDaysIso(diasPlazo),
    tipo,
    fundamentoOrientativo,
  });

  if (/(intima|mandamiento|embargo|citacion de remate)/.test(titleNorm)) {
    if (titleNorm.includes('citacion de remate')) {
      return build(
        'Solicitar sentencia de remate',
        3,
        'impulso',
        'Cumplida la citación de remate, corresponde urgir sentencia de remate (Art. 462 CPC).'
      );
    }
    return build(
      'Controlar oposición de excepciones y pedir citación de remate',
      5,
      'plazo_legal',
      'Plazo de 5 días para oponer excepciones o impulsar la citación de remate (Art. 460 CPC).'
    );
  }

  if (/(contest|demanda|traslado de la demanda|emplazam)/.test(titleNorm)) {
    if (tipoJuicio === 'Ejecutivo') {
      return build(
        'Solicitar citación de remate o sentencia de remate',
        5,
        'impulso',
        'Etapa posterior al traslado o contestación en juicio ejecutivo (CPC).'
      );
    }
    if (tipoJuicio === 'Laboral') {
      return build(
        'Solicitar audiencia de conciliación y ofrecimiento probatorio',
        5,
        'impulso',
        'Etapa procesal laboral siguiente a la contestación de demanda (CPT).'
      );
    }
    if (tipoJuicio === 'Sucesorio') {
      return build(
        'Publicar edictos y agregar constancias al expediente',
        10,
        'impulso',
        'Seguimiento de publicación de edictos sucesorios (Art. 741 CPC).'
      );
    }
    if (tipoJuicio === 'Niñez y Adolescencia') {
      return build(
        'Solicitar audiencia de sustanciación y pruebas',
        3,
        'impulso',
        'Impulso prioritario de 3 días para audiencia y pruebas en Niñez.'
      );
    }
    return build(
      'Ofrecimiento probatorio / solicitar apertura a prueba',
      10,
      'impulso',
      'Plazo orientativo de 10 días para solicitar apertura a prueba u ofrecer medios probatorios (Art. 247 CPC).'
    );
  }

  if (/excepcion/.test(titleNorm)) {
    return build(
      'Solicitar resolución de excepciones o apertura a prueba',
      3,
      'impulso',
      'Impulso orientativo de 3 días para solicitar resolución del incidente o prosecución (CPC).'
    );
  }

  if (/(audiencia|conciliacion)/.test(titleNorm)) {
    return build(
      'Ofrecimiento probatorio / solicitar resolución según lo actuado',
      10,
      'impulso',
      'Impulso orientativo de 10 días posterior a la audiencia celebrada.'
    );
  }

  if (/(apertura a prueba|ofrecimiento|ofrecer prueba|periodo probatorio)/.test(titleNorm)) {
    return build(
      'Diligenciar oficios, cédulas y producción de pruebas',
      10,
      'impulso',
      'Seguimiento de 10 días para diligenciamiento y producción de pruebas admitidas (CPC).'
    );
  }

  if (/(diligenc|oficio|pericia|testifical|produccion de prueba)/.test(titleNorm)) {
    return build(
      'Solicitar cierre de período probatorio y traslado para alegar',
      6,
      'impulso',
      'Impulso para solicitar informe de actuario, cierre probatorio y alegatos (Art. 379 CPC).'
    );
  }

  if (/(alegato|alegar)/.test(titleNorm)) {
    return build(
      'Solicitar llamamiento de autos para sentencia',
      3,
      'impulso',
      'Plazo orientativo de 3 días tras los alegatos para solicitar autos para sentencia (CPC).'
    );
  }

  if (/(autos para sentencia|sentencia definitiva|sentencia de remate|sentencia)/.test(titleNorm)) {
    if (titleNorm.includes('autos para sentencia')) {
      return build(
        'Urgir dictado de sentencia definitiva / control de despacho',
        10,
        'impulso',
        'Seguimiento orientativo del llamamiento de autos para sentencia.'
      );
    }
    return build(
      'Controlar notificación de sentencia y cómputo recursivo',
      5,
      'plazo_legal',
      'Control del plazo de 5 días para eventual aclaratoria o apelación (CPC).'
    );
  }

  if (/(apelacion|apelar|agravio)/.test(titleNorm)) {
    return build(
      'Presentar expresión de agravios o impulsar elevación al Tribunal',
      5,
      'plazo_legal',
      'Plazo orientativo de 5 días para fundamentar recurso ante el Tribunal (CPC).'
    );
  }

  if (/(reposicion|aclaratoria|incidente|nulidad)/.test(titleNorm)) {
    return build(
      'Solicitar resolución del recurso / traslado pendiente',
      3,
      'impulso',
      'Plazo orientativo de 3 días para solicitar resolución de incidente o recurso (CPC).'
    );
  }

  if (/(edicto|declaratoria|heredero|inventario|avaluo)/.test(titleNorm) || tipoJuicio === 'Sucesorio') {
    if (titleNorm.includes('edicto')) {
      return build(
        'Solicitar declaratoria de herederos',
        10,
        'impulso',
        'Cumplido el término de edictos, corresponde solicitar declaratoria de herederos (CPC).'
      );
    }
    if (titleNorm.includes('declaratoria')) {
      return build(
        'Presentar inventario, avalúo y partición de bienes',
        10,
        'impulso',
        'Etapa siguiente tras la declaratoria de herederos en juicio sucesorio (CPC).'
      );
    }
    return build(
      'Solicitar aprobación de operaciones y adjudicación',
      5,
      'impulso',
      'Impulso sucesorio orientativo de 5 días para adjudicación o resolución (CPC).'
    );
  }

  if (/(providencia|resolucion|cedula|notificacion|traslado)/.test(titleNorm)) {
    return build(
      'Solicitar resolución / prosecución de trámite pendiente',
      3,
      'impulso',
      'Plazo orientativo de 3 días para solicitar providencia o traslado (CPC).'
    );
  }

  if (tipoJuicio === 'Penal') {
    return build(
      'Controlar requerimiento fiscal o solicitar audiencia',
      5,
      'impulso',
      'Seguimiento procesal penal orientativo a 5 días (CPP).'
    );
  }

  if (tipoJuicio === 'Niñez y Adolescencia') {
    return build(
      'Solicitar audiencia o resolución prioritaria',
      3,
      'impulso',
      'Impulso prioritario de 3 días en fuero de Niñez y Adolescencia.'
    );
  }

  return build(
    'Impulso procesal: Solicitar resolución o prosecución de trámite',
    3,
    'impulso',
    'Sugerencia orientativa de impulso procesal a 3 días según práctica habitual del CPC.'
  );
};

const inferOrigenDocumentoExpediente = (
  analisis: Partial<ExpedienteAnalisisIA> | null | undefined,
  rolParte?: string
): OrigenDocumentoExpediente => {
  const texto = `${analisis?.plazoPrincipal?.titulo || ''} ${analisis?.resumenHechos || ''}`.toLowerCase();
  if (/(providencia|auto\s+interlocutorio|sentencia|resoluci[óo]n|oficio|c[eé]dula\s+de\s+notificaci[óo]n|despacho)/.test(texto)) {
    return 'Juzgado';
  }
  const esDemandado = String(rolParte || '').toLowerCase().includes('demandad');
  if (esDemandado && /(demanda|traslado|emplazamiento|intimaci[óo]n|reclamo|actora|demandante)/.test(texto)) {
    return 'Adversa';
  }
  if (!esDemandado && /(contestaci[óo]n|excepci[óo]n|oposici[óo]n|reconvenci[óo]n|demandado)/.test(texto)) {
    return 'Adversa';
  }
  if (/(nuestro|propio|impulso\s+presentado|alegato\s+nuestro)/.test(texto)) {
    return 'Propia';
  }
  return 'General';
};

const sanitizeHistorialDocumentosList = (
  rawList: unknown,
  fallbackAnalisis?: ExpedienteAnalisisIA | null,
  rolParte?: string
): ExpedienteDocumentoMemoria[] => {
  const list: ExpedienteDocumentoMemoria[] = Array.isArray(rawList)
    ? rawList
        .filter((d: any) => d && typeof d === 'object' && String(d.resumenHechos || '').trim())
        .map((d: any, idx: number) => ({
          id: String(d.id || `docmem-${idx}-${Date.now()}`).trim(),
          archivoNombre: String(d.archivoNombre || `Documento ${idx + 1}`).trim(),
          analizadoAt: String(d.analizadoAt || new Date().toISOString()),
          parteOrigen: (['Adversa', 'Propia', 'Juzgado', 'General'].includes(String(d.parteOrigen))
            ? d.parteOrigen
            : inferOrigenDocumentoExpediente(d, rolParte)) as OrigenDocumentoExpediente,
          resumenHechos: String(d.resumenHechos || '').trim(),
          fundamentoCPC: d.fundamentoCPC ? String(d.fundamentoCPC).trim() : '',
          tipoActo: d.tipoActo ? String(d.tipoActo).trim() : (d.tipoActuacion ? String(d.tipoActuacion).trim() : ''),
        }))
    : [];

  if (list.length === 0 && fallbackAnalisis && String(fallbackAnalisis.resumenHechos || '').trim()) {
    list.push({
      id: `docmem-legacy-${String(fallbackAnalisis.analizadoAt || '1').replace(/[^a-z0-9]/gi, '').slice(0, 14)}`,
      archivoNombre: String(fallbackAnalisis.archivoNombre || 'Documento analizado').trim(),
      analizadoAt: String(fallbackAnalisis.analizadoAt || new Date().toISOString()),
      parteOrigen: inferOrigenDocumentoExpediente(fallbackAnalisis, rolParte),
      resumenHechos: String(fallbackAnalisis.resumenHechos || '').trim(),
      fundamentoCPC: fallbackAnalisis.fundamentoCPC ? String(fallbackAnalisis.fundamentoCPC).trim() : '',
      tipoActo: fallbackAnalisis.plazoPrincipal?.titulo ? String(fallbackAnalisis.plazoPrincipal.titulo).trim() : '',
    });
  }

  return list.slice(-30);
};

const appendAnalisisToHistorial = (
  existingHistorial: unknown,
  fallbackAnalisis: ExpedienteAnalisisIA | null | undefined,
  newAnalisis: ExpedienteAnalisisIA,
  rolParte?: string
): ExpedienteDocumentoMemoria[] => {
  const base = sanitizeHistorialDocumentosList(existingHistorial, fallbackAnalisis, rolParte);
  const newSummary = String(newAnalisis.resumenHechos || '').trim();
  if (!newSummary) return base;

  const newEntry: ExpedienteDocumentoMemoria = {
    id: `docmem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    archivoNombre: String(newAnalisis.archivoNombre || 'Documento analizado').trim(),
    analizadoAt: String(newAnalisis.analizadoAt || new Date().toISOString()),
    parteOrigen: inferOrigenDocumentoExpediente(newAnalisis, rolParte),
    resumenHechos: newSummary,
    fundamentoCPC: newAnalisis.fundamentoCPC ? String(newAnalisis.fundamentoCPC).trim() : '',
    tipoActo: newAnalisis.plazoPrincipal?.titulo ? String(newAnalisis.plazoPrincipal.titulo).trim() : '',
  };

  const duplicateExists = base.some(
    (item) =>
      item.archivoNombre === newEntry.archivoNombre &&
      item.resumenHechos.slice(0, 90) === newEntry.resumenHechos.slice(0, 90)
  );
  if (duplicateExists) {
    return base.map((item) =>
      item.archivoNombre === newEntry.archivoNombre &&
      item.resumenHechos.slice(0, 90) === newEntry.resumenHechos.slice(0, 90)
        ? { ...item, analizadoAt: newEntry.analizadoAt, fundamentoCPC: newEntry.fundamentoCPC || item.fundamentoCPC }
        : item
    );
  }
  return [...base, newEntry].slice(-30);
};

const mapFirestoreDocToExpediente = (raw: any, docId: string): Expediente => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawPlazos = Array.isArray(src.plazos) ? src.plazos : [];
  const plazos: PlazoProcesal[] = rawPlazos
    .filter((p: any) => p && typeof p === 'object')
    .map((p: any, idx: number) => {
      const isCompleted = p.completado === true;
      const completadoEn =
        isCompleted && typeof p.completadoEn === 'string' && p.completadoEn.trim()
          ? p.completadoEn.trim()
          : null;
      return {
        id: buildStablePlazoId(p, idx),
        titulo: String(p.titulo || 'Plazo procesal').trim(),
        fechaVencimiento: String(p.fechaVencimiento || '').slice(0, 10),
        diasPlazo: Number.isFinite(Number(p.diasPlazo)) ? Number(p.diasPlazo) : 0,
        completado: isCompleted,
        completadoEn,
        tipo: p.tipo === 'impulso' ? 'impulso' : 'plazo_legal',
      };
    });

  const rawEstado = String(src.estado || '').trim();
  const estado: EstadoExpediente = (ESTADOS_EXPEDIENTE.includes(rawEstado as EstadoExpediente)
    ? rawEstado
    : rawEstado || 'En trámite') as EstadoExpediente;

  const rawTipo = String(src.tipoJuicio || '').trim();
  const tipoJuicio: TipoJuicioExpediente = rawTipo ? normalizeTipoJuicio(rawTipo) : 'Ordinario';

  const rawUserId = pickNonEmptyOwnerId(src.userId);
  const rawOwnedByWorkspace = pickNonEmptyOwnerId(src.ownedByWorkspace);
  const ultimoAnalisisIA =
    src.ultimoAnalisisIA && typeof src.ultimoAnalisisIA === 'object' ? src.ultimoAnalisisIA : null;
  const rolParte = src.rolParte ? normalizeRolParte(String(src.rolParte)) : 'Actor / Demandante';

  return {
    id: String(src.id || docId).trim() || docId,
    userId: rawUserId || rawOwnedByWorkspace,
    ownedByWorkspace: rawOwnedByWorkspace || rawUserId,
    caratula: String(src.caratula || '').trim() || 'Expediente sin carátula',
    nroExpediente: String(src.nroExpediente || '').trim(),
    anio: String(src.anio || new Date().getFullYear()).trim(),
    juzgado: String(src.juzgado || '').trim(),
    tipoJuicio,
    rolParte,
    estado,
    plazos,
    ultimoAnalisisIA,
    historialDocumentos: sanitizeHistorialDocumentosList(src.historialDocumentos, ultimoAnalisisIA, rolParte),
    notas: src.notas ? String(src.notas) : '',
    clienteNombre: src.clienteNombre ? String(src.clienteNombre) : '',
    clienteId: src.clienteId ? String(src.clienteId) : '',
    createdAt: String(src.createdAt || new Date().toISOString()),
    updatedAt: String(src.updatedAt || src.createdAt || new Date().toISOString()),
    creator_id: src.creator_id ? String(src.creator_id) : '',
    creator_name: src.creator_name ? String(src.creator_name) : '',
    anulado: src.anulado === true,
    eliminado: src.eliminado === true,
  };
};

const EXPEDIENTES_DESCARTADOS_KEY_PREFIX = 'olga_expedientes_descartados_';
const PLAZOS_CHECKS_KEY_PREFIX = 'olga_plazos_checks_';

export interface LocalPlazoCheckOverride {
  completado: boolean;
  completadoEn: string | null;
  updatedAt?: string;
}

const normalizeCheckStorageUid = (rawUid?: string | null): string =>
  String(rawUid || '').trim() || 'anon';

export const loadDiscardedExpKeys = (uid: string): string[] => {
  const normUid = normalizeCheckStorageUid(uid);
  const readOne = (bucketUid: string): string[] => {
    try {
      const raw = localStorage.getItem(`${EXPEDIENTES_DESCARTADOS_KEY_PREFIX}${bucketUid}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  };
  if (normUid === 'anon') return readOne('anon');
  return Array.from(new Set([...readOne('anon'), ...readOne(normUid)]));
};

const saveDiscardedExpKeys = (uid: string, keys: string[]): void => {
  const normUid = normalizeCheckStorageUid(uid);
  try {
    const unique = Array.from(new Set(keys.filter((k) => typeof k === 'string' && k.trim().length > 0)));
    localStorage.setItem(`${EXPEDIENTES_DESCARTADOS_KEY_PREFIX}${normUid}`, JSON.stringify(unique));
  } catch {}
};

export const buildExpedienteDismissKeys = (
  exp: Partial<Expediente> | null | undefined,
  docId?: string
): string[] => {
  const keys: string[] = [];
  const cleanId = String(exp?.id || '').trim();
  const cleanDocId = String(docId || '').trim();
  if (cleanId) keys.push(cleanId);
  if (cleanDocId && cleanDocId !== cleanId) keys.push(cleanDocId);
  const sigCaratula = String(exp?.caratula || '').trim().toLowerCase();
  const sigNro = String(exp?.nroExpediente || '').trim().toLowerCase();
  const sigAnio = String(exp?.anio || '').trim().toLowerCase();
  if (sigCaratula || sigNro) {
    keys.push(`sig:${sigCaratula}|${sigNro}|${sigAnio}`);
  }
  return keys;
};

const getPlazosChecksStorageKey = (uid: string, expedienteId: string): string =>
  `${PLAZOS_CHECKS_KEY_PREFIX}${normalizeCheckStorageUid(uid)}_${String(expedienteId || '').trim()}`;

const readRawPlazoChecksBucket = (
  storageUid: string,
  expedienteId: string
): Record<string, LocalPlazoCheckOverride> => {
  const cleanExpId = String(expedienteId || '').trim();
  if (!cleanExpId) return {};
  try {
    const raw = localStorage.getItem(getPlazosChecksStorageKey(storageUid, cleanExpId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, LocalPlazoCheckOverride> = {};
    Object.entries(parsed).forEach(([plazoId, val]: [string, any]) => {
      if (val && typeof val === 'object' && typeof val.completado === 'boolean') {
        result[plazoId] = {
          completado: val.completado,
          completadoEn:
            val.completado && typeof val.completadoEn === 'string' && val.completadoEn.trim()
              ? val.completadoEn.trim()
              : null,
          updatedAt: typeof val.updatedAt === 'string' ? val.updatedAt : undefined,
        };
      }
    });
    return result;
  } catch {
    return {};
  }
};

const pickNewestOverride = (
  a?: LocalPlazoCheckOverride,
  b?: LocalPlazoCheckOverride
): LocalPlazoCheckOverride | undefined => {
  if (!a) return b;
  if (!b) return a;
  const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
  return tb >= ta ? b : a;
};

export const loadLocalPlazoChecksForExpediente = (
  uid: string,
  expedienteId: string
): Record<string, LocalPlazoCheckOverride> => {
  const cleanExpId = String(expedienteId || '').trim();
  if (!cleanExpId) return {};
  const normUid = normalizeCheckStorageUid(uid);
  const anonBucket = readRawPlazoChecksBucket('anon', cleanExpId);
  if (normUid === 'anon') return anonBucket;
  const userBucket = readRawPlazoChecksBucket(normUid, cleanExpId);
  const merged: Record<string, LocalPlazoCheckOverride> = { ...anonBucket };
  Object.entries(userBucket).forEach(([key, val]) => {
    const newest = pickNewestOverride(merged[key], val);
    if (newest) merged[key] = newest;
  });
  return merged;
};

export const saveLocalPlazoCheckForExpediente = (
  uid: string,
  expedienteId: string,
  plazoId: string,
  override: LocalPlazoCheckOverride,
  fallbackSigKey?: string
): void => {
  const cleanExpId = String(expedienteId || '').trim();
  const cleanPlazoId = String(plazoId || '').trim();
  if (!cleanExpId || !cleanPlazoId) return;
  const normUid = normalizeCheckStorageUid(uid);
  try {
    const existing = readRawPlazoChecksBucket(normUid, cleanExpId);
    const normalizedOverride: LocalPlazoCheckOverride = {
      completado: override.completado === true,
      completadoEn: override.completado === true ? (override.completadoEn || new Date().toISOString()) : null,
      updatedAt: override.updatedAt || new Date().toISOString(),
    };
    existing[cleanPlazoId] = normalizedOverride;
    if (fallbackSigKey) {
      existing[fallbackSigKey] = normalizedOverride;
    }
    localStorage.setItem(getPlazosChecksStorageKey(normUid, cleanExpId), JSON.stringify(existing));
  } catch {}
};

const EXPEDIENTES_LOCALES_KEY_PREFIX = 'olga_expedientes_locales_';

const getExpedienteUpdatedMs = (exp?: Partial<Expediente> | null): number => {
  if (!exp) return 0;
  const raw = exp.updatedAt || exp.createdAt || '';
  const parsed = raw ? Date.parse(String(raw)) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickNewerExpediente = (existing: Expediente | undefined, candidate: Expediente): Expediente => {
  if (!existing) return candidate;
  return getExpedienteUpdatedMs(candidate) >= getExpedienteUpdatedMs(existing) ? candidate : existing;
};

const readRawLocalExpedientesBucket = (storageUid: string): Record<string, Expediente> => {
  try {
    const raw = localStorage.getItem(`${EXPEDIENTES_LOCALES_KEY_PREFIX}${normalizeCheckStorageUid(storageUid)}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, Expediente> = {};
    Object.entries(parsed).forEach(([id, val]: [string, any]) => {
      if (val && typeof val === 'object' && id.trim()) {
        const mapped = mapFirestoreDocToExpediente(val, id);
        if (mapped.anulado !== true && mapped.eliminado !== true) {
          result[mapped.id] = mapped;
        }
      }
    });
    return result;
  } catch {
    return {};
  }
};

export const loadLocalExpedienteOverrides = (uid: string): Record<string, Expediente> => {
  const normUid = normalizeCheckStorageUid(uid);
  const anonBucket = readRawLocalExpedientesBucket('anon');
  if (normUid === 'anon') return anonBucket;
  const userBucket = readRawLocalExpedientesBucket(normUid);
  const merged: Record<string, Expediente> = { ...anonBucket };
  Object.entries(userBucket).forEach(([id, exp]) => {
    merged[id] = pickNewerExpediente(merged[id], exp);
  });
  return merged;
};

const saveLocalExpedienteOverride = (uid: string, exp: Expediente, oldId?: string): void => {
  if (!exp || !exp.id) return;
  const normUid = normalizeCheckStorageUid(uid);
  try {
    const existing = readRawLocalExpedientesBucket(normUid);
    if (oldId && oldId !== exp.id) {
      delete existing[oldId];
    }
    existing[exp.id] = exp;
    localStorage.setItem(`${EXPEDIENTES_LOCALES_KEY_PREFIX}${normUid}`, JSON.stringify(existing));
  } catch {}
};

const removeLocalExpedienteOverride = (uid: string, idsToRemove: string[]): void => {
  const cleanIds = idsToRemove.map((id) => String(id || '').trim()).filter(Boolean);
  if (cleanIds.length === 0) return;
  const normUid = normalizeCheckStorageUid(uid);
  const buckets = normUid === 'anon' ? ['anon'] : ['anon', normUid];
  buckets.forEach((bucketUid) => {
    try {
      const existing = readRawLocalExpedientesBucket(bucketUid);
      let changed = false;
      cleanIds.forEach((id) => {
        if (existing[id]) {
          delete existing[id];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(`${EXPEDIENTES_LOCALES_KEY_PREFIX}${bucketUid}`, JSON.stringify(existing));
      }
    } catch {}
  });
};

const isGhostOrMockExpId = (rawId: string): boolean => {
  const clean = String(rawId || '').trim().toLowerCase();
  if (!clean) return true;
  return /^(mock|seed|demo|ghost|sample|temp|ejemplo|inicial)[-_:]/.test(clean);
};

interface ExpedienteVisualAccent {
  stripeCls: string;
  nroBadgeCls: string;
  dotCls: string;
  hoverBorderCls: string;
}

const EXPEDIENTE_ACCENT_PALETTE: ExpedienteVisualAccent[] = [
  {
    stripeCls: 'bg-indigo-500',
    nroBadgeCls: 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/70',
    dotCls: 'bg-indigo-500',
    hoverBorderCls: 'hover:border-indigo-300 dark:hover:border-indigo-700/80',
  },
  {
    stripeCls: 'bg-emerald-500',
    nroBadgeCls: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700/70',
    dotCls: 'bg-emerald-500',
    hoverBorderCls: 'hover:border-emerald-300 dark:hover:border-emerald-700/80',
  },
  {
    stripeCls: 'bg-amber-500',
    nroBadgeCls: 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700/70',
    dotCls: 'bg-amber-500',
    hoverBorderCls: 'hover:border-amber-300 dark:hover:border-amber-700/80',
  },
  {
    stripeCls: 'bg-sky-500',
    nroBadgeCls: 'bg-sky-50 dark:bg-sky-950/70 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-700/70',
    dotCls: 'bg-sky-500',
    hoverBorderCls: 'hover:border-sky-300 dark:hover:border-sky-700/80',
  },
  {
    stripeCls: 'bg-violet-500',
    nroBadgeCls: 'bg-violet-50 dark:bg-violet-950/70 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-700/70',
    dotCls: 'bg-violet-500',
    hoverBorderCls: 'hover:border-violet-300 dark:hover:border-violet-700/80',
  },
  {
    stripeCls: 'bg-teal-500',
    nroBadgeCls: 'bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700/70',
    dotCls: 'bg-teal-500',
    hoverBorderCls: 'hover:border-teal-300 dark:hover:border-teal-700/80',
  },
];

const getExpedienteVisualAccent = (exp: Expediente): ExpedienteVisualAccent => {
  const seed = `${exp.id || ''}|${exp.nroExpediente || ''}|${exp.caratula || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return EXPEDIENTE_ACCENT_PALETTE[hash % EXPEDIENTE_ACCENT_PALETTE.length];
};

export const ExpedientesTab: React.FC<ExpedientesTabProps> = ({
  expedientes,
  personas = [],
  userData,
  currentUser,
  workspaceId = '',
  esPlanFull = false,
  isSoftBlocked = false,
  isSuperAdminView = false,
  initialSelectedExpedienteId = null,
  onClearInitialSelectedExpediente,
  onSaveExpediente,
  onDeleteExpediente,
  onOpenDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [showUpcomingAll, setShowUpcomingAll] = useState(false);
  const [kpiModalCategory, setKpiModalCategory] = useState<'activas' | 'criticos' | 'proximos' | 'cumplidas' | null>(null);
  const expedienteCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const expedientesListSectionRef = useRef<HTMLDivElement | null>(null);

  // Modal crear/editar expediente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpediente, setEditingExpediente] = useState<Expediente | null>(null);
  const [caratula, setCaratula] = useState('');
  const [nroExpediente, setNroExpediente] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [juzgado, setJuzgado] = useState('');
  const [tipoJuicio, setTipoJuicio] = useState<TipoJuicioExpediente>('Ordinario');
  const [rolParte, setRolParte] = useState<RolParteExpediente>('Demandado');
  const [estado, setEstado] = useState<EstadoExpediente>('En trámite');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [notas, setNotas] = useState('');
  const [draftPlazos, setDraftPlazos] = useState<PlazoProcesal[]>([]);
  const [draftAnalisisIA, setDraftAnalisisIA] = useState<ExpedienteAnalisisIA | null>(null);
  const [draftHistorialDocumentos, setDraftHistorialDocumentos] = useState<ExpedienteDocumentoMemoria[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Análisis PDF con IA (dentro del modal o directo sobre un expediente abierto)
  const [analyzingTargetId, setAnalyzingTargetId] = useState<string | null>(null); // 'modal' | expediente.id
  const [pendingAnalysisPreview, setPendingAnalysisPreview] = useState<{
    target: 'modal' | string;
    fileName: string;
    result: ExpedientePdfAnalysisPayload;
  } | null>(null);

  // Redacción IA en progreso
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [draftingFromPreviewMode, setDraftingFromPreviewMode] = useState<'contestacion' | 'impulso' | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Confirmación de borrado en UI (sin window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Nuevo plazo rápido dentro de un expediente abierto
  const [addingPlazoForExpId, setAddingPlazoForExpId] = useState<string | null>(null);
  const [newPlazoTitulo, setNewPlazoTitulo] = useState('');
  const [newPlazoFecha, setNewPlazoFecha] = useState(() => addCalendarDaysIso(5));
  const [newPlazoDias, setNewPlazoDias] = useState('5');
  const [newPlazoTipo, setNewPlazoTipo] = useState<TipoPlazoProcesal>('plazo_legal');

  // Toggle análisis IA expandido por expediente
  const [expandedAnalisisIds, setExpandedAnalisisIds] = useState<Record<string, boolean>>({});

  const modalPdfInputRef = useRef<HTMLInputElement>(null);
  const cardPdfInputRef = useRef<HTMLInputElement>(null);
  const [cardPdfTargetExp, setCardPdfTargetExp] = useState<Expediente | null>(null);

  const estudioNombre =
    String(
      userData?.razonSocial ||
        userData?.nombreInstitucion ||
        userData?.nombre ||
        ''
    ).trim() || 'Estudio Jurídico';

  const cardSurfaceCls = esPlanFull
    ? 'bg-[#F4F4F0]/90 dark:bg-[#12141C]/90 border-amber-200/50 dark:border-amber-500/30'
    : 'bg-white dark:bg-[#121824]/95 border-slate-200/80 dark:border-slate-800';

  const [liveExpedientes, setLiveExpedientes] = useState<Expediente[]>([]);
  const [hasLiveSnapshot, setHasLiveSnapshot] = useState(false);
  const [optimisticToggleByKey, setOptimisticToggleByKey] = useState<
    Record<string, LocalPlazoCheckOverride>
  >({});
  const [togglingPlazos, setTogglingPlazos] = useState<Record<string, boolean>>({});
  const docIdByExpIdRef = useRef<Map<string, string>>(new Map());

  const uid = String(currentUser?.uid || auth?.currentUser?.uid || '').trim();
  const wsId = String(workspaceId || uid).trim();
  const storageUid = normalizeCheckStorageUid(uid || userData?.uid || wsId);
  const isExplicitSuperAdmin = isSuperAdminView === true;
  const esAbogado =
    String(userData?.tipoPerfil || currentUser?.tipoPerfil || '').toLowerCase() === 'abogado';

  const [discardedExpKeys, setDiscardedExpKeys] = useState<string[]>(() =>
    loadDiscardedExpKeys(storageUid)
  );
  const [localExpedienteOverrides, setLocalExpedienteOverrides] = useState<Record<string, Expediente>>(() =>
    loadLocalExpedienteOverrides(storageUid)
  );
  const [localChecksVersion, setLocalChecksVersion] = useState(0);
  const [pendingMarkDonePrompt, setPendingMarkDonePrompt] = useState<{
    expediente: Expediente;
    plazo: PlazoProcesal;
  } | null>(null);
  const [nextStepSuggestion, setNextStepSuggestion] = useState<{
    expedienteId: string;
    caratula: string;
    tipoJuicio: string;
    completedPlazoId: string;
    completedTitulo: string;
    suggestedPlazo: SuggestedNextStep;
  } | null>(null);
  const [isSavingNextStep, setIsSavingNextStep] = useState(false);

  // Secretaría O.L.G.A. — WhatsApp propio y modal de Parte (EXCLUSIVO ABOGADOS)
  const [connectedWaPhone, setConnectedWaPhone] = useState<string>('');
  const [abogadoWaNumber, setAbogadoWaNumber] = useState<string>(() =>
    esAbogado ? loadAbogadoCustomWhatsappSecretaria(uid, userData, wsId) : ''
  );
  const [abogadoWaDraft, setAbogadoWaDraft] = useState<string>(() => {
    if (!esAbogado) return '';
    const custom = loadAbogadoCustomWhatsappSecretaria(uid, userData, wsId);
    return custom ? formatAbogadoWhatsAppDisplay(custom) : '';
  });
  const [editingAbogadoWa, setEditingAbogadoWa] = useState(false);
  const [isSavingAbogadoWa, setIsSavingAbogadoWa] = useState(false);
  const [abogadoWaFeedback, setAbogadoWaFeedback] = useState<string | null>(null);
  const [workspaceDocs, setWorkspaceDocs] = useState<LinkedDocResumen[]>([]);
  const [parteModalTarget, setParteModalTarget] = useState<{
    expediente: Expediente | null;
    plazo?: PlazoProcesal | null;
    isScheduledTrigger?: boolean;
    mode?: ParteSecretariaMode;
  } | null>(null);
  const [secretariaSchedule, setSecretariaSchedule] = useState<SecretariaReminderSchedule>(() =>
    esAbogado ? loadAbogadoSecretariaSchedule(uid, userData, wsId) : { ...DEFAULT_SECRETARIA_SCHEDULE }
  );
  const [scheduleDraft, setScheduleDraft] = useState<SecretariaReminderSchedule>(() =>
    esAbogado ? loadAbogadoSecretariaSchedule(uid, userData, wsId) : { ...DEFAULT_SECRETARIA_SCHEDULE }
  );
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null);

  const waResolution = useMemo(
    () =>
      esAbogado
        ? resolveEffectiveAbogadoWhatsapp({
            uid,
            workspaceId: wsId,
            userData,
            currentUser,
            connectedWaPhone,
            customPhoneOverride: abogadoWaNumber,
          })
        : { effectivePhone: '', defaultPhone: '', customPhone: '', source: 'none' as const },
    [esAbogado, uid, wsId, userData, currentUser, connectedWaPhone, abogadoWaNumber]
  );

  useEffect(() => {
    if (!esAbogado) {
      setConnectedWaPhone('');
      return;
    }
    const targetWs = wsId || uid;
    if (!targetWs) return;
    let active = true;
    void fetchConnectedWorkspaceWhatsApp(targetWs).then((phone) => {
      if (active) setConnectedWaPhone(phone);
    });
    return () => {
      active = false;
    };
  }, [esAbogado, wsId, uid]);

  useEffect(() => {
    setDiscardedExpKeys(loadDiscardedExpKeys(storageUid));
    setLocalExpedienteOverrides(loadLocalExpedienteOverrides(storageUid));
    setLocalChecksVersion((v) => v + 1);
  }, [storageUid]);

  useEffect(() => {
    if (!esAbogado) return;
    const custom = loadAbogadoCustomWhatsappSecretaria(uid, userData, wsId);
    setAbogadoWaNumber(custom);
    setAbogadoWaDraft(custom ? formatAbogadoWhatsAppDisplay(custom) : '');
  }, [esAbogado, uid, wsId, userData?.whatsappSecretaria]);

  useEffect(() => {
    if (!esAbogado) return;
    const loadedSched = loadAbogadoSecretariaSchedule(uid, userData, wsId);
    setSecretariaSchedule(loadedSched);
    setScheduleDraft(loadedSched);
  }, [
    esAbogado,
    uid,
    wsId,
    userData?.secretariaOlgaSchedule,
    userData?.frecuenciaDias,
    userData?.horaEnvio,
    userData?.incluirSabado,
    userData?.incluirDomingo,
    userData?.recordatorioActivo,
    userData?.ultimoEnvioSecretariaFecha,
  ]);

  useEffect(() => {
    if (!esAbogado) return;
    const onWaUpdated = (e: any) => {
      const next = normalizeAbogadoWhatsAppPhone(String(e?.detail?.phone || ''));
      setAbogadoWaNumber(next);
      setAbogadoWaDraft(next ? formatAbogadoWhatsAppDisplay(next) : '');
    };
    const onScheduleUpdated = (e: any) => {
      if (e?.detail?.schedule) {
        const nextSched = normalizeSecretariaSchedule(e.detail.schedule);
        setSecretariaSchedule(nextSched);
        setScheduleDraft(nextSched);
      }
    };
    window.addEventListener('olga_abogado_wa_updated', onWaUpdated);
    window.addEventListener('olga_abogado_schedule_updated', onScheduleUpdated);
    return () => {
      window.removeEventListener('olga_abogado_wa_updated', onWaUpdated);
      window.removeEventListener('olga_abogado_schedule_updated', onScheduleUpdated);
    };
  }, [esAbogado]);

  useEffect(() => {
    if (!esAbogado) {
      setWorkspaceDocs([]);
      return;
    }
    const ownerTarget = wsId || uid;
    if (!ownerTarget) return;
    const docsMap = new Map<string, LinkedDocResumen>();
    const unsubs: Array<() => void> = [];

    const commitDocs = () => {
      setWorkspaceDocs(Array.from(docsMap.values()));
    };

    const subscribeDocs = (field: 'userId' | 'ownedByWorkspace', val: string) => {
      const qDocs = query(collection(db, 'documentos_olga'), where(field, '==', val));
      unsubs.push(
        onSnapshot(
          qDocs,
          (snap) => {
            snap.docs.forEach((d) => {
              const data = d.data() as any;
              if (data?.eliminado === true) return;
              docsMap.set(d.id, {
                id: d.id,
                tipo: data?.tipo,
                categoria: data?.categoria,
                storageUrl: data?.storageUrl,
                pdfUrl: data?.pdfUrl,
                expedienteId: data?.expedienteId,
                createdAt: data?.createdAt,
                texto: typeof data?.texto === 'string' ? data.texto.slice(0, 600) : undefined,
              });
            });
            commitDocs();
          },
          () => {
            // Silencioso si no hay permisos o aún no existen documentos
          }
        )
      );
    };

    if (uid) subscribeDocs('userId', uid);
    if (wsId && wsId !== uid) subscribeDocs('ownedByWorkspace', wsId);

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [esAbogado, uid, wsId]);

  const handleSaveAbogadoWaInline = async (overridePhone?: string) => {
    const rawVal = overridePhone !== undefined ? overridePhone : abogadoWaDraft;
    const norm = rawVal.trim() ? normalizeAbogadoWhatsAppPhone(rawVal) : '';
    if (rawVal.trim() && norm.length < 8) {
      setAbogadoWaFeedback('Ingresa un número válido (ej. 0981 123 456).');
      return;
    }
    setIsSavingAbogadoWa(true);
    setAbogadoWaFeedback(null);
    try {
      const res = await saveAbogadoWhatsappSecretaria({
        uid,
        workspaceId: wsId,
        phone: norm,
      });
      setAbogadoWaNumber(res.savedPhone);
      setAbogadoWaDraft(res.savedPhone ? formatAbogadoWhatsAppDisplay(res.savedPhone) : '');
      setEditingAbogadoWa(false);
      setAbogadoWaFeedback(
        res.savedPhone
          ? 'Número alternativo guardado para avisos.'
          : 'Se usará automáticamente tu número vinculado.'
      );
      window.setTimeout(() => setAbogadoWaFeedback(null), 3500);
    } catch {
      setAbogadoWaFeedback('Error al guardar el número.');
    } finally {
      setIsSavingAbogadoWa(false);
    }
  };

  const handleToggleSecretariaActivoInline = async () => {
    const nextActivo = !secretariaSchedule.recordatorioActivo;
    const normalized = normalizeSecretariaSchedule({
      ...secretariaSchedule,
      recordatorioActivo: nextActivo,
    });
    setSecretariaSchedule(normalized);
    setScheduleDraft(normalized);
    try {
      const res = await saveAbogadoSecretariaSchedule({
        uid,
        workspaceId: wsId,
        schedule: normalized,
      });
      setSecretariaSchedule(res.schedule);
      setScheduleDraft(res.schedule);
      setScheduleFeedback(
        res.schedule.recordatorioActivo
          ? 'Secretaría O.L.G.A. activada.'
          : 'Secretaría O.L.G.A. pausada.'
      );
      window.setTimeout(() => setScheduleFeedback(null), 3000);
    } catch {
      setScheduleFeedback('No se pudo actualizar el estado.');
    }
  };

  const handleSaveScheduleInline = async () => {
    setIsSavingSchedule(true);
    setScheduleFeedback(null);
    try {
      const normalized = normalizeSecretariaSchedule({
        ...scheduleDraft,
        frecuenciaDias: sanitizeFrecuenciaDias(scheduleDraft.frecuenciaDias),
        horaEnvio: sanitizeHoraEnvio(scheduleDraft.horaEnvio),
        ultimoEnvioFecha: secretariaSchedule.ultimoEnvioFecha ?? scheduleDraft.ultimoEnvioFecha ?? null,
      });
      const res = await saveAbogadoSecretariaSchedule({
        uid,
        workspaceId: wsId,
        schedule: normalized,
      });
      setSecretariaSchedule(res.schedule);
      setScheduleDraft(res.schedule);
      setShowScheduleEditor(false);
      setScheduleFeedback('Programación guardada.');
      window.setTimeout(() => setScheduleFeedback(null), 3500);
    } catch {
      setScheduleFeedback('No se pudo guardar la programación.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const discardedExpKeySet = useMemo(() => new Set(discardedExpKeys), [discardedExpKeys]);

  const persistDiscardedExpKeys = (newKeys: string[]) => {
    if (!esAbogado || newKeys.length === 0) return;
    setDiscardedExpKeys((prev) => {
      const merged = Array.from(new Set([...prev, ...newKeys.filter(Boolean)]));
      saveDiscardedExpKeys(storageUid, merged);
      return merged;
    });
  };

  const removeDiscardedExpKeys = (keysToRestore: string[]) => {
    if (!esAbogado || keysToRestore.length === 0) return;
    const toRemove = new Set(keysToRestore.filter(Boolean));
    setDiscardedExpKeys((prev) => {
      const next = prev.filter((k) => !toRemove.has(k));
      if (next.length !== prev.length) {
        saveDiscardedExpKeys(storageUid, next);
      }
      return next;
    });
  };

  const persistLocalExpedienteOverride = (exp: Expediente, oldId?: string) => {
    if (!esAbogado || !exp?.id) return;
    setLocalExpedienteOverrides((prev) => {
      const next = { ...prev };
      if (oldId && oldId !== exp.id) {
        delete next[oldId];
      }
      next[exp.id] = exp;
      return next;
    });
    saveLocalExpedienteOverride(storageUid, exp, oldId);
  };

  const purgeLocalExpedienteOverride = (ids: string[]) => {
    if (!esAbogado || ids.length === 0) return;
    const cleanIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
    if (cleanIds.length === 0) return;
    setLocalExpedienteOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      cleanIds.forEach((id) => {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    removeLocalExpedienteOverride(storageUid, cleanIds);
  };

  const allowedOwnerIds = useMemo(() => {
    const ids = new Set<string>();
    if (uid) ids.add(uid);
    if (wsId) ids.add(wsId);
    return ids;
  }, [uid, wsId]);

  const belongsToCurrentAccount = (exp: Expediente): boolean => {
    if (isExplicitSuperAdmin) return true;
    const owners = [exp.userId, exp.ownedByWorkspace, exp.creator_id]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    if (owners.length === 0) return false;
    return owners.some((id) => allowedOwnerIds.has(id));
  };

  useEffect(() => {
    setLiveExpedientes([]);
    setHasLiveSnapshot(false);
    docIdByExpIdRef.current.clear();

    if (!uid && !wsId && !isExplicitSuperAdmin) {
      return;
    }

    const colRef = collection(db, 'expedientes');
    const adminMap = new Map<string, Expediente>();
    const userIdMap = new Map<string, Expediente>();
    const workspaceMap = new Map<string, Expediente>();
    const fallbackWorkspaceUidMap = new Map<string, Expediente>();

    const commitMerged = () => {
      const unified = new Map<string, Expediente>();
      const sources = isExplicitSuperAdmin
        ? [adminMap]
        : [userIdMap, workspaceMap, fallbackWorkspaceUidMap];

      sources.forEach((sourceMap) => {
        sourceMap.forEach((exp, id) => {
          if (exp.anulado === true || exp.eliminado === true) return;
          if (!isExplicitSuperAdmin) {
            const owners = [exp.userId, exp.ownedByWorkspace, exp.creator_id]
              .map((v) => String(v || '').trim())
              .filter(Boolean);
            if (owners.length === 0 || !owners.some((o) => allowedOwnerIds.has(o))) return;
          }
          unified.set(id, exp);
        });
      });

      setLiveExpedientes(Array.from(unified.values()));
      setHasLiveSnapshot(true);
    };

    const unsubs: Array<() => void> = [];

    if (isExplicitSuperAdmin) {
      unsubs.push(
        onSnapshot(
          colRef,
          (snapshot) => {
            adminMap.clear();
            snapshot.docs.forEach((docSnap) => {
              const raw = docSnap.data() as any;
              if (raw?.anulado === true || raw?.eliminado === true) return;
              const mapped = mapFirestoreDocToExpediente(raw, docSnap.id);
              docIdByExpIdRef.current.set(mapped.id, docSnap.id);
              adminMap.set(docSnap.id, mapped);
            });
            commitMerged();
          },
          (error) => {
            console.error('[ExpedientesTab] Error en lectura onSnapshot (superadmin):', error);
          }
        )
      );
    } else {
      if (uid) {
        unsubs.push(
          onSnapshot(
            query(colRef, where('userId', '==', uid)),
            (snapshot) => {
              userIdMap.clear();
              snapshot.docs.forEach((docSnap) => {
                const raw = docSnap.data() as any;
                if (raw?.anulado === true || raw?.eliminado === true) return;
                const mapped = mapFirestoreDocToExpediente(raw, docSnap.id);
                docIdByExpIdRef.current.set(mapped.id, docSnap.id);
                userIdMap.set(docSnap.id, mapped);
              });
              commitMerged();
            },
            (error) => {
              console.error('[ExpedientesTab] Error en lectura onSnapshot (userId):', error);
            }
          )
        );
      }

      if (wsId) {
        unsubs.push(
          onSnapshot(
            query(colRef, where('ownedByWorkspace', '==', wsId)),
            (snapshot) => {
              workspaceMap.clear();
              snapshot.docs.forEach((docSnap) => {
                const raw = docSnap.data() as any;
                if (raw?.anulado === true || raw?.eliminado === true) return;
                const mapped = mapFirestoreDocToExpediente(raw, docSnap.id);
                docIdByExpIdRef.current.set(mapped.id, docSnap.id);
                workspaceMap.set(docSnap.id, mapped);
              });
              commitMerged();
            },
            (error) => {
              console.error('[ExpedientesTab] Error en lectura onSnapshot (ownedByWorkspace):', error);
            }
          )
        );
      }

      if (uid && wsId && wsId !== uid) {
        unsubs.push(
          onSnapshot(
            query(colRef, where('ownedByWorkspace', '==', uid)),
            (snapshot) => {
              fallbackWorkspaceUidMap.clear();
              snapshot.docs.forEach((docSnap) => {
                const raw = docSnap.data() as any;
                if (raw?.anulado === true || raw?.eliminado === true) return;
                const mapped = mapFirestoreDocToExpediente(raw, docSnap.id);
                docIdByExpIdRef.current.set(mapped.id, docSnap.id);
                fallbackWorkspaceUidMap.set(docSnap.id, mapped);
              });
              commitMerged();
            },
            (error) => {
              console.error('[ExpedientesTab] Error en lectura onSnapshot (ownedByWorkspace=uid):', error);
            }
          )
        );
      }
    }

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
    };
  }, [uid, wsId, isExplicitSuperAdmin, allowedOwnerIds]);

  const effectiveExpedientes = useMemo(() => {
    const dedup = new Map<string, Expediente>();

    const ingestExpediente = (item: any, fromLocalOverride = false) => {
      if (!item || !item.id) return;
      if (item.anulado === true || item.eliminado === true) return;
      const mapped = mapFirestoreDocToExpediente(item, item.id);
      if (!fromLocalOverride && !belongsToCurrentAccount(mapped)) return;
      const mappedDocId = docIdByExpIdRef.current.get(mapped.id);
      if (esAbogado && discardedExpKeySet.size > 0) {
        const itemKeys = buildExpedienteDismissKeys(mapped, mappedDocId);
        if (itemKeys.some((k) => discardedExpKeySet.has(k))) return;
      }
      const existing = dedup.get(mapped.id);
      const chosen = fromLocalOverride
        ? (existing && getExpedienteUpdatedMs(existing) > getExpedienteUpdatedMs(mapped)
            ? existing
            : mapped)
        : pickNewerExpediente(existing, mapped);
      dedup.set(mapped.id, chosen);
    };

    if (esAbogado) {
      // Combinar siempre prop expedientes + liveExpedientes + ediciones locales (sin depender de hasLiveSnapshot)
      (Array.isArray(expedientes) ? expedientes : []).forEach((item) => ingestExpediente(item, false));
      liveExpedientes.forEach((item) => ingestExpediente(item, false));
      Object.values(localExpedienteOverrides).forEach((item) => ingestExpediente(item, true));
    } else {
      const source = hasLiveSnapshot ? liveExpedientes : (Array.isArray(expedientes) ? expedientes : []);
      source.forEach((item) => ingestExpediente(item, false));
    }

    const finalResults: Expediente[] = [];
    dedup.forEach((mapped) => {
      const mappedDocId = docIdByExpIdRef.current.get(mapped.id);
      const localChecksByPlazo = esAbogado
        ? (() => {
            const merged: Record<string, LocalPlazoCheckOverride> = {
              ...loadLocalPlazoChecksForExpediente(storageUid, mapped.id),
            };
            if (mappedDocId && mappedDocId !== mapped.id) {
              const docBucket = loadLocalPlazoChecksForExpediente(storageUid, mappedDocId);
              Object.entries(docBucket).forEach(([k, v]) => {
                const newest = pickNewestOverride(merged[k], v);
                if (newest) merged[k] = newest;
              });
            }
            return merged;
          })()
        : {};
      const patchedPlazos = mapped.plazos.map((p, idx) => {
        const sigKey = buildPlazoFallbackKey(p, idx);
        const localSaved = esAbogado
          ? pickNewestOverride(localChecksByPlazo[p.id], localChecksByPlazo[sigKey])
          : undefined;
        const optByExp = optimisticToggleByKey[`${mapped.id}::${p.id}`];
        const optByDoc =
          mappedDocId && mappedDocId !== mapped.id
            ? optimisticToggleByKey[`${mappedDocId}::${p.id}`]
            : undefined;
        const optimistic = pickNewestOverride(optByExp, optByDoc);
        const effectiveOverride = pickNewestOverride(localSaved, optimistic);
        return effectiveOverride
          ? {
              ...p,
              completado: effectiveOverride.completado === true,
              completadoEn: effectiveOverride.completado === true ? effectiveOverride.completadoEn : null,
            }
          : p;
      });
      finalResults.push({ ...mapped, plazos: patchedPlazos });
    });

    return finalResults;
  }, [hasLiveSnapshot, liveExpedientes, expedientes, localExpedienteOverrides, optimisticToggleByKey, isExplicitSuperAdmin, allowedOwnerIds, esAbogado, discardedExpKeySet, storageUid, localChecksVersion]);

  useEffect(() => {
    if (!initialSelectedExpedienteId) return;
    const exists = effectiveExpedientes.some((item) => item.id === initialSelectedExpedienteId);
    if (!exists) return;
    setSearchQuery('');
    setFilterEstado('TODOS');
    setFilterTipo('TODOS');
    setSelectedExpId(initialSelectedExpedienteId);
    window.setTimeout(() => {
      const targetEl = expedienteCardRefs.current[initialSelectedExpedienteId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    onClearInitialSelectedExpediente?.();
  }, [initialSelectedExpedienteId, effectiveExpedientes, onClearInitialSelectedExpediente]);

  const showToastSuccess = (msg: string) => {
    setErrorBanner(null);
    setSuccessBanner(msg);
    window.setTimeout(() => {
      setSuccessBanner((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  // Plazos pendientes ordenados por urgencia
  const upcomingDeadlines = useMemo(() => {
    const items: Array<{
      expediente: Expediente;
      plazo: PlazoProcesal;
      diasRestantes: number | null;
    }> = [];

    effectiveExpedientes.forEach((exp) => {
      if ((exp.estado || 'En trámite') === 'Finalizado') return;
      (Array.isArray(exp.plazos) ? exp.plazos : []).forEach((plazo) => {
        if (plazo.completado === true) return;
        const dias = calcDaysUntil(plazo.fechaVencimiento);
        items.push({ expediente: exp, plazo, diasRestantes: dias });
      });
    });

    items.sort((a, b) => {
      const da = a.diasRestantes ?? 9999;
      const db = b.diasRestantes ?? 9999;
      return da - db;
    });

    return items;
  }, [effectiveExpedientes]);

  const criticalDeadlines = useMemo(
    () => upcomingDeadlines.filter((i) => i.diasRestantes !== null && i.diasRestantes <= 3),
    [upcomingDeadlines]
  );
  const warningDeadlines = useMemo(
    () =>
      upcomingDeadlines.filter(
        (i) => i.diasRestantes !== null && i.diasRestantes > 3 && i.diasRestantes <= 7
      ),
    [upcomingDeadlines]
  );
  const activeExpedientes = useMemo(
    () =>
      effectiveExpedientes
        .filter((e) => (e.estado || 'En trámite') !== 'Finalizado')
        .sort((a, b) =>
          String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
        ),
    [effectiveExpedientes]
  );
  const completedDeadlines = useMemo(() => {
    const list: Array<{ expediente: Expediente; plazo: PlazoProcesal }> = [];
    effectiveExpedientes.forEach((exp) => {
      (Array.isArray(exp.plazos) ? exp.plazos : []).forEach((plazo) => {
        if (plazo.completado === true) {
          list.push({ expediente: exp, plazo });
        }
      });
    });
    list.sort((a, b) =>
      String(b.plazo.completadoEn || b.plazo.fechaVencimiento || '').localeCompare(
        String(a.plazo.completadoEn || a.plazo.fechaVencimiento || '')
      )
    );
    return list;
  }, [effectiveExpedientes]);

  const urgentCount = criticalDeadlines.length;
  const warningCount = warningDeadlines.length;
  const activeCasesCount = activeExpedientes.length;
  const completedStepsCount = completedDeadlines.length;

  useEffect(() => {
    if (!esAbogado) return;
    if (parteModalTarget) return;
    const targetExp = upcomingDeadlines[0]?.expediente || activeExpedientes[0] || null;
    if (!targetExp) return;
    const targetPlazo = upcomingDeadlines[0]?.plazo || null;

    const checkSchedule = () => {
      const evaluation = shouldTriggerSecretariaReminder({ schedule: secretariaSchedule });
      if (!evaluation.shouldSend) return;
      if (wasSecretariaReminderPromptedSession(uid || wsId, evaluation.todayIso)) return;
      markSecretariaReminderPromptedSession(uid || wsId, evaluation.todayIso);
      setParteModalTarget({
        expediente: targetExp,
        plazo: targetPlazo,
        isScheduledTrigger: true,
        mode: 'general',
      });
    };

    checkSchedule();
    const timer = window.setInterval(checkSchedule, 30000);
    return () => window.clearInterval(timer);
  }, [esAbogado, secretariaSchedule, upcomingDeadlines, activeExpedientes, parteModalTarget, uid, wsId]);

  const handleSelectExpedienteFromKpiModal = (expId: string) => {
    setKpiModalCategory(null);
    const isVisibleInCurrentFilter = filteredExpedientes.some((item) => item.id === expId);
    if (!isVisibleInCurrentFilter) {
      setSearchQuery('');
      setFilterEstado('TODOS');
      setFilterTipo('TODOS');
    }
    setSelectedExpId(expId);
    window.setTimeout(() => {
      const targetEl = expedienteCardRefs.current[expId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 90);
  };

  const handleVerTodosDesdeKpiModal = () => {
    setKpiModalCategory(null);
    setSearchQuery('');
    setFilterEstado('TODOS');
    setFilterTipo('TODOS');
    window.setTimeout(() => {
      expedientesListSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const filteredExpedientes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...effectiveExpedientes]
      .filter((exp) => {
        if (exp.anulado === true || exp.eliminado === true) return false;
        const expEstado = exp.estado || 'En trámite';
        const expTipo = exp.tipoJuicio || 'Ordinario';
        if (filterEstado !== 'TODOS' && expEstado !== filterEstado) return false;
        if (filterTipo !== 'TODOS' && expTipo !== filterTipo) return false;
        if (!q) return true;
        return (
          (exp.caratula || 'Expediente sin carátula').toLowerCase().includes(q) ||
          (exp.nroExpediente || '').toLowerCase().includes(q) ||
          (exp.juzgado || '').toLowerCase().includes(q) ||
          (exp.clienteNombre || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }, [effectiveExpedientes, searchQuery, filterEstado, filterTipo]);

  const resetFormFields = () => {
    setEditingExpediente(null);
    setCaratula('');
    setNroExpediente('');
    setAnio(String(new Date().getFullYear()));
    setJuzgado('');
    setTipoJuicio('Ordinario');
    setRolParte('Demandado');
    setEstado('En trámite');
    setClienteNombre('');
    setClienteId('');
    setNotas('');
    setDraftPlazos([]);
    setDraftAnalisisIA(null);
    setDraftHistorialDocumentos([]);
    setPendingAnalysisPreview(null);
    setModalError(null);
  };

  const openCreateModal = () => {
    setErrorBanner(null);
    resetFormFields();
    setModalOpen(true);
  };

  const openEditModal = (exp: Expediente) => {
    const freshExp = effectiveExpedientes.find((item) => item.id === exp.id) || exp;
    setErrorBanner(null);
    setModalError(null);
    setEditingExpediente(freshExp);
    setCaratula(freshExp.caratula || '');
    setNroExpediente(freshExp.nroExpediente || '');
    setAnio(freshExp.anio || String(new Date().getFullYear()));
    setJuzgado(freshExp.juzgado || '');
    setTipoJuicio(freshExp.tipoJuicio || 'Ordinario');
    setRolParte(freshExp.rolParte || 'Demandado');
    setEstado(freshExp.estado || 'En trámite');
    setClienteNombre(freshExp.clienteNombre || '');
    setClienteId(freshExp.clienteId || '');
    setNotas(freshExp.notas || '');
    setDraftPlazos(freshExp.plazos ? [...freshExp.plazos] : []);
    setDraftAnalisisIA(freshExp.ultimoAnalisisIA || null);
    setDraftHistorialDocumentos(
      sanitizeHistorialDocumentosList(
        freshExp.historialDocumentos,
        freshExp.ultimoAnalisisIA || null,
        freshExp.rolParte
      )
    );
    setPendingAnalysisPreview(null);
    setModalOpen(true);
  };

  const isNonDeadlinePlaceholderTitle = (rawTitulo: unknown): boolean => {
    const clean = String(rawTitulo || '').trim();
    if (!clean) return true;
    return /no\s+existe|no\s+aplica|no\s+corresponde|no\s+hay\s+plazo|no\s+posee\s+plazo|no\s+tiene\s+plazo|sin\s+plazo|ning[uú]n\s+plazo|\bninguno\b|\bn\/a\b|no\s+aplicable|no\s+se\s+(?:observa|detecta|registra|advierte|establece|fija|determina|identifica)\s+(?:ning[uú]n\s+)?plazo|documento\s+sin\s+plazo|no\s+es\s+un\s+acto\s+procesal|carece\s+de\s+plazo|sin\s+vencimiento/i.test(
      clean
    );
  };

  const isInvalidPlazoForAbogado = (
    item: { titulo?: unknown; diasPlazo?: unknown; fechaVencimiento?: unknown } | null | undefined,
    todayIso: string
  ): boolean => {
    if (!item || typeof item !== 'object') return true;
    if (isNonDeadlinePlaceholderTitle(item.titulo)) return true;
    const dias = Number(item.diasPlazo);
    const fecha = typeof item.fechaVencimiento === 'string' ? item.fechaVencimiento.trim().slice(0, 10) : '';
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
    if ((!Number.isFinite(dias) || dias <= 0) && (!hasValidDate || fecha === todayIso)) {
      return true;
    }
    return false;
  };

  const sanitizeAnalysisPayloadForAbogado = (
    raw: ExpedientePdfAnalysisPayload
  ): ExpedientePdfAnalysisPayload => {
    const todayIso = getTodayIsoAsuncion();
    const cleanPlazo =
      raw.plazoPrincipal && !isInvalidPlazoForAbogado(raw.plazoPrincipal, todayIso)
        ? {
            ...raw.plazoPrincipal,
            titulo: limpiarLatexJuridico(String(raw.plazoPrincipal.titulo || '')).trim(),
            diasPlazo: Math.max(1, Number(raw.plazoPrincipal.diasPlazo) || 1),
            fechaVencimiento:
              raw.plazoPrincipal.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(raw.plazoPrincipal.fechaVencimiento)
                ? raw.plazoPrincipal.fechaVencimiento.slice(0, 10)
                : addCalendarDaysIso(Math.max(1, Number(raw.plazoPrincipal.diasPlazo) || 1)),
            tipo: (raw.plazoPrincipal.tipo === 'impulso' ? 'impulso' : 'plazo_legal') as 'plazo_legal' | 'impulso',
          }
        : null;

    const cleanImpulsos = Array.isArray(raw.impulsosSugeridos)
      ? raw.impulsosSugeridos
          .filter((imp) => !isInvalidPlazoForAbogado(imp, todayIso))
          .map((imp, idx) => {
            const dias = Math.max(1, Number(imp.diasPlazo) || (idx + 1) * 10);
            return {
              ...imp,
              titulo: limpiarLatexJuridico(String(imp.titulo || '')).trim(),
              diasPlazo: dias,
              fechaVencimiento:
                imp.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(imp.fechaVencimiento)
                  ? imp.fechaVencimiento.slice(0, 10)
                  : addCalendarDaysIso(dias),
              tipo: (imp.tipo === 'plazo_legal' ? 'plazo_legal' : 'impulso') as 'plazo_legal' | 'impulso',
            };
          })
      : [];

    return {
      ...raw,
      caratula: limpiarLatexJuridico(String(raw.caratula || '')).trim(),
      nroExpediente: limpiarLatexJuridico(String(raw.nroExpediente || '')).trim(),
      anio: String(raw.anio || '').trim(),
      juzgado: limpiarLatexJuridico(String(raw.juzgado || '')).trim(),
      resumenHechos: limpiarLatexJuridico(String(raw.resumenHechos || '')).trim(),
      fundamentoCPC: raw.fundamentoCPC ? limpiarLatexJuridico(String(raw.fundamentoCPC)).trim() : '',
      plazoPrincipal: cleanPlazo,
      impulsosSugeridos: cleanImpulsos,
    };
  };

  const handleAnalyzePdfFile = async (file: File, target: 'modal' | Expediente) => {
    setErrorBanner(null);
    if (target === 'modal') setModalError(null);
    const targetId = target === 'modal' ? 'modal' : target.id;
    setAnalyzingTargetId(targetId);
    try {
      const { base64, mimeType } = await readFileAsBase64(file);
      const rawResult = await analyzeExpedientePdf(base64, mimeType, {
        fileName: file.name,
        rolParteHint: target === 'modal' ? rolParte : target.rolParte,
        esAbogado,
      });
      const result = esAbogado ? sanitizeAnalysisPayloadForAbogado(rawResult) : rawResult;
      setPendingAnalysisPreview({
        target: targetId,
        fileName: file.name,
        result,
      });
      void incrementarUsoIA(currentUser?.uid || userData?.uid);
    } catch (err: any) {
      const errMsg = err?.message || 'No se pudo analizar el documento PDF.';
      if (target === 'modal') {
        setModalError(errMsg);
      } else {
        setErrorBanner(errMsg);
      }
    } finally {
      setAnalyzingTargetId(null);
    }
  };

  const buildPlazosFromAnalysis = (result: ExpedientePdfAnalysisPayload): PlazoProcesal[] => {
    const generated: PlazoProcesal[] = [];
    const ts = Date.now();
    const todayIso = getTodayIsoAsuncion();

    if (esAbogado) {
      if (result.plazoPrincipal && !isInvalidPlazoForAbogado(result.plazoPrincipal, todayIso)) {
        const rawDays = Number(result.plazoPrincipal.diasPlazo);
        const hasValidDate = Boolean(
          result.plazoPrincipal.fechaVencimiento &&
            /^\d{4}-\d{2}-\d{2}$/.test(result.plazoPrincipal.fechaVencimiento)
        );
        if ((Number.isFinite(rawDays) && rawDays > 0) || (hasValidDate && result.plazoPrincipal.fechaVencimiento.slice(0, 10) !== todayIso)) {
          const days = Math.max(1, Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 1);
          generated.push({
            id: `plazo-${ts}-main`,
            titulo: limpiarLatexJuridico(result.plazoPrincipal.titulo).trim(),
            diasPlazo: days,
            fechaVencimiento: hasValidDate
              ? result.plazoPrincipal.fechaVencimiento.slice(0, 10)
              : addCalendarDaysIso(days),
            completado: false,
            completadoEn: null,
            tipo: 'plazo_legal',
          });
        }
      }
      if (Array.isArray(result.impulsosSugeridos)) {
        result.impulsosSugeridos.forEach((imp, idx) => {
          if (isInvalidPlazoForAbogado(imp, todayIso)) return;
          const rawDays = Number(imp.diasPlazo);
          const hasValidDate = Boolean(imp.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(imp.fechaVencimiento));
          if ((!Number.isFinite(rawDays) || rawDays <= 0) && (!hasValidDate || imp.fechaVencimiento.slice(0, 10) === todayIso)) {
            return;
          }
          const days = Math.max(1, Number.isFinite(rawDays) && rawDays > 0 ? rawDays : (idx + 1) * 10);
          generated.push({
            id: `impulso-${ts}-${idx}`,
            titulo: limpiarLatexJuridico(imp.titulo).trim(),
            diasPlazo: days,
            fechaVencimiento: hasValidDate
              ? imp.fechaVencimiento.slice(0, 10)
              : addCalendarDaysIso(days),
            completado: false,
            completadoEn: null,
            tipo: 'impulso',
          });
        });
      }
      return generated;
    }

    if (result.plazoPrincipal?.titulo) {
      const days = Math.max(1, Number(result.plazoPrincipal.diasPlazo) || 5);
      generated.push({
        id: `plazo-${ts}-main`,
        titulo: result.plazoPrincipal.titulo,
        diasPlazo: days,
        fechaVencimiento:
          result.plazoPrincipal.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(result.plazoPrincipal.fechaVencimiento)
            ? result.plazoPrincipal.fechaVencimiento
            : addCalendarDaysIso(days),
        completado: false,
        completadoEn: null,
        tipo: 'plazo_legal',
      });
    }
    if (Array.isArray(result.impulsosSugeridos)) {
      result.impulsosSugeridos.forEach((imp, idx) => {
        if (!imp?.titulo) return;
        const days = Math.max(1, Number(imp.diasPlazo) || (idx + 1) * 10);
        generated.push({
          id: `impulso-${ts}-${idx}`,
          titulo: imp.titulo,
          diasPlazo: days,
          fechaVencimiento:
            imp.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(imp.fechaVencimiento)
              ? imp.fechaVencimiento
              : addCalendarDaysIso(days),
          completado: false,
          completadoEn: null,
          tipo: 'impulso',
        });
      });
    }
    return generated;
  };

  const handleConfirmPendingAnalysis = async () => {
    if (!pendingAnalysisPreview) return;
    const { target, fileName, result } = pendingAnalysisPreview;
    const suggestedPlazos = buildPlazosFromAnalysis(result);
    const analisisObj: ExpedienteAnalisisIA = {
      caratula: result.caratula,
      nroExpediente: result.nroExpediente,
      anio: result.anio,
      juzgado: result.juzgado,
      tipoJuicio: normalizeTipoJuicio(result.tipoJuicio),
      rolParteSugerido: normalizeRolParte(result.rolParteSugerido),
      resumenHechos: result.resumenHechos,
      fundamentoCPC: result.fundamentoCPC,
      plazoPrincipal: result.plazoPrincipal,
      impulsosSugeridos: result.impulsosSugeridos,
      analizadoAt: new Date().toISOString(),
      archivoNombre: fileName,
    };

    if (target === 'modal') {
      if (result.caratula && !caratula.trim()) setCaratula(result.caratula);
      if (result.caratula && caratula.trim()) setCaratula(result.caratula);
      if (result.nroExpediente) setNroExpediente(result.nroExpediente);
      if (result.anio) setAnio(result.anio);
      if (result.juzgado) setJuzgado(result.juzgado);
      if (result.tipoJuicio) setTipoJuicio(normalizeTipoJuicio(result.tipoJuicio));
      const effectiveRol = result.rolParteSugerido ? normalizeRolParte(result.rolParteSugerido) : rolParte;
      if (result.rolParteSugerido) setRolParte(effectiveRol);
      if (normalizeRolParte(result.rolParteSugerido) === 'Demandado') {
        setEstado('Pendiente de contestación');
      }
      setDraftPlazos((prev) => [...prev, ...suggestedPlazos]);
      if (esAbogado) {
        setDraftHistorialDocumentos((prev) =>
          appendAnalisisToHistorial(prev, draftAnalisisIA, analisisObj, effectiveRol)
        );
      }
      setDraftAnalisisIA(analisisObj);
      setPendingAnalysisPreview(null);
      showToastSuccess(
        esAbogado
          ? 'Datos, memoria del caso y plazos cargados al formulario. Revisa y guarda el expediente.'
          : 'Análisis IA aplicado al formulario. Revisa los datos y guarda el expediente.'
      );
      return;
    }

    const exp = effectiveExpedientes.find((e) => e.id === target);
    if (!exp) {
      setPendingAnalysisPreview(null);
      return;
    }

    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(
        exp.ownedByWorkspace,
        workspaceId,
        wsId,
        currentUser?.uid,
        userData?.uid,
        auth?.currentUser?.uid,
        exp.userId
      ) || (esAbogado ? storageUid : '');
    const resolvedUserId =
      pickNonEmptyOwnerId(
        exp.userId,
        auth?.currentUser?.uid,
        currentUser?.uid,
        userData?.uid,
        resolvedWorkspaceId
      ) || resolvedWorkspaceId;

    const nextHistorial = esAbogado
      ? appendAnalisisToHistorial(
          exp.historialDocumentos,
          exp.ultimoAnalisisIA || null,
          analisisObj,
          exp.rolParte
        )
      : exp.historialDocumentos;

    const updatedExp: Expediente = {
      ...exp,
      userId: resolvedUserId,
      ownedByWorkspace: resolvedWorkspaceId,
      caratula: exp.caratula || result.caratula || exp.caratula,
      nroExpediente: exp.nroExpediente || result.nroExpediente || '',
      anio: exp.anio || result.anio || String(new Date().getFullYear()),
      juzgado: exp.juzgado || result.juzgado || '',
      tipoJuicio: exp.tipoJuicio || normalizeTipoJuicio(result.tipoJuicio),
      plazos: [...(exp.plazos || []), ...suggestedPlazos],
      ultimoAnalisisIA: analisisObj,
      ...(esAbogado ? { historialDocumentos: nextHistorial } : {}),
      updatedAt: new Date().toISOString(),
    };

    if (esAbogado) {
      persistLocalExpedienteOverride(updatedExp, exp.id);
      setLiveExpedientes((prev) => {
        const exists = prev.some((item) => item.id === updatedExp.id);
        return exists
          ? prev.map((item) => (item.id === updatedExp.id ? updatedExp : item))
          : [updatedExp, ...prev];
      });
    }

    try {
      await onSaveExpediente(updatedExp);
      setPendingAnalysisPreview(null);
      setExpandedAnalisisIds((prev) => ({ ...prev, [exp.id]: true }));
      showToastSuccess(
        esAbogado && suggestedPlazos.length === 0
          ? `Resumen jurídico sumado a la memoria del expediente desde "${fileName}" (sin plazos automáticos).`
          : `Se cargaron ${suggestedPlazos.length} plazos/impulsos desde "${fileName}".`
      );
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const rawMsg = String(err?.message || '').toLowerCase();
      if (
        esAbogado &&
        (code.includes('permission') || rawMsg.includes('permission') || rawMsg.includes('insufficient'))
      ) {
        setPendingAnalysisPreview(null);
        setExpandedAnalisisIds((prev) => ({ ...prev, [exp.id]: true }));
        showToastSuccess(
          suggestedPlazos.length === 0
            ? `Resumen jurídico sumado localmente desde "${fileName}" (sin plazos automáticos).`
            : `Datos y ${suggestedPlazos.length} plazos/impulsos cargados localmente desde "${fileName}".`
        );
      } else {
        setErrorBanner(err?.message || 'No se pudo guardar el análisis en el expediente.');
      }
    }
  };

  const handleDraftFromPendingAnalysis = async (modo: 'contestacion' | 'impulso') => {
    if (!pendingAnalysisPreview || draftingFromPreviewMode) return;
    const { target, fileName, result } = pendingAnalysisPreview;
    const suggestedPlazos = buildPlazosFromAnalysis(result);
    const nowIso = new Date().toISOString();
    const analisisObj: ExpedienteAnalisisIA = {
      caratula: result.caratula,
      nroExpediente: result.nroExpediente,
      anio: result.anio,
      juzgado: result.juzgado,
      tipoJuicio: normalizeTipoJuicio(result.tipoJuicio),
      rolParteSugerido: normalizeRolParte(result.rolParteSugerido),
      resumenHechos: result.resumenHechos,
      fundamentoCPC: result.fundamentoCPC,
      plazoPrincipal: result.plazoPrincipal,
      impulsosSugeridos: result.impulsosSugeridos,
      analizadoAt: nowIso,
      archivoNombre: fileName,
    };

    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(workspaceId, wsId, currentUser?.uid, userData?.uid, auth?.currentUser?.uid) ||
      storageUid;
    const resolvedUserId =
      pickNonEmptyOwnerId(auth?.currentUser?.uid, currentUser?.uid, userData?.uid, resolvedWorkspaceId) ||
      resolvedWorkspaceId;

    let expForDraft: Expediente;
    if (target === 'modal') {
      const effRol = rolParte || normalizeRolParte(result.rolParteSugerido);
      const modalHist = esAbogado
        ? appendAnalisisToHistorial(draftHistorialDocumentos, draftAnalisisIA, analisisObj, effRol)
        : undefined;
      expForDraft = {
        id: editingExpediente?.id || `draft-${Date.now()}`,
        userId: pickNonEmptyOwnerId(editingExpediente?.userId, resolvedUserId) || resolvedUserId,
        ownedByWorkspace:
          pickNonEmptyOwnerId(editingExpediente?.ownedByWorkspace, resolvedWorkspaceId) ||
          resolvedWorkspaceId,
        caratula: (caratula || '').trim() || result.caratula || fileName || 'Expediente analizado',
        nroExpediente: (nroExpediente || '').trim() || result.nroExpediente || '',
        anio: (anio || '').trim() || result.anio || String(new Date().getFullYear()),
        juzgado: (juzgado || '').trim() || result.juzgado || '',
        tipoJuicio: tipoJuicio || normalizeTipoJuicio(result.tipoJuicio),
        rolParte: effRol,
        estado: estado || 'En trámite',
        plazos: [...draftPlazos, ...suggestedPlazos],
        ultimoAnalisisIA: analisisObj,
        ...(esAbogado ? { historialDocumentos: modalHist } : {}),
        notas: (notas || '').trim(),
        clienteNombre: (clienteNombre || '').trim(),
        clienteId: (clienteId || '').trim(),
        createdAt: editingExpediente?.createdAt || nowIso,
        updatedAt: nowIso,
      };
    } else {
      const existingExp = effectiveExpedientes.find((e) => e.id === target);
      expForDraft = existingExp
        ? {
            ...existingExp,
            userId: pickNonEmptyOwnerId(existingExp.userId, resolvedUserId) || resolvedUserId,
            ownedByWorkspace:
              pickNonEmptyOwnerId(existingExp.ownedByWorkspace, resolvedWorkspaceId) ||
              resolvedWorkspaceId,
            caratula: existingExp.caratula || result.caratula || fileName,
            nroExpediente: existingExp.nroExpediente || result.nroExpediente || '',
            anio: existingExp.anio || result.anio || String(new Date().getFullYear()),
            juzgado: existingExp.juzgado || result.juzgado || '',
            tipoJuicio: existingExp.tipoJuicio || normalizeTipoJuicio(result.tipoJuicio),
            plazos: [...(existingExp.plazos || []), ...suggestedPlazos],
            ultimoAnalisisIA: analisisObj,
            ...(esAbogado
              ? {
                  historialDocumentos: appendAnalisisToHistorial(
                    existingExp.historialDocumentos,
                    existingExp.ultimoAnalisisIA || null,
                    analisisObj,
                    existingExp.rolParte
                  ),
                }
              : {}),
            updatedAt: nowIso,
          }
        : {
            id: `draft-${Date.now()}`,
            userId: resolvedUserId,
            ownedByWorkspace: resolvedWorkspaceId,
            caratula: result.caratula || fileName || 'Expediente analizado',
            nroExpediente: result.nroExpediente || '',
            anio: result.anio || String(new Date().getFullYear()),
            juzgado: result.juzgado || '',
            tipoJuicio: normalizeTipoJuicio(result.tipoJuicio),
            rolParte: normalizeRolParte(result.rolParteSugerido),
            estado: 'En trámite',
            plazos: suggestedPlazos,
            ultimoAnalisisIA: analisisObj,
            ...(esAbogado
              ? {
                  historialDocumentos: appendAnalisisToHistorial(
                    [],
                    null,
                    analisisObj,
                    normalizeRolParte(result.rolParteSugerido)
                  ),
                }
              : {}),
            createdAt: nowIso,
            updatedAt: nowIso,
          };
    }

    const plazoObjetivo =
      modo === 'impulso'
        ? suggestedPlazos.find((p) => p.tipo === 'impulso') ||
          suggestedPlazos[0] ||
          (expForDraft.plazos || []).find((p) => !p.completado)
        : suggestedPlazos.find((p) => p.tipo === 'plazo_legal') || suggestedPlazos[0];

    setDraftingFromPreviewMode(modo);
    try {
      await handleRedactarConIA(expForDraft, modo, plazoObjetivo);
    } finally {
      setDraftingFromPreviewMode(null);
    }
  };

  const sanitizePlazosList = (list: PlazoProcesal[]): PlazoProcesal[] =>
    (Array.isArray(list) ? list : [])
      .filter((p) => p && typeof p === 'object')
      .map((p, idx) => {
        const isCompleted = p.completado === true;
        const completadoEn =
          isCompleted && typeof p.completadoEn === 'string' && p.completadoEn.trim()
            ? p.completadoEn.trim()
            : null;
        return {
          id: buildStablePlazoId(p, idx),
          titulo: String(p.titulo || 'Plazo procesal').trim(),
          fechaVencimiento: String(p.fechaVencimiento || '').slice(0, 10),
          diasPlazo: Number.isFinite(Number(p.diasPlazo)) ? Number(p.diasPlazo) : 0,
          completado: isCompleted,
          completadoEn,
          tipo: p.tipo === 'impulso' ? 'impulso' : 'plazo_legal',
        };
      });

  const sanitizeAnalisisIA = (analisis: ExpedienteAnalisisIA | null): ExpedienteAnalisisIA | null => {
    if (!analisis || typeof analisis !== 'object') return null;
    return {
      caratula: String(analisis.caratula || ''),
      nroExpediente: String(analisis.nroExpediente || ''),
      anio: String(analisis.anio || ''),
      juzgado: String(analisis.juzgado || ''),
      tipoJuicio: analisis.tipoJuicio || 'Otro',
      rolParteSugerido: analisis.rolParteSugerido || 'Actor / Demandante',
      resumenHechos: String(analisis.resumenHechos || ''),
      fundamentoCPC: String(analisis.fundamentoCPC || ''),
      plazoPrincipal: analisis.plazoPrincipal
        ? {
            titulo: String(analisis.plazoPrincipal.titulo || ''),
            diasPlazo: Number.isFinite(Number(analisis.plazoPrincipal.diasPlazo))
              ? Number(analisis.plazoPrincipal.diasPlazo)
              : 0,
            fechaVencimiento: String(analisis.plazoPrincipal.fechaVencimiento || ''),
            tipo: analisis.plazoPrincipal.tipo === 'impulso' ? 'impulso' : 'plazo_legal',
          }
        : null,
      impulsosSugeridos: Array.isArray(analisis.impulsosSugeridos)
        ? analisis.impulsosSugeridos
            .filter((imp) => imp && typeof imp === 'object')
            .map((imp) => ({
              titulo: String(imp.titulo || ''),
              diasPlazo: Number.isFinite(Number(imp.diasPlazo)) ? Number(imp.diasPlazo) : 0,
              fechaVencimiento: String(imp.fechaVencimiento || ''),
              tipo: imp.tipo === 'plazo_legal' ? 'plazo_legal' : 'impulso',
            }))
        : [],
      analizadoAt: String(analisis.analizadoAt || new Date().toISOString()),
      archivoNombre: String(analisis.archivoNombre || ''),
    };
  };

  const handleSubmitExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (isSoftBlocked) {
      const msg = 'Tu cuenta está en modo solo lectura. Renueva tu plan para crear o editar expedientes.';
      setModalError(msg);
      setErrorBanner(msg);
      return;
    }
    if (!caratula.trim()) {
      const msg = 'Ingresa la carátula del expediente.';
      setModalError(msg);
      return;
    }

    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(
        editingExpediente?.ownedByWorkspace,
        workspaceId,
        wsId,
        currentUser?.uid,
        userData?.uid,
        auth?.currentUser?.uid,
        editingExpediente?.userId
      ) || (esAbogado ? storageUid : '');
    const resolvedUserId =
      pickNonEmptyOwnerId(
        editingExpediente?.userId,
        auth?.currentUser?.uid,
        currentUser?.uid,
        userData?.uid,
        resolvedWorkspaceId
      ) || resolvedWorkspaceId;

    if (!resolvedUserId && !esAbogado) {
      setModalError('No se detectó una sesión activa para guardar el expediente. Recarga o inicia sesión nuevamente.');
      return;
    }

    setIsSaving(true);
    setModalError(null);
    setErrorBanner(null);

    const nowIso = new Date().toISOString();
    const wasEditing = Boolean(editingExpediente);
    const previousEditingId = editingExpediente?.id;
    const resolvedDocId = wasEditing && editingExpediente
      ? (docIdByExpIdRef.current.get(editingExpediente.id) || editingExpediente.id)
      : `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sanitizedUltimoAnalisis = sanitizeAnalisisIA(draftAnalisisIA);
    const sanitizedHistorial = esAbogado
      ? sanitizeHistorialDocumentosList(
          draftHistorialDocumentos.length > 0
            ? draftHistorialDocumentos
            : editingExpediente?.historialDocumentos,
          sanitizedUltimoAnalisis,
          rolParte
        )
      : editingExpediente?.historialDocumentos;

    const expToSave: Expediente = {
      id: resolvedDocId,
      userId: resolvedUserId,
      ownedByWorkspace: resolvedWorkspaceId || resolvedUserId,
      caratula: caratula.trim(),
      nroExpediente: (nroExpediente || '').trim(),
      anio: (anio || '').trim() || String(new Date().getFullYear()),
      juzgado: (juzgado || '').trim(),
      tipoJuicio: tipoJuicio || 'Ordinario',
      rolParte: rolParte || 'Demandado',
      estado: estado || 'En trámite',
      plazos: sanitizePlazosList(draftPlazos),
      ultimoAnalisisIA: sanitizedUltimoAnalisis,
      ...(esAbogado ? { historialDocumentos: sanitizedHistorial } : {}),
      notas: (notas || '').trim(),
      clienteNombre: (clienteNombre || '').trim(),
      clienteId: (clienteId || '').trim(),
      createdAt: editingExpediente?.createdAt || nowIso,
      updatedAt: nowIso,
      creator_id:
        pickNonEmptyOwnerId(
          editingExpediente?.creator_id,
          auth?.currentUser?.uid,
          currentUser?.uid,
          resolvedUserId
        ) || resolvedUserId,
      creator_name: String(
        editingExpediente?.creator_name ||
          auth?.currentUser?.displayName ||
          userData?.nombre ||
          auth?.currentUser?.email?.split('@')[0] ||
          'Usuario'
      ),
    };

    const applyLocalSaveState = () => {
      docIdByExpIdRef.current.set(expToSave.id, resolvedDocId);
      if (!esAbogado) return;
      removeDiscardedExpKeys(buildExpedienteDismissKeys(expToSave, resolvedDocId));
      persistLocalExpedienteOverride(expToSave, previousEditingId);
      setLiveExpedientes((prev) => {
        const exists = prev.some(
          (item) => item.id === expToSave.id || (previousEditingId && item.id === previousEditingId)
        );
        if (exists) {
          return prev.map((item) =>
            item.id === expToSave.id || (previousEditingId && item.id === previousEditingId)
              ? expToSave
              : item
          );
        }
        return [expToSave, ...prev];
      });
    };

    // Para abogados: aplicar cambio en estado local + localStorage de inmediato
    if (esAbogado) {
      applyLocalSaveState();
    }

    let timeoutId: number | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al conectar con Firestore (8s). Verifica tu conexión e intenta nuevamente.'));
        }, 8000);
      });

      const persistEditOrCreate = async () => {
        if (esAbogado && wasEditing) {
          const expRef = doc(db, 'expedientes', resolvedDocId);
          await setDoc(
            expRef,
            {
              ...expToSave,
              fechaActualizacion: serverTimestamp(),
            },
            { merge: true }
          );
          try {
            await onSaveExpediente(expToSave);
          } catch {
            // El documento ya fue persistido directamente en expedientes/{id}
          }
          return;
        }
        await onSaveExpediente(expToSave);
      };

      await Promise.race([persistEditOrCreate(), timeoutPromise]);

      if (!esAbogado) {
        docIdByExpIdRef.current.set(expToSave.id, resolvedDocId);
      }

      setModalOpen(false);
      resetFormFields();
      setSelectedExpId(expToSave.id);
      showToastSuccess(wasEditing ? 'Expediente actualizado correctamente.' : 'Expediente registrado correctamente.');
    } catch (err: any) {
      console.error('Error guardando expediente en Firestore:', err);
      const code = String(err?.code || '').toLowerCase();
      const rawMessage = String(err?.message || '');
      const isPermissionOrPreviewError =
        code.includes('permission') ||
        rawMessage.toLowerCase().includes('permission') ||
        rawMessage.toLowerCase().includes('insufficient') ||
        rawMessage.toLowerCase().includes('sesión') ||
        rawMessage.toLowerCase().includes('workspace');

      if (esAbogado && isPermissionOrPreviewError) {
        // Mantener la edición aplicada localmente sin bloquear al abogado en vista previa
        applyLocalSaveState();
        setModalOpen(false);
        resetFormFields();
        setSelectedExpId(expToSave.id);
        showToastSuccess(
          wasEditing
            ? 'Expediente actualizado en tu vista local (pendiente de permisos en Firestore).'
            : 'Expediente registrado en tu vista local (pendiente de permisos en Firestore).'
        );
      } else {
        const friendlyMsg =
          code.includes('permission') || rawMessage.toLowerCase().includes('permission')
            ? 'Permiso denegado por Firestore al guardar el expediente. Verifica tu sesión y permisos.'
            : rawMessage || 'Ocurrió un error al guardar el expediente.';
        setModalError(friendlyMsg);
        setErrorBanner(friendlyMsg);
      }
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setIsSaving(false);
    }
  };

  const togglePlazoCompletado = async (
    exp: Expediente,
    plazoId: string,
    forcedNextState?: boolean
  ) => {
    if (isSoftBlocked) {
      setErrorBanner('Plan expirado: modo solo lectura activado.');
      return;
    }

    const latestExp = effectiveExpedientes.find((item) => item.id === exp.id) || exp;
    const toggleKey = `${latestExp.id}::${plazoId}`;
    if (togglingPlazos[toggleKey]) return;

    const activeUid = String(auth?.currentUser?.uid || uid || '').trim();
    const effectiveStorageUid = normalizeCheckStorageUid(activeUid || storageUid);
    if (!activeUid && !esAbogado) {
      setErrorBanner('No se detectó una sesión activa para guardar el cambio en Firestore.');
      return;
    }

    setErrorBanner(null);
    const nowIso = new Date().toISOString();
    const currentPlazos = Array.isArray(latestExp.plazos) ? latestExp.plazos : [];
    const targetPlazoIdx = currentPlazos.findIndex((p) => p.id === plazoId);
    const targetPlazo = targetPlazoIdx >= 0 ? currentPlazos[targetPlazoIdx] : undefined;
    const prevCompletado = targetPlazo?.completado === true;
    const prevCompletadoEn =
      prevCompletado && typeof targetPlazo?.completadoEn === 'string' && targetPlazo.completadoEn.trim()
        ? targetPlazo.completadoEn.trim()
        : null;
    const nextCompletado =
      typeof forcedNextState === 'boolean' ? forcedNextState : !prevCompletado;
    const nextCompletadoEn = nextCompletado ? nowIso : null;
    const previousUpdatedAt = String(latestExp.updatedAt || nowIso);

    const updatedPlazos = sanitizePlazosList(
      currentPlazos.map((p) =>
        p.id === plazoId
          ? { ...p, completado: nextCompletado, completadoEn: nextCompletadoEn }
          : p
      )
    );

    const targetDocId = docIdByExpIdRef.current.get(latestExp.id) || latestExp.id;
    const checkOverride: LocalPlazoCheckOverride = {
      completado: nextCompletado,
      completadoEn: nextCompletadoEn,
      updatedAt: nowIso,
    };
    const fallbackSigKey =
      targetPlazo && targetPlazoIdx >= 0
        ? buildPlazoFallbackKey(targetPlazo, targetPlazoIdx)
        : undefined;

    // 1. Actualización inmediata en estado local + respaldo en localStorage (exp.id y targetDocId, uid con fallback 'anon')
    setTogglingPlazos((prev) => ({ ...prev, [toggleKey]: true }));
    setOptimisticToggleByKey((prev) => ({
      ...prev,
      [toggleKey]: checkOverride,
      ...(targetDocId && targetDocId !== latestExp.id
        ? { [`${targetDocId}::${plazoId}`]: checkOverride }
        : {}),
    }));
    setLiveExpedientes((prev) =>
      prev.map((item) =>
        item.id === latestExp.id || item.id === targetDocId
          ? { ...item, plazos: updatedPlazos, updatedAt: nowIso }
          : item
      )
    );

    if (esAbogado) {
      saveLocalPlazoCheckForExpediente(
        effectiveStorageUid,
        latestExp.id,
        plazoId,
        checkOverride,
        fallbackSigKey
      );
      if (targetDocId && targetDocId !== latestExp.id) {
        saveLocalPlazoCheckForExpediente(
          effectiveStorageUid,
          targetDocId,
          plazoId,
          checkOverride,
          fallbackSigKey
        );
      }
      if (effectiveStorageUid !== storageUid) {
        saveLocalPlazoCheckForExpediente(
          storageUid,
          latestExp.id,
          plazoId,
          checkOverride,
          fallbackSigKey
        );
        if (targetDocId && targetDocId !== latestExp.id) {
          saveLocalPlazoCheckForExpediente(
            storageUid,
            targetDocId,
            plazoId,
            checkOverride,
            fallbackSigKey
          );
        }
      }
      setLocalChecksVersion((v) => v + 1);
      if (nextCompletado && targetPlazo) {
        setPendingMarkDonePrompt((prev) =>
          prev && prev.expediente.id === latestExp.id && prev.plazo.id === plazoId ? null : prev
        );
        const suggestedPlazo = suggestNextProceduralStep(latestExp, targetPlazo);
        setNextStepSuggestion({
          expedienteId: latestExp.id,
          caratula: latestExp.caratula || 'Expediente sin carátula',
          tipoJuicio: latestExp.tipoJuicio || 'Ordinario',
          completedPlazoId: plazoId,
          completedTitulo: targetPlazo.titulo,
          suggestedPlazo,
        });
      } else if (!nextCompletado) {
        setNextStepSuggestion((prev) =>
          prev && prev.expedienteId === latestExp.id && prev.completedPlazoId === plazoId
            ? null
            : prev
        );
      }
    }

    // 2. Intentar persistir en Firestore (expedientes/{expedienteId})
    const expRef = doc(db, 'expedientes', targetDocId);

    try {
      if (auth?.currentUser?.uid) {
        try {
          await updateDoc(expRef, {
            plazos: updatedPlazos,
            updatedAt: nowIso,
            fechaActualizacion: serverTimestamp(),
          });
        } catch (updateErr: any) {
          const errCode = String(updateErr?.code || '').toLowerCase();
          const errMsg = String(updateErr?.message || '').toLowerCase();
          if (errCode.includes('not-found') || errMsg.includes('no document to update')) {
            const fallbackWorkspaceId = pickNonEmptyOwnerId(
              latestExp.ownedByWorkspace,
              workspaceId,
              wsId,
              activeUid,
              latestExp.userId
            );
            const fallbackUserId =
              pickNonEmptyOwnerId(latestExp.userId, activeUid, fallbackWorkspaceId) ||
              fallbackWorkspaceId;
            await setDoc(
              expRef,
              {
                id: targetDocId,
                userId: fallbackUserId,
                ownedByWorkspace: fallbackWorkspaceId || fallbackUserId,
                caratula: latestExp.caratula || 'Expediente sin carátula',
                nroExpediente: latestExp.nroExpediente || '',
                anio: latestExp.anio || String(new Date().getFullYear()),
                juzgado: latestExp.juzgado || '',
                tipoJuicio: latestExp.tipoJuicio || 'Ordinario',
                rolParte: latestExp.rolParte || 'Actor / Demandante',
                estado: latestExp.estado || 'En trámite',
                plazos: updatedPlazos,
                notas: latestExp.notas || '',
                clienteNombre: latestExp.clienteNombre || '',
                clienteId: latestExp.clienteId || '',
                createdAt: latestExp.createdAt || nowIso,
                updatedAt: nowIso,
                fechaActualizacion: serverTimestamp(),
              },
              { merge: true }
            );
          } else {
            throw updateErr;
          }
        }
      }

      if (!esAbogado) {
        setOptimisticToggleByKey((prev) => {
          if (!prev[toggleKey]) return prev;
          const next = { ...prev };
          delete next[toggleKey];
          return next;
        });
      }
    } catch (err: any) {
      if (esAbogado) {
        // Nunca revertir en falso ni romper la UI para abogados: el check queda persistido localmente
        console.warn('[ExpedientesTab] Check guardado localmente (sincronización Firestore diferida):', err);
      } else {
        console.error('[ExpedientesTab] Error al persistir togglePlazoCompletado:', err);
        setOptimisticToggleByKey((prev) => {
          if (!prev[toggleKey]) return prev;
          const next = { ...prev };
          delete next[toggleKey];
          return next;
        });
        setLiveExpedientes((prev) =>
          prev.map((item) => {
            if (item.id !== latestExp.id) return item;
            return {
              ...item,
              plazos: (item.plazos || []).map((p) =>
                p.id === plazoId
                  ? { ...p, completado: prevCompletado, completadoEn: prevCompletadoEn }
                  : p
              ),
              updatedAt: previousUpdatedAt,
            };
          })
        );
        const code = String(err?.code || '').toLowerCase();
        setErrorBanner(
          code.includes('permission')
            ? 'Permiso denegado al guardar el estado del plazo en Firestore. Se revirtió el cambio.'
            : err?.message || 'No se pudo guardar el estado del plazo en Firestore. Se revirtió el cambio.'
        );
      }
    } finally {
      setTogglingPlazos((prev) => {
        if (!prev[toggleKey]) return prev;
        const next = { ...prev };
        delete next[toggleKey];
        return next;
      });
    }
  };

  const handleConfirmNextStepSuggestion = async () => {
    if (!esAbogado || !nextStepSuggestion || isSavingNextStep) return;
    if (isSoftBlocked) {
      setErrorBanner('Plan expirado: modo solo lectura activado.');
      return;
    }

    const exp = effectiveExpedientes.find((item) => item.id === nextStepSuggestion.expedienteId);
    if (!exp) {
      setNextStepSuggestion(null);
      return;
    }

    setIsSavingNextStep(true);
    setErrorBanner(null);

    const nowIso = new Date().toISOString();
    const targetDocId = docIdByExpIdRef.current.get(exp.id) || exp.id;
    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(
        exp.ownedByWorkspace,
        workspaceId,
        wsId,
        currentUser?.uid,
        userData?.uid,
        auth?.currentUser?.uid,
        exp.userId
      ) || storageUid;
    const resolvedUserId =
      pickNonEmptyOwnerId(
        exp.userId,
        auth?.currentUser?.uid,
        currentUser?.uid,
        userData?.uid,
        resolvedWorkspaceId
      ) || resolvedWorkspaceId;

    const nuevoPlazo: PlazoProcesal = {
      id: `plazo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titulo: nextStepSuggestion.suggestedPlazo.titulo,
      fechaVencimiento: nextStepSuggestion.suggestedPlazo.fechaVencimiento,
      diasPlazo: nextStepSuggestion.suggestedPlazo.diasPlazo,
      completado: false,
      completadoEn: null,
      tipo: nextStepSuggestion.suggestedPlazo.tipo,
    };

    const updatedPlazos = sanitizePlazosList([...(exp.plazos || []), nuevoPlazo]);
    const updatedExp: Expediente = {
      ...exp,
      userId: resolvedUserId,
      ownedByWorkspace: resolvedWorkspaceId || resolvedUserId,
      plazos: updatedPlazos,
      updatedAt: nowIso,
    };

    persistLocalExpedienteOverride(updatedExp, exp.id);
    setLiveExpedientes((prev) =>
      prev.map((item) =>
        item.id === updatedExp.id || item.id === targetDocId ? updatedExp : item
      )
    );

    try {
      if (auth?.currentUser?.uid) {
        if (targetDocId && targetDocId !== exp.id) {
          await updateDoc(doc(db, 'expedientes', targetDocId), {
            plazos: updatedPlazos,
            updatedAt: nowIso,
            fechaActualizacion: serverTimestamp(),
          });
        } else {
          await onSaveExpediente(updatedExp);
        }
      }
      setNextStepSuggestion(null);
      showToastSuccess(`Siguiente paso agendado: "${nuevoPlazo.titulo}".`);
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const rawMsg = String(err?.message || '').toLowerCase();
      if (
        code.includes('permission') ||
        rawMsg.includes('permission') ||
        rawMsg.includes('insufficient')
      ) {
        setNextStepSuggestion(null);
        showToastSuccess(`Siguiente paso agendado localmente: "${nuevoPlazo.titulo}".`);
      } else {
        setErrorBanner(err?.message || 'No se pudo agendar el siguiente paso procesal.');
      }
    } finally {
      setIsSavingNextStep(false);
    }
  };

  const handleAddPlazoInline = async (exp: Expediente) => {
    if (isSoftBlocked) {
      setErrorBanner('Plan expirado: modo solo lectura activado.');
      return;
    }
    if (!newPlazoTitulo.trim() || !newPlazoFecha) {
      setErrorBanner('Completa el título y la fecha de vencimiento del plazo.');
      return;
    }
    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(
        exp.ownedByWorkspace,
        workspaceId,
        wsId,
        currentUser?.uid,
        userData?.uid,
        auth?.currentUser?.uid,
        exp.userId
      ) || (esAbogado ? storageUid : '');
    const resolvedUserId =
      pickNonEmptyOwnerId(
        exp.userId,
        auth?.currentUser?.uid,
        currentUser?.uid,
        userData?.uid,
        resolvedWorkspaceId
      ) || resolvedWorkspaceId;

    const nuevo: PlazoProcesal = {
      id: `plazo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titulo: newPlazoTitulo.trim(),
      fechaVencimiento: newPlazoFecha,
      diasPlazo: Math.max(0, Number(newPlazoDias) || 0),
      completado: false,
      completadoEn: null,
      tipo: newPlazoTipo,
    };
    const updatedExp: Expediente = {
      ...exp,
      userId: resolvedUserId,
      ownedByWorkspace: resolvedWorkspaceId || resolvedUserId,
      plazos: [...(exp.plazos || []), nuevo],
      updatedAt: new Date().toISOString(),
    };
    if (esAbogado) {
      persistLocalExpedienteOverride(updatedExp, exp.id);
      setLiveExpedientes((prev) =>
        prev.map((item) => (item.id === updatedExp.id ? updatedExp : item))
      );
    }
    try {
      await onSaveExpediente(updatedExp);
      setAddingPlazoForExpId(null);
      setNewPlazoTitulo('');
      setNewPlazoDias('5');
      setNewPlazoFecha(addCalendarDaysIso(5));
      showToastSuccess('Plazo procesal agregado al cronograma.');
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const rawMsg = String(err?.message || '').toLowerCase();
      if (
        esAbogado &&
        (code.includes('permission') || rawMsg.includes('permission') || rawMsg.includes('insufficient'))
      ) {
        setAddingPlazoForExpId(null);
        setNewPlazoTitulo('');
        setNewPlazoDias('5');
        setNewPlazoFecha(addCalendarDaysIso(5));
        showToastSuccess('Plazo procesal agregado en tu vista local.');
      } else {
        setErrorBanner(err?.message || 'No se pudo agregar el plazo procesal.');
      }
    }
  };

  const handleDeletePlazoInline = async (exp: Expediente, plazoId: string) => {
    if (isSoftBlocked) return;
    const resolvedWorkspaceId =
      pickNonEmptyOwnerId(
        exp.ownedByWorkspace,
        workspaceId,
        wsId,
        currentUser?.uid,
        userData?.uid,
        auth?.currentUser?.uid,
        exp.userId
      ) || (esAbogado ? storageUid : '');
    const resolvedUserId =
      pickNonEmptyOwnerId(
        exp.userId,
        auth?.currentUser?.uid,
        currentUser?.uid,
        userData?.uid,
        resolvedWorkspaceId
      ) || resolvedWorkspaceId;

    const updatedPlazos = (exp.plazos || []).filter((p) => p.id !== plazoId);
    const updatedExp: Expediente = {
      ...exp,
      userId: resolvedUserId,
      ownedByWorkspace: resolvedWorkspaceId || resolvedUserId,
      plazos: updatedPlazos,
      updatedAt: new Date().toISOString(),
    };
    if (esAbogado) {
      persistLocalExpedienteOverride(updatedExp, exp.id);
      setLiveExpedientes((prev) =>
        prev.map((item) => (item.id === updatedExp.id ? updatedExp : item))
      );
    }
    try {
      await onSaveExpediente(updatedExp);
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const rawMsg = String(err?.message || '').toLowerCase();
      if (
        !(
          esAbogado &&
          (code.includes('permission') || rawMsg.includes('permission') || rawMsg.includes('insufficient'))
        )
      ) {
        setErrorBanner(err?.message || 'No se pudo eliminar el plazo.');
      }
    }
  };

  const handleRedactarConIA = async (
    exp: Expediente,
    modo: 'contestacion' | 'impulso',
    plazoObjetivo?: PlazoProcesal
  ) => {
    const key = `${exp.id}-${modo}-${plazoObjetivo?.id || 'general'}`;
    setDraftingKey(key);
    setErrorBanner(null);
    try {
      const memoriaDocumentos: MemoriaDocumentoEscritoPayload[] | undefined = esAbogado
        ? (() => {
            const memList: MemoriaDocumentoEscritoPayload[] = [];
            const hist = sanitizeHistorialDocumentosList(
              exp.historialDocumentos,
              exp.ultimoAnalisisIA || null,
              exp.rolParte
            );
            hist.forEach((docMem) => {
              memList.push({
                titulo: docMem.archivoNombre || docMem.tipoActo,
                fecha: docMem.analizadoAt,
                parteOrigen: docMem.parteOrigen,
                resumen: docMem.resumenHechos,
                fundamentoCPC: docMem.fundamentoCPC,
              });
            });
            const linked = findLinkedDocumentosForExpediente(exp, workspaceDocs);
            linked.forEach((ld) => {
              const snippet = String(ld.texto || '').trim();
              if (!snippet) return;
              memList.push({
                titulo: ld.tipo || ld.categoria || 'Escrito vinculado',
                fecha: ld.createdAt,
                parteOrigen: 'Propia',
                resumen: `Escrito/documento previo de nuestra parte (${ld.categoria || 'Expedientes'})`,
                extracto: snippet.slice(0, 500),
              });
            });
            return memList.length > 0 ? memList : undefined;
          })()
        : undefined;

      const rawDraftText = await redactarEscritoJudicialConIA({
        expediente: exp,
        modo,
        plazoObjetivo: plazoObjetivo
          ? { titulo: plazoObjetivo.titulo, fechaVencimiento: plazoObjetivo.fechaVencimiento }
          : undefined,
        estudio: {
          razonSocial: userData?.razonSocial || userData?.nombreInstitucion || estudioNombre,
          nombre: userData?.nombre || estudioNombre,
          matricula: userData?.matriculaAbogado || userData?.matricula || userData?.registroNotarial || '',
          ciudad: userData?.ciudad || userData?.localidad || 'Asunción',
        },
        instruccionesAdicionales:
          'Revisa la ortografía estricta en español (tildes, concordancia y puntuación jurídica impecable). Si el documento base o los datos del expediente contienen denominaciones de juzgados o términos procesales extranjeros, adáptalos obligatoriamente a la jurisdicción paraguaya (por ejemplo: Juzgado de Primera Instancia en lo Civil y Comercial, Juzgado de Primera Instancia en lo Laboral o Juzgado de Paz, según corresponda).',
        esAbogado,
        memoriaDocumentos,
      });
      const draftText = esAbogado ? limpiarLatexJuridico(rawDraftText) : rawDraftText;
      const cleanCaratula = limpiarLatexJuridico(exp.caratula || '').trim();
      const cleanObjetivo = limpiarLatexJuridico(plazoObjetivo?.titulo || exp.caratula || '').trim();
      const tituloModal = esAbogado
        ? modo === 'contestacion'
          ? `Contestación / Respuesta - ${cleanCaratula}`
          : `Impulso: ${cleanObjetivo}`
        : modo === 'contestacion'
          ? `Contestación de Demanda - ${exp.caratula.slice(0, 48)}`
          : `Impulso: ${(plazoObjetivo?.titulo || exp.caratula).slice(0, 48)}`;
      void incrementarUsoIA(currentUser?.uid || userData?.uid);
      onOpenDocument(draftText, undefined, tituloModal, 'Expedientes', 'blanca', true);

      if (esAbogado && !String(exp.id || '').startsWith('draft-')) {
        const pendingInExp = (exp.plazos || []).filter((p) => p && p.completado !== true);
        const linkedPlazo =
          (plazoObjetivo && plazoObjetivo.completado !== true ? plazoObjetivo : null) ||
          (modo === 'contestacion'
            ? pendingInExp.find((p) => /contest/i.test(p.titulo || '')) || pendingInExp[0] || null
            : null);

        if (linkedPlazo) {
          setPendingMarkDonePrompt({ expediente: exp, plazo: linkedPlazo });
        }
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo generar el escrito judicial con IA.');
    } finally {
      setDraftingKey(null);
    }
  };

  const handleConfirmDeleteExpediente = async () => {
    if (!confirmDeleteId) return;
    const targetId = confirmDeleteId;
    const targetExp = effectiveExpedientes.find((item) => item.id === targetId) || null;
    const mappedDocId = docIdByExpIdRef.current.get(targetId) || targetId;
    const candidateDocIds = Array.from(
      new Set([mappedDocId, targetId].map((v) => String(v || '').trim()).filter(Boolean))
    );

    setIsDeleting(true);
    setErrorBanner(null);

    const removeFromLocalUiAndDiscard = (dismissLocally: boolean) => {
      setLiveExpedientes((prev) =>
        prev.filter((item) => item.id !== targetId && item.id !== mappedDocId)
      );
      if (dismissLocally && esAbogado) {
        purgeLocalExpedienteOverride([targetId, mappedDocId]);
        const dismissKeys = buildExpedienteDismissKeys(targetExp || { id: targetId }, mappedDocId);
        persistDiscardedExpKeys(dismissKeys);
      }
      if (selectedExpId === targetId || selectedExpId === mappedDocId) {
        setSelectedExpId(null);
      }
      setConfirmDeleteId(null);
    };

    try {
      if (!esAbogado) {
        await onDeleteExpediente(mappedDocId);
        removeFromLocalUiAndDiscard(false);
        showToastSuccess('Expediente eliminado.');
        return;
      }

      // Para abogados: remover siempre de inmediato de la vista y guardar en descartados por uid (localStorage)
      removeFromLocalUiAndDiscard(true);

      const validFirestoreIds = candidateDocIds.filter((id) => !isGhostOrMockExpId(id));
      const hasAuthSession = Boolean(auth?.currentUser?.uid);
      let deletedFromFirestore = false;

      if (hasAuthSession && validFirestoreIds.length > 0) {
        for (const docId of validFirestoreIds) {
          try {
            const docRef = doc(db, 'expedientes', docId);
            const existingSnap = await getDoc(docRef);
            if (existingSnap.exists()) {
              await deleteDoc(docRef);
              deletedFromFirestore = true;
            }
          } catch (docErr: any) {
            console.warn('[ExpedientesTab] Borrado remoto omitido/diferido (expediente ocultado localmente):', docErr);
          }
        }
      }

      try {
        await onDeleteExpediente(mappedDocId);
        if (targetId !== mappedDocId) {
          await onDeleteExpediente(targetId);
        }
      } catch {
        // Ya removido y ocultado localmente por uid para evitar que reaparezca como fantasma
      }

      showToastSuccess(
        deletedFromFirestore
          ? 'Expediente eliminado correctamente.'
          : 'Expediente eliminado y ocultado de tu lista.'
      );
    } catch (err: any) {
      if (esAbogado) {
        removeFromLocalUiAndDiscard(true);
        console.warn('[ExpedientesTab] Expediente ocultado localmente tras error remoto:', err);
        showToastSuccess('Expediente eliminado y ocultado de tu lista.');
      } else {
        console.error('[ExpedientesTab] Error eliminando expediente:', err);
        setConfirmDeleteId(null);
        setErrorBanner(err?.message || 'No se pudo eliminar el expediente.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeadlineBadgeStyle = (dias: number | null, completado: boolean) => {
    if (completado) {
      return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60';
    }
    if (dias !== null && dias <= 3) {
      return 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700/70';
    }
    if (dias !== null && dias <= 7) {
      return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const getDaysLabel = (dias: number | null, completado: boolean) => {
    if (completado) return 'Completado';
    if (dias === null) return 'Sin fecha';
    if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
    if (dias === 0) return 'Vence HOY';
    if (dias === 1) return 'Vence MAÑANA';
    return `En ${dias} días`;
  };

  const visibleUpcoming = showUpcomingAll ? upcomingDeadlines : upcomingDeadlines.slice(0, 5);

  return (
    <div className="w-full box-border flex flex-col gap-5 animate-fade-in pb-12">
      {/* Input oculto para analizar PDF directo sobre un expediente */}
      <input
        ref={cardPdfInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && cardPdfTargetExp) {
            void handleAnalyzePdfFile(file, cardPdfTargetExp);
          }
        }}
      />

      {/* Cabecera principal */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 md:p-7 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700 shadow-xs shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-white text-xl md:text-2xl font-black font-serif leading-tight">
                Gestión de Expedientes y Plazos Procesales
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                CPC Paraguay + IA
              </span>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1.5 max-w-2xl">
              {esAbogado
                ? 'Control de causas judiciales, análisis con IA de documentos, PDFs o fotos (demandas, cédulas, providencias, autos, oficios y escritos), vencimientos e impulsos procesales para '
                : 'Control de causas judiciales, análisis de demandas/cédulas PDF, vencimientos e impulsos procesales para '}
              <span className="text-slate-200 font-semibold">{estudioNombre}</span>.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            disabled={isSoftBlocked}
            onClick={() => {
              openCreateModal();
              window.setTimeout(() => modalPdfInputRef.current?.click(), 120);
            }}
            className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{esAbogado ? 'Analizar Documento / PDF / Foto' : 'Analizar Demanda PDF'}</span>
          </button>

          <button
            type="button"
            disabled={isSoftBlocked}
            onClick={openCreateModal}
            className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Expediente</span>
          </button>
        </div>
      </div>

      {/* Banners de estado */}
      {errorBanner && (
        <div className="rounded-2xl border border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-950/50 p-4 flex items-center justify-between gap-3 text-red-800 dark:text-red-200 text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra Secretaría O.L.G.A. — Llave ON/OFF + WhatsApp vinculado automático + Programación (EXCLUSIVO ABOGADOS) */}
      {esAbogado && (
        <div className={`rounded-2xl border p-3.5 md:px-5 space-y-3 ${cardSurfaceCls}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  secretariaSchedule.recordatorioActivo
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Secretaría O.L.G.A. • WhatsApp propio
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={secretariaSchedule.recordatorioActivo}
                    onClick={() => void handleToggleSecretariaActivoInline()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                      secretariaSchedule.recordatorioActivo
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                    title={
                      secretariaSchedule.recordatorioActivo
                        ? 'Avisos automáticos activados (clic para pausar)'
                        : 'Avisos automáticos pausados (clic para activar)'
                    }
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        secretariaSchedule.recordatorioActivo ? 'bg-white' : 'bg-slate-400'
                      }`}
                    />
                    <span>{secretariaSchedule.recordatorioActivo ? 'ON • Activa' : 'OFF • Inactiva'}</span>
                  </button>

                  {waResolution.effectivePhone ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {waResolution.source === 'connected'
                        ? `Vinculado: ${formatAbogadoWhatsAppDisplay(waResolution.effectivePhone)}`
                        : waResolution.source === 'custom'
                          ? `Otro número: ${formatAbogadoWhatsAppDisplay(waResolution.effectivePhone)}`
                          : `Perfil: ${formatAbogadoWhatsAppDisplay(waResolution.effectivePhone)}`}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Sin número vinculado
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {formatSecretariaScheduleSummary(secretariaSchedule)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {abogadoWaFeedback ||
                    scheduleFeedback ||
                    'Configura tu WhatsApp y horario para recibir el parte de tus causas con enlace directo y recordatorio para revisar y cargar Judisoft.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {editingAbogadoWa ? (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <input
                    type="tel"
                    value={abogadoWaDraft}
                    onChange={(e) => {
                      setAbogadoWaDraft(e.target.value);
                      setAbogadoWaFeedback(null);
                    }}
                    placeholder="Recibir avisos en otro número (opcional)"
                    className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-slate-900 dark:text-white outline-none w-56"
                  />
                  <button
                    type="button"
                    disabled={isSavingAbogadoWa}
                    onClick={() => void handleSaveAbogadoWaInline()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAbogadoWa ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar</span>
                  </button>
                  {waResolution.customPhone && waResolution.defaultPhone && (
                    <button
                      type="button"
                      disabled={isSavingAbogadoWa}
                      onClick={() => void handleSaveAbogadoWaInline('')}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer"
                    >
                      Usar vinculado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAbogadoWa(false);
                      setAbogadoWaDraft(
                        abogadoWaNumber ? formatAbogadoWhatsAppDisplay(abogadoWaNumber) : ''
                      );
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAbogadoWa(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                >
                  {waResolution.effectivePhone ? 'Otro número (opcional)' : 'Configurar número'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowScheduleEditor((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{showScheduleEditor ? 'Ocultar horario' : 'Programar'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setParteModalTarget({
                    expediente: upcomingDeadlines[0]?.expediente || activeExpedientes[0] || null,
                    plazo: upcomingDeadlines[0]?.plazo || null,
                    isScheduledTrigger: false,
                    mode: 'urgente',
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                title="Ver alerta Foco Urgente del Día (qué hacer, qué proveer y qué presentar)"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>🚨 Urgente del Día</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setParteModalTarget({
                    expediente: upcomingDeadlines[0]?.expediente || activeExpedientes[0] || null,
                    plazo: upcomingDeadlines[0]?.plazo || null,
                    isScheduledTrigger: false,
                    mode: 'general',
                  })
                }
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                title="Generar Parte General Compacto de todas tus causas con plazos pendientes"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enviar Parte ahora</span>
              </button>
            </div>
          </div>

          {showScheduleEditor && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Cada cuántos días
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={scheduleDraft.frecuenciaDias}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setScheduleDraft((prev) => ({
                      ...prev,
                      frecuenciaDias: Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1,
                    }));
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Hora envío (HH:mm)
                </label>
                <input
                  type="time"
                  value={scheduleDraft.horaEnvio}
                  onChange={(e) =>
                    setScheduleDraft((prev) => ({
                      ...prev,
                      horaEnvio: e.target.value || '05:00',
                    }))
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pb-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleDraft.incluirSabado}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, incluirSabado: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Sábados</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleDraft.incluirDomingo}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, incluirDomingo: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Domingos</span>
                </label>
              </div>

              <div className="pb-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleDraft.recordatorioActivo}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, recordatorioActivo: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Recordatorio activo</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingSchedule}
                  onClick={() => void handleSaveScheduleInline()}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingSchedule ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar horario</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previsualización de Análisis PDF cuando se disparó desde una tarjeta */}
      {pendingAnalysisPreview && pendingAnalysisPreview.target !== 'modal' && (
        <div className="rounded-3xl border-2 border-indigo-400 dark:border-indigo-500/60 bg-indigo-50/95 dark:bg-indigo-950/40 p-5 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                  {esAbogado
                    ? `Resumen jurídico listo: ${pendingAnalysisPreview.fileName}`
                    : `Análisis IA listo: ${pendingAnalysisPreview.fileName}`}
                </h3>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5">
                  {esAbogado
                    ? 'Elige qué deseas hacer con este documento: cargar datos y plazos al expediente o redactar directamente con IA.'
                    : 'Confirma para actualizar el expediente y cargar los plazos e impulsos sugeridos.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingAnalysisPreview(null)}
              className="p-1.5 rounded-lg text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/60">
              <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">
                {esAbogado ? 'Resumen Jurídico del Documento' : 'Resumen Procesal'}
              </p>
              {esAbogado && pendingAnalysisPreview.result.caratula && (
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {pendingAnalysisPreview.result.caratula}
                </p>
              )}
              <p className="text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {pendingAnalysisPreview.result.resumenHechos}
              </p>
              {pendingAnalysisPreview.result.fundamentoCPC && (
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-2 font-semibold">
                  Base CPC: {pendingAnalysisPreview.result.fundamentoCPC}
                </p>
              )}
            </div>
            <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Plazos e Impulsos Detectados</p>
              {pendingAnalysisPreview.result.plazoPrincipal && (
                <div className="flex items-center justify-between gap-2 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-2.5 py-1.5">
                  <span className="font-bold text-red-800 dark:text-red-200">
                    {pendingAnalysisPreview.result.plazoPrincipal.titulo}
                  </span>
                  <span className="font-mono text-[11px] text-red-700 dark:text-red-300 shrink-0">
                    {formatDateShort(pendingAnalysisPreview.result.plazoPrincipal.fechaVencimiento)}
                  </span>
                </div>
              )}
              {(pendingAnalysisPreview.result.impulsosSugeridos || []).map((imp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{imp.titulo}</span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {formatDateShort(imp.fechaVencimiento)}
                  </span>
                </div>
              ))}
              {esAbogado &&
                !pendingAnalysisPreview.result.plazoPrincipal &&
                (pendingAnalysisPreview.result.impulsosSugeridos || []).length === 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    No se detectaron vencimientos automáticos en este documento. Igualmente puedes guardar el resumen o redactar un escrito con IA.
                  </p>
                )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingAnalysisPreview(null)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmPendingAnalysis()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>
                {esAbogado ? 'Cargar datos y plazos al expediente' : 'Confirmar y Cargar al Expediente'}
              </span>
            </button>
            {esAbogado && (
              <>
                <button
                  type="button"
                  disabled={Boolean(draftingFromPreviewMode)}
                  onClick={() => void handleDraftFromPendingAnalysis('contestacion')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {draftingFromPreviewMode === 'contestacion' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {draftingFromPreviewMode === 'contestacion'
                      ? 'Redactando...'
                      : 'Redactar contestación / respuesta con IA'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(draftingFromPreviewMode)}
                  onClick={() => void handleDraftFromPendingAnalysis('impulso')}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {draftingFromPreviewMode === 'impulso' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>
                    {draftingFromPreviewMode === 'impulso'
                      ? 'Redactando...'
                      : 'Redactar impulso / escrito con IA'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* KPIs de Expedientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setKpiModalCategory('activas')}
          className={`text-left w-full rounded-2xl p-4 md:p-5 border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-blue-400/70 dark:hover:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${cardSurfaceCls}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Causas Activas
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activeCasesCount}</p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {effectiveExpedientes.length} totales registradas
            </p>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">Ver →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setKpiModalCategory('criticos')}
          className={`text-left w-full rounded-2xl p-4 md:p-5 border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-red-400/70 dark:hover:border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/40 ${cardSurfaceCls}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Críticos (≤ 3 días)
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black ${urgentCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {urgentCount}
          </p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vencidos o urgentes
            </p>
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 shrink-0">Ver →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setKpiModalCategory('proximos')}
          className={`text-left w-full rounded-2xl p-4 md:p-5 border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-amber-400/70 dark:hover:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${cardSurfaceCls}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Próximos (4–7 días)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black ${warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {warningCount}
          </p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Seguimiento cercano
            </p>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">Ver →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setKpiModalCategory('cumplidas')}
          className={`text-left w-full rounded-2xl p-4 md:p-5 border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-400/70 dark:hover:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${cardSurfaceCls}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Actuaciones Cumplidas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Gavel className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{completedStepsCount}</p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Plazos e impulsos cerrados
            </p>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">Ver →</span>
          </div>
        </button>
      </div>

      {/* Bloque superior: Plazos Próximos a Vencer */}
      {upcomingDeadlines.length > 0 && (
        <div className={`rounded-3xl border p-4 md:p-5 shadow-sm ${cardSurfaceCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                urgentCount > 0
                  ? 'bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
              }`}>
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Plazos Próximos a Vencer ({upcomingDeadlines.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Marca un plazo como cumplido o genera el escrito de impulso con IA en un clic.
                </p>
              </div>
            </div>

            {upcomingDeadlines.length > 5 && (
              <button
                type="button"
                onClick={() => setShowUpcomingAll((prev) => !prev)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showUpcomingAll ? 'Ver menos' : `Ver los ${upcomingDeadlines.length}`}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {visibleUpcoming.map(({ expediente, plazo, diasRestantes }) => {
              const isCritical = diasRestantes !== null && diasRestantes <= 3;
              const isWarning = diasRestantes !== null && diasRestantes > 3 && diasRestantes <= 7;
              const rowDraftKey = `${expediente.id}-impulso-${plazo.id}`;
              return (
                <div
                  key={`${expediente.id}-${plazo.id}`}
                  className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isCritical
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800/60'
                      : isWarning
                        ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/50'
                        : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      disabled={Boolean(togglingPlazos[`${expediente.id}::${plazo.id}`])}
                      onClick={() => void togglePlazoCompletado(expediente, plazo.id)}
                      className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-400 dark:border-slate-500 hover:border-emerald-500 flex items-center justify-center shrink-0 transition-colors cursor-pointer bg-white dark:bg-slate-900 disabled:opacity-60"
                      title="Marcar plazo como cumplido"
                    >
                      <span className="sr-only">Completar</span>
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(diasRestantes, plazo.completado)}`}>
                          {getDaysLabel(diasRestantes, plazo.completado)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatDateShort(plazo.fechaVencimiento)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {plazo.titulo}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedExpId(expediente.id)}
                        className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-left truncate max-w-full cursor-pointer"
                      >
                        {expediente.caratula} {expediente.nroExpediente ? `• Expte. ${expediente.nroExpediente}/${expediente.anio}` : ''}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {esAbogado && (
                      <button
                        type="button"
                        onClick={() => setParteModalTarget({ expediente, plazo })}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        title="Generar parte Secretaría O.L.G.A. y autoenviar por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Parte WA</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={draftingKey === rowDraftKey}
                      onClick={() => void handleRedactarConIA(expediente, 'impulso', plazo)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {draftingKey === rowDraftKey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>Escrito IA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className={`rounded-2xl border p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3 ${cardSurfaceCls}`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por carátula, N° de expediente, juzgado o cliente..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Filtros:</span>
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="TODOS">Todos los estados</option>
            {ESTADOS_EXPEDIENTE.map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="TODOS">Todos los fueros</option>
            {TIPOS_JUICIO.map((tj) => (
              <option key={tj} value={tj}>{tj}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Expedientes */}
      <div ref={expedientesListSectionRef} className="scroll-mt-24">
      {filteredExpedientes.length === 0 ? (
        <div className={`rounded-[2rem] border p-8 md:p-14 text-center flex flex-col items-center justify-center gap-4 shadow-sm ${cardSurfaceCls}`}>
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-black font-serif text-slate-900 dark:text-white">
              {effectiveExpedientes.length === 0 ? 'Tu carpeta de expedientes está lista' : 'Sin coincidencias para tu búsqueda'}
            </h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {effectiveExpedientes.length === 0
                ? esAbogado
                  ? 'Registra tu primera causa manualmente o sube cualquier documento del expediente (demanda, cédula, providencia, auto, oficio o escrito en PDF o foto) para que O.L.G.A. resuma el caso, detecte plazos según el CPC de Paraguay y te ayude a redactar escritos.'
                  : 'Registra tu primera causa manualmente o sube una Demanda / Cédula en PDF para que O.L.G.A. extraiga la carátula, calcule plazos según el CPC de Paraguay y te ayude a redactar escritos.'
                : 'Prueba limpiando los filtros o cambiando el texto de búsqueda.'}
            </p>
          </div>
          {effectiveExpedientes.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
              <button
                type="button"
                disabled={isSoftBlocked}
                onClick={() => {
                  openCreateModal();
                  window.setTimeout(() => modalPdfInputRef.current?.click(), 120);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {esAbogado ? 'Analizar Documento / PDF / Foto con IA' : 'Subir Demanda PDF con IA'}
                </span>
              </button>
              <button
                type="button"
                disabled={isSoftBlocked}
                onClick={openCreateModal}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Cargar Manualmente</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpedientes.map((exp) => {
            const isOpen = selectedExpId === exp.id;
            const pendingPlazos = (exp.plazos || [])
              .filter((p) => !p.completado)
              .sort((a, b) => (calcDaysUntil(a.fechaVencimiento) ?? 9999) - (calcDaysUntil(b.fechaVencimiento) ?? 9999));
            const nextPlazo = pendingPlazos[0] || null;
            const nextDays = nextPlazo ? calcDaysUntil(nextPlazo.fechaVencimiento) : null;
            const isAnalyzingThis = analyzingTargetId === exp.id;
            const contestacionKey = `${exp.id}-contestacion-general`;
            const impulsoGeneralKey = `${exp.id}-impulso-general`;
            const analisisOpen = Boolean(expandedAnalisisIds[exp.id]);

            const accent = getExpedienteVisualAccent(exp);
            const nroDisplay = exp.nroExpediente
              ? `Expte. N.º ${exp.nroExpediente}${exp.anio ? `/${exp.anio}` : ''}`
              : 'Sin N.º asignado';
            const rolLabelShort =
              exp.rolParte === 'Actor / Demandante'
                ? 'Actor'
                : exp.rolParte || 'Parte';

            return (
              <div
                key={exp.id}
                ref={(el) => {
                  expedienteCardRefs.current[exp.id] = el;
                }}
                className={`scroll-mt-24 rounded-3xl border transition-all shadow-sm overflow-hidden relative ${cardSurfaceCls} ${
                  esAbogado ? accent.hoverBorderCls : ''
                } ${
                  isOpen ? 'ring-2 ring-blue-500/40' : ''
                }`}
              >
                {/* Franja lateral de acento visual consistente por expediente (solo esAbogado === true) */}
                {esAbogado && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent.stripeCls} pointer-events-none`}
                    aria-hidden="true"
                  />
                )}

                {/* Cabecera de la tarjeta */}
                {esAbogado ? (
                  <div
                    onClick={() => setSelectedExpId(isOpen ? null : exp.id)}
                    className="pl-5 pr-4 py-4 md:pl-6 md:pr-5 md:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-2.5">
                      {/* Fila superior destacada: N.º Expediente / Año + Tipo de Juicio / Fuero + Rol + Estado */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-black border ${
                            exp.nroExpediente
                              ? accent.nroBadgeCls
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dotCls}`} />
                          <span>{nroDisplay}</span>
                        </span>

                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white border border-slate-700">
                          {exp.tipoJuicio}
                        </span>

                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                          exp.rolParte === 'Demandado'
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                            : exp.rolParte === 'Tercero'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                        }`}>
                          Rol: {rolLabelShort}
                        </span>

                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                          exp.estado === 'Finalizado'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}>
                          {exp.estado}
                        </span>
                      </div>

                      {/* Carátula */}
                      <h3 className="text-base md:text-lg font-black font-serif text-slate-900 dark:text-white leading-snug">
                        {exp.caratula}
                      </h3>

                      {/* Separación visual clara entre Juzgado y Cliente */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="flex items-start gap-2 min-w-0 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
                          <Gavel className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Juzgado / Fuero
                            </p>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                              {exp.juzgado || 'Juzgado sin especificar'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 min-w-0 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              Cliente / Mandante
                            </p>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                              {exp.clienteNombre || 'Sin cliente asignado'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Próximo plazo separado visualmente + botones Editar / Eliminar */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 shrink-0 lg:border-l lg:border-slate-200/80 dark:lg:border-slate-800 lg:pl-4">
                      {nextPlazo ? (
                        <div className={`px-3.5 py-2 rounded-2xl border text-left min-w-[180px] max-w-[240px] ${getDeadlineBadgeStyle(nextDays, false)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider opacity-80">
                              Próximo Plazo
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              {getDaysLabel(nextDays, false)}
                            </span>
                          </div>
                          <p className="text-xs font-bold truncate mt-0.5">
                            {nextPlazo.titulo}
                          </p>
                          <p className="text-[10px] font-mono opacity-80 mt-0.5">
                            Vence: {formatDateShort(nextPlazo.fechaVencimiento)}
                          </p>
                        </div>
                      ) : (
                        <div className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-left min-w-[160px]">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            Próximo Plazo
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                            Sin plazos pendientes
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(exp);
                          }}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-600 hover:border-blue-300 dark:text-slate-300 dark:hover:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          title="Editar expediente"
                          aria-label={`Editar expediente ${exp.caratula}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(exp.id);
                          }}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-red-600 hover:border-red-300 dark:text-slate-300 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar expediente"
                          aria-label={`Eliminar expediente ${exp.caratula}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="p-2 text-slate-400">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setSelectedExpId(isOpen ? null : exp.id)}
                    className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white border border-slate-700">
                          {exp.tipoJuicio}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          exp.rolParte === 'Demandado'
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                        }`}>
                          {exp.rolParte}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          exp.estado === 'Finalizado'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}>
                          {exp.estado}
                        </span>
                        {exp.nroExpediente && (
                          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                            Expte. N° {exp.nroExpediente}/{exp.anio}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base md:text-lg font-black font-serif text-slate-900 dark:text-white leading-snug">
                        {exp.caratula}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>{exp.juzgado || 'Juzgado sin especificar'}</span>
                        {exp.clienteNombre && (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Cliente: {exp.clienteNombre}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 shrink-0">
                      {nextPlazo ? (
                        <div className={`px-3 py-1.5 rounded-xl border text-left ${getDeadlineBadgeStyle(nextDays, false)}`}>
                          <p className="text-[10px] font-black uppercase tracking-wider">
                            {getDaysLabel(nextDays, false)}
                          </p>
                          <p className="text-[11px] font-semibold truncate max-w-[200px]">
                            {nextPlazo.titulo} ({formatDateShort(nextPlazo.fechaVencimiento)})
                          </p>
                        </div>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Sin plazos pendientes
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(exp);
                          }}
                          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Editar expediente"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(exp.id);
                          }}
                          className="p-2 rounded-xl text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar expediente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="p-2 text-slate-400">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cuerpo expandido del Expediente */}
                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-4 md:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/40">
                    {/* Botonera de Acciones IA */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isSoftBlocked || isAnalyzingThis}
                        onClick={() => {
                          setCardPdfTargetExp(exp);
                          cardPdfInputRef.current?.click();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isAnalyzingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileSearch className="w-4 h-4" />
                        )}
                        <span>
                          {isAnalyzingThis
                            ? esAbogado
                              ? 'Analizando documento...'
                              : 'Analizando PDF...'
                            : esAbogado
                              ? '✨ Analizar Documento / PDF / Foto'
                              : '✨ Analizar Demanda PDF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={draftingKey === contestacionKey}
                        onClick={() => void handleRedactarConIA(exp, 'contestacion')}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {draftingKey === contestacionKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>
                          {draftingKey === contestacionKey
                            ? 'Redactando...'
                            : esAbogado
                              ? '✨ Redactar Contestación / Respuesta'
                              : '✨ Redactar Contestación de Demanda'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={draftingKey === impulsoGeneralKey}
                        onClick={() => void handleRedactarConIA(exp, 'impulso', nextPlazo || undefined)}
                        className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {draftingKey === impulsoGeneralKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500" />
                        )}
                        <span>
                          {draftingKey === impulsoGeneralKey
                            ? 'Redactando...'
                            : '✨ Redactar Escrito de Impulso'}
                        </span>
                      </button>

                      {esAbogado && (
                        <button
                          type="button"
                          onClick={() =>
                            setParteModalTarget({
                              expediente: exp,
                              plazo: nextPlazo || null,
                            })
                          }
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Parte Secretaría O.L.G.A.</span>
                        </button>
                      )}
                    </div>

                    {/* Último Análisis IA + Memoria Acumulada del Expediente */}
                    {exp.ultimoAnalisisIA && (
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
                        <div
                          onClick={() =>
                            setExpandedAnalisisIds((prev) => ({ ...prev, [exp.id]: !prev[exp.id] }))
                          }
                          className="flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                              Análisis Jurídico IA Guardado
                            </span>
                            {exp.ultimoAnalisisIA.archivoNombre && (
                              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                ({exp.ultimoAnalisisIA.archivoNombre})
                              </span>
                            )}
                            {esAbogado && (exp.historialDocumentos?.length || 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/15 text-indigo-800 dark:text-indigo-200 border border-indigo-300/60 dark:border-indigo-700">
                                Memoria acumulada: {exp.historialDocumentos?.length} doc(s)
                              </span>
                            )}
                          </div>
                          {analisisOpen ? (
                            <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          )}
                        </div>
                        {analisisOpen && (
                          <div className="mt-3 pt-3 border-t border-indigo-200/70 dark:border-indigo-800/50 space-y-2.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                            <p>{exp.ultimoAnalisisIA.resumenHechos}</p>
                            {exp.ultimoAnalisisIA.fundamentoCPC && (
                              <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                                Fundamento CPC Paraguay: {exp.ultimoAnalisisIA.fundamentoCPC}
                              </p>
                            )}
                            {esAbogado && (exp.historialDocumentos?.length || 0) > 1 && (
                              <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                  Historial acumulado usado por la IA al redactar ({exp.historialDocumentos?.length})
                                </p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {(exp.historialDocumentos || []).map((docMem) => (
                                    <div
                                      key={docMem.id}
                                      className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-indigo-100 dark:border-indigo-900/60 p-2.5 text-[11px]"
                                    >
                                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                          {docMem.archivoNombre}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                          {docMem.parteOrigen}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          {formatDateShort(docMem.analizadoAt)}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {docMem.resumenHechos}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cronograma de Plazos e Impulsos */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-blue-500" />
                          <span>Cronograma de Plazos Procesales e Impulsos ({(exp.plazos || []).length})</span>
                        </h4>
                        <button
                          type="button"
                          disabled={isSoftBlocked}
                          onClick={() => {
                            setAddingPlazoForExpId(addingPlazoForExpId === exp.id ? null : exp.id);
                            setNewPlazoTitulo('');
                            setNewPlazoFecha(addCalendarDaysIso(5));
                            setNewPlazoDias('5');
                            setNewPlazoTipo('plazo_legal');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Plazo / Impulso</span>
                        </button>
                      </div>

                      {addingPlazoForExpId === exp.id && (
                        <div className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Actuación / Título del Plazo
                            </label>
                            <input
                              type="text"
                              value={newPlazoTitulo}
                              onChange={(e) => setNewPlazoTitulo(e.target.value)}
                              placeholder="Ej: Contestar demanda / Ofrecer pruebas"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Fecha Vencimiento
                            </label>
                            <input
                              type="date"
                              value={newPlazoFecha}
                              onChange={(e) => setNewPlazoFecha(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Tipo
                            </label>
                            <select
                              value={newPlazoTipo}
                              onChange={(e) => setNewPlazoTipo(e.target.value as TipoPlazoProcesal)}
                              className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            >
                              <option value="plazo_legal">Plazo Legal</option>
                              <option value="impulso">Impulso</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleAddPlazoInline(exp)}
                              className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingPlazoForExpId(null)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {(exp.plazos || []).length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                          Aún no hay plazos ni impulsos cargados en este expediente.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {[...(exp.plazos || [])]
                            .sort((a, b) => {
                              if (a.completado !== b.completado) return a.completado ? 1 : -1;
                              return String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento));
                            })
                            .map((plazo) => {
                              const dias = calcDaysUntil(plazo.fechaVencimiento);
                              const stepDraftKey = `${exp.id}-impulso-${plazo.id}`;
                              return (
                                <div
                                  key={plazo.id}
                                  className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    plazo.completado
                                      ? 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <button
                                      type="button"
                                      disabled={Boolean(togglingPlazos[`${exp.id}::${plazo.id}`])}
                                      onClick={() => void togglePlazoCompletado(exp, plazo.id)}
                                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-60 ${
                                        plazo.completado
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 hover:border-emerald-500'
                                      }`}
                                      title={plazo.completado ? 'Reabrir plazo' : 'Marcar como completado'}
                                    >
                                      {plazo.completado && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(dias, plazo.completado)}`}>
                                          {getDaysLabel(dias, plazo.completado)}
                                        </span>
                                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                          {formatDateShort(plazo.fechaVencimiento)}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                                        </span>
                                      </div>
                                      <p className={`text-xs font-bold mt-1 ${plazo.completado ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                        {plazo.titulo}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {esAbogado && (
                                      <button
                                        type="button"
                                        onClick={() => setParteModalTarget({ expediente: exp, plazo })}
                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Generar parte Secretaría O.L.G.A. por WhatsApp"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        <span>Parte WA</span>
                                      </button>
                                    )}
                                    {!plazo.completado && (
                                      <button
                                        type="button"
                                        disabled={draftingKey === stepDraftKey}
                                        onClick={() => void handleRedactarConIA(exp, 'impulso', plazo)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                      >
                                        {draftingKey === stepDraftKey ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="w-3 h-3 text-amber-300" />
                                        )}
                                        <span>Redactar Impulso IA</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void handleDeletePlazoInline(exp, plazo.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                      title="Eliminar plazo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {exp.notas && (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Notas del Estudio
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">
                          {exp.notas}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Expediente con Análisis IA */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm md:text-base font-black font-serif">
                  {editingExpediente ? 'Editar Expediente Judicial' : 'Nuevo Expediente Judicial'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitExpediente(e)} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Zona de Análisis PDF con IA dentro del modal */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 space-y-3">
                <input
                  ref={modalPdfInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) {
                      void handleAnalyzePdfFile(file, 'modal');
                    }
                  }}
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-indigo-950 dark:text-indigo-100">
                        {esAbogado
                          ? '✨ Analizar Documento / PDF / Foto con IA'
                          : '✨ Analizar Demanda o Cédula PDF con IA'}
                      </p>
                      <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                        {esAbogado
                          ? 'Sube demandas, cédulas de notificación, providencias, autos, oficios, escritos o constancias del expediente para resumir, detectar plazos CPC y redactar con IA.'
                          : 'Extrae carátula, juzgado, tipo de juicio y calcula el plazo procesal según el CPC de Paraguay.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={analyzingTargetId === 'modal'}
                    onClick={() => modalPdfInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {analyzingTargetId === 'modal' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir PDF / Foto</span>
                      </>
                    )}
                  </button>
                </div>

                {pendingAnalysisPreview && pendingAnalysisPreview.target === 'modal' && (
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4" />
                        {esAbogado
                          ? `Resumen jurídico (${pendingAnalysisPreview.fileName})`
                          : `Sugerencia IA (${pendingAnalysisPreview.fileName})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingAnalysisPreview(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {pendingAnalysisPreview.result.caratula}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      {pendingAnalysisPreview.result.juzgado} • {pendingAnalysisPreview.result.tipoJuicio} • Rol sugerido: {pendingAnalysisPreview.result.rolParteSugerido}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                      {pendingAnalysisPreview.result.resumenHechos}
                    </p>
                    {esAbogado && pendingAnalysisPreview.result.fundamentoCPC && (
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                        Base CPC: {pendingAnalysisPreview.result.fundamentoCPC}
                      </p>
                    )}
                    {pendingAnalysisPreview.result.plazoPrincipal && (
                      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                        Plazo Principal: {pendingAnalysisPreview.result.plazoPrincipal.titulo} — Vence {formatDateShort(pendingAnalysisPreview.result.plazoPrincipal.fechaVencimiento)}
                      </div>
                    )}
                    {esAbogado && (pendingAnalysisPreview.result.impulsosSugeridos || []).length > 0 && (
                      <div className="space-y-1">
                        {(pendingAnalysisPreview.result.impulsosSugeridos || []).map((imp, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px]"
                          >
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{imp.titulo}</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                              {formatDateShort(imp.fechaVencimiento)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleConfirmPendingAnalysis()}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {esAbogado ? 'Cargar datos y plazos al expediente' : 'Confirmar y Cargar al Expediente'}
                        </span>
                      </button>
                      {esAbogado && (
                        <>
                          <button
                            type="button"
                            disabled={Boolean(draftingFromPreviewMode)}
                            onClick={() => void handleDraftFromPendingAnalysis('contestacion')}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {draftingFromPreviewMode === 'contestacion' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {draftingFromPreviewMode === 'contestacion'
                                ? 'Redactando...'
                                : 'Redactar contestación / respuesta con IA'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(draftingFromPreviewMode)}
                            onClick={() => void handleDraftFromPendingAnalysis('impulso')}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {draftingFromPreviewMode === 'impulso' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                            <span>
                              {draftingFromPreviewMode === 'impulso'
                                ? 'Redactando...'
                                : 'Redactar impulso / escrito con IA'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Campos del Expediente */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Carátula del Expediente *
                  </label>
                  <input
                    type="text"
                    required
                    value={caratula}
                    onChange={(e) => setCaratula(e.target.value)}
                    placeholder='Ej: "Juan Pérez c/ Empresa X s/ Cobro de Guaraníes"'
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    N° Expediente
                  </label>
                  <input
                    type="text"
                    value={nroExpediente}
                    onChange={(e) => setNroExpediente(e.target.value)}
                    placeholder="Ej: 1245"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Año
                  </label>
                  <input
                    type="text"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Juzgado / Circunscripción
                  </label>
                  <input
                    type="text"
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    placeholder="Ej: Juzgado de 1ra. Instancia en lo Civil, 3er Turno"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Tipo de Juicio
                  </label>
                  <select
                    value={tipoJuicio}
                    onChange={(e) => setTipoJuicio(e.target.value as TipoJuicioExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {TIPOS_JUICIO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Rol de Parte
                  </label>
                  <select
                    value={rolParte}
                    onChange={(e) => setRolParte(e.target.value as RolParteExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {ROLES_PARTE.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {ESTADOS_EXPEDIENTE.map((est) => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Cliente / Mandante (opcional)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={clienteNombre}
                      onChange={(e) => {
                        setClienteNombre(e.target.value);
                        setClienteId('');
                      }}
                      placeholder="Nombre completo o Razón Social del cliente"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    {personas.length > 0 && (
                      <select
                        value={clienteId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setClienteId(pid);
                          const found = personas.find((p) => p.id === pid);
                          if (found) {
                            setClienteNombre(
                              found.nombre_o_razon_social || `${found.nombre} ${found.apellido || ''}`.trim()
                            );
                          }
                        }}
                        className="sm:w-56 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="">Elegir de Clientes/Partes...</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre_o_razon_social || `${p.nombre} ${p.apellido || ''}`.trim()} ({p.nro_documento})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Notas Estratégicas / Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles de estrategia procesal, pruebas pendientes o montos..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-y"
                  />
                </div>
              </div>

              {/* Resumen de plazos cargados en borrador */}
              {draftPlazos.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Plazos e Impulsos en este Expediente ({draftPlazos.length})
                  </p>
                  {draftPlazos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.titulo}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateShort(p.fechaVencimiento)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDraftPlazos((prev) => prev.filter((item) => item.id !== p.id))}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modalError && (
                <div className="rounded-xl border border-red-300 dark:border-red-700/70 bg-red-50 dark:bg-red-950/60 px-3.5 py-2.5 flex items-start justify-between gap-2.5 text-red-700 dark:text-red-200 text-xs font-semibold">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalError(null)}
                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setModalOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingExpediente ? 'Guardar Cambios' : 'Registrar Expediente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>

      {/* Modal Listado Interactivo de Tarjetas KPI */}
      {kpiModalCategory && (
        <div
          onClick={() => setKpiModalCategory(null)}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    kpiModalCategory === 'activas'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      : kpiModalCategory === 'criticos'
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                        : kpiModalCategory === 'proximos'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {kpiModalCategory === 'activas' && <Scale className="w-5 h-5" />}
                  {kpiModalCategory === 'criticos' && <AlertTriangle className="w-5 h-5" />}
                  {kpiModalCategory === 'proximos' && <CalendarClock className="w-5 h-5" />}
                  {kpiModalCategory === 'cumplidas' && <Gavel className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {kpiModalCategory === 'activas' && `Causas Activas (${activeCasesCount})`}
                    {kpiModalCategory === 'criticos' && `Plazos Críticos ≤ 3 Días (${urgentCount})`}
                    {kpiModalCategory === 'proximos' && `Plazos Próximos 4–7 Días (${warningCount})`}
                    {kpiModalCategory === 'cumplidas' && `Actuaciones Cumplidas (${completedStepsCount})`}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Haz clic en cualquier registro para abrir y trabajar directamente sobre el expediente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKpiModalCategory(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
              {kpiModalCategory === 'activas' && (
                activeExpedientes.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <Scale className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No hay causas activas registradas
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      Registra un nuevo expediente o revisa todos los expedientes archivados/finalizados.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {!isSoftBlocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setKpiModalCategory(null);
                            openCreateModal();
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nuevo Expediente</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleVerTodosDesdeKpiModal}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Ver Todos los Expedientes
                      </button>
                    </div>
                  </div>
                ) : (
                  activeExpedientes.map((exp) => {
                    const nextP = (exp.plazos || [])
                      .filter((p) => !p.completado)
                      .sort(
                        (a, b) =>
                          (calcDaysUntil(a.fechaVencimiento) ?? 9999) -
                          (calcDaysUntil(b.fechaVencimiento) ?? 9999)
                      )[0];
                    const nextDays = nextP ? calcDaysUntil(nextP.fechaVencimiento) : null;
                    return (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => handleSelectExpedienteFromKpiModal(exp.id)}
                        className="w-full text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 dark:bg-slate-800 text-white">
                              {exp.tipoJuicio}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {exp.estado}
                            </span>
                            {exp.nroExpediente && (
                              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                Expte. {exp.nroExpediente}/{exp.anio}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {exp.caratula}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {nextP
                              ? `Próximo: ${nextP.titulo} • ${formatDateShort(nextP.fechaVencimiento)}`
                              : exp.juzgado || 'Sin plazos pendientes'}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {nextP && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(nextDays, false)}`}>
                              {getDaysLabel(nextDays, false)}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            Ir al expte. →
                          </span>
                        </div>
                      </button>
                    );
                  })
                )
              )}

              {(kpiModalCategory === 'criticos' || kpiModalCategory === 'proximos') && (() => {
                const items = kpiModalCategory === 'criticos' ? criticalDeadlines : warningDeadlines;
                if (items.length === 0) {
                  return (
                    <div className="py-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                        {kpiModalCategory === 'criticos' ? (
                          <AlertTriangle className="w-6 h-6" />
                        ) : (
                          <CalendarClock className="w-6 h-6" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {kpiModalCategory === 'criticos'
                          ? 'Sin plazos críticos en este momento'
                          : 'Sin plazos próximos entre 4 y 7 días'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        {kpiModalCategory === 'criticos'
                          ? 'No hay vencimientos urgentes o vencidos en las próximas 72 horas.'
                          : 'No tienes plazos ni impulsos programados para el rango de 4 a 7 días.'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        {!isSoftBlocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setKpiModalCategory(null);
                              openCreateModal();
                            }}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Nuevo Expediente</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleVerTodosDesdeKpiModal}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          Ver Todos los Expedientes
                        </button>
                      </div>
                    </div>
                  );
                }

                return items.map(({ expediente, plazo, diasRestantes }) => (
                  <button
                    key={`${expediente.id}-${plazo.id}`}
                    type="button"
                    onClick={() => handleSelectExpedienteFromKpiModal(expediente.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      kpiModalCategory === 'criticos'
                        ? 'border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-950/40'
                        : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(diasRestantes, false)}`}>
                          {getDaysLabel(diasRestantes, false)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatDateShort(plazo.fechaVencimiento)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                        </span>
                        {expediente.nroExpediente && (
                          <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                            Expte. {expediente.nroExpediente}/{expediente.anio}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {plazo.titulo}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {expediente.caratula}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                      Abrir →
                    </span>
                  </button>
                ));
              })()}

              {kpiModalCategory === 'cumplidas' && (
                completedDeadlines.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <Gavel className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Aún no hay actuaciones cumplidas
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      Cuando marques un plazo o impulso procesal como cumplido aparecerá registrado aquí.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleVerTodosDesdeKpiModal}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Ver Todos los Expedientes
                      </button>
                    </div>
                  </div>
                ) : (
                  completedDeadlines.map(({ expediente, plazo }) => (
                    <button
                      key={`${expediente.id}-${plazo.id}`}
                      type="button"
                      onClick={() => handleSelectExpedienteFromKpiModal(expediente.id)}
                      className="w-full text-left p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/35 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase border bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            Cumplido
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {formatDateShort(plazo.completadoEn || plazo.fechaVencimiento)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                          </span>
                          {expediente.nroExpediente && (
                            <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                              Expte. {expediente.nroExpediente}/{expediente.anio}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {plazo.titulo}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          {expediente.caratula}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                        Ver causa →
                      </span>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminación */}
      {confirmDeleteId && (() => {
        const expToDelete = effectiveExpedientes.find((item) => item.id === confirmDeleteId) || null;
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Eliminar Expediente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Esta acción eliminará el expediente y su cronograma de plazos de forma permanente.
                </p>
                {esAbogado && expToDelete && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-2.5 text-left">
                    <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      {expToDelete.nroExpediente
                        ? `Expte. N.º ${expToDelete.nroExpediente}${expToDelete.anio ? `/${expToDelete.anio}` : ''}`
                        : 'Sin N.º asignado'}
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2">
                      {expToDelete.caratula}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void handleConfirmDeleteExpediente()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmación breve al generar un escrito vinculado a un plazo/impulso (solo esAbogado === true) */}
      {esAbogado && pendingMarkDonePrompt && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Confirmar cumplimiento de plazo procesal"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] z-[90] rounded-2xl border border-indigo-300 dark:border-indigo-700/80 bg-white dark:bg-[#121824] shadow-2xl p-4 space-y-3 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                  ¿Deseas marcar este plazo/impulso como cumplido?
                </h4>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mt-1 truncate">
                  {pendingMarkDonePrompt.plazo.titulo}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {pendingMarkDonePrompt.expediente.caratula}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingMarkDonePrompt(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPendingMarkDonePrompt(null)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Mantener pendiente
            </button>
            <button
              type="button"
              onClick={() => {
                const { expediente, plazo } = pendingMarkDonePrompt;
                const freshExp =
                  effectiveExpedientes.find((item) => item.id === expediente.id) || expediente;
                setPendingMarkDonePrompt(null);
                void togglePlazoCompletado(freshExp, plazo.id, true);
                showToastSuccess(`Plazo "${plazo.titulo}" marcado como cumplido.`);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar como hecho</span>
            </button>
          </div>
        </div>
      )}

      {/* Sugerencia rápida de siguiente etapa procesal tras cumplir una actuación (solo esAbogado === true) */}
      {esAbogado && nextStepSuggestion && !pendingMarkDonePrompt && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Sugerencia de siguiente etapa procesal"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[430px] z-[90] rounded-2xl border border-indigo-300 dark:border-indigo-700/80 bg-white dark:bg-[#121824] shadow-2xl p-4 space-y-3 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    Siguiente paso · {nextStepSuggestion.tipoJuicio}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug mt-1">
                  {nextStepSuggestion.suggestedPlazo.titulo}
                </h4>
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Vencimiento sugerido: {formatDateShort(nextStepSuggestion.suggestedPlazo.fechaVencimiento)} ({nextStepSuggestion.suggestedPlazo.diasPlazo} días)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {nextStepSuggestion.suggestedPlazo.fundamentoOrientativo}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                  Tras cumplir: {nextStepSuggestion.completedTitulo} · {nextStepSuggestion.caratula}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNextStepSuggestion(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label="Cerrar sugerencia"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setNextStepSuggestion(null)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={isSavingNextStep}
              onClick={() => void handleConfirmNextStepSuggestion()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {isSavingNextStep && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>+ Agendar siguiente paso</span>
            </button>
          </div>
        </div>
      )}
      {/* Modal Parte Secretaría O.L.G.A. + Autoenvío WhatsApp (EXCLUSIVO ABOGADOS) */}
      {esAbogado && parteModalTarget && (
        <ParteSecretariaModal
          isOpen={Boolean(parteModalTarget)}
          onClose={() => setParteModalTarget(null)}
          expediente={parteModalTarget.expediente}
          allExpedientes={activeExpedientes}
          defaultMode={parteModalTarget.mode || 'detallado'}
          initialPlazo={parteModalTarget.plazo || null}
          userData={userData}
          currentUser={currentUser}
          workspaceId={wsId}
          connectedWaPhone={connectedWaPhone}
          isScheduledTrigger={Boolean(parteModalTarget.isScheduledTrigger)}
          linkedDocs={
            parteModalTarget.expediente
              ? findLinkedDocumentosForExpediente(parteModalTarget.expediente, workspaceDocs)
              : []
          }
          onWhatsappSaved={(saved) => {
            setAbogadoWaNumber(saved);
            setAbogadoWaDraft(saved ? formatAbogadoWhatsAppDisplay(saved) : '');
          }}
          onScheduleSaved={(nextSched) => {
            setSecretariaSchedule(nextSched);
            setScheduleDraft(nextSched);
          }}
        />
      )}
    </div>
  );
};
