
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const saveClientDataToSheetDeclaration: FunctionDeclaration = {
  name: 'saveClientDataToSheet',
  parameters: {
    type: Type.OBJECT,
    description: 'Extrae y guarda información estructurada de documentos de clientes para una planilla de Google Sheets.',
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
      summary: { type: Type.STRING, description: 'Resumen detallado de todos los puntos discutidos, documentos analizados y próximos pasos.' },
      recipientEmail: { type: Type.STRING, description: 'El correo de destino (olga.ihara.feltes@gmail.com).' },
      clientIdentifier: { type: Type.STRING, description: 'Nombre o identificador del cliente para el asunto del correo.' },
      conversationLink: { type: Type.STRING, description: 'URL directa para acceder a la conversación y continuar la atención manualmente.' },
    },
    required: ['summary', 'recipientEmail', 'conversationLink'],
  },
};

const getSystemInstruction = (lang: string) => `
Actúa como O.L.G.A., asistente inteligente ejecutiva y legal (Organización, Legalización, Gestión y Administración). Eres una abogada experta y escribana de Paraguay con especialización en Contratos, Pagarés, Ley de Maquila y Sociedades.

ANÁLISIS DE DOCUMENTOS Y CONTRATOS:
- Al recibir anexos o analizar casos, extrae los datos más importantes para responder al cliente con exactitud.
- Sé rigurosa con la calidad de los datos para construir borradores (drafts) de contratos sólidos y seguros.
- Si el usuario te pide que redactes un documento o contrato, HAZLO INMEDIATAMENTE en tu respuesta de texto. No esperes confirmación.

ESTILO Y CONOCIMIENTO:
- Ejecutivo, directo, enfocado en seguridad jurídica y reducción de costos.
- Tienes profundo conocimiento técnico notarial y redactas cláusulas perfectas basadas en el Código Civil Paraguayo.

COMUNICACIÓN:
- Debes responder y comunicarte SIEMPRE 100% en Español, sin importar el idioma de entrada.
`;

const getGenAI = () => {
  const apiKey = 
    process.env.API_KEY || 
    process.env.GEMINI_API_KEY || 
    (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__) || 
    '';
  return new GoogleGenAI({ apiKey });
};

// Modelo principal rápido para chat y redacción legal, con respaldos rápidos compatibles con @google/genai
const COMPATIBLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

const CHAT_TIMEOUT_MS = 90000;

export interface SendMessageOptions {
  systemInstructionExtra?: string;
  onChunk?: (textPartial: string) => void;
  timeoutMs?: number;
}

