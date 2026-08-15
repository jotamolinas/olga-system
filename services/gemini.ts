
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

export const sendMessageToOlga = async (
  message: string, 
  history: { role: 'user' | 'model', parts: { text?: string, inlineData?: any }[] }[], 
  lang: string = 'es',
  attachments?: { data: string, mimeType: string }[]
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const userParts: any[] = [];
    if (message) userParts.push({ text: message });
    
    if (attachments && attachments.length > 0) {
      attachments.forEach(attachment => {
        userParts.push({
          inlineData: { data: attachment.data, mimeType: attachment.mimeType }
        });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [...history, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: getSystemInstruction(lang),
        temperature: 0.2,
      },
    });

    return {
      text: response.text,
      functionCalls: null
    };
  } catch (error: any) {
    console.error("Error al contactar a O.L.G.A.:", error);
    return { text: "Error al procesar el archivo adjunto. Por favor, verifica el formato e intenta nuevamente." };
  }
};

export const generateExecutiveSummary = async (history: any[], lang: string, currentUrl: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
  } catch (error) {
    console.error("Error al generar resumen:", error);
    return null;
  }
};

export const analyzePagareImage = async (fileBase64: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
          { inlineData: { data: fileBase64, mimeType } }
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
    return null;
  } catch (error: any) {
    console.error("Error analyzing pagare image/pdf:", error);
    throw error;
  }
};
