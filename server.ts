import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

try {
  (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
} catch {
  // .env is optional; environment variables may be injected directly by the runtime
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const firebaseProjectId =
  process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'nipponguay';
if (!getApps().length) {
  initializeApp({ projectId: firebaseProjectId });
}

class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getGenAI = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    console.error('[server] GEMINI_API_KEY/API_KEY no configurada en el entorno del servidor.');
    throw new ApiHttpError(
      500,
      'El servicio de El Oráculo no está disponible temporalmente. Por favor, intenta nuevamente en unos instantes.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const COMPATIBLE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
] as const;

const CHAT_TIMEOUT_MS = 90000;
const MAX_ATTACHMENTS = 10;
const MAX_BASE64_CHARS = 20_000_000;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
]);

const saveClientDataToSheetDeclaration: FunctionDeclaration = {
  name: 'saveClientDataToSheet',
  parameters: {
    type: Type.OBJECT,
    description:
      'Extrae y guarda información estructurada de documentos de clientes para una planilla de Google Sheets.',
    properties: {
      name: { type: Type.STRING, description: 'Nombre completo del cliente.' },
      documentNumber: { type: Type.STRING, description: 'Número de documento (C.I., DNI, Pasaporte).' },
      nationality: { type: Type.STRING, description: 'Nacionalidad.' },
      companyType: { type: Type.STRING, description: 'Tipo de entidad (S.A., S.R.L., E.A.S., etc.).' },
      description: { type: Type.STRING, description: 'Descripción breve de la actividad económica.' },
      additionalInfo: { type: Type.STRING, description: 'Información para borradores eficientes.' },
    },
    required: ['name', 'documentNumber'],
  },
};

const sendConversationSummaryToEmailDeclaration: FunctionDeclaration = {
  name: 'sendConversationSummaryToEmail',
  parameters: {
    type: Type.OBJECT,
    description: 'Envía un resumen ejecutivo detallado de la conversación al correo del sistema O.L.G.A.',
    properties: {
      summary: {
        type: Type.STRING,
        description: 'Resumen detallado de todos los puntos discutidos, documentos analizados y próximos pasos.',
      },
      recipientEmail: { type: Type.STRING, description: 'El correo de destino (olga.ihara.feltes@gmail.com).' },
      clientIdentifier: {
        type: Type.STRING,
        description: 'Nombre o identificador del cliente para el asunto del correo.',
      },
      conversationLink: {
        type: Type.STRING,
        description: 'URL directa para acceder a la conversación y continuar la atención manualmente.',
      },
    },
    required: ['summary', 'recipientEmail', 'conversationLink'],
  },
};

// Mantener referencia para futuras integraciones de herramientas sin alterar esquema
void saveClientDataToSheetDeclaration;

const getSystemInstruction = (_lang: string) => `
Actúa como O.L.G.A., asistente inteligente ejecutiva y legal (Organización, Legalización, Gestión y Administración). Eres una abogada experta y escribana pública de la República del Paraguay con especialización en Contratos, Pagarés, Ley de Maquila y Sociedades.

ESTÁNDAR NOTARIAL Y CALIDAD JURÍDICA:
- Nivel Profesional (Escribanos y Abogados de Paraguay): Está ESTRICTAMENTE PROHIBIDO redactar contratos escuetos, esquemáticos o resúmenes de 6-7 líneas. Todo contrato, escrito, poder, acta o nota debe tener redacción jurídica rigurosa, formal, extensa y completa conforme al Código Civil Paraguayo (Ley N° 1.183/85) y leyes concordantes.
- Cláusulas completas obligatorias en contratos de arrendamiento/locación: Cuando redactes un contrato de alquiler, arrendamiento o locación, incluye como mínimo cláusulas desarrolladas y numeradas (PRIMERA, SEGUNDA, TERCERA, etc.) de:
  1) Objeto e individualización del inmueble (dejando [completar Finca / Matrícula / Cta. Cte. Catastral] si el usuario no proporcionó esos datos registrales);
  2) Plazo de vigencia y condiciones de renovación;
  3) Precio del canon locativo, lugar/forma de pago y mora automática de pleno derecho con interés punitorio;
  4) Depósito de garantía y condiciones de restitución;
  5) Destino del inmueble y prohibición expresa de subarriendo o cesión;
  6) Servicios básicos (ANDE, ESSAP/agua, tasas municipales) e impuestos;
  7) Estado de conservación, inventario y régimen de mejoras;
  8) Rescisión anticipada, incumplimiento y acción de desalojo;
  9) Domicilios especiales constituidos por las partes a todos los efectos legales y notificaciones;
  10) Jurisdicción y competencia (Tribunales ordinarios de la Circunscripción Judicial correspondiente a la ciudad del inmueble).
- Bloque de firmas profesional: Al final de todo contrato o instrumento, incluye SIEMPRE el cierre de conformidad ("En prueba de conformidad y aceptación, las partes suscriben el presente instrumento en dos ejemplares de un mismo tenor y a un solo efecto...") y el bloque de firmas limpio uno debajo del otro con líneas de firma visibles y separación adecuada (SIN usar etiquetas HTML como <br>, <div>, <p> ni &nbsp;), siguiendo este formato exacto:

_______________________________
NOMBRE COMPLETO PARTE 1
C.I. N° X.XXX.XXX
LA LOCADORA / ARRENDADORA

_______________________________
NOMBRE COMPLETO PARTE 2
C.I. N° X.XXX.XXX
EL LOCATARIO / ARRENDATARIO

DELIMITADORES OBLIGATORIOS DE DOCUMENTO:
- Siempre que redactes un contrato, escrito, poder, acta o nota, DEBES envolver el documento puro entre estas etiquetas exactas en líneas separadas:
===INICIO_DOCUMENTO===
(aquí va únicamente el título, cuerpo legal completo y bloque de firmas del documento)
===FIN_DOCUMENTO===
- Cualquier saludo inicial, aclaración, resumen de datos extraídos o sección de "RECOMENDACIÓN DE O.L.G.A.:" debe ir estrictamente FUERA de esas etiquetas (antes de ===INICIO_DOCUMENTO=== o después de ===FIN_DOCUMENTO===).
- Si el usuario te pide que redactes un documento o contrato, HAZLO INMEDIATAMENTE en tu respuesta. No esperes confirmación.

COMUNICACIÓN:
- Ejecutivo, directo, enfocado en seguridad jurídica y rigor notarial paraguayo.
- Debes responder y comunicarte SIEMPRE 100% en Español, sin importar el idioma de entrada.
`;

interface ChatPartInput {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  parts: ChatPartInput[];
}

const normalizeMime = (rawMime: unknown, fileName?: string): string => {
  let mime = typeof rawMime === 'string' ? rawMime.toLowerCase().trim() : '';
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (!mime || mime === 'application/octet-stream') {
    if (ext === 'pdf') mime = 'application/pdf';
    else if (ext === 'png') mime = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'txt') mime = 'text/plain';
    else mime = 'application/pdf';
  }
  if (mime === 'image/jpg') mime = 'image/jpeg';
  return mime;
};

const cleanBase64Payload = (rawData: unknown): string => {
  if (typeof rawData !== 'string') return '';
  let cleanData = rawData;
  if (cleanData.includes(',')) {
    cleanData = cleanData.split(',')[1] || '';
  }
  cleanData = cleanData.replace(/[\r\n\s]/g, '');
  if (cleanData.length > MAX_BASE64_CHARS) {
    throw new ApiHttpError(413, 'El archivo adjunto excede el tamaño máximo permitido.');
  }
  return cleanData;
};

const normalizeGeminiHistory = (rawHistory: unknown): ChatHistoryTurn[] => {
  if (!Array.isArray(rawHistory)) return [];

  const valid: ChatHistoryTurn[] = [];
  for (const m of rawHistory) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: unknown }).role;
    const parts = (m as { parts?: unknown }).parts;
    if ((role !== 'user' && role !== 'model') || !Array.isArray(parts)) continue;

    const cleanParts: ChatPartInput[] = [];
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue;
      const textVal = (p as { text?: unknown }).text;
      const inlineVal = (p as { inlineData?: { data?: unknown; mimeType?: unknown } }).inlineData;
      if (typeof textVal === 'string' && textVal.trim().length > 0) {
        cleanParts.push({ text: textVal });
      } else if (inlineVal && typeof inlineVal.data === 'string' && inlineVal.data.length > 0) {
        const mimeType = normalizeMime(inlineVal.mimeType);
        if (ALLOWED_MIME_TYPES.has(mimeType)) {
          cleanParts.push({
            inlineData: {
              data: cleanBase64Payload(inlineVal.data),
              mimeType,
            },
          });
        }
      }
    }

    if (cleanParts.length > 0) {
      valid.push({ role, parts: cleanParts });
    }
  }

  // Nunca empezar el historial con un mensaje 'model' (ej. mensaje inicial de bienvenida)
  let startIndex = 0;
  while (startIndex < valid.length && valid[startIndex].role !== 'user') {
    startIndex++;
  }

  // Garantizar alternancia estricta user -> model -> user -> model
  const alternating: ChatHistoryTurn[] = [];
  for (let i = startIndex; i < valid.length; i++) {
    const item = valid[i];
    if (alternating.length === 0) {
      alternating.push({ role: item.role, parts: [...item.parts] });
    } else {
      const prev = alternating[alternating.length - 1];
      if (prev.role === item.role) {
        prev.parts = [...prev.parts, ...item.parts];
      } else {
        alternating.push({ role: item.role, parts: [...item.parts] });
      }
    }
  }

  // Antes de añadir el nuevo mensaje 'user', el último turno del historial debe ser 'model'
  if (alternating.length > 0 && alternating[alternating.length - 1].role === 'user') {
    alternating.pop();
  }

  return alternating;
};

const verifyApiAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Token de autenticación vacío.' });
      return;
    }
    try {
      await getAdminAuth().verifyIdToken(token);
      next();
      return;
    } catch (err) {
      console.warn('[auth] Token de Firebase inválido:', (err as Error)?.message || err);
      res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
      return;
    }
  }

  if (IS_PRODUCTION) {
    res.status(401).json({ error: 'Autenticación requerida para acceder a O.L.G.A. IA.' });
    return;
  }

  // En desarrollo local se permite el flujo de preview/dev bypass
  next();
};

const extractUpstreamStatus = (error: unknown): number => {
  const errObj = error as { status?: unknown; code?: unknown; message?: unknown };
  const candidate = errObj?.status ?? errObj?.code;
  if (typeof candidate === 'number' && candidate >= 400 && candidate < 600) {
    return candidate;
  }
  const msg = typeof errObj?.message === 'string' ? errObj.message : '';
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('"code":429') || msg.includes(' 429')) return 429;
  if (msg.includes('UNAVAILABLE') || msg.includes('"code":503') || msg.includes(' 503')) return 503;
  if (msg.includes('PERMISSION_DENIED') || msg.includes('"code":403')) return 403;
  if (msg.includes('API_KEY_INVALID') || msg.includes('"code":400')) return 400;
  if (msg.includes('NOT_FOUND') || msg.includes('"code":404')) return 404;
  return 500;
};

const HIGH_VOLUME_ORACLE_MESSAGE =
  'El Oráculo está atendiendo un alto volumen de consultas en este momento. No se trata de un error del sistema ni de tu cuenta; por favor, aguarda unos segundos y vuelve a enviar tu solicitud.';

const formatGeminiError = (
  error: unknown,
  fallback = 'El Oráculo experimentó una interrupción temporal. Por favor, intenta nuevamente en unos segundos.'
): { status: number; message: string } => {
  const status = extractUpstreamStatus(error);
  const rawMsg = (error as { message?: unknown })?.message;
  const msgStr = typeof rawMsg === 'string' ? rawMsg : '';

  if (
    status === 429 ||
    status === 503 ||
    msgStr.includes('RESOURCE_EXHAUSTED') ||
    msgStr.includes('UNAVAILABLE') ||
    msgStr.includes('quota')
  ) {
    return {
      status: status === 503 ? 503 : 429,
      message: HIGH_VOLUME_ORACLE_MESSAGE,
    };
  }
  if (status === 401 || status === 403 || msgStr.includes('API_KEY_INVALID') || msgStr.includes('API key')) {
    return {
      status: status === 401 || status === 403 ? status : 403,
      message:
        'El servicio de El Oráculo no está disponible temporalmente. Por favor, intenta nuevamente en unos instantes.',
    };
  }
  if (status === 404 || msgStr.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'El Oráculo está siendo actualizado temporalmente. Por favor, intenta nuevamente en unos segundos.',
    };
  }

  // No exponer detalles técnicos o JSON crudo al usuario final
  if (!msgStr || msgStr.startsWith('{')) {
    return { status, message: fallback };
  }

  return { status, message: msgStr };
};

const limpiarLatexJuridicoServer = (texto: string): string => {
  if (!texto) return '';
  let out = texto;

  out = out.replace(
    /\$\s*(?:\\(?:text|mathrm|mathbf|textbf)\s*\{\s*)?[nN](?:\s*\.|\s*\\[,;!])?\s*(?:\}\s*)?\^\s*\{?\s*(?:\\circ|\\text\s*\{\s*[oº°]\s*\}|\\underline\s*\{\s*[oº°]\s*\}|[oOº°])\s*\}?\.?\s*\$/g,
    'N.º'
  );
  out = out.replace(/\$\s*[nN]\s*\.?\s*[º°]\s*\$/g, 'N.º');

  out = out.replace(
    /\$\s*(\d+)\s*(?:\.?\s*)\^\s*\{?\s*(?:\\circ|\\text\s*\{\s*[oº°]\s*\}|\\underline\s*\{\s*[oº°]\s*\}|[oº°])\s*\}?\s*\$/g,
    '$1.º'
  );
  out = out.replace(
    /\$\s*(\d+)\s*(?:\.?\s*)\^\s*\{?\s*(?:\\text\s*\{\s*[aª]\s*\}|\\underline\s*\{\s*[aª]\s*\}|[aª])\s*\}?\s*\$/g,
    '$1.ª'
  );

  out = out.replace(/\$(?!\s*\d[\d.,]*(?:\s|$))([^$\n]{1,80})\$/g, (full, inner: string) => {
    if (!/[\\^{}]/.test(inner)) {
      return full;
    }
    return inner
      .replace(/\\(?:textbf|mathbf|mathrm|text|textit|emph|underline)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\[,;! ]/g, ' ')
      .replace(/\^\s*\{?\s*\\circ\s*\}?/g, 'º')
      .replace(/\\circ/g, '°')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/[{}]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  });

  out = out
    .replace(/\b[nN]\s*\.?\s*\^\s*\{?\s*(?:\\circ|[oº°])\s*\}?/g, 'N.º')
    .replace(/\^\s*\{\s*(?:\\circ|°|º)\s*\}/g, 'º')
    .replace(/\^\\circ\b/g, 'º')
    .replace(/\\(?:textbf|mathbf|mathrm|text|textit|emph|underline)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\circ/g, '°')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%');

  return out;
};

