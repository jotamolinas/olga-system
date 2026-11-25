import { auth } from './auth';

const CHAT_TIMEOUT_MS = 90000;

export interface SendMessageOptions {
  systemInstructionExtra?: string;
  onChunk?: (textPartial: string) => void;
  timeoutMs?: number;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // Continuar sin token si no está disponible aún
  }
  return headers;
};

const HIGH_VOLUME_ORACLE_MESSAGE =
  'El Oráculo está atendiendo un alto volumen de consultas en este momento. No se trata de un error del sistema ni de tu cuenta; por favor, aguarda unos segundos y vuelve a enviar tu solicitud.';

const sanitizeUserErrorMessage = (rawMessage: unknown, status?: number): string => {
  const msg = typeof rawMessage === 'string' ? rawMessage : '';
  if (
    status === 429 ||
    status === 503 ||
    /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|Free Tier|cuota gratuita|facturaci[óo]n|Settings > Secrets|Gemini API/i.test(msg)
  ) {
    return HIGH_VOLUME_ORACLE_MESSAGE;
  }
  return msg || 'El Oráculo experimentó una interrupción temporal. Por favor, intenta nuevamente en unos segundos.';
};

const parseJsonError = async (response: Response, fallbackMessage: string): Promise<string> => {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string' && body.error.trim()) {
      return sanitizeUserErrorMessage(body.error, response.status);
    }
  } catch {
    // Ignorar fallo al leer JSON de error
  }
  return sanitizeUserErrorMessage(fallbackMessage, response.status);
};

export const sendMessageToOlga = async (
  message: string,
  history: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[],
  lang: string = 'es',
  attachments?: { data: string; mimeType: string }[],
  options?: SendMessageOptions
) => {
  const timeoutMs = options?.timeoutMs ?? CHAT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
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

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/chat-stream', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        message,
        history,
        lang,
        attachments,
        systemInstructionExtra: options?.systemInstructionExtra,
        timeoutMs,
      }),
    });

    if (!response.ok) {
      clearSafetyTimer();
      const errMsg = await parseJsonError(
        response,
        'El Oráculo experimentó una interrupción temporal. Por favor, intenta nuevamente en unos segundos.'
      );
      throw new Error(errMsg);
    }

    if (!response.body) {
      clearSafetyTimer();
      throw new Error('La respuesta del servidor no incluyó un flujo de lectura.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) return;

      let eventData: { text?: string; error?: string; status?: number; done?: boolean };
      try {
        eventData = JSON.parse(jsonStr);
      } catch {
        return;
      }

      if (eventData.error) {
        throw new Error(sanitizeUserErrorMessage(eventData.error, eventData.status));
      }

      if (typeof eventData.text === 'string' && eventData.text.length > 0) {
        clearSafetyTimer();
        accumulatedText += eventData.text;
        if (options?.onChunk) {
          options.onChunk(accumulatedText);
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
      }
    }

    const tail = buffer + decoder.decode();
    if (tail.trim()) {
      for (const line of tail.split('\n')) {
        processLine(line);
      }
    }

    clearSafetyTimer();
    return {
      text: accumulatedText,
      functionCalls: null,
    };
  } catch (error: any) {
    console.warn('[sendMessageToOlga] Aviso:', error?.message || error);
    if (timedOut || error?.message === 'TIMEOUT_90S' || error?.name === 'AbortError') {
      throw new Error(
        'La consulta superó el tiempo máximo de espera (90s). Por favor, intenta nuevamente.'
      );
    }
    throw new Error(sanitizeUserErrorMessage(error?.message));
  } finally {
    clearSafetyTimer();
  }
};

export const generateExecutiveSummary = async (
  history: any[],
  lang: string,
  currentUrl: string
) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/executive-summary', {
      method: 'POST',
      headers,
      body: JSON.stringify({ history, lang, currentUrl }),
    });
    if (!response.ok) {
      const errMsg = await parseJsonError(response, 'No se pudo generar el resumen ejecutivo.');
      console.warn('[generateExecutiveSummary] Aviso:', errMsg);
      return null;
    }
    const payload = await response.json();
    return payload?.functionCalls ?? null;
  } catch (error: any) {
    console.warn('[generateExecutiveSummary] Aviso:', error?.message || error);
    return null;
  }
};