const normalizeGeminiHistory = (
  rawHistory: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[]
): { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[] => {
  const valid = (rawHistory || []).filter(
    (m) =>
      m &&
      Array.isArray(m.parts) &&
      m.parts.some((p) => (typeof p?.text === 'string' && p.text.trim().length > 0) || Boolean(p?.inlineData))
  );

  // Nunca empezar el historial con un mensaje 'model' (ej. mensaje inicial de bienvenida)
  let startIndex = 0;
  while (startIndex < valid.length && valid[startIndex].role !== 'user') {
    startIndex++;
  }

  // Garantizar alternancia estricta user -> model -> user -> model
  const alternating: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[] = [];
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

export const sendMessageToOlga = async (
  message: string,
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: any }[] }[],
  lang: string = 'es',
  attachments?: { data: string, mimeType: string }[],
  options?: SendMessageOptions
) => {
  const ai = getGenAI();

  const userParts: any[] = [];
  if (message) userParts.push({ text: message });

  if (attachments && attachments.length > 0) {
    attachments.forEach((attachment) => {
      userParts.push({
        inlineData: { data: attachment.data, mimeType: attachment.mimeType }
      });
    });
  }

  const normalizedHistory = normalizeGeminiHistory(history);
  const combinedSystemInstruction = options?.systemInstructionExtra
    ? `${getSystemInstruction(lang)}\n\n${options.systemInstructionExtra}`
    : getSystemInstruction(lang);

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

  const timeoutPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(new Error('TIMEOUT_90S')),
      { once: true }
    );
  });

  try {
    let lastError: any = null;

    for (const model of COMPATIBLE_MODELS) {
      if (timedOut || controller.signal.aborted) break;

      try {
        const modelConfig: Record<string, any> = {
          systemInstruction: combinedSystemInstruction,
          abortSignal: controller.signal,
        };

        if (model === 'gemini-2.5-flash') {
          modelConfig.temperature = 0.2;
          modelConfig.thinkingConfig = { thinkingBudget: 0 };
        } else if (model !== 'gemini-4-hydrogen') {
          modelConfig.temperature = 0.2;
        }

        const streamCall = ai.models.generateContentStream({
          model,
          contents: [...normalizedHistory, { role: 'user', parts: userParts }],
          config: modelConfig,
        });

        const stream = await Promise.race([streamCall, timeoutPromise]);
        let accumulatedText = '';

        for await (const chunk of stream) {
          if (timedOut || controller.signal.aborted) {
            throw new Error('TIMEOUT_90S');
          }
          // Cancelar el timeout de respaldo apenas llega el primer chunk del stream
          clearSafetyTimer();

          const chunkText = chunk?.text || '';
          if (chunkText) {
            accumulatedText += chunkText;
            if (options?.onChunk) {
              options.onChunk(accumulatedText);
            }
          }
        }

        clearSafetyTimer();
        return {
          text: accumulatedText,
          functionCalls: null
        };
      } catch (error: any) {
        lastError = error;
        console.error(`[sendMessageToOlga] Error real en modelo ${model}:`, error);

        if (timedOut || controller.signal.aborted || error?.message === 'TIMEOUT_90S' || error?.name === 'AbortError') {
          throw new Error('La consulta superó el tiempo máximo de espera (90s). Por favor, intenta nuevamente.');
        }

        const status = error?.status ?? error?.code;
        if (status === 400 || status === 401 || status === 403 || status === 429) {
          throw new Error(error?.message || `Error de Gemini API (${status}).`);
        }

        if (model === COMPATIBLE_MODELS[COMPATIBLE_MODELS.length - 1]) {
          throw new Error(lastError?.message || 'Error al procesar la solicitud con IA. Por favor, intente nuevamente.');
        }
      }
    }

    throw new Error(lastError?.message || 'No se pudo conectar con el servicio notarial de IA.');
  } finally {
    clearSafetyTimer();
  }
};

export const generateExecutiveSummary = async (history: any[], lang: string, currentUrl: string) => {
  const ai = getGenAI();
  for (const model of COMPATIBLE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          ...history,
          { 
            role: 'user', 
            parts: [{ 
              text: `Genera ahora un resumen ejecutivo ultra-detallado de esta conversación para ser enviado por correo a olga.ihara.feltes@gmail.com. 
              Incluye datos del cliente, documentos anexados y el objetivo del trámite o inversión.
              Usa la herramienta 'sendConversationSummaryToEmail'.
              IMPORTANTE: Incluye este enlace en el campo 'conversationLink' para que la Administración pueda acceder a la conversación: ${currentUrl}` 
            }] 
          }
        ],
        config: {
          systemInstruction: "Eres el asistente de automatización de O.L.G.A.. Tu objetivo es consolidar la conversación para archivo y seguimiento. Habla siempre en español.",
          tools: [{ functionDeclarations: [sendConversationSummaryToEmailDeclaration] }],
        },
      });
      return response.functionCalls;
    } catch (error: any) {
      console.warn(`[generateExecutiveSummary] Error con ${model}:`, error?.message || error);
    }
  }
  return null;
};

