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

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

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
    };

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const contextoActual = typeof body?.contextoActual === 'string' ? body.contextoActual : undefined;
    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];

    if (!prompt && rawAttachments.length === 0) {
      res.status(400).json({ error: 'Se requiere una instrucción o un archivo adjunto para redactar.' });
      return;
    }

    const userParts: ChatPartInput[] = [];
    let instruccionCompleta = `Actúa como O.L.G.A., abogada y escribana experta en derecho notarial y civil de la República del Paraguay.
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