export const analyzePagareImage = async (fileBase64: string, mimeType: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/analyze-pagare', {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileBase64, mimeType }),
  });

  if (!response.ok) {
    const errMsg = await parseJsonError(response, 'No se pudo analizar el documento en este momento.');
    throw new Error(errMsg);
  }

  const payload = await response.json();
  return payload?.data ?? null;
};

export const limpiarLatexJuridico = (texto: string): string => {
  if (!texto) return '';
  let out = texto;

  // 1. Limpiar variantes de $N^{\circ}$ / $N^\circ$ / $N^{o}$ / $\text{N}^{\circ}$ -> N.º
  out = out.replace(
    /\$\s*(?:\\(?:text|mathrm|mathbf|textbf)\s*\{\s*)?[nN](?:\s*\.|\s*\\[,;!])?\s*(?:\}\s*)?\^\s*\{?\s*(?:\\circ|\\text\s*\{\s*[oº°]\s*\}|\\underline\s*\{\s*[oº°]\s*\}|[oOº°])\s*\}?\.?\s*\$/g,
    'N.º'
  );
  out = out.replace(/\$\s*[nN]\s*\.?\s*[º°]\s*\$/g, 'N.º');

  // 2. Ordinales en LaTeX tipo $1^{\circ}$, $2^{\text{a}}$
  out = out.replace(
    /\$\s*(\d+)\s*(?:\.?\s*)\^\s*\{?\s*(?:\\circ|\\text\s*\{\s*[oº°]\s*\}|\\underline\s*\{\s*[oº°]\s*\}|[oº°])\s*\}?\s*\$/g,
    '$1.º'
  );
  out = out.replace(
    /\$\s*(\d+)\s*(?:\.?\s*)\^\s*\{?\s*(?:\\text\s*\{\s*[aª]\s*\}|\\underline\s*\{\s*[aª]\s*\}|[aª])\s*\}?\s*\$/g,
    '$1.ª'
  );

  // 3. Fragmentos LaTeX inline $...$ con sintaxis LaTeX (\, ^, {, }) sin afectar montos en dólares (US$ 1.000)
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

  // 4. Restos de LaTeX sin delimitadores $
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

const fetchWith503Retry = async (
  url: string,
  init: RequestInit,
  maxRetries = 1
): Promise<globalThis.Response> => {
  let lastResponse: globalThis.Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    lastResponse = response;
    if (response.status !== 503 && response.status !== 429) {
      return response;
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1400 * (attempt + 1)));
    }
  }
  return lastResponse as globalThis.Response;
};

export const redactarEscritoConIA = async (
  prompt: string,
  contextoActual?: string,
  attachments?: { data: string; mimeType: string; name?: string }[],
  options?: { esAbogado?: boolean }
): Promise<string> => {
  const esAbogado = Boolean(options?.esAbogado);
  const headers = await getAuthHeaders();
  const reqInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, contextoActual, attachments, esAbogado }),
  };
  const response = esAbogado
    ? await fetchWith503Retry('/api/gemini/redactar-escrito', reqInit, 1)
    : await fetch('/api/gemini/redactar-escrito', reqInit);

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (typeof payload?.text === 'string' && payload.text) {
    return esAbogado ? limpiarLatexJuridico(payload.text) : payload.text;
  }

  throw new Error('No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.');
};

export const draftNotificationWithAI = async (
  draft: string,
  options?: { type?: string; targetSegment?: string }
): Promise<{ title: string; message: string }> => {
  const cleanDraft = draft.trim();
  if (!cleanDraft) {
    throw new Error('Escribe una idea o borrador corto antes de redactar con IA.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/draft-notification', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      draft: cleanDraft,
      type: options?.type,
      targetSegment: options?.targetSegment,
    }),
  });

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo redactar el aviso con IA en este momento. Puedes escribirlo manualmente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (
    payload &&
    typeof payload.title === 'string' &&
    payload.title.trim() &&
    typeof payload.message === 'string' &&
    payload.message.trim()
  ) {
    return {
      title: payload.title.trim(),
      message: payload.message.trim(),
    };
  }

  throw new Error('La IA no devolvió un título y mensaje válidos. Intenta nuevamente.');
};