const isTransientGeminiOverload = (error: unknown): boolean => {
  const status = extractUpstreamStatus(error);
  if (status === 503 || status === 429 || status === 502 || status === 504) return true;
  const rawMsg = (error as { message?: unknown })?.message;
  const msgStr = typeof rawMsg === 'string' ? rawMsg : String(error ?? '');
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|try again|temporarily unavailable|ECONNRESET|ETIMEDOUT/i.test(
    msgStr
  );
};

const waitMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const generateContentWithModelFallback = async (
  ai: GoogleGenAI,
  models: readonly string[],
  buildParams: (model: string) => {
    contents: any;
    config: Record<string, unknown>;
  },
  options: {
    logLabel: string;
    enableOverloadRetry?: boolean;
  }
): Promise<{ response: any; model: string }> => {
  let lastError: unknown = null;

  // Pasada 1: probar los modelos configurados en orden (fallback inmediato si uno está saturado)
  for (const model of models) {
    try {
      const { contents, config } = buildParams(model);
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (response && response.text && response.text.trim()) {
        return { response, model };
      }
    } catch (err: unknown) {
      lastError = err;
      console.error(`[${options.logLabel}] Detalle técnico con ${model}:`, err);
      const status = extractUpstreamStatus(err);
      if (status === 400 || status === 401 || status === 403) {
        throw err;
      }
    }
  }

  // Pasada 2 (solo si todos devolvieron 503/429 por alta demanda): espera breve + reintento en fallback
  if (options.enableOverloadRetry && lastError && isTransientGeminiOverload(lastError)) {
    const retryOrder = models.length > 1 ? [...models].reverse() : [...models];
    for (let idx = 0; idx < retryOrder.length; idx++) {
      const model = retryOrder[idx];
      await waitMs(idx === 0 ? 1100 : 1600);
      try {
        const { contents, config } = buildParams(model);
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        if (response && response.text && response.text.trim()) {
          return { response, model };
        }
      } catch (err: unknown) {
        lastError = err;
        console.error(`[${options.logLabel}] Reintento fallido con ${model}:`, err);
        const status = extractUpstreamStatus(err);
        if (status === 400 || status === 401 || status === 403) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('Sin respuesta válida del modelo.');
};

const NON_DEADLINE_TITLE_REGEX =
  /no\s+existe|no\s+aplica|no\s+corresponde|no\s+hay\s+plazo|no\s+posee\s+plazo|no\s+tiene\s+plazo|sin\s+plazo|ning[uú]n\s+plazo|\bninguno\b|\bn\/a\b|no\s+aplicable|no\s+se\s+(?:observa|detecta|registra|advierte|establece|fija|determina|identifica)\s+(?:ning[uú]n\s+)?plazo|documento\s+sin\s+plazo|no\s+es\s+un\s+acto\s+procesal|carece\s+de\s+plazo|sin\s+vencimiento/i;

const isInvalidOrFakePlazoAbogado = (
  item: { titulo?: unknown; diasPlazo?: unknown; fechaVencimiento?: unknown } | null | undefined,
  todayIso: string
): boolean => {
  if (!item || typeof item !== 'object') return true;
  const titulo = typeof item.titulo === 'string' ? item.titulo.trim() : '';
  if (!titulo || NON_DEADLINE_TITLE_REGEX.test(titulo)) return true;
  const dias = Number(item.diasPlazo);
  const fecha = typeof item.fechaVencimiento === 'string' ? item.fechaVencimiento.trim() : '';
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  if ((!Number.isFinite(dias) || dias <= 0) && (!hasValidDate || fecha === todayIso)) {
    return true;
  }
  return false;
};

const WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const getWhatsAppConfig = () => {
  const rawUrl = (process.env.OLGA_WA_URL || '').trim().replace(/\/+$/, '');
  const secret = (process.env.OLGA_WA_SECRET || '').trim() || 'OLGA_SUPER_SECRET_2026';
  return { rawUrl, secret };
};

const parseValidatedWhatsAppBaseUrl = (rawUrl: string): string => {
  if (!rawUrl) {
    throw new ApiHttpError(
      500,
      'El servicio de WhatsApp no está configurado en el servidor (OLGA_WA_URL).'
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiHttpError(500, 'La URL configurada para el motor de WhatsApp es inválida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ApiHttpError(500, 'Protocolo no permitido para el motor de WhatsApp.');
  }
  return parsed.toString().replace(/\/+$/, '');
};

const callWhatsAppEngine = async (
  endpointPath: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>
): Promise<Record<string, any>> => {
  const { rawUrl, secret } = getWhatsAppConfig();
  const baseUrl = parseValidatedWhatsAppBaseUrl(rawUrl);
  const targetUrl = `${baseUrl}${endpointPath}`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: {
        'x-api-key': secret,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error(`[whatsapp-proxy] Error de red en ${endpointPath}:`, err);
    throw new ApiHttpError(500, 'No se pudo conectar con el motor de WhatsApp.');
  }

  let data: any = null;
  const rawText = await upstream.text();
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!upstream.ok) {
    const upstreamErr =
      (data && typeof data.error === 'string' && data.error.trim()) ||
      (data && typeof data.message === 'string' && data.message.trim()) ||
      `El motor de WhatsApp devolvió un error (${upstream.status}).`;
    const mappedStatus = upstream.status >= 400 && upstream.status < 500 ? 400 : 500;
    throw new ApiHttpError(mappedStatus, upstreamErr);
  }

  return data && typeof data === 'object' ? data : {};
};

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Proxy ligero para consultas DNIT/RUC en desarrollo y producción
  app.use('/api/dnit', async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    try {
      const targetPath = req.originalUrl.replace(/^\/api\/dnit/, '') || '/';
      const upstream = await fetch(`https://ruc.sun.com.py${targetPath}`, {
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      const body = await upstream.text();
      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.send(body);
    } catch (error) {
      console.error('[/api/dnit] Proxy error:', error);
      res.status(502).json({ error: 'No se pudo consultar el servicio externo de RUC.' });
    }
  });

  // 1. Streaming de El Oráculo / Chat de O.L.G.A.
  app.post('/api/gemini/chat-stream', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      message?: unknown;
      history?: unknown;
      lang?: unknown;
      attachments?: unknown;
      systemInstructionExtra?: unknown;
      timeoutMs?: unknown;
    };

    const message = typeof body?.message === 'string' ? body.message : '';
    const lang = typeof body?.lang === 'string' && body.lang.trim() ? body.lang.trim() : 'es';
    const systemInstructionExtra =
      typeof body?.systemInstructionExtra === 'string'
        ? body.systemInstructionExtra.slice(0, 40000)
        : undefined;
    const rawTimeout = typeof body?.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
      ? body.timeoutMs
      : CHAT_TIMEOUT_MS;
    const timeoutMs = Math.min(Math.max(rawTimeout, 5000), 120000);

    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];
    const userParts: ChatPartInput[] = [];
    if (message) {
      userParts.push({ text: message.slice(0, 60000) });
    }

    try {
      for (const att of rawAttachments) {
        if (!att || typeof att !== 'object') continue;
        const attObj = att as { data?: unknown; mimeType?: unknown; name?: unknown };
        const cleanData = cleanBase64Payload(attObj.data);
        if (!cleanData) continue;
        const mimeType = normalizeMime(attObj.mimeType, typeof attObj.name === 'string' ? attObj.name : undefined);
        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          res.status(400).json({ error: `Tipo de archivo no admitido: ${mimeType}` });
          return;
        }
        userParts.push({
          inlineData: { data: cleanData, mimeType },
        });
      }
    } catch (err) {
      if (err instanceof ApiHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Adjuntos inválidos.' });
      return;
    }

    if (userParts.length === 0) {
      res.status(400).json({ error: 'El mensaje o archivo adjunto no puede estar vacío.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const normalizedHistory = normalizeGeminiHistory(body?.history);
    const combinedSystemInstruction = systemInstructionExtra
      ? `${getSystemInstruction(lang)}\n\n${systemInstructionExtra}`
      : getSystemInstruction(lang);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const controller = new AbortController();
    let timedOut = false;
    let clientClosed = false;
    let timerCleared = false;

    const clearSafetyTimer = () => {
      if (!timerCleared) {
        timerCleared = true;
        clearTimeout(timeoutId);
      }
    };

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('TIMEOUT_90S'));
    }, timeoutMs);

    const keepaliveId = setInterval(() => {
      if (!res.writableEnded && !clientClosed) {
        res.write(': keepalive\n\n');
      }
    }, 5000);

    const onClientClose = () => {
      if (!res.writableEnded) {
        clientClosed = true;
        clearSafetyTimer();
        clearInterval(keepaliveId);
        controller.abort(new Error('CLIENT_ABORT'));
      }
    };
    req.on('aborted', onClientClose);
    res.on('close', onClientClose);

    const raceWithTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        if (timedOut || clientClosed || controller.signal.aborted) {
          reject(new Error(timedOut ? 'TIMEOUT_90S' : 'ABORTED'));
          return;
        }
        const localTimer = setTimeout(() => reject(new Error(label)), ms);
        const onAbort = () => {
          clearTimeout(localTimer);
          reject(new Error(timedOut ? 'TIMEOUT_90S' : 'ABORTED'));
        };
        controller.signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
          (val) => {
            clearTimeout(localTimer);
            controller.signal.removeEventListener('abort', onAbort);
            resolve(val);
          },
          (err) => {
            clearTimeout(localTimer);
            controller.signal.removeEventListener('abort', onAbort);
            reject(err);
          }
        );
      });

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded && !clientClosed) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      let lastError: unknown = null;
      let completed = false;
      const contents = [...normalizedHistory, { role: 'user', parts: userParts }];

      for (const model of COMPATIBLE_MODELS) {
        if (timedOut || clientClosed || controller.signal.aborted) break;

        const modelConfig: Record<string, unknown> = {
          systemInstruction: combinedSystemInstruction,
          maxOutputTokens: 4096,
        };

        if (model === 'gemini-4-hydrogen') {
          modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        let emittedAnyText = false;
        let skipSameModelGenerateFallback = false;
        const attemptController = new AbortController();
        const onParentAbort = () => attemptController.abort(controller.signal.reason);
        controller.signal.addEventListener('abort', onParentAbort, { once: true });

        try {
          const stream = await raceWithTimeout(
            ai.models.generateContentStream({
              model,
              contents,
              config: {
                ...modelConfig,
                abortSignal: attemptController.signal,
              },
            }),
            15000,
            'STREAM_OPEN_TIMEOUT'
          );

          const iterator = stream[Symbol.asyncIterator]();
          while (true) {
            if (clientClosed) break;
            if (timedOut || controller.signal.aborted) {
              throw new Error('TIMEOUT_90S');
            }

            const step = emittedAnyText
              ? await raceWithTimeout(iterator.next(), timeoutMs, 'TIMEOUT_90S')
              : await raceWithTimeout(iterator.next(), 15000, 'STREAM_FIRST_CHUNK_TIMEOUT');

            if (step.done) break;
            clearSafetyTimer();

            const chunkText = step.value?.text || '';
            if (chunkText) {
              emittedAnyText = true;
              writeEvent({ text: chunkText });
            }
          }

          if (emittedAnyText) {
            clearSafetyTimer();
            completed = true;
            controller.signal.removeEventListener('abort', onParentAbort);
            break;
          }
        } catch (streamErr: unknown) {
          attemptController.abort();
          lastError = streamErr;
          const streamErrMsg = (streamErr as { message?: string })?.message || '';
          const streamStatus = extractUpstreamStatus(streamErr);
          console.error(`[sendMessageToOlga] Detalle técnico stream en ${model} (${streamStatus}):`, streamErr);

          if (clientClosed) break;
          if (timedOut || streamErrMsg === 'TIMEOUT_90S') {
            writeEvent({
              error: 'La consulta superó el tiempo máximo de espera (90s). Por favor, intenta nuevamente.',
              status: 504,
            });
            res.end();
            return;
          }

          if (streamStatus === 400 || streamStatus === 401 || streamStatus === 403) {
            const formatted = formatGeminiError(streamErr);
            writeEvent({ error: formatted.message, status: formatted.status });
            res.end();
            return;
          }

          // Si el modelo respondió con error de API (429/503/404), pasar directo al siguiente modelo
          if (streamStatus === 429 || streamStatus === 503 || streamStatus === 404) {
            skipSameModelGenerateFallback = true;
          }
        } finally {
          controller.signal.removeEventListener('abort', onParentAbort);
        }

        // Si el stream se estancó sin error explícito de API, usar generateContent como respaldo inmediato
        if (!emittedAnyText && !skipSameModelGenerateFallback && !timedOut && !clientClosed && !controller.signal.aborted) {
          try {
            const response = await raceWithTimeout(
              ai.models.generateContent({
                model,
                contents,
                config: modelConfig,
              }),
              60000,
              'GENERATE_TIMEOUT'
            );

            const fullText = response?.text || '';
            if (fullText) {
              clearSafetyTimer();
              writeEvent({ text: fullText });
              completed = true;
              break;
            }
          } catch (error: unknown) {
            lastError = error;
            const formatted = formatGeminiError(error);
            console.error(`[sendMessageToOlga] Detalle técnico en modelo ${model} (${formatted.status}):`, error);

            if (clientClosed) break;

            const errObj = error as { message?: string };
            if (timedOut || errObj?.message === 'TIMEOUT_90S') {
              writeEvent({
                error: 'La consulta superó el tiempo máximo de espera (90s). Por favor, intenta nuevamente.',
                status: 504,
              });
              res.end();
              return;
            }

            if (formatted.status === 400 || formatted.status === 401 || formatted.status === 403) {
              writeEvent({ error: formatted.message, status: formatted.status });
              res.end();
              return;
            }
          }
        }
      }

      if (completed && !clientClosed) {
        writeEvent({ done: true });
      } else if (!clientClosed) {
        console.error('[sendMessageToOlga] Falla final tras agotar modelos:', lastError);
        const formatted = formatGeminiError(lastError, 'No se pudo conectar con El Oráculo en este momento. Por favor, intenta nuevamente.');
        writeEvent({
          error: formatted.message,
          status: formatted.status,
        });
      }

      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearSafetyTimer();
      clearInterval(keepaliveId);
      req.off('aborted', onClientClose);
      res.off('close', onClientClose);
    }
  });

  // 2. Resumen ejecutivo con tool call
  app.post('/api/gemini/executive-summary', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      history?: unknown;
      currentUrl?: unknown;
    };

    const currentUrl = typeof body?.currentUrl === 'string' ? body.currentUrl.slice(0, 2000) : '';
    const history = Array.isArray(body?.history) ? body.history : [];

    try {
      const ai = getGenAI();
      for (const model of COMPATIBLE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              ...history,
              {
                role: 'user',
                parts: [
                  {
                    text: `Genera ahora un resumen ejecutivo ultra-detallado de esta conversación para ser enviado por correo a olga.ihara.feltes@gmail.com. 
Incluye datos del cliente, documentos anexados y el objetivo del trámite o inversión.
Usa la herramienta 'sendConversationSummaryToEmail'.
IMPORTANTE: Incluye este enlace en el campo 'conversationLink' para que la Administración pueda acceder a la conversación: ${currentUrl}`,
                  },
                ],
              },
            ],
            config: {
              systemInstruction:
                'Eres el asistente de automatización de O.L.G.A.. Tu objetivo es consolidar la conversación para archivo y seguimiento. Habla siempre en español.',
              tools: [{ functionDeclarations: [sendConversationSummaryToEmailDeclaration] }],
              maxOutputTokens: 4096,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });
          res.json({ functionCalls: response.functionCalls ?? null });
          return;
        } catch (error: unknown) {
          console.error(`[generateExecutiveSummary] Detalle técnico con ${model}:`, error);
        }
      }
      res.json({ functionCalls: null });
    } catch (err: unknown) {
      console.error('[generateExecutiveSummary] Error final:', err);
      const formatted = err instanceof ApiHttpError
        ? { status: err.status, message: err.message }
        : formatGeminiError(err, 'No se pudo generar el resumen ejecutivo en este momento.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Análisis OCR/estructurado de Pagarés
  app.post('/api/gemini/analyze-pagare', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      fileBase64?: unknown;
      mimeType?: unknown;
    };

    if (typeof body?.fileBase64 !== 'string' || !body.fileBase64.trim()) {
      res.status(400).json({ error: 'Se requiere fileBase64 para analizar el pagaré.' });
      return;
    }

    let cleanData: string;
    try {
      cleanData = cleanBase64Payload(body.fileBase64);
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 400;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const cleanMime = normalizeMime(body?.mimeType);
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      res.status(400).json({ error: `Formato de archivo no admitido: ${cleanMime}` });
      return;
    }

    try {
      const ai = getGenAI();
      for (const model of COMPATIBLE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Analiza este documento PDF o imagen de un Pagaré (Promissory Note).
Extrae la siguiente información y preséntala EXACTAMENTE en formato JSON plano sin bloques de código markdown (\`\`\`json):
{
  "valorTotal": "monto numérico EXACTO en enteros (ignorar centavos, sin puntos ni símbolos). Ej si es 300.00 devuelve 300",
  "moneda": "PYG o USD u otra",
  "numeroCertificadoFirmas": "numero de 9 dígitos",
  "acreedorBeneficiario": {
    "nombre": "Nombre de a quién se debe pagar",
    "documento": "Documento si aparece, null si no"
  },
  "deudorPrincipal": {
    "nombre": "Nombre del deudor principal",
    "documento": "Documento/CI del deudor principal",
    "domicilio": "Domicilio del deudor principal"
  },
  "fechaPrimerPago": "Fecha de vencimiento en estricto formato YYYY-MM-DD. Si no hay fecha o es ilegible, devuelve string vacío",
  "entregaInicial": "Monto de entrega inicial en enteros (sin decimales), si no 0",
  "recomendaciones": "Alguna alerta legal breve que notes si el pagaré está incompleto o tiene borrones"
}`,
                  },
                  { inlineData: { data: cleanData, mimeType: cleanMime } },
                ],
              },
            ],
            config: {
              systemInstruction:
                "Eres O.L.G.A., experta notarial. Tu trabajo es extraer metadatos estructurados tolerando errores de OCR. Respeta estrictamente este formato JSON en tu respuesta. Para numeroCertificadoFirmas busca 'CERTIFICACION DE FIRMAS N°' y extrae los 9 dígitos que le siguen. Para deudorPrincipal busca las etiquetas Nombre, Documento y Domicilio al final de la firma. Si un dato no existe, devuélvelo como nulo.",
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          if (response.text) {
            try {
              const text = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(text);
              res.json({ data: parsed });
              return;
            } catch (parseError) {
              console.error('JSON parse error: ', parseError, response.text);
              throw new Error('Error parsing JSON response: ' + parseError);
            }
          }
        } catch (error: unknown) {
          console.error(`[analyzePagareImage] Detalle técnico con ${model}:`, error);
          if (model === COMPATIBLE_MODELS[COMPATIBLE_MODELS.length - 1]) {
            throw error;
          }
        }
      }

      res.json({ data: null });
    } catch (err: unknown) {
      console.error('[analyzePagareImage] Error final:', err);
      const formatted = err instanceof ApiHttpError
        ? { status: err.status, message: err.message }
        : formatGeminiError(err, 'No se pudo analizar el documento en este momento. Intenta nuevamente.');
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Redacción asistida de Escritos Oficiales
  app.post('/api/gemini/redactar-escrito', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      prompt?: unknown;
      contextoActual?: unknown;
      attachments?: unknown;
      esAbogado?: unknown;
    };

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const contextoActual = typeof body?.contextoActual === 'string' ? body.contextoActual : undefined;
    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];
    const esAbogado = Boolean(body?.esAbogado);

    if (!prompt && rawAttachments.length === 0) {
      res.status(400).json({ error: 'Se requiere una instrucción o un archivo adjunto para redactar.' });
      return;
    }

    const userParts: ChatPartInput[] = [];
    let instruccionCompleta = esAbogado
      ? `Actúa como O.L.G.A., abogada litigante senior experta en derecho civil, procesal civil, laboral y comercial de la República del Paraguay.
Tu tarea es redactar o adaptar con máxima precisión jurídica el escrito judicial, contestación, impulso, demanda o contrato privado solicitado por el usuario.
Usa terminología técnica jurídica paraguaya, redacción completa y profesional.
REGLAS DE FORMATO OBLIGATORIAS:
- PROHIBIDO usar formato LaTeX o signos "$" para numeración (como "$N^{\circ}$"); escribe siempre "N.º" o "N°" en texto plano.
- PROHIBIDO usar etiquetas HTML (<br>, <p>, <div>, &nbsp;) o bloques de código markdown (\`\`\`).
- Redacta títulos y encabezados completos sin recortarlos ni abreviarlos abruptamente.

SOLICITUD DE REDACCIÓN:
${prompt}
`
      : `Actúa como O.L.G.A., abogada y escribana experta en derecho notarial y civil de la República del Paraguay.
Tu tarea es redactar o adaptar con máxima precisión jurídica y formalidad notarial el documento, contrato o cláusula solicitado por el usuario.
Usa terminología técnica notarial paraguaya, cláusulas claras y precisas, y estilo profesional.

SOLICITUD DE REDACCIÓN:
${prompt}
`;

    if (contextoActual && contextoActual.trim().length > 0) {
      instruccionCompleta += `\nDOCUMENTO / TEXTO ACTUAL EN EL EDITOR (PARA REFERENCIA O INSERCIÓN):\n"""\n${contextoActual.slice(0, 15000)}\n"""\n`;
    }

    userParts.push({ text: instruccionCompleta });

    try {
      for (const att of rawAttachments) {
        if (!att || typeof att !== 'object') continue;
        const attObj = att as { data?: unknown; mimeType?: unknown; name?: unknown };
        if (!attObj.data) continue;
        const cleanData = cleanBase64Payload(attObj.data);
        if (!cleanData) continue;
        const mime = normalizeMime(attObj.mimeType, typeof attObj.name === 'string' ? attObj.name : undefined);
        if (!ALLOWED_MIME_TYPES.has(mime)) {
          res.status(400).json({ error: 'Uno de los archivos adjuntos tiene un formato no admitido. Utilice PDF o imágenes JPG/PNG.' });
          return;
        }
        userParts.push({
          inlineData: { data: cleanData, mimeType: mime },
        });
      }
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 400;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    if (esAbogado) {
      const abogadoModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      try {
        const { response } = await generateContentWithModelFallback(
          ai,
          abogadoModels,
          (model) => {
            const modelConfig: Record<string, unknown> = {
              systemInstruction:
                'Eres O.L.G.A., redactora jurídica experta de Paraguay. Genera escritos judiciales y legales completos, formales y listos para editar e imprimir. Prohibido usar LaTeX o expresiones como $N^{\\circ}$ (usa siempre "N.º"), prohibido usar HTML o markdown de código, y nunca cortes títulos ni encabezados.',
              maxOutputTokens: 8192,
            };
            if (model === 'gemini-4-hydrogen') {
              modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }
            return {
              contents: [{ role: 'user', parts: userParts }],
              config: modelConfig,
            };
          },
          { logLabel: 'O.L.G.A. IA Abogado', enableOverloadRetry: true }
        );
        res.json({ text: limpiarLatexJuridicoServer(response.text) });
        return;
      } catch (err: unknown) {
        const lastMsg = (err as { message?: string })?.message || '';
        if (lastMsg.includes('MIME') || lastMsg.includes('unsupported')) {
          res.status(400).json({
            error: 'Uno de los archivos adjuntos tiene un formato no admitido. Utilice PDF o imágenes JPG/PNG.',
          });
        } else {
          const formatted = formatGeminiError(
            err,
            'No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.'
          );
          res.status(formatted.status).json({ error: formatted.message });
        }
        return;
      }
    }

    let lastError: unknown = null;
    for (const model of COMPATIBLE_MODELS) {
      try {
        const modelConfig: Record<string, unknown> = {
          systemInstruction:
            'Eres O.L.G.A., redactora legal y notarial de Paraguay. Genera redacciones sólidas, formales, listas para su revisión y uso notarial administrativo. No incluyas introducciones conversacionales innecesarias; entrega directamente el texto legal o la cláusula redactada.',
          maxOutputTokens: 4096,
        };

        if (model === 'gemini-4-hydrogen') {
          modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: userParts }],
          config: modelConfig,
        });

        if (response && response.text) {
          res.json({ text: response.text });
          return;
        }
      } catch (err: unknown) {
        lastError = err;
        console.error(`[O.L.G.A. IA] Detalle técnico en modelo '${model}':`, err);
      }
    }

    const lastMsg = (lastError as { message?: string })?.message || '';
    if (lastMsg.includes('MIME') || lastMsg.includes('unsupported')) {
      res.status(400).json({
        error: 'Uno de los archivos adjuntos tiene un formato no admitido. Utilice PDF o imágenes JPG/PNG.',
      });
    } else {
      const formatted = formatGeminiError(
        lastError,
        'No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4b. Redacción asistida de Notificaciones / Avisos Institucionales (SuperAdmin)
  app.post('/api/gemini/draft-notification', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      draft?: unknown;
      type?: unknown;
      targetSegment?: unknown;
    };

    const draft = typeof body?.draft === 'string' ? body.draft.trim().slice(0, 2000) : '';
    const type = typeof body?.type === 'string' ? body.type.trim().slice(0, 40) : 'informativo';
    const targetSegment = typeof body?.targetSegment === 'string' ? body.targetSegment.trim().slice(0, 40) : 'all';

    if (!draft) {
      res.status(400).json({ error: 'Escribe una idea o borrador corto antes de redactar con IA.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const segmentHintMap: Record<string, string> = {
      all: 'Todos los usuarios de O.L.G.A.',
      plan_full: 'Usuarios con Plan Full',
      active: 'Clientes con suscripción activa',
      trial: 'Usuarios en período de prueba gratuita',
      expired: 'Usuarios con cuenta vencida',
      cortesia: 'Cuentas de cortesía y equipo interno',
    };
    const audienceLabel = segmentHintMap[targetSegment] || 'Usuarios de O.L.G.A.';

    const promptText = `Convierte la siguiente idea o borrador en un aviso institucional formal, claro y profesional para la plataforma O.L.G.A. Notarial (software notarial para escribanías y estudios jurídicos en Paraguay).

Categoría del aviso: ${type}
Audiencia objetivo: ${audienceLabel}
Idea del administrador:
"""
${draft}
"""

Reglas:
- El título debe ser breve, claro y directo (idealmente entre 25 y 65 caracteres, sin emojis excesivos ni signos repetidos).
- El mensaje debe tener entre 2 y 4 oraciones claras, formales (trato profesional de "estimado usuario" o tono institucional neutro) y tranquilizadoras si corresponde.
- Respeta exactamente los hechos, horarios y detalles dados en la idea. No inventes precios, fechas ni garantías que no estén en la idea.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          systemInstruction:
            'Eres O.L.G.A., asistente de comunicación institucional para escribanías y profesionales del derecho en Paraguay. Devuelve únicamente el objeto JSON solicitado con title y message en español.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Título breve y claro del aviso institucional.',
              },
              message: {
                type: Type.STRING,
                description: 'Cuerpo del aviso claro, formal y profesional.',
              },
            },
            required: ['title', 'message'],
          },
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'La IA no devolvió una redacción válida. Intenta nuevamente.' });
        return;
      }

      const parsed = JSON.parse(rawText) as { title?: unknown; message?: unknown };
      const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
      const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';

      if (!title || !message) {
        res.status(502).json({ error: 'La respuesta de IA estuvo incompleta. Intenta nuevamente.' });
        return;
      }

      res.json({ title, message });
    } catch (err: unknown) {
      console.error('[draft-notification] Error:', err);
      const formatted = formatGeminiError(
        err,
        'No se pudo redactar el aviso con IA en este momento. Puedes escribirlo manualmente.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4c. Análisis IA de Demanda / Cédula de Notificación PDF para Expedientes (Código Procesal Civil PY)
  app.post('/api/gemini/analyze-expediente-pdf', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      fileBase64?: unknown;
      mimeType?: unknown;
      fileName?: unknown;
      rolParteHint?: unknown;
      esAbogado?: unknown;
    };

    if (typeof body?.fileBase64 !== 'string' || !body.fileBase64.trim()) {
      res.status(400).json({ error: 'Se requiere el archivo PDF o imagen de la demanda/cédula para analizar.' });
      return;
    }

    let cleanData: string;
    try {
      cleanData = cleanBase64Payload(body.fileBase64);
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 400;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim().slice(0, 180) : undefined;
    const cleanMime = normalizeMime(body?.mimeType, fileName);
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      res.status(400).json({ error: `Formato no admitido (${cleanMime}). Sube un PDF o imagen JPG/PNG.` });
      return;
    }

    const rolParteHint = typeof body?.rolParteHint === 'string' ? body.rolParteHint.trim().slice(0, 60) : '';
    const esAbogado = Boolean(body?.esAbogado);

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const nowInAsuncion = new Date();
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(nowInAsuncion);

    const promptText = esAbogado
      ? `Analiza este documento o imagen para un estudio jurídico de Paraguay (puede ser una demanda, cédula de notificación judicial, providencia, auto, mandamiento, oficio, escrito, o bien un documento probatorio/constancia como cédula de identidad, recibo, factura o certificado).
FECHA ACTUAL EN PARAGUAY (REFERENCIA PARA CÓMPUTO DE PLAZOS): ${todayIso}.
${rolParteHint ? `ROL DE PARTE INDICADO POR EL USUARIO: ${rolParteHint}.` : ''}

INSTRUCCIONES DE ANÁLISIS PROCESAL PARAGUAYO (Ley N° 1.337/88 Código Procesal Civil y leyes especiales de Paraguay):
1. Extrae la carátula completa del expediente (ej: "Juan Pérez c/ Empresa X s/ Cobro de Guaraníes") o una descripción breve identificatoria si se trata de una constancia/documento de respaldo, número de expediente (si figura), año y juzgado/circunscripción judicial completo. Si el documento base trae denominaciones de juzgados extranjeros, adáptalo a la nomenclatura judicial paraguaya equivalente (ej. "Juzgado de Primera Instancia en lo Civil y Comercial" o "Juzgado de Paz").
2. Revisa estrictamente la ortografía, tildes y redacción en español formal antes de responder. NO uses sintaxis LaTeX ni signos "$" como "$N^{\circ}$" (usa siempre "N.º").
3. Clasifica el tipo de juicio en UNO de estos valores exactos: "Ordinario", "Ejecutivo", "Laboral", "Niñez y Adolescencia", "Penal", "Sucesorio", "Otro".
4. Determina el rol de parte sugerido para el cliente representado ("Demandado", "Actor / Demandante", "Tercero") según el documento.
5. Redacta un resumen técnico claro de los hechos, pretensiones, montos reclamados, documentos acompañados y puntos relevantes ("resumenHechos"), y cita brevemente los artículos aplicables del Código Procesal Civil / Ley Paraguaya si corresponden ("fundamentoCPC", o cadena vacía "" si es un documento de identidad/constancia sin trámite procesal).
6. REGLA ESTRICTA DE PLAZO PROCESAL ("plazoPrincipal"):
   - Evalúa primero si el documento es realmente un acto procesal con un plazo legal vigente o vencimiento concreto (demanda con traslado, cédula de notificación, providencia que corre traslado o intima, mandamiento, resolución apelable, etc.).
   - Si el documento NO es un acto con plazo procesal (por ejemplo: cédula de identidad, pasaporte, factura, recibo, constancia simple, poder, comprobante, certificado sin emplazamiento), devuelve ESTRICTAMENTE "plazoPrincipal": null.
   - PROHIBIDO inventar plazos, PROHIBIDO escribir títulos como "No existe plazo procesal aplicable" o "Sin plazo", y PROHIBIDO asignar la fecha de hoy (${todayIso}) por defecto cuando no haya plazo.
   - Si SÍ existe un plazo procesal real (ej. traslado de demanda ordinaria = 18 días hábiles Art. 222 CPC; excepciones ejecutivo = 5 días hábiles Art. 460 CPC; contestación laboral = 6 días hábiles; reposición = 3 días; apelación = 5 días; incidente = 5 días), calcula "fechaVencimiento" (YYYY-MM-DD) y "diasPlazo" entero positivo.
7. REGLA ESTRICTA DE IMPULSOS ("impulsosSugeridos"):
   - Solo sugiere impulsos procesales concretos cuando el documento corresponda a un trámite judicial que realmente amerite actuaciones futuras. Si es un documento de identidad, constancia, recibo o comprobante sin plazo ni actuación pendiente, devuelve "impulsosSugeridos": [].`
      : `Analiza este documento judicial de Paraguay (puede ser un escrito de demanda, cédula de notificación judicial, providencia, mandamiento de intimación o resolución).
FECHA ACTUAL EN PARAGUAY (REFERENCIA PARA CÓMPUTO DE PLAZOS): ${todayIso}.
${rolParteHint ? `ROL DE PARTE INDICADO POR EL USUARIO: ${rolParteHint}.` : ''}

INSTRUCCIONES DE ANÁLISIS PROCESAL PARAGUAYO (Ley N° 1.337/88 Código Procesal Civil y leyes especiales de Paraguay):
1. Extrae la carátula completa del expediente (ej: "Juan Pérez c/ Empresa X s/ Cobro de Guaraníes"), número de expediente (si figura), año y juzgado/circunscripción judicial completo. Si el documento base trae denominaciones de juzgados extranjeros, adáptalo a la nomenclatura judicial paraguaya equivalente (ej. "Juzgado de Primera Instancia en lo Civil y Comercial" o "Juzgado de Paz").
2. Revisa estrictamente la ortografía, tildes y redacción en español formal antes de responder.
3. Clasifica el tipo de juicio en UNO de estos valores exactos: "Ordinario", "Ejecutivo", "Laboral", "Niñez y Adolescencia", "Penal", "Sucesorio", "Otro".
4. Determina el rol de parte sugerido para el cliente representado ("Demandado", "Actor / Demandante", "Tercero") según la cédula/demanda (si es cédula de traslado de demanda o citación/remate, normalmente es "Demandado"; si es inicio de demanda o providencia a pedido del actor, "Actor / Demandante").
5. Redacta un resumen técnico claro de los hechos, pretensiones, montos reclamados, documentos acompañados y puntos críticos de defensa o impulso ("resumenHechos"), y cita brevemente los artículos aplicables del Código Procesal Civil / Ley Paraguaya ("fundamentoCPC").
6. Calcula el plazo procesal principal ("plazoPrincipal"):
   - Ejemplos CPC Paraguay: Traslado de demanda ordinaria = 18 días hábiles (Art. 222 CPC); Oposición de excepciones en juicio ejecutivo = 5 días hábiles (Art. 460 CPC); Contestación laboral = 6 días hábiles; Recurso de reposición = 3 días hábiles; Apelación = 5 días hábiles; Traslado de incidentes = 5 días hábiles.
   - Si en el documento aparece fecha de notificación o cargo, úsala como punto de partida; si no aparece, estima a partir de hoy (${todayIso}) contando días hábiles aproximados (lunes a viernes) para entregar una "fechaVencimiento" en estricto formato YYYY-MM-DD.
7. Sugiere entre 2 y 4 "impulsosSugeridos" ordenados cronológicamente (ej: "Ofrecimiento y diligenciamiento de pruebas", "Pedido de apertura a prueba / urgimiento", "Alegatos de bien probado", "Pedido de autos para sentencia"), cada uno con "titulo", "diasPlazo" (entero positivo), "fechaVencimiento" (YYYY-MM-DD) y "tipo": "impulso".`;

    const expedienteModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

    const buildSchema = (): Record<string, unknown> => ({
      type: Type.OBJECT,
      properties: {
        caratula: { type: Type.STRING, description: 'Carátula completa de la causa.' },
        nroExpediente: { type: Type.STRING, description: 'Número de expediente o vacío si no consta.' },
        anio: { type: Type.STRING, description: 'Año del expediente (4 dígitos).' },
        juzgado: { type: Type.STRING, description: 'Juzgado, secretaría y circunscripción judicial.' },
        tipoJuicio: {
          type: Type.STRING,
          description: 'Uno de: Ordinario, Ejecutivo, Laboral, Niñez y Adolescencia, Penal, Sucesorio, Otro.',
        },
        rolParteSugerido: {
          type: Type.STRING,
          description: 'Uno de: Demandado, Actor / Demandante, Tercero.',
        },
        resumenHechos: {
          type: Type.STRING,
          description: 'Resumen técnico jurídico de hechos, pretensiones y riesgos procesales.',
        },
        fundamentoCPC: {
          type: Type.STRING,
          description: 'Artículos y plazos aplicables del Código Procesal Civil del Paraguay.',
        },
        plazoPrincipal: {
          type: Type.OBJECT,
          ...(esAbogado ? { nullable: true } : {}),
          properties: {
            titulo: { type: Type.STRING },
            diasPlazo: { type: Type.NUMBER },
            fechaVencimiento: { type: Type.STRING, description: 'Fecha ISO YYYY-MM-DD' },
            tipo: { type: Type.STRING, description: 'plazo_legal' },
          },
          required: ['titulo', 'diasPlazo', 'fechaVencimiento', 'tipo'],
        },
        impulsosSugeridos: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              titulo: { type: Type.STRING },
              diasPlazo: { type: Type.NUMBER },
              fechaVencimiento: { type: Type.STRING, description: 'Fecha ISO YYYY-MM-DD' },
              tipo: { type: Type.STRING, description: 'impulso' },
            },
            required: ['titulo', 'diasPlazo', 'fechaVencimiento', 'tipo'],
          },
        },
      },
      required: esAbogado
        ? ['caratula', 'juzgado', 'tipoJuicio', 'rolParteSugerido', 'resumenHechos', 'impulsosSugeridos']
        : ['caratula', 'juzgado', 'tipoJuicio', 'rolParteSugerido', 'resumenHechos', 'plazoPrincipal', 'impulsosSugeridos'],
    });

    const sanitizeAbogadoAnalysis = (parsed: any) => {
      if (!parsed || typeof parsed !== 'object') return parsed;
      const cleanStr = (v: unknown) => (typeof v === 'string' ? limpiarLatexJuridicoServer(v).trim() : '');
      const rawPlazo = parsed.plazoPrincipal && typeof parsed.plazoPrincipal === 'object' ? parsed.plazoPrincipal : null;
      const cleanPlazo =
        rawPlazo && !isInvalidOrFakePlazoAbogado(rawPlazo, todayIso)
          ? {
              ...rawPlazo,
              titulo: cleanStr(rawPlazo.titulo),
              diasPlazo: Math.max(1, Number(rawPlazo.diasPlazo) || 1),
              fechaVencimiento: typeof rawPlazo.fechaVencimiento === 'string' ? rawPlazo.fechaVencimiento.trim().slice(0, 10) : '',
              tipo: rawPlazo.tipo === 'impulso' ? 'impulso' : 'plazo_legal',
            }
          : null;

      const rawImpulsos = Array.isArray(parsed.impulsosSugeridos) ? parsed.impulsosSugeridos : [];
      const cleanImpulsos = rawImpulsos
        .filter((imp: any) => !isInvalidOrFakePlazoAbogado(imp, todayIso))
        .map((imp: any) => ({
          ...imp,
          titulo: cleanStr(imp.titulo),
          diasPlazo: Math.max(1, Number(imp.diasPlazo) || 1),
          fechaVencimiento: typeof imp.fechaVencimiento === 'string' ? imp.fechaVencimiento.trim().slice(0, 10) : '',
          tipo: imp.tipo === 'plazo_legal' ? 'plazo_legal' : 'impulso',
        }));

      return {
        ...parsed,
        caratula: cleanStr(parsed.caratula),
        nroExpediente: cleanStr(parsed.nroExpediente),
        anio: cleanStr(parsed.anio),
        juzgado: cleanStr(parsed.juzgado),
        resumenHechos: cleanStr(parsed.resumenHechos),
        fundamentoCPC: cleanStr(parsed.fundamentoCPC),
        plazoPrincipal: cleanPlazo,
        impulsosSugeridos: cleanImpulsos,
      };
    };

    try {
      const { response } = await generateContentWithModelFallback(
        ai,
        expedienteModels,
        (model) => ({
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                { inlineData: { data: cleanData, mimeType: cleanMime } },
              ],
            },
          ],
          config: {
            systemInstruction:
              'Eres O.L.G.A., abogada litigante senior experta en derecho procesal civil, laboral y ejecutivo de la República del Paraguay. Analizas documentos y demandas con precisión y devuelves únicamente el JSON estructurado.',
            responseMimeType: 'application/json',
            responseSchema: buildSchema(),
            maxOutputTokens: 4096,
            ...(model === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        { logLabel: 'analyze-expediente-pdf', enableOverloadRetry: esAbogado }
      );

      const rawText = (response?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        res.json({ data: esAbogado ? sanitizeAbogadoAnalysis(parsed) : parsed });
        return;
      }
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'No se pudo analizar la demanda o cédula en este momento. Intenta nuevamente.'
      );
      res.status(formatted.status).json({ error: formatted.message });
      return;
    }

    res.status(502).json({ error: 'No se pudo analizar la demanda o cédula en este momento. Intenta nuevamente.' });
  });

  // 4d. Redacción IA de Escritos Judiciales (Contestación de Demanda o Impulso Procesal)
  app.post('/api/gemini/redactar-escrito-judicial', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      expediente?: Record<string, unknown>;
      modo?: unknown;
      plazoObjetivo?: Record<string, unknown>;
      estudio?: Record<string, unknown>;
      instruccionesAdicionales?: unknown;
      memoriaDocumentos?: unknown;
      esAbogado?: unknown;
    };

    const expediente = body?.expediente && typeof body.expediente === 'object' ? body.expediente : null;
    if (!expediente || typeof expediente.caratula !== 'string' || !expediente.caratula.trim()) {
      res.status(400).json({ error: 'Se requieren los datos del expediente (al menos carátula) para redactar el escrito.' });
      return;
    }

    const modo = body?.modo === 'impulso' ? 'impulso' : 'contestacion';
    const esAbogado = Boolean(body?.esAbogado);
    const plazoObjetivo = body?.plazoObjetivo && typeof body.plazoObjetivo === 'object' ? body.plazoObjetivo : null;
    const estudio = body?.estudio && typeof body.estudio === 'object' ? body.estudio : null;
    const instruccionesAdicionales =
      typeof body?.instruccionesAdicionales === 'string'
        ? body.instruccionesAdicionales.trim().slice(0, 1200)
        : '';

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const fechaHoyParaguay = new Date().toLocaleDateString('es-PY', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Asuncion',
    });

    const caratula = String(expediente.caratula || '').trim();
    const nroExpediente = String(expediente.nroExpediente || 'S/N').trim();
    const anio = String(expediente.anio || new Date().getFullYear()).trim();
    const juzgado = String(expediente.juzgado || 'Juzgado de Primera Instancia en lo Civil y Comercial').trim();
    const tipoJuicio = String(expediente.tipoJuicio || 'Ordinario').trim();
    const rolParte = String(expediente.rolParte || 'Demandado').trim();
    const estado = String(expediente.estado || 'En trámite').trim();
    const clienteNombre = String(expediente.clienteNombre || '[NOMBRE COMPLETO DEL CLIENTE / MANDANTE]').trim();
    const notas = String(expediente.notas || '').trim();

    const ultimoAnalisis =
      expediente.ultimoAnalisisIA && typeof expediente.ultimoAnalisisIA === 'object'
        ? (expediente.ultimoAnalisisIA as Record<string, unknown>)
        : null;
    const resumenHechos = ultimoAnalisis?.resumenHechos ? String(ultimoAnalisis.resumenHechos).slice(0, 6000) : '';
    const fundamentoCPC = ultimoAnalisis?.fundamentoCPC ? String(ultimoAnalisis.fundamentoCPC).slice(0, 2000) : '';

    // Memoria acumulada del expediente (EXCLUSIVO ABOGADOS)
    let memoriaAcumuladaBloque = '';
    if (esAbogado) {
      const memoriaItems: string[] = [];
      const seenKeys = new Set<string>();
      const pushMem = (
        titulo: string,
        origen: string,
        fecha: string,
        resumen: string,
        fundamento: string,
        extracto: string
      ) => {
        const cleanTitle = titulo.trim() || 'Documento del expediente';
        const cleanBody = (resumen || extracto || '').trim();
        if (!cleanBody) return;
        const dedupKey = `${cleanTitle.toLowerCase()}::${cleanBody.slice(0, 80).toLowerCase()}`;
        if (seenKeys.has(dedupKey)) return;
        seenKeys.add(dedupKey);
        const metaParts = [origen ? `Origen: ${origen}` : '', fecha ? `Fecha: ${fecha.slice(0, 10)}` : '']
          .filter(Boolean)
          .join(' | ');
        const lines = [
          `[Doc ${memoriaItems.length + 1}] ${cleanTitle}${metaParts ? ` (${metaParts})` : ''}`,
          cleanBody.slice(0, 1600),
          fundamento ? `Base/CPC: ${fundamento.slice(0, 400)}` : '',
        ].filter(Boolean);
        memoriaItems.push(lines.join('\n'));
      };

      const bodyMemList = Array.isArray(body?.memoriaDocumentos) ? body.memoriaDocumentos : [];
      bodyMemList.forEach((m: any) => {
        if (!m || typeof m !== 'object') return;
        pushMem(
          String(m.titulo || m.archivoNombre || ''),
          String(m.parteOrigen || 'General'),
          String(m.fecha || m.analizadoAt || ''),
          String(m.resumen || m.resumenHechos || ''),
          String(m.fundamentoCPC || ''),
          String(m.extracto || '')
        );
      });

      const expHistorial = Array.isArray(expediente.historialDocumentos)
        ? expediente.historialDocumentos
        : [];
      expHistorial.forEach((h: any) => {
        if (!h || typeof h !== 'object') return;
        pushMem(
          String(h.archivoNombre || h.tipoActo || ''),
          String(h.parteOrigen || 'General'),
          String(h.analizadoAt || ''),
          String(h.resumenHechos || ''),
          String(h.fundamentoCPC || ''),
          ''
        );
      });

      if (memoriaItems.length > 0) {
        memoriaAcumuladaBloque = memoriaItems.join('\n\n---\n\n').slice(0, 11000);
      }
    }

    const nombreEstudio = String(estudio?.razonSocial || estudio?.nombre || '[ESTUDIO JURÍDICO / ABOGADO PATROCINANTE]').trim();
    const matricula = String(estudio?.matricula || '[MATRÍCULA CSJ N.º ____]').trim();
    const ciudad = String(estudio?.ciudad || 'Asunción').trim();

    const objetivoTitulo = plazoObjetivo?.titulo ? String(plazoObjetivo.titulo).trim() : '';
    const objetivoVenc = plazoObjetivo?.fechaVencimiento ? String(plazoObjetivo.fechaVencimiento).trim() : '';

    const formatoAbogadoExtra = esAbogado
      ? `\n- PROHIBIDO usar sintaxis LaTeX o delimitadores "$" como "$N^{\circ}$" (escribe siempre "N.º" o "N°" en texto plano).\n- Redacta el título, el encabezado "OBJETO: ..." y la carátula completos, sin recortes ni abreviaturas abruptas.\n- REGLA DE MEMORIA ACUMULADA Y DIFERENCIACIÓN DE PARTES: Si existe historial acumulado del expediente, integra todos los documentos y actuaciones previas sin ignorar constancias anteriores. Identifica y diferencia expresamente QUÉ ALEGÓ, RECLAMÓ u OFRECIÓ LA PARTE ADVERSA frente a QUÉ ALEGÓ, NEGÓ u OFRECIÓ NUESTRA PARTE (${rolParte}), evitando contradicciones con escritos o pruebas ya incorporadas al expediente.`
      : '';

    const promptText =
      modo === 'contestacion'
        ? `Redacta un escrito judicial formal y completo de CONTESTACIÓN DE DEMANDA (o Oposición de Excepciones / Contestación según corresponda al tipo de juicio "${tipoJuicio}") conforme al Código Procesal Civil de la República del Paraguay (Ley N° 1.337/88) y normas concordantes.

DATOS DEL EXPEDIENTE:
- Carátula: "${caratula}"
- Expediente N.º: ${nroExpediente} / Año: ${anio}
- Juzgado / Tribunal: ${juzgado}
- Tipo de Juicio: ${tipoJuicio}
- Rol que representamos: ${rolParte}
- Estado procesal actual: ${estado}
- Cliente / Mandante: ${clienteNombre}
- Abogado / Estudio Jurídico: ${nombreEstudio} (Matrícula CSJ: ${matricula})
- Ciudad y Fecha de referencia en Paraguay: ${ciudad}, ${fechaHoyParaguay}
${resumenHechos ? `- Último análisis / documento reciente:\n${resumenHechos}` : ''}
${fundamentoCPC ? `- Fundamento CPC detectado:\n${fundamentoCPC}` : ''}
${memoriaAcumuladaBloque ? `\nMEMORIA ACUMULADA DEL EXPEDIENTE (TODOS LOS DOCUMENTOS Y ACTUACIONES ANALIZADAS/VINCULADAS):\n${memoriaAcumuladaBloque}` : ''}
${notas ? `- Notas adicionales del estudio:\n${notas}` : ''}

ESTRUCTURA OBLIGATORIA PARAGUAYA:
1. Encabezado profesional con "OBJETO: CONTESTAR DEMANDA." (o "OPONER EXCEPCIONES Y CONTESTAR DEMANDA" si aplica).
2. "SEÑOR/A JUEZ/A:" (dirigido al ${juzgado}).
3. Comparecencia del Abogado/Parte con domicilio procesal constituido en el radio del Juzgado (${ciudad}).
4. "I. PERSONERÍA / OBJETO:"
5. "II. NEGATIVA GENERAL Y PORMENORIZADA DE LOS HECHOS:" (negación categórica y defensa técnica articulada contra los hechos expuestos).
6. "III. DERECHO:" (fundamentación sólida con citas pertinentes de la Constitución Nacional, Código Civil Ley N° 1.183/85 y Código Procesal Civil Ley N° 1.337/88, Art. 235 y concordantes).
7. "IV. OFRECIMIENTO DE PRUEBAS:" (documental, instrumental, informativa, confesoria/testifical según corresponda, dejando [completar si falta detalle]).
8. "V. PETITORIO:" numerado claro (tener por presentado, por contestada la demanda, por ofrecidas las pruebas, y oportunamente rechazar la demanda con costas).
9. Cierre clásico paraguayo: "PROVEER DE CONFORMIDAD Y SERÁ JUSTICIA."
10. Bloque de firma limpio sin HTML.

REGLAS DE CALIDAD LINGÜÍSTICA Y JURISDICCIÓN PARAGUAYA (OBLIGATORIAS):
- Revisa con rigor absoluto la ortografía estricta en español, acentuación (tildes), puntuación y concordancia gramatical.
- Adapta cualquier denominación de juzgado o término procesal extranjero que aparezca en el documento base a la jurisdicción paraguaya (por ejemplo: Juzgado de Primera Instancia en lo Civil y Comercial, Juzgado de Primera Instancia en lo Laboral, Juzgado de Paz, Tribunal de Apelación o Corte Suprema de Justicia, según corresponda).${formatoAbogadoExtra}
${instruccionesAdicionales ? `- Indicaciones específicas del caso: ${instruccionesAdicionales}` : ''}`
        : `Redacta un escrito judicial formal de IMPULSO PROCESAL conforme al Código Procesal Civil de la República del Paraguay (Ley N° 1.337/88).

DATOS DEL EXPEDIENTE:
- Carátula: "${caratula}"
- Expediente N.º: ${nroExpediente} / Año: ${anio}
- Juzgado / Tribunal: ${juzgado}
- Tipo de Juicio: ${tipoJuicio}
- Rol que representamos: ${rolParte}
- Estado procesal actual: ${estado}
- Cliente / Mandante: ${clienteNombre}
- Abogado / Estudio Jurídico: ${nombreEstudio} (Matrícula CSJ: ${matricula})
- Ciudad y Fecha de referencia en Paraguay: ${ciudad}, ${fechaHoyParaguay}
- ACTUACIÓN / IMPULSO ESPECÍFICO A SOLICITAR: "${objetivoTitulo || 'Urge trámite procesal / Solicita prosecución de la causa'}"${objetivoVenc ? ` (Fecha límite de referencia: ${objetivoVenc})` : ''}
${resumenHechos ? `- Último análisis / contexto reciente:\n${resumenHechos}` : ''}
${memoriaAcumuladaBloque ? `\nMEMORIA ACUMULADA DEL EXPEDIENTE (TODOS LOS DOCUMENTOS Y ACTUACIONES ANALIZADAS/VINCULADAS):\n${memoriaAcumuladaBloque}` : ''}
${notas ? `- Notas adicionales del estudio:\n${notas}` : ''}

ESTRUCTURA OBLIGATORIA PARAGUAYA:
1. Encabezado claro con "OBJETO: [TÍTULO DEL IMPULSO EN MAYÚSCULAS]." (ej: URGIR TRÁMITE, SOLICITAR APERTURA A PRUEBA, URGIR RESOLUCIÓN, PEDIR AUTOS PARA SENTENCIA, etc., alineado exactamente al impulso especificado).
2. "SEÑOR/A JUEZ/A:" dirigido al juzgado paraguayo correspondiente (${juzgado}).
3. Comparecencia breve en los autos caratulados "${caratula}" (Expte. N.º ${nroExpediente}/${anio}).
4. Exposición fundada del estado procesal y del pedido concreto con cita pertinente del Código Procesal Civil del Paraguay (principio de impulso procesal, celeridad y artículos aplicables según la actuación).
5. "PETITORIO:" puntual y claro.
6. Cierre clásico: "PROVEER DE CONFORMIDAD Y SERÁ JUSTICIA."
7. Bloque de firma limpio sin HTML.

REGLAS DE CALIDAD LINGÜÍSTICA Y JURISDICCIÓN PARAGUAYA (OBLIGATORIAS):
- Revisa con rigor absoluto la ortografía estricta en español, acentuación (tildes), puntuación y concordancia gramatical.
- Adapta cualquier denominación de juzgado o término procesal extranjero que aparezca en el documento base a la jurisdicción paraguaya (por ejemplo: Juzgado de Primera Instancia en lo Civil y Comercial, Juzgado de Primera Instancia en lo Laboral o Juzgado de Paz, según corresponda).${formatoAbogadoExtra}
${instruccionesAdicionales ? `- Indicaciones específicas del caso: ${instruccionesAdicionales}` : ''}`;

    const judicialModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

    try {
      const { response } = await generateContentWithModelFallback(
        ai,
        judicialModels,
        (model) => ({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: {
            systemInstruction: esAbogado
              ? 'Eres O.L.G.A., abogada litigante senior de la República del Paraguay. Redactas escritos judiciales impecables con ortografía estricta en español y adaptados al Poder Judicial del Paraguay (Juzgados de Primera Instancia y Juzgados de Paz). Aprovechas toda la memoria acumulada del expediente diferenciando lo alegado/ofrecido por la parte adversa frente a nuestra parte. Prohibido usar etiquetas HTML (<br>, <p>, <div>, &nbsp;), bloques de código markdown (```), o sintaxis LaTeX como $N^{\\circ}$ (usa siempre "N.º"). Entrega únicamente el texto completo del escrito judicial listo para editar e imprimir, sin cortar títulos.'
              : 'Eres O.L.G.A., abogada litigante senior de la República del Paraguay. Redactas escritos judiciales impecables con ortografía estricta en español y adaptados al Poder Judicial del Paraguay (Juzgados de Primera Instancia y Juzgados de Paz). Prohibido usar etiquetas HTML (<br>, <p>, <div>, &nbsp;) o bloques de código markdown (```). Entrega únicamente el texto completo del escrito judicial listo para editar e imprimir.',
            maxOutputTokens: esAbogado ? 8192 : 4096,
            ...(model === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        { logLabel: 'redactar-escrito-judicial', enableOverloadRetry: esAbogado }
      );

      const finalText = response.text.trim();
      res.json({ text: esAbogado ? limpiarLatexJuridicoServer(finalText) : finalText });
      return;
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'No se pudo redactar el escrito judicial con IA en este momento. Intenta nuevamente.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4e. Autocompletado IA de Presupuestos por Voz o Texto (Abogados / Estudios Jurídicos)
  app.post('/api/gemini/parse-presupuesto', verifyApiAuth, async (req: Request, res: Response) => {
    const body = req.body as {
      texto?: unknown;
      esAbogado?: unknown;
    };

    const texto = typeof body?.texto === 'string' ? body.texto.trim().slice(0, 3000) : '';
    const esAbogado = Boolean(body?.esAbogado);

    if (!texto) {
      res.status(400).json({ error: 'Escribe o dicta los datos del presupuesto antes de procesarlo con IA.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = getGenAI();
    } catch (err) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: (err as Error).message });
      return;
    }

    const perfilContext = esAbogado
      ? 'Estudio Jurídico / Abogado en Paraguay (tasas judiciales CSJ, notificaciones, honorarios profesionales, patrocinio procesal, redacción de escritos o contratos).'
      : 'Escribanía Notarial en Paraguay.';

    const promptText = `Extrae y estructura en formato JSON los datos para completar un presupuesto en Guaraníes (PYG) de un ${perfilContext}

TEXTO O DICTADO DEL USUARIO:
"""
${texto}
"""

REGLAS DE EXTRACCIÓN:
- Convierte expresiones coloquiales de dinero en Paraguay a números enteros en guaraníes (ejemplo: "350 mil" -> 350000, "2 millones" -> 2000000, "1.5 millones" o "un millón quinientos" -> 1500000, "500 mil gs" -> 500000).
- Si un campo de cliente (nombre, RUC/CI, teléfono, dirección, email) no aparece en el texto, devuélvelo como cadena vacía "".
- En "tasas" incluye únicamente tasas judiciales CSJ, gastos de notificación/diligenciamiento, certificados registrales o reembolsos oficiales exentos. Usa categoria entre: "judicial", "hipoteca", "municipal", "especial", "automotor", "otro".
- En "honorarios" incluye honorarios profesionales, patrocinio/representación procesal, redacción de escritos o contratos, consultas o gestiones. Usa tipoIva "10" por defecto (o "5" / "exenta" solo si se menciona explícitamente) y cantidad 1 si no se especifica.`;

    let lastError: unknown = null;
    for (const model of COMPATIBLE_MODELS) {
      try {
        const modelConfig: Record<string, unknown> = {
          systemInstruction:
            'Eres O.L.G.A., asistente jurídica financiera de Paraguay. Devuelves únicamente el objeto JSON estructurado según el esquema requerido.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clienteNombre: { type: Type.STRING },
              clienteRucCI: { type: Type.STRING },
              clienteTelefono: { type: Type.STRING },
              clienteDireccion: { type: Type.STRING },
              clienteEmail: { type: Type.STRING },
              conceptoGeneral: { type: Type.STRING },
              tasas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    descripcion: { type: Type.STRING },
                    categoria: { type: Type.STRING },
                    monto: { type: Type.NUMBER },
                  },
                  required: ['descripcion', 'categoria', 'monto'],
                },
              },
              honorarios: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    descripcion: { type: Type.STRING },
                    cantidad: { type: Type.NUMBER },
                    precioUnitario: { type: Type.NUMBER },
                    tipoIva: { type: Type.STRING },
                  },
                  required: ['descripcion', 'cantidad', 'precioUnitario', 'tipoIva'],
                },
              },
            },
            required: ['clienteNombre', 'clienteRucCI', 'conceptoGeneral', 'tasas', 'honorarios'],
          },
          maxOutputTokens: 2048,
          ...(model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        };

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          config: modelConfig,
        });

        const rawText = (response?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        if (rawText) {
          const parsed = JSON.parse(rawText);
          res.json({ data: parsed });
          return;
        }
      } catch (err: unknown) {
        lastError = err;
        console.error(`[parse-presupuesto] Detalle técnico con ${model}:`, err);
      }
    }

    const formatted = formatGeminiError(
      lastError,
      'No se pudo interpretar el presupuesto con IA en este momento. Intenta nuevamente.'
    );
    res.status(formatted.status).json({ error: formatted.message });
  });

  // 5. Proxy seguro para motor propio olga-whatsapp-engine
  app.post('/api/whatsapp/connect', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }
      const data = await callWhatsAppEngine(`/connect/${encodeURIComponent(workspaceId)}`, 'POST');
      res.json({
        status: data.status ?? 'connecting',
        qr: data.qr ?? null,
        phone: data.phone ?? null,
      });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al iniciar la conexión de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/whatsapp/status/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }
      const data = await callWhatsAppEngine(`/status/${encodeURIComponent(workspaceId)}`, 'GET');
      res.json({
        status: data.status ?? 'disconnected',
        qr: data.qr ?? null,
        phone: data.phone ?? null,
      });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al consultar el estado de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/whatsapp/send', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
      const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const rawJid = typeof req.body?.jid === 'string' ? req.body.jid.trim() : '';
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const jid = rawJid.slice(0, 160);
      const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
      if (!jid && (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 20)) {
        res.status(400).json({ error: 'Número de teléfono o JID inválido. Usa formato internacional (ej. 595981123456).' });
        return;
      }

      if (!message || message.length > 4096) {
        res.status(400).json({ error: 'El mensaje es obligatorio y no puede superar 4096 caracteres.' });
        return;
      }

      await callWhatsAppEngine('/send', 'POST', {
        workspaceId,
        phone: cleanPhone,
        ...(jid ? { jid } : {}),
        message,
      });
      res.json({ ok: true });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al enviar el mensaje de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/whatsapp/send-document', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
      const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const rawJid = typeof req.body?.jid === 'string' ? req.body.jid.trim() : '';
      const rawFileBase64 = typeof req.body?.fileBase64 === 'string' ? req.body.fileBase64 : '';
      const rawFileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
      const rawMimetype = typeof req.body?.mimetype === 'string' ? req.body.mimetype.trim().toLowerCase() : '';
      const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim().slice(0, 4096) : '';

      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const jid = rawJid.slice(0, 160);
      const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
      if (!jid && (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 20)) {
        res.status(400).json({ error: 'Número de teléfono o JID inválido. Usa formato internacional (ej. 595981123456).' });
        return;
      }

      const fileBase64 = cleanBase64Payload(rawFileBase64);
      if (!fileBase64) {
        res.status(400).json({ error: 'Se requiere fileBase64 para enviar el documento.' });
        return;
      }

      const fileName = (rawFileName.replace(/[\\/:*?"<>|\r\n]/g, '_') || 'documento.pdf').slice(0, 200);
      const mimetype = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(rawMimetype) ? rawMimetype : 'application/pdf';

      await callWhatsAppEngine('/send-document', 'POST', {
        workspaceId,
        phone: cleanPhone,
        ...(jid ? { jid } : {}),
        fileBase64,
        fileName,
        mimetype,
        caption,
      });
      res.json({ ok: true });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al enviar el documento por WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  const WHATSAPP_ANALYZE_ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/webm',
    'audio/amr',
    'audio/3gpp',
    'audio/flac',
  ]);

  const extractMimeFromDataUri = (rawData: unknown): string => {
    if (typeof rawData !== 'string') return '';
    const match = /^data:([^;,\s]+);base64,/i.exec(rawData.trim());
    return match ? match[1].trim().toLowerCase() : '';
  };

  const normalizeAnalyzeMime = (
    rawMime: unknown,
    rawMediaType: unknown,
    rawBase64?: unknown
  ): string => {
    let mime =
      (typeof rawMime === 'string' ? rawMime.split(';')[0].trim().toLowerCase() : '') ||
      extractMimeFromDataUri(rawBase64);
    if (mime === 'image/jpg') mime = 'image/jpeg';
    if (mime === 'audio/mp3') mime = 'audio/mpeg';
    if (mime === 'audio/x-wav') mime = 'audio/wav';
    if (mime === 'audio/m4a' || mime === 'audio/x-m4a') mime = 'audio/mp4';
    if (mime === 'audio/opus') mime = 'audio/ogg';
    if (mime === 'application/ogg') mime = 'audio/ogg';

    if (!mime || mime === 'application/octet-stream') {
      const mediaType = typeof rawMediaType === 'string' ? rawMediaType.trim().toLowerCase() : '';
      if (mediaType === 'image') mime = 'image/jpeg';
      else if (mediaType === 'audio' || mediaType === 'ptt' || mediaType === 'voice') mime = 'audio/ogg';
      else if (mediaType === 'document' || mediaType === 'pdf') mime = 'application/pdf';
    }
    return mime;
  };

  const sanitizeNullableString = (val: unknown): string | null => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'n/a' ||
      trimmed.toLowerCase() === 'no especificado' ||
      trimmed.toLowerCase() === 'no disponible'
    ) {
      return null;
    }
    return trimmed;
  };

  app.get('/api/whatsapp/inbox/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const data = await callWhatsAppEngine(`/inbox/${encodeURIComponent(workspaceId)}`, 'GET');
      const messages = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data)
          ? data
          : [];

      res.json({ ok: true, messages });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al consultar la bandeja de entrada de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/whatsapp/activity/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const data = await callWhatsAppEngine(`/activity/${encodeURIComponent(workspaceId)}`, 'GET');
      const activities = Array.isArray(data.activities)
        ? data.activities
        : Array.isArray(data)
          ? data
          : [];

      res.json({ ok: true, activities });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al consultar la actividad de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/whatsapp/config/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const data = await callWhatsAppEngine(`/config/${encodeURIComponent(workspaceId)}`, 'GET');
      const rawCfg = data?.config && typeof data.config === 'object' ? data.config : data;

      const autoReplyEnabled =
        typeof rawCfg?.autoReplyEnabled === 'boolean'
          ? rawCfg.autoReplyEnabled
          : typeof rawCfg?.enabled === 'boolean'
            ? rawCfg.enabled
            : true;
      const delaySeconds =
        typeof rawCfg?.delaySeconds === 'number' && Number.isFinite(rawCfg.delaySeconds)
          ? rawCfg.delaySeconds
          : 120;
      const cooldownMinutes =
        typeof rawCfg?.cooldownMinutes === 'number' && Number.isFinite(rawCfg.cooldownMinutes)
          ? rawCfg.cooldownMinutes
          : 0;
      const businessHoursEnabled =
        typeof rawCfg?.businessHoursEnabled === 'boolean' ? rawCfg.businessHoursEnabled : false;
      const businessStart =
        typeof rawCfg?.businessStart === 'string' && /^\d{2}:\d{2}$/.test(rawCfg.businessStart.trim())
          ? rawCfg.businessStart.trim()
          : '08:00';
      const businessEnd =
        typeof rawCfg?.businessEnd === 'string' && /^\d{2}:\d{2}$/.test(rawCfg.businessEnd.trim())
          ? rawCfg.businessEnd.trim()
          : '17:00';
      const autoReplyMessage =
        typeof rawCfg?.autoReplyMessage === 'string'
          ? rawCfg.autoReplyMessage
          : typeof rawCfg?.message === 'string'
            ? rawCfg.message
            : '';
      const afterHoursMessage =
        typeof rawCfg?.afterHoursMessage === 'string' ? rawCfg.afterHoursMessage : '';
      const mediaReplyEnabled =
        typeof rawCfg?.mediaReplyEnabled === 'boolean' ? rawCfg.mediaReplyEnabled : false;
      const mediaReplyMessage =
        typeof rawCfg?.mediaReplyMessage === 'string' ? rawCfg.mediaReplyMessage : '';
      const hasWorkFilterEnabled = typeof rawCfg?.workFilterEnabled === 'boolean';
      const hasAllowDocuments = typeof rawCfg?.allowDocuments === 'boolean';
      const hasAiReceptionistEnabled = typeof rawCfg?.aiReceptionistEnabled === 'boolean';
      const hasWorkKeywords = Array.isArray(rawCfg?.workKeywords);
      const workKeywords = hasWorkKeywords
        ? rawCfg.workKeywords
            .filter((k: unknown): k is string => typeof k === 'string' && k.trim().length > 0)
            .map((k: string) => k.trim().slice(0, 60))
            .slice(0, 100)
        : undefined;
      const rawExcluded = Array.isArray(rawCfg?.excludedJids)
        ? rawCfg.excludedJids
        : Array.isArray(data?.excludedJids)
          ? data.excludedJids
          : [];
      const excludedJids = rawExcluded.filter(
        (j: unknown): j is string => typeof j === 'string' && j.trim().length > 0
      );

      res.json({
        ok: true,
        autoReplyEnabled,
        delaySeconds,
        cooldownMinutes,
        businessHoursEnabled,
        businessStart,
        businessEnd,
        autoReplyMessage,
        afterHoursMessage,
        mediaReplyEnabled,
        mediaReplyMessage,
        ...(hasAiReceptionistEnabled ? { aiReceptionistEnabled: rawCfg.aiReceptionistEnabled } : {}),
        ...(hasWorkFilterEnabled ? { workFilterEnabled: rawCfg.workFilterEnabled } : {}),
        ...(hasAllowDocuments ? { allowDocuments: rawCfg.allowDocuments } : {}),
        ...(workKeywords !== undefined ? { workKeywords } : {}),
        excludedJids,
      });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al consultar la configuración de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/whatsapp/config/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      if (typeof req.body?.autoReplyEnabled !== 'boolean') {
        res.status(400).json({ error: 'El campo autoReplyEnabled (booleano) es obligatorio.' });
        return;
      }

      const rawBody =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const safePassthrough: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawBody)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        safePassthrough[key] = value;
      }

      const rawDelay = Number(rawBody.delaySeconds ?? 120);
      const delaySeconds =
        Number.isFinite(rawDelay) && rawDelay >= 10 && rawDelay <= 3600 ? Math.round(rawDelay) : 120;

      const rawCooldown = Number(rawBody.cooldownMinutes ?? 0);
      const cooldownMinutes =
        Number.isFinite(rawCooldown) && rawCooldown >= 0 && rawCooldown <= 10080
          ? Math.round(rawCooldown)
          : 0;

      const businessHoursEnabled =
        typeof rawBody.businessHoursEnabled === 'boolean' ? rawBody.businessHoursEnabled : false;

      const rawBusinessStart = typeof rawBody.businessStart === 'string' ? rawBody.businessStart.trim() : '';
      const businessStart = /^\d{2}:\d{2}$/.test(rawBusinessStart) ? rawBusinessStart : '08:00';

      const rawBusinessEnd = typeof rawBody.businessEnd === 'string' ? rawBody.businessEnd.trim() : '';
      const businessEnd = /^\d{2}:\d{2}$/.test(rawBusinessEnd) ? rawBusinessEnd : '17:00';

      const autoReplyMessage =
        typeof rawBody.autoReplyMessage === 'string' ? rawBody.autoReplyMessage.trim().slice(0, 2000) : '';
      const afterHoursMessage =
        typeof rawBody.afterHoursMessage === 'string' ? rawBody.afterHoursMessage.trim().slice(0, 2000) : '';
      const mediaReplyEnabled =
        typeof rawBody.mediaReplyEnabled === 'boolean' ? rawBody.mediaReplyEnabled : false;
      const mediaReplyMessage =
        typeof rawBody.mediaReplyMessage === 'string' ? rawBody.mediaReplyMessage.trim().slice(0, 2000) : '';

      const aiReceptionistEnabled =
        typeof rawBody.aiReceptionistEnabled === 'boolean' ? rawBody.aiReceptionistEnabled : true;
      const workFilterEnabled =
        typeof rawBody.workFilterEnabled === 'boolean' ? rawBody.workFilterEnabled : true;
      const allowDocuments =
        typeof rawBody.allowDocuments === 'boolean' ? rawBody.allowDocuments : true;
      const defaultWorkKeywords = [
        'escribania',
        'escritura',
        'pagare',
        'certificacion',
        'poder',
        'presupuesto',
        'honorarios',
        'transferencia',
        'firma',
        'contrato',
        'vehiculo',
        'terreno',
        'sociedad',
        'ruc',
      ];
      const workKeywords = Array.isArray(rawBody.workKeywords)
        ? Array.from(
            new Set(
              rawBody.workKeywords
                .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
                .map((k) => k.trim().slice(0, 60))
            )
          ).slice(0, 100)
        : defaultWorkKeywords;

      const forwardPayload: Record<string, unknown> = {
        ...safePassthrough,
        autoReplyEnabled: rawBody.autoReplyEnabled,
        delaySeconds,
        cooldownMinutes,
        businessHoursEnabled,
        businessStart,
        businessEnd,
        autoReplyMessage,
        afterHoursMessage,
        mediaReplyEnabled,
        mediaReplyMessage,
        aiReceptionistEnabled,
        workFilterEnabled,
        allowDocuments,
        workKeywords,
      };

      const data = await callWhatsAppEngine(
        `/config/${encodeURIComponent(workspaceId)}`,
        'POST',
        forwardPayload
      );

      res.json({
        ok: true,
        autoReplyEnabled:
          typeof data?.autoReplyEnabled === 'boolean' ? data.autoReplyEnabled : rawBody.autoReplyEnabled,
        delaySeconds: typeof data?.delaySeconds === 'number' ? data.delaySeconds : delaySeconds,
        cooldownMinutes:
          typeof data?.cooldownMinutes === 'number' ? data.cooldownMinutes : cooldownMinutes,
        businessHoursEnabled:
          typeof data?.businessHoursEnabled === 'boolean'
            ? data.businessHoursEnabled
            : businessHoursEnabled,
        businessStart: typeof data?.businessStart === 'string' ? data.businessStart : businessStart,
        businessEnd: typeof data?.businessEnd === 'string' ? data.businessEnd : businessEnd,
        autoReplyMessage:
          typeof data?.autoReplyMessage === 'string' ? data.autoReplyMessage : autoReplyMessage,
        afterHoursMessage:
          typeof data?.afterHoursMessage === 'string' ? data.afterHoursMessage : afterHoursMessage,
        mediaReplyEnabled:
          typeof data?.mediaReplyEnabled === 'boolean' ? data.mediaReplyEnabled : mediaReplyEnabled,
        mediaReplyMessage:
          typeof data?.mediaReplyMessage === 'string' ? data.mediaReplyMessage : mediaReplyMessage,
        aiReceptionistEnabled:
          typeof data?.aiReceptionistEnabled === 'boolean'
            ? data.aiReceptionistEnabled
            : aiReceptionistEnabled,
        workFilterEnabled:
          typeof data?.workFilterEnabled === 'boolean' ? data.workFilterEnabled : workFilterEnabled,
        allowDocuments:
          typeof data?.allowDocuments === 'boolean' ? data.allowDocuments : allowDocuments,
        workKeywords: Array.isArray(data?.workKeywords) ? data.workKeywords : workKeywords,
      });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al guardar la configuración de WhatsApp.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/whatsapp/mute/:workspaceId', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const workspaceId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
      if (!WORKSPACE_ID_REGEX.test(workspaceId)) {
        res.status(400).json({ error: 'workspaceId inválido o requerido.' });
        return;
      }

      const jid = typeof req.body?.jid === 'string' ? req.body.jid.trim().slice(0, 140) : '';
      if (!jid) {
        res.status(400).json({ error: 'El campo jid es obligatorio.' });
        return;
      }

      if (typeof req.body?.muted !== 'boolean') {
        res.status(400).json({ error: 'El campo muted (booleano) es obligatorio.' });
        return;
      }

      const data = await callWhatsAppEngine(`/mute/${encodeURIComponent(workspaceId)}`, 'POST', {
        jid,
        muted: req.body.muted,
      });

      const rawExcluded = Array.isArray(data?.excludedJids)
        ? data.excludedJids
        : Array.isArray(data?.config?.excludedJids)
          ? data.config.excludedJids
          : [];
      const excludedJids = rawExcluded.filter(
        (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0
      );

      res.json({
        ok: true,
        excludedJids,
      });
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Error al actualizar el estado del chat personal.';
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/whatsapp/analyze', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const pushName = typeof req.body?.pushName === 'string' ? req.body.pushName.trim().slice(0, 200) : '';
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 40) : '';

      interface RawAnalyzeMessage {
        text?: unknown;
        mediaType?: unknown;
        mimetype?: unknown;
        mediaBase64?: unknown;
        timestamp?: unknown;
      }

      const rawMessagesInput: RawAnalyzeMessage[] = Array.isArray(req.body?.messages) && req.body.messages.length > 0
        ? req.body.messages
        : [
            {
              text: req.body?.text,
              mediaType: req.body?.mediaType,
              mimetype: req.body?.mimetype,
              mediaBase64: req.body?.mediaBase64,
              timestamp: req.body?.timestamp,
            },
          ];

      const parseMsgTs = (ts: unknown, fallbackIndex: number): number => {
        if (typeof ts === 'number' && Number.isFinite(ts)) {
          return ts < 1_000_000_000_000 ? ts * 1000 : ts;
        }
        if (typeof ts === 'string' && ts.trim()) {
          const n = Number(ts);
          if (Number.isFinite(n) && n > 0) return n < 1_000_000_000_000 ? n * 1000 : n;
          const p = Date.parse(ts);
          if (Number.isFinite(p)) return p;
        }
        return fallbackIndex;
      };

      const sortedMessages = rawMessagesInput
        .slice(0, 40)
        .map((m, idx) => ({
          raw: m && typeof m === 'object' ? m : {},
          idx,
          ts: parseMsgTs((m as RawAnalyzeMessage)?.timestamp, idx),
        }))
        .sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.idx - b.idx));

      const textLines: string[] = [];
      const mediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      const MAX_MEDIA_PARTS = 12;

      for (const entry of sortedMessages) {
        const msgObj = entry.raw;
        const msgText = typeof msgObj.text === 'string' ? msgObj.text.trim().slice(0, 8000) : '';
        const msgMediaType = typeof msgObj.mediaType === 'string' ? msgObj.mediaType.trim().slice(0, 64) : '';
        const rawMediaBase64 = typeof msgObj.mediaBase64 === 'string' ? msgObj.mediaBase64 : '';
        const mediaBase64 = rawMediaBase64 ? cleanBase64Payload(rawMediaBase64) : '';
        const resolvedMime = mediaBase64
          ? normalizeAnalyzeMime(msgObj.mimetype, msgMediaType, rawMediaBase64)
          : '';

        if (mediaBase64 && (!resolvedMime || !WHATSAPP_ANALYZE_ALLOWED_MIME_TYPES.has(resolvedMime))) {
          continue;
        }

        const timeLabel =
          entry.ts > 1_000_000_000
            ? new Date(entry.ts).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
            : `#${entry.idx + 1}`;

        let attachmentTag = '';
        if (mediaBase64 && resolvedMime && mediaParts.length < MAX_MEDIA_PARTS) {
          mediaParts.push({
            inlineData: {
              mimeType: resolvedMime,
              data: mediaBase64,
            },
          });
          const labelTipo = resolvedMime.startsWith('image/')
            ? 'Imagen'
            : resolvedMime.startsWith('audio/')
              ? 'Audio / Nota de voz'
              : 'Documento PDF';
          attachmentTag = ` [Adjunto #${mediaParts.length}: ${labelTipo}]`;
        }

        if (msgText || attachmentTag) {
          textLines.push(`[${timeLabel}]${attachmentTag} ${msgText || '(sin texto adicional)'}`.trim());
        }
      }

      if (textLines.length === 0 && mediaParts.length === 0) {
        res.status(400).json({
          error: 'La conversación no contiene texto ni archivos multimedia válidos para analizar.',
        });
        return;
      }

      const ai = getGenAI();

      const promptContext = [
        'Analiza en conjunto toda la conversación entrante de WhatsApp de un mismo cliente (mensajes en orden cronológico + todas las imágenes, PDFs y notas de voz adjuntas).',
        '',
        `Cliente / Contacto: ${pushName || 'Sin nombre visible'} | Teléfono: ${phone || 'No informado'} | Mensajes analizados: ${sortedMessages.length} | Adjuntos multimedia: ${mediaParts.length}`,
        '',
        'HISTORIAL CRONOLÓGICO DE MENSAJES:',
        textLines.length > 0 ? textLines.join('\n') : '(Solo archivos adjuntos sin texto)',
        '',
        'INSTRUCCIONES DE EXTRACCIÓN NOTARIAL (PARAGUAY):',
        '- Unifica la información de todos los mensajes y documentos adjuntos (ej. fotos de Cédula de Identidad paraguaya frente/dorso, constancia RUC/DNIT, títulos, audios, condiciones enviadas por texto).',
        '- Identifica el trámite o documento notarial solicitado (ej. Contrato Privado de Alquiler, Compraventa de Inmueble, Transferencia de Automotor, Poder Especial, Pagaré, Certificación de Firmas, etc.).',
        '- En "partes", lista TODAS las personas físicas o jurídicas identificadas (ej. Locadora, Locatario, Vendedor, Comprador, Deudor, Acreedor, Cliente) con su rol, nombreCompleto, documento (C.I. o RUC con DV) y direccion si figura (si algún dato no figura, devuelve cadena vacía "" o null).',
        '- En "datosClave", enumera cada dato clave de la operación en formato claro "Etiqueta: Valor" (ej. "Monto: Gs. 3.500.000", "Ubicación: Barrio Villa Morra, Asunción", "Fecha inicio: 01/12/2026", "Plazo: 12 meses").',
        '- En "respuestaSugerida", redacta una respuesta cordial, formal y profesional de la escribanía confirmando la recepción de todos los datos/documentos e indicando el siguiente paso.',
        '- Responde ÚNICAMENTE con un objeto JSON válido sin bloques de código markdown.',
      ].join('\n');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: promptContext },
        ...mediaParts,
      ];

      let rawOutput = '';
      let lastModelError: unknown = null;

      for (const model of COMPATIBLE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
              systemInstruction:
                'Eres O.L.G.A., asistente jurídica experta de una Escribanía Pública en la República del Paraguay. Extrae datos notariales y responde únicamente en formato JSON válido sin bloques markdown.',
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  resumen: {
                    type: Type.STRING,
                    description: 'Resumen unificado de toda la conversación y condiciones del trámite.',
                  },
                  tramite: {
                    type: Type.STRING,
                    description: 'Tipo de documento o trámite solicitado (ej. Contrato Privado de Alquiler).',
                  },
                  partes: {
                    type: Type.ARRAY,
                    description: 'Lista de personas o entidades involucradas detectadas en la conversación y adjuntos.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        rol: {
                          type: Type.STRING,
                          description: 'Rol en el trámite (ej. Locadora, Locatario, Comprador, Vendedor, Cliente).',
                        },
                        nombreCompleto: {
                          type: Type.STRING,
                          description: 'Nombre y apellido completo o razón social, o cadena vacía si no figura.',
                        },
                        documento: {
                          type: Type.STRING,
                          description: 'Número de C.I. o RUC paraguayo, o cadena vacía si no figura.',
                        },
                        direccion: {
                          type: Type.STRING,
                          description: 'Dirección o domicilio detectado, o cadena vacía si no figura.',
                        },
                      },
                      required: ['rol', 'nombreCompleto', 'documento', 'direccion'],
                    },
                  },
                  datosClave: {
                    type: Type.ARRAY,
                    description: 'Lista de condiciones o datos clave del trámite (ej. "Monto: ...", "Ubicación: ...", "Fecha inicio: ...").',
                    items: {
                      type: Type.STRING,
                    },
                  },
                  respuestaSugerida: {
                    type: Type.STRING,
                    description: 'Respuesta cordial y profesional de la escribanía confirmando recepción de todos los datos.',
                  },
                },
                required: ['resumen', 'tramite', 'partes', 'datosClave', 'respuestaSugerida'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          if (response?.text && response.text.trim()) {
            rawOutput = response.text.trim();
            break;
          }
        } catch (modelErr: unknown) {
          lastModelError = modelErr;
          console.error(`[WA Analyze Error] Fallo con modelo '${model}':`, modelErr);
        }
      }

      if (!rawOutput) {
        if (lastModelError) {
          throw lastModelError;
        }
        throw new Error('La respuesta de Gemini estuvo vacía.');
      }

      const cleanedJson = rawOutput
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (parseErr) {
        console.error('[WA Analyze Error] Respuesta JSON inválida de Gemini:', cleanedJson, parseErr);
        throw new Error(`No se pudo interpretar el JSON de Gemini: ${(parseErr as Error)?.message || parseErr}`);
      }

      const rawPartes = Array.isArray(parsed.partes) ? parsed.partes : [];
      const partes = rawPartes
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          rol:
            typeof item.rol === 'string' && item.rol.trim()
              ? item.rol.trim()
              : 'Cliente / Interviniente',
          nombreCompleto: sanitizeNullableString(item.nombreCompleto),
          documento: sanitizeNullableString(item.documento),
          direccion: sanitizeNullableString(item.direccion),
        }))
        .filter((p) => p.nombreCompleto || p.documento || p.direccion);

      const datosClave = Array.isArray(parsed.datosClave)
        ? parsed.datosClave
            .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
            .map((d) => d.trim())
        : [];

      const analysis = {
        resumen:
          typeof parsed.resumen === 'string' && parsed.resumen.trim()
            ? parsed.resumen.trim()
            : 'Conversación analizada correctamente.',
        tramite:
          typeof parsed.tramite === 'string' && parsed.tramite.trim()
            ? parsed.tramite.trim()
            : 'Consulta notarial',
        partes,
        datosClave,
        respuestaSugerida:
          typeof parsed.respuestaSugerida === 'string' && parsed.respuestaSugerida.trim()
            ? parsed.respuestaSugerida.trim()
            : '¡Hola! Recibimos todos tus mensajes y documentos en la Escribanía. En breve te confirmamos los detalles para avanzar con tu trámite.',
      };

      res.json({ ok: true, ...analysis, analysis });
    } catch (err: any) {
      console.error('[WA Analyze Error]:', err);
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: err?.message || 'Error analizando conversación' });
    }
  });

  app.post('/api/whatsapp/generate-contract', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const tramite = typeof req.body?.tramite === 'string' ? req.body.tramite.trim().slice(0, 300) : '';
      const resumen = typeof req.body?.resumen === 'string' ? req.body.resumen.trim().slice(0, 8000) : '';

      if (!tramite && !resumen) {
        res.status(400).json({ error: 'Se requiere el trámite o resumen del análisis para redactar el documento.' });
        return;
      }

      const rawPartes = Array.isArray(req.body?.partes) ? req.body.partes.slice(0, 20) : [];
      const partesText = rawPartes
        .filter((p: unknown): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p, idx) => {
          const rol = typeof p.rol === 'string' && p.rol.trim() ? p.rol.trim() : `Parte ${idx + 1}`;
          const nombre = typeof p.nombreCompleto === 'string' && p.nombreCompleto.trim() ? p.nombreCompleto.trim() : 'No especificado';
          const doc = typeof p.documento === 'string' && p.documento.trim() ? p.documento.trim() : 'No especificado';
          const dir = typeof p.direccion === 'string' && p.direccion.trim() ? p.direccion.trim() : 'No especificada';
          return `- ${rol}: ${nombre} | C.I./RUC: ${doc} | Dirección: ${dir}`;
        })
        .join('\n');

      const rawDatosClave = Array.isArray(req.body?.datosClave) ? req.body.datosClave.slice(0, 30) : [];
      const datosClaveText = rawDatosClave
        .filter((d: unknown): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => `- ${d.trim()}`)
        .join('\n');

      const escObj = req.body?.escribania && typeof req.body.escribania === 'object' ? req.body.escribania : {};
      const escNombre = typeof escObj.nombre === 'string' && escObj.nombre.trim() ? escObj.nombre.trim() : 'Escribanía Pública';
      const escRegistro = typeof escObj.registro === 'string' && escObj.registro.trim() ? escObj.registro.trim() : '';
      const escDireccion = typeof escObj.direccion === 'string' && escObj.direccion.trim() ? escObj.direccion.trim() : '';

      const hoyEs = new Date().toLocaleDateString('es-PY', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const ai = getGenAI();

      const prompt = [
        'Redacta el instrumento legal/notarial COMPLETO, EXTENSO y listo para firmar (extensión equivalente a ~2 páginas A4, entre 850 y 1.400 palabras), con máximo rigor jurídico conforme al Código Civil de la República del Paraguay (Ley N° 1.183/85) y leyes concordantes. ESTÁ PROHIBIDO entregar resúmenes o borradores cortos.',
        '',
        `TRÁMITE DETECTADO: ${tramite || 'Contrato Privado'}`,
        `RESUMEN DEL CASO: ${resumen || 'Sin resumen adicional'}`,
        `FECHA DE REFERENCIA: ${hoyEs}`,
        `ESCRIBANÍA INTERVINIENTE: ${escNombre}${escRegistro ? ` (Registro N° ${escRegistro})` : ''}${escDireccion ? ` - ${escDireccion}` : ''}`,
        '',
        'PARTES INTERVINIENTES EXTRAÍDAS:',
        partesText || '- (Sin partes estructuradas; incluir marcadores claros [completar] donde falten datos)',
        '',
        'DATOS CLAVE Y CONDICIONES DE LA OPERACIÓN:',
        datosClaveText || '- (Usar los datos mencionados en el resumen)',
        '',
        'REQUISITOS OBLIGATORIOS DE CONTENIDO JURÍDICO (~2 PÁGINAS A4):',
        '1. En "titulo", devuelve un título breve y formal (ej. "Contrato Privado de Locación de Inmueble", "Contrato Privado de Compraventa").',
        '2. En "categoria", clasifica EXACTAMENTE con una de estas opciones: "Alquiler", "Compraventa", "Traspasos", "Pagarés", "Contratos Privados".',
        '3. Desarrolla el encabezado de comparecencia completo (ciudad/país, fecha, nombres completos, nacionalidad/capacidad legal, C.I. Nº / RUC, domicilios reales y el carácter con que comparece cada parte; usa únicamente los datos proporcionados y coloca [completar] solo si un dato puntual no figura).',
        '4. Desarrolla entre 9 y 12 CLÁUSULAS COMPLETAS, NUMERADAS EN MAYÚSCULAS Y BIEN FUNDAMENTADAS según el tipo de acto:',
        '   - Para contratos de locación/alquiler: PRIMERA: OBJETO E INDIVIDUALIZACIÓN, SEGUNDA: DESTINO, TERCERA: PLAZO DE DURACIÓN, CUARTA: PRECIO Y FORMA DE PAGO (monto en números y letras), QUINTA: GARANTÍA / DEPÓSITO (respetando expresamente si las partes pactaron sin garantía o depósito), SEXTA: SERVICIOS PÚBLICOS E IMPUESTOS, SÉPTIMA: ESTADO DE CONSERVACIÓN Y MEJORAS, OCTAVA: PROHIBICIÓN DE SUBLOCACIÓN Y CESIÓN, NOVENA: MORA, INCUMPLIMIENTO Y RESCISIÓN, DÉCIMA: JURISDICCIÓN Y DOMICILIOS ESPECIALES (y cláusulas adicionales pertinentes como entrega de llaves o inventario).',
        '   - Para compraventas, traspasos u otros contratos: desarrolla igualmente entre 9 y 12 cláusulas equivalentes (Objeto, Precio y forma de pago, Entrega de posesión/tradición, Evicción y vicios redhibitorios, Gastos e impuestos, Mora automática, Rescisión, Domicilios especiales, Jurisdicción ordinaria paraguaya, etc.).',
        '5. Termina el cuerpo con un párrafo independiente de cierre: "En prueba de conformidad y aceptación, las partes suscriben el presente instrumento en dos ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha arriba indicados."',
        '',
        'REGLAS ESTRICTAS DE FORMATO Y PÁRRAFOS (MUY IMPORTANTE):',
        '- Entrega ÚNICAMENTE texto plano limpio (PROHIBIDO usar markdown, asteriscos *, almohadillas #, negritas **, comillas invertidas ` ni etiquetas HTML como <br> o <p>).',
        '- PROHIBIDO texto corrido en un solo bloque: separa OBLIGATORIAMENTE con DOBLE SALTO DE LÍNEA (\\n\\n) entre:',
        '  * El título en mayúsculas (en la primera línea).',
        '  * El párrafo de comparecencia.',
        '  * CADA UNA de las cláusulas (PRIMERA:, SEGUNDA:, TERCERA:, etc. SIEMPRE debe comenzar en un párrafo nuevo precedido por \\n\\n).',
        '  * El párrafo de cierre ("En prueba de conformidad...").',
        '- BLOQUE DE FIRMAS: NO pegues las firmas en la misma línea del cierre. Separa el bloque de firmas del cierre con AL MENOS 3 SALTOS DE LÍNEA (\\n\\n\\n), y deja también \\n\\n\\n arriba de cada firmante para que exista espacio generoso para la firma manuscrita, siguiendo EXACTAMENTE este esquema:',
        '',
        '',
        '____________________________________',
        'NOMBRE COMPLETO DE LA PARTE 1',
        'C.I. Nº X.XXX.XXX',
        'LA LOCADORA (o carácter correspondiente)',
        '',
        '',
        '____________________________________',
        'NOMBRE COMPLETO DE LA PARTE 2',
        'C.I. Nº X.XXX.XXX',
        'EL LOCATARIO (o carácter correspondiente)',
      ].join('\n');

      let rawOutput = '';
      let lastModelError: unknown = null;

      for (const model of COMPATIBLE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              systemInstruction:
                'Eres O.L.G.A., escribana pública y abogada especialista en derecho civil y notarial de la República del Paraguay. Redactas contratos e instrumentos legales completos (~2 páginas A4, 9 a 12 cláusulas desarrolladas), con separación estricta de párrafos mediante doble salto de línea (\\n\\n) y bloque de firmas separado al pie (\\n\\n\\n), en texto plano sin markdown. Responde únicamente JSON válido.',
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  titulo: {
                    type: Type.STRING,
                    description: 'Título formal del documento.',
                  },
                  categoria: {
                    type: Type.STRING,
                    description: "Exactamente una de: 'Alquiler', 'Compraventa', 'Traspasos', 'Pagarés', 'Contratos Privados'.",
                  },
                  texto: {
                    type: Type.STRING,
                    description: 'Cuerpo completo (~2 páginas A4, 9-12 cláusulas) en texto plano con \\n\\n entre cada cláusula y párrafo, y bloque de firmas al pie separado con \\n\\n\\n.',
                  },
                },
                required: ['titulo', 'categoria', 'texto'],
              },
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          if (response?.text && response.text.trim()) {
            rawOutput = response.text.trim();
            break;
          }
        } catch (modelErr: unknown) {
          lastModelError = modelErr;
          console.error(`[WA Generate Contract Error] Fallo con modelo '${model}':`, modelErr);
        }
      }

      if (!rawOutput) {
        if (lastModelError) throw lastModelError;
        throw new Error('La respuesta de Gemini al redactar el contrato estuvo vacía.');
      }

      const cleanedJson = rawOutput
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (parseErr) {
        console.error('[WA Generate Contract Error] JSON inválido:', cleanedJson, parseErr);
        throw new Error(`No se pudo interpretar el JSON del contrato: ${(parseErr as Error)?.message || parseErr}`);
      }

      const ALLOWED_CATEGORIES = new Set([
        'Alquiler',
        'Compraventa',
        'Traspasos',
        'Pagarés',
        'Contratos Privados',
      ]);

      const rawCat = typeof parsed.categoria === 'string' ? parsed.categoria.trim() : '';
      let categoria = 'Contratos Privados';
      if (ALLOWED_CATEGORIES.has(rawCat)) {
        categoria = rawCat;
      } else {
        const lower = `${rawCat} ${tramite}`.toLowerCase();
        if (lower.includes('alquiler') || lower.includes('locaci') || lower.includes('arrendam')) {
          categoria = 'Alquiler';
        } else if (lower.includes('compraventa') || lower.includes('compra') || lower.includes('venta')) {
          categoria = 'Compraventa';
        } else if (lower.includes('traspaso') || lower.includes('transferen')) {
          categoria = 'Traspasos';
        } else if (lower.includes('pagar')) {
          categoria = 'Pagarés';
        }
      }

      const titulo =
        (typeof parsed.titulo === 'string' && parsed.titulo.trim()) ||
        tramite ||
        'Contrato Privado';

      const normalizeGeneratedContractText = (input: string): string => {
        let txt = input
          .replace(/\r\n/g, '\n')
          .replace(/```[\w-]*\n?/g, '')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*\*/g, '')
          .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2')
          .replace(/<\/?(?:br|p|div|b|strong|i|em|u)[^>]*>/gi, '')
          .trim();

        if (!txt) return '';

        // 1. Garantizar doble salto de línea (\n\n) después del título en mayúsculas si viene con salto simple
        txt = txt.replace(/^([^\n]{4,140})\n(?!\n)/, '$1\n\n');

        // 2. Garantizar \n\n antes de cada cláusula numerada (PRIMERA:, SEGUNDA:, ..., DUODÉCIMA:)
        txt = txt.replace(
          /([^\n])\s*(?:\n\s*)?((?:CLÁUSULA\s+)?(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[ÉE]PTIMA|OCTAVA|NOVENA|D[ÉE]CIMA(?:\s+(?:PRIMERA|SEGUNDA|TERCERA))?|UND[ÉE]CIMA|DUOD[ÉE]CIMA|DECIMOPRIMERA|DECIMOSEGUNDA)\s*[:.\-–])/g,
          '$1\n\n$2'
        );
        // También si ya tenía un solo \n al principio de línea antes de PRIMERA:, SEGUNDA:, etc., elevarlo a \n\n
        txt = txt.replace(
          /([^\n])\n((?:CLÁUSULA\s+)?(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[ÉE]PTIMA|OCTAVA|NOVENA|D[ÉE]CIMA(?:\s+(?:PRIMERA|SEGUNDA|TERCERA))?|UND[ÉE]CIMA|DUOD[ÉE]CIMA|DECIMOPRIMERA|DECIMOSEGUNDA)\s*[:.\-–])/g,
          '$1\n\n$2'
        );

        // 3. Garantizar \n\n antes de "En prueba de conformidad"
        txt = txt.replace(
          /([^\n])\s*(?:\n\s*)?(En prueba de conformidad|EN PRUEBA DE CONFORMIDAD)/g,
          '$1\n\n$2'
        );
        txt = txt.replace(
          /([^\n])\n(En prueba de conformidad|EN PRUEBA DE CONFORMIDAD)/g,
          '$1\n\n$2'
        );

        // 4. Garantizar separación generosa (\n\n\n) antes de cada línea de firma (______...)
        txt = txt.replace(/\s*(_{6,})\s*/g, '\n\n\n____________________________________\n');

        // Limpiar exceso de saltos de línea (>3) preservando \n\n\n antes de firmas
        txt = txt.replace(/\n{4,}/g, '\n\n\n').trim();

        return txt;
      };

      const rawTexto = typeof parsed.texto === 'string' ? parsed.texto : '';
      const texto = normalizeGeneratedContractText(rawTexto);

      if (!texto) {
        throw new Error('Gemini devolvió un borrador de documento vacío.');
      }

      res.json({ ok: true, titulo, categoria, texto });
    } catch (err: any) {
      console.error('[WA Generate Contract Error]:', err);
      const status = err instanceof ApiHttpError ? err.status : 500;
      res.status(status).json({ error: err?.message || 'Error redactando el documento legal con IA' });
    }
  });

  // 6. Alertas automáticas al Superadmin por WhatsApp (pagos, solicitudes de plan y soporte)
  app.post('/api/notifications/admin-alert', verifyApiAuth, async (req: Request, res: Response) => {
    try {
      const rawType = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
      if (rawType !== 'payment' && rawType !== 'plan_request' && rawType !== 'support') {
        res.status(400).json({ ok: false, error: 'Tipo de alerta inválido.' });
        return;
      }

      const sanitizeText = (val: unknown, maxLen: number): string =>
        typeof val === 'string' ? val.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen) : '';

      const userName = sanitizeText(req.body?.userName, 160) || 'Usuario O.L.G.A.';
      const userEmail = sanitizeText(req.body?.userEmail, 160);
      const userPhone = sanitizeText(req.body?.userPhone, 60);
      const details = sanitizeText(req.body?.details, 1200) || '(sin detalle)';

      let safeAttachmentUrl = '';
      const rawAttachment = typeof req.body?.attachmentUrl === 'string' ? req.body.attachmentUrl.trim().slice(0, 1000) : '';
      if (rawAttachment) {
        try {
          const parsedUrl = new URL(rawAttachment);
          if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            safeAttachmentUrl = parsedUrl.toString();
          }
        } catch {
          safeAttachmentUrl = '';
        }
      }

      const rawAdminUids = (process.env.VITE_ADMIN_UID || '').trim();
      const firstEnvAdminUid = rawAdminUids
        .split(',')
        .map((u) => u.trim())
        .find((u) => WORKSPACE_ID_REGEX.test(u));
      const adminWorkspaceId = firstEnvAdminUid || 'sjqCJTQ1lNMRIMk31VRwz9Rwhud2';

      const adminPhone =
        (process.env.ADMIN_WA_PHONE || '817084827565').replace(/[^\d]/g, '') || '817084827565';

      let message = '';
      if (rawType === 'payment') {
        const attachmentPart = safeAttachmentUrl ? ` Comprobante: ${safeAttachmentUrl}` : '';
        message = `💳 O.L.G.A. PAGO: ${userName} (${userEmail || 'sin correo'}) envió un comprobante. Detalle: ${details}.${attachmentPart} Ver en: https://olgatech.com.py/consola/admin`;
      } else if (rawType === 'plan_request') {
        message = `🚀 O.L.G.A. PLAN: ${userName} (${userEmail || 'sin correo'} / ${userPhone || 'sin teléfono'}) solicitó activar un plan. Detalle: ${details}. Gestionar en: https://olgatech.com.py/consola/admin`;
      } else {
        message = `📩 O.L.G.A. SOPORTE: Nueva consulta de ${userName} (${userEmail || 'sin correo'}): "${details}". Responder en: https://olgatech.com.py/consola/admin`;
      }

      try {
        await callWhatsAppEngine('/send', 'POST', {
          workspaceId: adminWorkspaceId,
          phone: adminPhone,
          message,
        });
      } catch {
        await callWhatsAppEngine(`/send/${encodeURIComponent(adminWorkspaceId)}`, 'POST', {
          phone: adminPhone,
          message,
        });
      }

      res.json({ ok: true });
    } catch (err: unknown) {
      console.error('[admin-alert] No se pudo enviar alerta WhatsApp al Superadmin:', err);
      res.json({ ok: false });
    }
  });

  // 404 explícito para cualquier ruta /api no registrada
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const patchedCode = result.code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* HMR WebSocket disabled */'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(patchedCode);
      } catch {
        next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`O.L.G.A. server listening on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor O.L.G.A.:', err);
  process.exit(1);
});