export const analyzePagareImage = async (fileBase64: string, mimeType: string) => {
  const ai = getGenAI();
  const cleanData = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  const cleanMime = mimeType === 'image/jpg' ? 'image/jpeg' : (mimeType || 'application/pdf');

  for (const model of COMPATIBLE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
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
}`
            },
            { inlineData: { data: cleanData.replace(/[\r\n\s]/g, ''), mimeType: cleanMime } }
          ]
        }],
        config: {
          systemInstruction: "Eres O.L.G.A., experta notarial. Tu trabajo es extraer metadatos estructurados tolerando errores de OCR. Respeta estrictamente este formato JSON en tu respuesta. Para numeroCertificadoFirmas busca 'CERTIFICACION DE FIRMAS N°' y extrae los 9 dígitos que le siguen. Para deudorPrincipal busca las etiquetas Nombre, Documento y Domicilio al final de la firma. Si un dato no existe, devuélvelo como nulo.",
          responseMimeType: "application/json"
        }
      });
      
      if (response.text) {
        try {
          const text = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          return JSON.parse(text);
        } catch (parseError) {
          console.error("JSON parse error: ", parseError, response.text);
          throw new Error("Error parsing JSON response: " + parseError);
        }
      }
    } catch (error: any) {
      console.warn(`[analyzePagareImage] Error con ${model}:`, error?.message || error);
      if (model === COMPATIBLE_MODELS[COMPATIBLE_MODELS.length - 1]) {
        throw error;
      }
    }
  }
  return null;
};

export const redactarEscritoConIA = async (
  prompt: string,
  contextoActual?: string,
  attachments?: { data: string; mimeType: string; name?: string }[]
): Promise<string> => {
  const ai = getGenAI();

  // Modelos compatibles y estables para este entorno (evita el error 404 de Requested entity was not found)
  const modelsToTry = COMPATIBLE_MODELS;

  // Preparar contenido de texto
  const userParts: any[] = [];
  
  let instruccionCompleta = `Actúa como O.L.G.A., abogada y escribana experta en derecho notarial y civil de la República del Paraguay.
Tu tarea es redactar o adaptar con máxima precisión jurídica y formalidad notarial el documento, contrato o cláusula solicitado por el usuario.
Usa terminología técnica notarial paraguaya, cláusulas claras y precisas, y estilo profesional.

SOLICITUD DE REDACCIÓN:
${prompt.trim()}
`;

  if (contextoActual && contextoActual.trim().length > 0) {
    instruccionCompleta += `\nDOCUMENTO / TEXTO ACTUAL EN EL EDITOR (PARA REFERENCIA O INSERCIÓN):\n"""\n${contextoActual.slice(0, 15000)}\n"""\n`;
  }

  userParts.push({ text: instruccionCompleta });

  // Manejo de archivos e imágenes seguro y limpio
  if (attachments && attachments.length > 0) {
    attachments.forEach((att) => {
      if (!att || !att.data) return;

      // Limpiar prefijo data URL y caracteres de salto de línea
      let cleanData = att.data;
      if (cleanData.includes(',')) {
        cleanData = cleanData.split(',')[1];
      }
      cleanData = cleanData.replace(/[\r\n\s]/g, '');

      // Normalizar MIME type
      let mime = (att.mimeType || '').toLowerCase().trim();
      const ext = (att.name || '').split('.').pop()?.toLowerCase() || '';

      if (!mime || mime === 'application/octet-stream') {
        if (ext === 'pdf') mime = 'application/pdf';
        else if (ext === 'png') mime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'webp') mime = 'image/webp';
        else if (ext === 'txt') mime = 'text/plain';
        else mime = 'application/pdf';
      }

      if (mime === 'image/jpg') mime = 'image/jpeg';

      if (cleanData.length > 0) {
        userParts.push({
          inlineData: {
            data: cleanData,
            mimeType: mime
          }
        });
      }
    });
  }

  let lastErrorMessage = '';

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: userParts }],
        config: {
          systemInstruction: "Eres O.L.G.A., redactora legal y notarial de Paraguay. Genera redacciones sólidas, formales, listas para su revisión y uso notarial administrativo. No incluyas introducciones conversacionales innecesarias; entrega directamente el texto legal o la cláusula redactada.",
          ...(model === 'gemini-2.5-flash'
            ? { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }
            : model !== 'gemini-4-hydrogen'
              ? { temperature: 0.2 }
              : {}),
        }
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      lastErrorMessage = errMsg;
      console.warn(`[O.L.G.A. IA] Intento con modelo '${model}' falló (${errMsg}). Probando alternativa...`);
      // Continuar con el siguiente modelo en la lista de respaldo
      continue;
    }
  }

  // Manejo de errores limpio con mensaje descriptivo para la interfaz
  if (lastErrorMessage.includes('404') || lastErrorMessage.includes('not found')) {
    throw new Error('El modelo de IA solicitado no está disponible temporalmente en este entorno. Por favor, reintente.');
  } else if (lastErrorMessage.includes('API key') || lastErrorMessage.includes('apiKey')) {
    throw new Error('Clave de API de Gemini no válida o no configurada.');
  } else if (lastErrorMessage.includes('quota') || lastErrorMessage.includes('429')) {
    throw new Error('Límite de solicitudes de la API alcanzado. Por favor, espere unos segundos.');
  } else if (lastErrorMessage.includes('MIME') || lastErrorMessage.includes('unsupported')) {
    throw new Error('Uno de los archivos adjuntos tiene un formato no admitido. Utilice PDF o imágenes JPG/PNG.');
  } else {
    throw new Error(lastErrorMessage || 'No se pudo generar la redacción con IA. Verifique su conexión e intente nuevamente.');
  }
};