export interface ExpedientePdfAnalysisPayload {
  caratula: string;
  nroExpediente?: string;
  anio?: string;
  juzgado: string;
  tipoJuicio: string;
  rolParteSugerido: string;
  resumenHechos: string;
  fundamentoCPC?: string;
  plazoPrincipal: {
    titulo: string;
    diasPlazo: number;
    fechaVencimiento: string;
    tipo: 'plazo_legal' | 'impulso';
  } | null;
  impulsosSugeridos: Array<{
    titulo: string;
    diasPlazo: number;
    fechaVencimiento: string;
    tipo: 'plazo_legal' | 'impulso';
  }>;
}

export const analyzeExpedientePdf = async (
  fileBase64: string,
  mimeType: string,
  options?: { fileName?: string; rolParteHint?: string; esAbogado?: boolean }
): Promise<ExpedientePdfAnalysisPayload> => {
  const esAbogado = Boolean(options?.esAbogado);
  const headers = await getAuthHeaders();
  const reqInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileBase64,
      mimeType,
      fileName: options?.fileName,
      rolParteHint: options?.rolParteHint,
      esAbogado,
    }),
  };
  const response = esAbogado
    ? await fetchWith503Retry('/api/gemini/analyze-expediente-pdf', reqInit, 1)
    : await fetch('/api/gemini/analyze-expediente-pdf', reqInit);

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo analizar el documento en este momento. Intenta nuevamente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (payload?.data && typeof payload.data === 'object') {
    return payload.data as ExpedientePdfAnalysisPayload;
  }

  throw new Error('La IA no devolvió datos procesales válidos para este documento.');
};

export interface MemoriaDocumentoEscritoPayload {
  titulo?: string;
  fecha?: string;
  parteOrigen?: string;
  resumen?: string;
  fundamentoCPC?: string;
  extracto?: string;
}

export const redactarEscritoJudicialConIA = async (params: {
  expediente: Record<string, any>;
  modo: 'contestacion' | 'impulso';
  plazoObjetivo?: { titulo?: string; fechaVencimiento?: string };
  estudio?: {
    razonSocial?: string;
    nombre?: string;
    matricula?: string;
    ciudad?: string;
  };
  instruccionesAdicionales?: string;
  memoriaDocumentos?: MemoriaDocumentoEscritoPayload[];
  esAbogado?: boolean;
}): Promise<string> => {
  const esAbogado = Boolean(params?.esAbogado);
  const headers = await getAuthHeaders();
  const reqInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  };
  const response = esAbogado
    ? await fetchWith503Retry('/api/gemini/redactar-escrito-judicial', reqInit, 1)
    : await fetch('/api/gemini/redactar-escrito-judicial', reqInit);

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo redactar el escrito judicial en este momento. Intenta nuevamente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    const cleanText = payload.text.trim();
    return esAbogado ? limpiarLatexJuridico(cleanText) : cleanText;
  }

  throw new Error('La IA no generó texto para el escrito judicial. Intenta nuevamente.');
};

export interface ParsedPresupuestoIA {
  clienteNombre?: string;
  clienteRucCI?: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  conceptoGeneral?: string;
  tasas?: Array<{
    descripcion: string;
    categoria: 'judicial' | 'hipoteca' | 'municipal' | 'especial' | 'automotor' | 'otro';
    monto: number;
  }>;
  honorarios?: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    tipoIva: '10' | '5' | 'exenta';
  }>;
}

export const parsePresupuestoConIA = async (
  texto: string,
  esAbogado: boolean = true
): Promise<ParsedPresupuestoIA> => {
  const cleanTexto = texto.trim();
  if (!cleanTexto) {
    throw new Error('Escribe o dicta los conceptos del presupuesto antes de enviarlo a la IA.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/parse-presupuesto', {
    method: 'POST',
    headers,
    body: JSON.stringify({ texto: cleanTexto, esAbogado }),
  });

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo interpretar el presupuesto con IA en este momento. Intenta nuevamente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (payload?.data && typeof payload.data === 'object') {
    return payload.data as ParsedPresupuestoIA;
  }

  throw new Error('La IA no devolvió datos válidos para completar el presupuesto.');
};




