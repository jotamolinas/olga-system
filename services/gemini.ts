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

export const redactarEscritoConIA = async (
  prompt: string,
  contextoActual?: string,
  attachments?: { data: string; mimeType: string; name?: string }[]
): Promise<string> => {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/redactar-escrito', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, contextoActual, attachments }),
  });

  if (!response.ok) {
    const errMsg = await parseJsonError(
      response,
      'No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.'
    );
    throw new Error(errMsg);
  }

  const payload = await response.json();
  if (typeof payload?.text === 'string' && payload.text) {
    return payload.text;
  }

  throw new Error('No se pudo generar la redacción en este momento. Por favor, intenta nuevamente.');
};
