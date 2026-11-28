import React, { useState, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import {
  Search,
  Sparkles,
  Copy,
  Check,
  Building2,
  Calendar,
  Banknote,
  FileText,
  Tag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  Landmark,
  Target,
  Server,
  Scale,
  ScrollText,
  Printer,
  Send,
  MessageSquare,
  Filter,
  FolderPlus,
  ExternalLink
} from 'lucide-react';

const DNCP_API_BASE = 'https://olga-dncp-api-933976114072.us-central1.run.app';
const ITEMS_POR_PAGINA = 20;

export interface DncpLlamado {
  ocid?: string;
  id?: string | number;
  idLlamado?: string | number;
  titulo?: string;
  nombre?: string;
  title?: string;
  convocante?: string;
  entidadConvocante?: string;
  organismo?: string;
  modalidad?: string;
  tipoProcedimiento?: string;
  procurementMethodDetails?: string;
  procurementMethod?: string;
  estado?: string;
  montoReferencial?: number | string | null;
  monto?: number | string | null;
  valorEstimado?: number | string | null;
  moneda?: string;
  fechaPublicacion?: string;
  fecha_publicacion?: string;
  fechaCierre?: string;
  fecha_cierre?: string;
  fechaEntregaOfertas?: string;
  url?: string;
  [key: string]: any;
}

interface BriefResult {
  llamado: DncpLlamado;
  ocid: string;
  informe: string;
  perfilEmpresaExplicito?: string;
}

type AsistenteModo = 'viabilidad' | 'propuesta' | 'chat';

interface AsistenteMensaje {
  id: string;
  role: 'user' | 'assistant';
  modo: AsistenteModo;
  titulo: string;
  contenido: string;
  timestamp: string;
}

const ESTADOS_DNCP = [
  'En Convocatoria (Abierta)',
  'En Evaluacion (Cerrada)',
  'Adjudicada',
] as const;

const getLlamadoOcid = (l: DncpLlamado): string => {
  return String(l.ocid || l.tender?.ocid || l.id || l.idLlamado || l.tender?.id || '').trim();
};

const getLlamadoTitulo = (l: DncpLlamado): string => {
  return String(l.titulo || l.nombre || l.title || l.tender?.title || 'Llamado sin título').trim();
};

const getLlamadoConvocante = (l: DncpLlamado): string => {
  return String(
    l.convocante ||
    l.entidadConvocante ||
    l.entidad_convocante ||
    l.organismo ||
    l.buyer?.name ||
    'Entidad no especificada'
  ).trim();
};

const getLlamadoModalidad = (l: DncpLlamado): string => {
  return String(
    l.modalidad ||
    l.tipoProcedimiento ||
    l.tipo_procedimiento ||
    l.procurementMethodDetails ||
    l.procurementMethod ||
    l.tender?.procurementMethodDetails ||
    'No especificada'
  ).trim();
};

const normalizarTextoFiltro = (valor: string): string => {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const getMontoNumerico = (l: DncpLlamado): number | null => {
  const raw =
    l.montoReferencial ??
    l.monto_referencial ??
    l.monto ??
    l.valorEstimado ??
    l.valor_estimado ??
    l.tender?.value?.amount ??
    null;

  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  const rawStr = String(raw).trim();
  if (!rawStr) return null;

  // Soporta formatos como "150.000.000", "150000000" o "150,000,000.00"
  const digitsOnly = rawStr.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  // Si termina en .00 o ,00 quitar decimales antes de parsear
  const sinDecimales = rawStr.replace(/[.,]\d{1,2}$/, '');
  const limpio = sinDecimales.replace(/[^\d]/g, '');
  const parsed = Number(limpio);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatMontoGs = (l: DncpLlamado): string => {
  const raw =
    l.montoReferencial ??
    l.monto_referencial ??
    l.monto ??
    l.valorEstimado ??
    l.valor_estimado ??
    l.tender?.value?.amount ??
    null;

  if (raw === null || raw === undefined || raw === '') {
    return 'Monto en pliego / No informado';
  }

  const numeric = getMontoNumerico(l);
  if (numeric === null) {
    return 'Monto en pliego / No informado';
  }

  const monedaRaw = String(l.moneda || l.currency || l.tender?.value?.currency || 'PYG').toUpperCase().trim();
  const monedaLabel = monedaRaw === 'PYG' || monedaRaw === 'GS' || monedaRaw === 'GS.' ? 'Gs.' : monedaRaw;
  const formatted = Math.round(numeric).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${monedaLabel} ${formatted}`;
};

type EncajeNivel = 'encaja' | 'alianza' | 'baja';

interface EncajeResultado {
  nivel: EncajeNivel;
  label: string;
  badgeClass: string;
}

const calcularEncajePerfil = (l: DncpLlamado): EncajeResultado => {
  const tituloNorm = normalizarTextoFiltro(getLlamadoTitulo(l));
  const modalidadNorm = normalizarTextoFiltro(getLlamadoModalidad(l));
  const monto = getMontoNumerico(l);

  const esExclusionFisicaOLicencia =
    /\b(licencia|licencias|microsoft|oracle|sap|fortinet|cisco|adobe|vmware|autodesk|antivirus|kaspersky|hardware|computadora|computadoras|notebook|notebooks|laptop|laptops|servidor|servidores|impresora|impresoras|toner|cartucho|ups|switch|router|cableado|obra|obras|construccion|refaccion|vial|asfalto|pavimento|limpieza|vigilancia|combustible|lubricante|vehiculo|vehiculos|camioneta|alimento|alimentos|catering|medicamento|medicamentos|insumo|insumos|mobiliario|mueble|muebles|uniforme|uniformes|papeleria)\b/.test(
      tituloNorm
    ) ||
    /\bsistema\s+de\s+(aire\s+acondicionado|refrigeracion|climatizacion|incendio|incendios|hidraulico|riego|vigilancia|cctv|camaras|alarma|energia|iluminacion|electrico|bombeo)\b/.test(
      tituloNorm
    );

  const esMontoMuyElevado = monto !== null && monto > 1_500_000_000;
  const esMontoAlto = monto !== null && monto > 500_000_000;

  if (esExclusionFisicaOLicencia || esMontoMuyElevado) {
    return {
      nivel: 'baja',
      label: 'Baja afinidad',
      badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    };
  }

  const esAlianzaTi =
    /\b(fabrica\s+de\s+software|ciberseguridad|seguridad\s+informatica|tecnologia\s+de\s+la\s+informacion|ti|infraestructura\s+ti|datacenter|data\s+center|soporte\s+tecnico|redes|telefonia|erp|mesa\s+de\s+ayuda|helpdesk)\b/.test(
      tituloNorm
    );

  if (esAlianzaTi || esMontoAlto) {
    return {
      nivel: 'alianza',
      label: 'Evaluar alianza / apoyo',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }

  const esAltoEncaje =
    /\b(software|sistema|sistemas|web|plataforma|plataformas|desarrollo|digitalizacion|digitalizar|consultoria|consultorias|ia|inteligencia\s+artificial|saas|aplicacion|aplicaciones|app|portal|automatizacion|gestion\s+documental|analitica|datos)\b/.test(
      tituloNorm
    );

  if (esAltoEncaje) {
    return {
      nivel: 'encaja',
      label: 'Encaja con perfil',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
  }

  const esConsultoriaGeneral =
    (modalidadNorm.includes('contratacion directa') || modalidadNorm.includes('menor cuantia')) &&
    /\b(servicio|servicios|asesoria|capacitacion|estudio|auditoria|diagnostico)\b/.test(tituloNorm);

  if (esConsultoriaGeneral) {
    return {
      nivel: 'alianza',
      label: 'Evaluar alianza / apoyo',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }

  return {
    nivel: 'baja',
    label: 'Baja afinidad',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
  };
};

const formatFecha = (val?: string | null): string => {
  if (!val) return '—';
  const trimmed = String(val).trim();
  if (!trimmed) return '—';
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const splitInformeYPerfil = (
  rawInforme: string,
  explicitPerfil?: string
): { cuerpo: string; perfilEncaje: string | null } => {
  const cleanText = String(rawInforme || '').trim();
  if (!cleanText) {
    return {
      cuerpo: '',
      perfilEncaje: explicitPerfil ? explicitPerfil.trim() : null,
    };
  }

  // Detecta sección final "Perfil de empresa que encaja" (con o sin markdown **, ##, :)
  const regex = /(?:^|\n)\s*(?:#{1,4}\s*|\*{1,2})?(?:\d+[\.\)]\s*)?perfil\s+de\s+empresa\s+que\s+encaja\b[:\*\s-]*(.*)$/is;
  const match = cleanText.match(regex);

  if (match && typeof match.index === 'number') {
    const cuerpo = cleanText.slice(0, match.index).trim();
    const extracted = (match[1] || '').replace(/^\*{1,2}\s*/, '').trim();
    return {
      cuerpo,
      perfilEncaje: extracted || explicitPerfil?.trim() || null,
    };
  }

  return {
    cuerpo: cleanText,
    perfilEncaje: explicitPerfil ? explicitPerfil.trim() : null,
  };
};

const escapeHtml = (value: string): string => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string };

const parseInlineMarkdown = (rawLine: string): InlineToken[] => {
  const cleaned = String(rawLine || '');
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|\*(?!\s)[^*\n]+?(?<!\s)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      const plainBefore = cleaned.slice(lastIndex, match.index).replace(/\*\*/g, '');
      if (plainBefore) tokens.push({ type: 'text', text: plainBefore });
    }

    const tokenStr = match[0];
    if (tokenStr.startsWith('**') && tokenStr.endsWith('**')) {
      tokens.push({ type: 'bold', text: tokenStr.slice(2, -2) });
    } else if (tokenStr.startsWith('__') && tokenStr.endsWith('__')) {
      tokens.push({ type: 'bold', text: tokenStr.slice(2, -2) });
    } else if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
      tokens.push({ type: 'code', text: tokenStr.slice(1, -1) });
    } else if (tokenStr.startsWith('*') && tokenStr.endsWith('*')) {
      tokens.push({ type: 'italic', text: tokenStr.slice(1, -1) });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    const plainAfter = cleaned.slice(lastIndex).replace(/\*\*/g, '');
    if (plainAfter) tokens.push({ type: 'text', text: plainAfter });
  }

  if (tokens.length === 0) {
    return [{ type: 'text', text: cleaned.replace(/\*\*/g, '') }];
  }
  return tokens;
};

const stripMarkdownInline = (rawLine: string): string => {
  return parseInlineMarkdown(rawLine)
    .map((t) => t.text)
    .join('');
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'checklist'; items: { checked: boolean; text: string }[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'paragraph'; text: string };

const parseMarkdownBlocks = (rawText: string): MarkdownBlock[] => {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Separador horizontal (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Encabezados (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Citas (> ...)
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, '').trim());
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines.filter(Boolean) });
      continue;
    }

    // Checklist (- [ ] / - [x] / * [ ])
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
        if (!m) break;
        items.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() });
        i++;
      }
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // Lista desordenada (-, *, •)
    if (/^([-*+]|•)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^[-*+]\s+\[[ xX]\]\s+/.test(t)) break;
        const m = t.match(/^(?:[-*+]|•)\s+(.+)$/);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Lista numerada (1. / 1) )
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+[.)]\s+(.+)$/);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Párrafo normal (agrupa líneas consecutivas de texto plano)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        !t ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(t) ||
        /^(#{1,4})\s+/.test(t) ||
        /^>\s?/.test(t) ||
        /^([-*+]|•)\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t)
      ) {
        break;
      }
      paraLines.push(t);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
};

const renderInlineReact = (rawLine: string, keyPrefix: string, accent: 'default' | 'amber' = 'default'): React.ReactNode => {
  const tokens = parseInlineMarkdown(rawLine);
  return tokens.map((tok, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (tok.type === 'bold') {
      return (
        <strong key={key} className={accent === 'amber' ? 'font-bold text-amber-50' : 'font-bold text-white'}>
          {tok.text}
        </strong>
      );
    }
    if (tok.type === 'italic') {
      return (
        <em key={key} className="italic">
          {tok.text}
        </em>
      );
    }
    if (tok.type === 'code') {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-blue-200 font-mono text-[11px]"
        >
          {tok.text}
        </code>
      );
    }
    return <React.Fragment key={key}>{tok.text}</React.Fragment>;
  });
};

const renderMarkdownReact = (rawText: string, accent: 'default' | 'amber' = 'default'): React.ReactNode => {
  const blocks = parseMarkdownBlocks(rawText);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        const key = `md-blk-${bIdx}`;
        switch (block.type) {
          case 'hr':
            return <hr key={key} className="border-0 border-t border-white/10 my-3" />;
          case 'heading': {
            if (block.level <= 2) {
              return (
                <h3
                  key={key}
                  className={`text-sm font-bold pt-2 pb-1 border-b border-white/10 ${
                    accent === 'amber' ? 'text-amber-200' : 'text-white'
                  }`}
                >
                  {renderInlineReact(block.text, key, accent)}
                </h3>
              );
            }
            return (
              <h4
                key={key}
                className={`text-xs font-bold uppercase tracking-wide pt-1.5 ${
                  accent === 'amber' ? 'text-amber-300' : 'text-blue-300'
                }`}
              >
                {renderInlineReact(block.text, key, accent)}
              </h4>
            );
          }
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-blue-400/60 bg-white/[0.03] pl-3 pr-2 py-1.5 rounded-r text-slate-300 italic space-y-1"
              >
                {block.lines.map((line, lIdx) => (
                  <p key={`${key}-q-${lIdx}`}>{renderInlineReact(line, `${key}-q-${lIdx}`, accent)}</p>
                ))}
              </blockquote>
            );
          case 'checklist':
            return (
              <ul key={key} className="space-y-1.5 pl-1">
                {block.items.map((item, cIdx) => (
                  <li key={`${key}-c-${cIdx}`} className="flex items-start gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-3.5 h-3.5 mt-0.5 rounded border text-[9px] font-bold shrink-0 ${
                        item.checked
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                          : 'bg-slate-900 border-slate-600 text-transparent'
                      }`}
                    >
                      {item.checked ? '✓' : '·'}
                    </span>
                    <span className="flex-1">{renderInlineReact(item.text, `${key}-c-${cIdx}`, accent)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-5 space-y-1">
                {block.items.map((item, uIdx) => (
                  <li key={`${key}-u-${uIdx}`}>{renderInlineReact(item, `${key}-u-${uIdx}`, accent)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-5 space-y-1">
                {block.items.map((item, oIdx) => (
                  <li key={`${key}-o-${oIdx}`}>{renderInlineReact(item, `${key}-o-${oIdx}`, accent)}</li>
                ))}
              </ol>
            );
          case 'paragraph':
          default:
            return (
              <p key={key} className="leading-relaxed">
                {renderInlineReact(block.text, key, accent)}
              </p>
            );
        }
      })}
    </div>
  );
};

const inlineMarkdownToHtml = (rawLine: string): string => {
  return parseInlineMarkdown(rawLine)
    .map((tok) => {
      if (tok.type === 'bold') return `<strong>${escapeHtml(tok.text)}</strong>`;
      if (tok.type === 'italic') return `<em>${escapeHtml(tok.text)}</em>`;
      if (tok.type === 'code') return `<code>${escapeHtml(tok.text)}</code>`;
      return escapeHtml(tok.text);
    })
    .join('');
};

const markdownToCleanHtml = (rawText: string): string => {
  const blocks = parseMarkdownBlocks(rawText);
  if (blocks.length === 0) return '';

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'hr':
          return '<hr />';
        case 'heading': {
          const tag = block.level <= 2 ? 'h3' : 'h4';
          return `<${tag}>${inlineMarkdownToHtml(block.text)}</${tag}>`;
        }
        case 'blockquote':
          return `<blockquote>${block.lines.map((l) => `<p>${inlineMarkdownToHtml(l)}</p>`).join('')}</blockquote>`;
        case 'checklist':
          return `<ul>${block.items
            .map((it) => `<li>${it.checked ? '&#9745;' : '&#9744;'} ${inlineMarkdownToHtml(it.text)}</li>`)
            .join('')}</ul>`;
        case 'ul':
          return `<ul>${block.items.map((it) => `<li>${inlineMarkdownToHtml(it)}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol>${block.items.map((it) => `<li>${inlineMarkdownToHtml(it)}</li>`).join('')}</ol>`;
        case 'paragraph':
        default:
          return `<p>${inlineMarkdownToHtml(block.text)}</p>`;
      }
    })
    .join('\n');
};

const sanitizeForJsPdf = (text: string): string => {
  return String(text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2713|\u2714/g, 'OK')
    // Elimina emojis / símbolos fuera del rango Latin-1 / WinAnsi común
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u2013\u2014]/g, '');
};

const getPortalDncpUrl = (llamado: DncpLlamado): string => {
  const candidate = String(
    llamado.url || llamado.enlace || llamado.tender?.url || ''
  ).trim();
  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return 'https://www.contrataciones.gov.py/licitaciones/buscador.html';
};

export const SuperAdminLicitacionesTab: React.FC = () => {
  const [titulo, setTitulo] = useState<string>('');
  const [convocante, setConvocante] = useState<string>('');
  const [estado, setEstado] = useState<string>('En Convocatoria (Abierta)');

  const [llamados, setLlamados] = useState<DncpLlamado[]>([]);
  const [pagina, setPagina] = useState<number>(1);
  const [totalResultados, setTotalResultados] = useState<number | null>(null);
  const [totalPaginas, setTotalPaginas] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefResult, setBriefResult] = useState<BriefResult | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  const [historial, setHistorial] = useState<AsistenteMensaje[]>([]);
  const [asistenteLoadingModo, setAsistenteLoadingModo] = useState<AsistenteModo | null>(null);
  const [asistenteError, setAsistenteError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [savingToDocs, setSavingToDocs] = useState<boolean>(false);
  const [savedToDocs, setSavedToDocs] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // Filtros rápidos en pantalla sobre resultados ya cargados (sin IA)
  const [filtroMontoMax, setFiltroMontoMax] = useState<string>('todos');
  const [filtroModalidad, setFiltroModalidad] = useState<string>('todas');
  const [filtroEncaje, setFiltroEncaje] = useState<string>('todos');

  const llamadosEvaluados = useMemo(() => {
    return llamados.map((llamado) => ({
      llamado,
      montoNumerico: getMontoNumerico(llamado),
      modalidadNorm: normalizarTextoFiltro(getLlamadoModalidad(llamado)),
      encaje: calcularEncajePerfil(llamado),
    }));
  }, [llamados]);

  const llamadosFiltrados = useMemo(() => {
    const modalidadFilterNorm = normalizarTextoFiltro(filtroModalidad);

    return llamadosEvaluados.filter(({ montoNumerico, modalidadNorm, encaje }) => {
      if (filtroMontoMax === 'sin_monto') {
        if (montoNumerico !== null) return false;
      } else if (filtroMontoMax !== 'todos') {
        const tope = Number(filtroMontoMax);
        if (!Number.isNaN(tope)) {
          if (montoNumerico === null || montoNumerico > tope) return false;
        }
      }

      if (filtroModalidad !== 'todas') {
        if (!modalidadNorm.includes(modalidadFilterNorm)) return false;
      }

      if (filtroEncaje === 'encaja' && encaje.nivel !== 'encaja') return false;
      if (filtroEncaje === 'alianza' && encaje.nivel !== 'alianza') return false;
      if (filtroEncaje === 'descartar_baja' && encaje.nivel === 'baja') return false;

      return true;
    });
  }, [llamadosEvaluados, filtroMontoMax, filtroModalidad, filtroEncaje]);

  const hayFiltrosRapidosActivos =
    filtroMontoMax !== 'todos' || filtroModalidad !== 'todas' || filtroEncaje !== 'todos';

  const resetFiltrosRapidos = () => {
    setFiltroMontoMax('todos');
    setFiltroModalidad('todas');
    setFiltroEncaje('todos');
  };

  const buscarLlamados = async (targetPage = 1) => {
    setLoadingSearch(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set('pagina', String(targetPage));
      params.set('itemsPorPagina', String(ITEMS_POR_PAGINA));
      if (titulo.trim()) params.set('titulo', titulo.trim());
      if (convocante.trim()) params.set('convocante', convocante.trim());
      if (estado.trim()) params.set('estado', estado.trim());

      const response = await fetch(`${DNCP_API_BASE}/api/dncp/llamados?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg =
          data?.mensaje ||
          data?.message ||
          data?.error ||
          `Error al consultar la API DNCP (${response.status})`;
        throw new Error(msg);
      }

      const lista: DncpLlamado[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.llamados)
          ? data.llamados
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data?.data)
                ? data.data
                : [];

      const total =
        typeof data?.total === 'number'
          ? data.total
          : typeof data?.totalResultados === 'number'
            ? data.totalResultados
            : typeof data?.pagination?.total === 'number'
              ? data.pagination.total
              : null;

      const calcTotalPages =
        typeof data?.totalPaginas === 'number'
          ? data.totalPaginas
          : typeof data?.pagination?.totalPages === 'number'
            ? data.pagination.totalPages
            : total !== null
              ? Math.max(1, Math.ceil(total / ITEMS_POR_PAGINA))
              : null;

      setLlamados(lista);
      setPagina(targetPage);
      setTotalResultados(total);
      setTotalPaginas(calcTotalPages);
    } catch (err: any) {
      console.error('Error buscando llamados DNCP:', err);
      setSearchError(
        err?.message || 'No se pudo conectar con el servicio DNCP en Cloud Run.'
      );
      setLlamados([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    buscarLlamados(1);
  };

  const handleAnalizarConIA = async (llamado: DncpLlamado, idx: number) => {
    const ocid = getLlamadoOcid(llamado);
    const key = ocid || `idx-${idx}`;

    setAnalyzingKey(key);
    setBriefError(null);
    setCopiedBrief(false);

    try {
      const response = await fetch(`${DNCP_API_BASE}/api/dncp/brief-ia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ocid,
          llamado,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg =
          data?.mensaje ||
          data?.message ||
          data?.error ||
          `Error al generar informe IA (${response.status})`;
        throw new Error(msg);
      }

      const informeTexto = String(
        data?.informe || data?.brief || data?.reporte || data?.resultado || ''
      ).trim();

      if (!informeTexto) {
        throw new Error('La API devolvió una respuesta sin contenido de informe.');
      }

      setBriefResult({
        llamado,
        ocid,
        informe: informeTexto,
        perfilEmpresaExplicito:
          typeof data?.perfilEmpresa === 'string'
            ? data.perfilEmpresa
            : typeof data?.perfil_empresa === 'string'
              ? data.perfil_empresa
              : undefined,
      });
      setHistorial([]);
      setAsistenteError(null);
      setChatInput('');
      setAsistenteLoadingModo(null);
      setSavedToDocs(false);
    } catch (err: any) {
      console.error('Error generando brief IA DNCP:', err);
      setBriefError(
        err?.message || 'No se pudo generar el informe ejecutivo con IA.'
      );
    } finally {
      setAnalyzingKey(null);
    }
  };

  const handleConsultarAsistente = async (modo: AsistenteModo, mensajeUsuario?: string) => {
    if (!briefResult || asistenteLoadingModo !== null) return;

    const mensajeLimpio = String(mensajeUsuario || '').trim();
    if (modo === 'chat' && !mensajeLimpio) return;

    setAsistenteLoadingModo(modo);
    setAsistenteError(null);

    const historialParaApi = historial.map((item) => ({
      role: item.role,
      content: item.contenido,
      contenido: item.contenido,
      modo: item.modo,
    }));

    let userEntry: AsistenteMensaje | null = null;
    if (modo === 'chat') {
      userEntry = {
        id: `usr-${Date.now()}`,
        role: 'user',
        modo: 'chat',
        titulo: 'Consulta de seguimiento',
        contenido: mensajeLimpio,
        timestamp: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatInput('');
      setHistorial((prev) => [...prev, userEntry!]);
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }

    try {
      const payload: Record<string, any> = {
        modo,
        llamado: briefResult.llamado,
        informeBase: briefResult.informe,
        historial: historialParaApi,
      };

      if (modo === 'chat') {
        payload.mensajeUsuario = mensajeLimpio;
      }

      const response = await fetch(`${DNCP_API_BASE}/api/dncp/asistente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg =
          data?.mensaje ||
          data?.message ||
          data?.error ||
          `Error en asistente DNCP (${response.status})`;
        throw new Error(msg);
      }

      const respuestaTexto = String(
        data?.respuesta ||
        data?.informe ||
        data?.propuesta ||
        data?.contenido ||
        data?.mensaje ||
        data?.resultado ||
        data?.text ||
        ''
      ).trim();

      if (!respuestaTexto) {
        throw new Error('El asistente no devolvió contenido para mostrar.');
      }

      const assistantTitulo =
        modo === 'viabilidad'
          ? 'Posibilidades Reales (Pros y Contras)'
          : modo === 'propuesta'
            ? 'Propuesta Técnica / Documental'
            : 'Respuesta del Asistente DNCP';

      const assistantEntry: AsistenteMensaje = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        modo,
        titulo: assistantTitulo,
        contenido: respuestaTexto,
        timestamp: new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
      };

      setHistorial((prev) => [...prev, assistantEntry]);
      setSavedToDocs(false);
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err: any) {
      console.error('Error consultando asistente DNCP:', err);
      setAsistenteError(
        err?.message || 'No se pudo completar la consulta con el asistente DNCP.'
      );
    } finally {
      setAsistenteLoadingModo(null);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConsultarAsistente('chat', chatInput);
  };

  const handleCopiarInforme = async () => {
    if (!briefResult) return;
    let textToCopy = briefResult.perfilEmpresaExplicito &&
      !briefResult.informe.toLowerCase().includes('perfil de empresa que encaja')
      ? `${briefResult.informe}\n\nPerfil de empresa que encaja:\n${briefResult.perfilEmpresaExplicito}`
      : briefResult.informe;

    if (historial.length > 0) {
      const hiloTexto = historial
        .map((item) => `--- ${item.titulo.toUpperCase()} (${item.timestamp}) ---\n${item.contenido}`)
        .join('\n\n');
      textToCopy = `${textToCopy}\n\n${hiloTexto}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2500);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedBrief(true);
        setTimeout(() => setCopiedBrief(false), 2500);
      } catch {}
    }
  };

  const handleGuardarEnMisDocumentos = async () => {
    if (!briefResult || savingToDocs) return;

    const user = auth?.currentUser as any;
    if (!user?.uid) {
      setAsistenteError('Debes tener una sesión activa para guardar en Mis Documentos.');
      return;
    }

    setSavingToDocs(true);
    setAsistenteError(null);

    try {
      const currentParsed = splitInformeYPerfil(
        briefResult.informe,
        briefResult.perfilEmpresaExplicito
      );
      const llamado = briefResult.llamado;
      const fechaPub = formatFecha(
        llamado.fechaPublicacion || llamado.fecha_publicacion || llamado.tender?.tenderPeriod?.startDate
      );
      const fechaCierre = formatFecha(
        llamado.fechaCierre ||
          llamado.fecha_cierre ||
          llamado.fechaEntregaOfertas ||
          llamado.tender?.tenderPeriod?.endDate
      );

      const tituloLlamado = getLlamadoTitulo(llamado);
      const tituloCorto = tituloLlamado.slice(0, 90);
      const docTipo = briefResult.ocid
        ? `Licitación DNCP · ${briefResult.ocid} - ${tituloCorto}`
        : `Licitación DNCP - ${tituloCorto}`;

      const historialHtml = historial.length > 0
        ? `
          <hr />
          <h3>Hilo de Análisis y Propuestas Generadas</h3>
          ${historial
            .map(
              (item) => `
              <div>
                <h4>${escapeHtml(item.titulo)} (${escapeHtml(item.timestamp)})</h4>
                ${markdownToCleanHtml(item.contenido)}
              </div>
            `
            )
            .join('\n')}
        `
        : '';

      const compiledHtml = `
        <h2>${escapeHtml(tituloLlamado)}</h2>
        <p><strong>Categoría:</strong> Licitación DNCP<br />
        <strong>OCID / ID:</strong> ${escapeHtml(briefResult.ocid || '—')}<br />
        <strong>Entidad Convocante:</strong> ${escapeHtml(getLlamadoConvocante(llamado))}<br />
        <strong>Modalidad:</strong> ${escapeHtml(getLlamadoModalidad(llamado))}<br />
        <strong>Estado:</strong> ${escapeHtml(llamado.estado || '—')}<br />
        <strong>Monto Referencial:</strong> ${escapeHtml(formatMontoGs(llamado))}<br />
        <strong>Publicación / Cierre:</strong> ${escapeHtml(fechaPub)} · ${escapeHtml(fechaCierre)}</p>
        <hr />
        <h3>Informe Ejecutivo IA — DNCP</h3>
        ${currentParsed.cuerpo ? markdownToCleanHtml(currentParsed.cuerpo) : ''}
        ${
          currentParsed.perfilEncaje
            ? `<h3>Perfil de empresa que encaja</h3>${markdownToCleanHtml(currentParsed.perfilEncaje)}`
            : ''
        }
        ${historialHtml}
      `.trim();

      const effectiveUserId = String(user.uid).trim();
      const creatorName =
        user.displayName || user.nombre || user.email?.split('@')[0] || 'SuperAdmin';

      await addDoc(collection(db, 'documentos_olga'), {
        texto: compiledHtml,
        tipo: docTipo,
        categoria: 'Licitación DNCP',
        tipoHoja: 'blanca',
        tipoPapel: 'blanco',
        modoImpresion: 'simple',
        includeHeader: false,
        fontFamily: 'Times New Roman',
        fontSizePt: 11,
        lineHeight: 1.5,
        userId: effectiveUserId,
        creator_id: user.uid,
        createdBy: user.uid,
        creator_name: creatorName,
        creator_role: 'SUPERADMIN',
        origen: 'LICITACIONES_DNCP',
        ocid: briefResult.ocid || '',
        createdAt: new Date().toISOString(),
        fechaCreacion: serverTimestamp(),
      });

      setSavedToDocs(true);
    } catch (err: any) {
      console.error('Error guardando licitación en Mis Documentos:', err);
      setAsistenteError(
        err?.message || 'No se pudo guardar el informe en Mis Documentos.'
      );
    } finally {
      setSavingToDocs(false);
    }
  };

  const handleImprimirGuardarPDF = () => {
    if (!briefResult || generatingPdf) return;
    setGeneratingPdf(true);
    setAsistenteError(null);

    try {
      const currentParsed = splitInformeYPerfil(
        briefResult.informe,
        briefResult.perfilEmpresaExplicito
      );
      const llamado = briefResult.llamado;
      const fechaPub = formatFecha(
        llamado.fechaPublicacion || llamado.fecha_publicacion || llamado.tender?.tenderPeriod?.startDate
      );
      const fechaCierre = formatFecha(
        llamado.fechaCierre ||
          llamado.fecha_cierre ||
          llamado.fechaEntregaOfertas ||
          llamado.tender?.tenderPeriod?.endDate
      );
      const fechaEmision = new Date().toLocaleString('es-PY', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 16;
      const marginTop = 16;
      const marginBottom = 16;
      const contentW = pageW - marginX * 2;
      let cursorY = marginTop;

      const ensureSpace = (neededMm: number) => {
        if (cursorY + neededMm > pageH - marginBottom) {
          pdf.addPage();
          cursorY = marginTop;
        }
      };

      const drawWrappedParagraph = (
        rawLine: string,
        opts: {
          x?: number;
          maxW?: number;
          fontSize?: number;
          lineH?: number;
          bold?: boolean;
          italic?: boolean;
          color?: [number, number, number];
        } = {}
      ) => {
        const x = opts.x ?? marginX;
        const maxW = opts.maxW ?? contentW;
        const fontSize = opts.fontSize ?? 10;
        const lineH = opts.lineH ?? 4.8;
        const color = opts.color ?? [30, 41, 59];

        const cleanLine = sanitizeForJsPdf(stripMarkdownInline(rawLine));
        if (!cleanLine.trim()) return;

        pdf.setFont('helvetica', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal');
        pdf.setFontSize(fontSize);
        pdf.setTextColor(color[0], color[1], color[2]);

        const wrapped: string[] = pdf.splitTextToSize(cleanLine, maxW);
        for (const line of wrapped) {
          ensureSpace(lineH + 1);
          pdf.text(line, x, cursorY);
          cursorY += lineH;
        }
      };

      const drawMarkdownInPdf = (rawMarkdown: string) => {
        const blocks = parseMarkdownBlocks(rawMarkdown);
        for (const block of blocks) {
          switch (block.type) {
            case 'hr': {
              ensureSpace(5);
              cursorY += 1.5;
              pdf.setDrawColor(203, 213, 225);
              pdf.setLineWidth(0.3);
              pdf.line(marginX, cursorY, pageW - marginX, cursorY);
              cursorY += 3.5;
              break;
            }
            case 'heading': {
              ensureSpace(9);
              cursorY += 2;
              const isMajor = block.level <= 2;
              drawWrappedParagraph(block.text, {
                fontSize: isMajor ? 11.5 : 10.5,
                lineH: isMajor ? 5.5 : 5,
                bold: true,
                color: isMajor ? [15, 23, 42] : [30, 64, 175],
              });
              cursorY += 1;
              break;
            }
            case 'blockquote': {
              ensureSpace(8);
              const quoteStartY = cursorY - 2;
              for (const qLine of block.lines) {
                drawWrappedParagraph(qLine, {
                  x: marginX + 5,
                  maxW: contentW - 6,
                  fontSize: 9.5,
                  lineH: 4.5,
                  italic: true,
                  color: [71, 85, 105],
                });
              }
              const quoteEndY = Math.max(quoteStartY + 4, cursorY - 1);
              pdf.setDrawColor(59, 130, 246);
              pdf.setLineWidth(0.8);
              pdf.line(marginX + 1.5, quoteStartY, marginX + 1.5, quoteEndY);
              cursorY += 2;
              break;
            }
            case 'checklist': {
              for (const item of block.items) {
                ensureSpace(6);
                pdf.setDrawColor(100, 116, 139);
                pdf.setLineWidth(0.3);
                pdf.rect(marginX + 1, cursorY - 3, 2.8, 2.8);
                if (item.checked) {
                  pdf.setFont('helvetica', 'bold');
                  pdf.setFontSize(8);
                  pdf.setTextColor(16, 185, 129);
                  pdf.text('x', marginX + 1.7, cursorY - 0.8);
                }
                drawWrappedParagraph(item.text, {
                  x: marginX + 6,
                  maxW: contentW - 6,
                  fontSize: 9.8,
                  lineH: 4.7,
                });
                cursorY += 0.8;
              }
              cursorY += 1.5;
              break;
            }
            case 'ul': {
              for (const item of block.items) {
                ensureSpace(5);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(51, 65, 85);
                pdf.text('-', marginX + 1.5, cursorY);
                drawWrappedParagraph(item, {
                  x: marginX + 5.5,
                  maxW: contentW - 5.5,
                  fontSize: 9.8,
                  lineH: 4.7,
                });
                cursorY += 0.8;
              }
              cursorY += 1.5;
              break;
            }
            case 'ol': {
              block.items.forEach((item, idx) => {
                ensureSpace(5);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9.8);
                pdf.setTextColor(51, 65, 85);
                pdf.text(`${idx + 1}.`, marginX + 0.5, cursorY);
                drawWrappedParagraph(item, {
                  x: marginX + 6.5,
                  maxW: contentW - 6.5,
                  fontSize: 9.8,
                  lineH: 4.7,
                });
                cursorY += 0.8;
              });
              cursorY += 1.5;
              break;
            }
            case 'paragraph':
            default: {
              drawWrappedParagraph(block.text, {
                fontSize: 10,
                lineH: 4.8,
              });
              cursorY += 1.8;
              break;
            }
          }
        }
      };

      // Encabezado O.L.G.A.
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text('O.L.G.A.', marginX, cursorY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(sanitizeForJsPdf(`Emitido: ${fechaEmision}`), pageW - marginX, cursorY, { align: 'right' });

      cursorY += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('INTELIGENCIA Y ANALISIS DE LICITACIONES DNCP', marginX, cursorY);

      cursorY += 3;
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.6);
      pdf.line(marginX, cursorY, pageW - marginX, cursorY);
      cursorY += 6;

      // Ficha del Llamado DNCP
      drawWrappedParagraph(getLlamadoTitulo(llamado), {
        fontSize: 12,
        lineH: 5.5,
        bold: true,
        color: [15, 23, 42],
      });
      cursorY += 2;

      const metaRows = [
        `OCID / ID: ${briefResult.ocid || '—'}   |   Estado: ${llamado.estado || '—'}`,
        `Entidad Convocante: ${getLlamadoConvocante(llamado)}`,
        `Modalidad: ${getLlamadoModalidad(llamado)}   |   Monto Referencial: ${formatMontoGs(llamado)}`,
        `Publicación / Cierre: ${fechaPub} · ${fechaCierre}`,
      ];
      for (const row of metaRows) {
        drawWrappedParagraph(row, {
          fontSize: 9.2,
          lineH: 4.4,
          color: [51, 65, 85],
        });
      }

      cursorY += 2;
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, cursorY, pageW - marginX, cursorY);
      cursorY += 6;

      // Informe Ejecutivo Base
      drawWrappedParagraph('INFORME EJECUTIVO IA - DNCP', {
        fontSize: 11,
        lineH: 5.5,
        bold: true,
        color: [15, 23, 42],
      });
      cursorY += 1.5;

      if (currentParsed.cuerpo) {
        drawMarkdownInPdf(currentParsed.cuerpo);
      }

      if (currentParsed.perfilEncaje) {
        ensureSpace(14);
        cursorY += 2;
        drawWrappedParagraph('PERFIL DE EMPRESA QUE ENCAJA', {
          fontSize: 10.5,
          lineH: 5,
          bold: true,
          color: [180, 83, 9],
        });
        cursorY += 1;
        drawMarkdownInPdf(currentParsed.perfilEncaje);
      }

      // Hilo de Análisis y Propuestas
      if (historial.length > 0) {
        ensureSpace(14);
        cursorY += 3;
        pdf.setDrawColor(148, 163, 184);
        pdf.setLineWidth(0.4);
        pdf.line(marginX, cursorY, pageW - marginX, cursorY);
        cursorY += 6;

        drawWrappedParagraph('ANALISIS COMPLEMENTARIO Y PROPUESTAS GENERADAS', {
          fontSize: 11,
          lineH: 5.5,
          bold: true,
          color: [15, 23, 42],
        });
        cursorY += 2;

        for (const item of historial) {
          ensureSpace(12);
          drawWrappedParagraph(`${item.titulo} (${item.timestamp})`, {
            fontSize: 10,
            lineH: 5,
            bold: true,
            color: item.role === 'user' ? [71, 85, 105] : [30, 64, 175],
          });
          cursorY += 1;
          drawMarkdownInPdf(item.contenido);
          cursorY += 3;
        }
      }

      const safeOcid = (briefResult.ocid || 'sin_ocid').replace(/[^a-zA-Z0-9_-]+/g, '_');
      pdf.save(`Licitacion_DNCP_${safeOcid}.pdf`);
    } catch (err: any) {
      console.error('Error generando PDF con jsPDF:', err);
      setAsistenteError(err?.message || 'No se pudo generar el archivo PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const puedeIrSiguiente = totalPaginas !== null
    ? pagina < totalPaginas
    : llamados.length === ITEMS_POR_PAGINA;

  const parsedBrief = briefResult
    ? splitInformeYPerfil(briefResult.informe, briefResult.perfilEmpresaExplicito)
    : null;

  return (
    <div className="p-3 md:p-6 w-full max-w-6xl mx-auto text-slate-200 space-y-5">
      {/* Header exclusivo SuperAdmin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            SuperAdmin · Inteligencia DNCP
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-400 shrink-0" />
            <span>Licitaciones DNCP</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Buscador directo de llamados públicos de la DNCP con análisis ejecutivo bajo demanda.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0B1120] border border-gray-800 rounded-lg px-3 py-1.5 self-start sm:self-auto text-xs text-slate-400">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span>API: <strong className="text-slate-200">olga-dncp-api</strong></span>
        </div>
      </div>

      {/* Buscador y Filtros (sin IA) */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-[#0B1120] border border-gray-800 rounded-xl p-4 md:p-5 space-y-4 shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Título / Palabra clave
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder='Ej: "vehículos", "limpieza", "software", "mantenimiento"'
              className="w-full px-3.5 py-2.5 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Entidad Convocante <span className="text-slate-500 font-normal normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={convocante}
              onChange={(e) => setConvocante(e.target.value)}
              placeholder="Ej: Ministerio, IPS, ANDE, Municipalidad..."
              className="w-full px-3.5 py-2.5 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white outline-none transition-colors"
            >
              {ESTADOS_DNCP.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500">
            Paginación estándar: {ITEMS_POR_PAGINA} llamados por página. El análisis IA se ejecuta solo bajo clic.
          </p>

          <button
            type="submit"
            disabled={loadingSearch}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            {loadingSearch ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{loadingSearch ? 'Buscando en DNCP...' : 'Buscar en DNCP'}</span>
          </button>
        </div>
      </form>

      {/* Errores de búsqueda o de IA */}
      {searchError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Error en consulta DNCP</p>
              <p className="mt-0.5 text-rose-200/90">{searchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSearchError(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {briefError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Error al generar informe IA</p>
              <p className="mt-0.5 text-rose-200/90">{briefError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBriefError(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Listado de llamados */}
      {!hasSearched ? (
        <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-10 text-center space-y-2">
          <Search className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">
            Ingresá filtros y presioná &ldquo;Buscar en DNCP&rdquo;
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Podés filtrar por palabra clave en el título, entidad convocante y estado del llamado en la DNCP.
          </p>
        </div>
      ) : loadingSearch ? (
        <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-10 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-400">
            Consultando llamados en la DNCP (página {pagina})...
          </p>
        </div>
      ) : llamados.length === 0 ? (
        <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">
            No se encontraron llamados con esos filtros
          </p>
          <p className="text-xs text-slate-500">
            Probá con otra palabra clave, quitá el filtro de convocante o cambiá el estado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Panel de Filtros Rápidos sobre resultados cargados (sin IA) */}
          <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 md:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Filtros Rápidos en Pantalla (Sin IA)
                </span>
              </div>
              {hayFiltrosRapidosActivos && (
                <button
                  type="button"
                  onClick={resetFiltrosRapidos}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Limpiar filtros rápidos
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Monto máximo (Gs.)
                </label>
                <select
                  value={filtroMontoMax}
                  onChange={(e) => setFiltroMontoMax(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white outline-none transition-colors"
                >
                  <option value="todos">Todos</option>
                  <option value="150000000">Hasta Gs. 150.000.000</option>
                  <option value="300000000">Hasta Gs. 300.000.000</option>
                  <option value="500000000">Hasta Gs. 500.000.000</option>
                  <option value="sin_monto">Sin monto / A consultar</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Modalidad
                </label>
                <select
                  value={filtroModalidad}
                  onChange={(e) => setFiltroModalidad(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white outline-none transition-colors"
                >
                  <option value="todas">Todas</option>
                  <option value="Contratación Directa">Contratación Directa</option>
                  <option value="Menor Cuantía">Menor Cuantía</option>
                  <option value="Subasta a la Baja">Subasta a la Baja</option>
                  <option value="Licitación Pública">Licitación Pública</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Encaje con perfil SaaS / IA / Consultoría
                </label>
                <select
                  value={filtroEncaje}
                  onChange={(e) => setFiltroEncaje(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121826] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white outline-none transition-colors"
                >
                  <option value="todos">Todos</option>
                  <option value="encaja">Alto encaje (Software/Web/IA/Consultoría)</option>
                  <option value="alianza">Posible alianza/apoyo (TI/Sistemas)</option>
                  <option value="descartar_baja">Descartar licencias/hardware/obras</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resumen + Paginación superior */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-slate-400">
              Mostrando <strong className="text-white">{llamadosFiltrados.length}</strong>
              {hayFiltrosRapidosActivos ? ` de ${llamados.length}` : ''} llamado(s) · Página{' '}
              <strong className="text-white">{pagina}</strong>
              {totalPaginas !== null ? ` de ${totalPaginas}` : ''}
              {totalResultados !== null ? ` (${totalResultados} en total)` : ''}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagina <= 1 || loadingSearch}
                onClick={() => buscarLlamados(pagina - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-gray-800 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={!puedeIrSiguiente || loadingSearch}
                onClick={() => buscarLlamados(pagina + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-gray-800 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjetas de llamados */}
          {llamadosFiltrados.length === 0 ? (
            <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-8 text-center space-y-2">
              <Filter className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Ningún llamado de esta página coincide con los filtros rápidos
              </p>
              <p className="text-xs text-slate-500">
                Ajustá los filtros rápidos o limpiálos para ver los {llamados.length} llamados cargados.
              </p>
            </div>
          ) : (
          <div className="space-y-3">
            {llamadosFiltrados.map(({ llamado, encaje }, idx) => {
              const ocid = getLlamadoOcid(llamado);
              const itemKey = ocid || `idx-${idx}`;
              const isAnalyzing = analyzingKey === itemKey;
              const fechaPub = formatFecha(
                llamado.fechaPublicacion || llamado.fecha_publicacion || llamado.tender?.tenderPeriod?.startDate
              );
              const fechaCierre = formatFecha(
                llamado.fechaCierre ||
                  llamado.fecha_cierre ||
                  llamado.fechaEntregaOfertas ||
                  llamado.tender?.tenderPeriod?.endDate
              );

              return (
                <div
                  key={itemKey}
                  className="bg-[#0B1120] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {ocid && (
                          <span className="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[11px] font-mono text-slate-300">
                            {ocid}
                          </span>
                        )}
                        {llamado.estado && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-300">
                            {llamado.estado}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${encaje.badgeClass}`}
                        >
                          {encaje.label}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white leading-snug">
                        {getLlamadoTitulo(llamado)}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
                        <div className="flex items-start gap-2 text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                              Convocante
                            </span>
                            <span className="block text-slate-200 font-medium break-words">
                              {getLlamadoConvocante(llamado)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-slate-300">
                          <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                              Modalidad
                            </span>
                            <span className="block text-slate-200 font-medium break-words">
                              {getLlamadoModalidad(llamado)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-slate-300">
                          <Banknote className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                              Monto Referencial
                            </span>
                            <span className="block text-emerald-300 font-semibold">
                              {formatMontoGs(llamado)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                              Publicación / Cierre
                            </span>
                            <span className="block text-slate-200 font-medium">
                              {fechaPub} · {fechaCierre}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center lg:pt-1">
                      <button
                        type="button"
                        disabled={analyzingKey !== null}
                        onClick={() => handleAnalizarConIA(llamado, idx)}
                        className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span>{isAnalyzing ? 'Analizando...' : 'Analizar con IA'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Paginación inferior */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={pagina <= 1 || loadingSearch}
              onClick={() => buscarLlamados(pagina - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-gray-800 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <span className="text-xs text-slate-400 px-2">Página {pagina}</span>
            <button
              type="button"
              disabled={!puedeIrSiguiente || loadingSearch}
              onClick={() => buscarLlamados(pagina + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B1120] hover:bg-slate-800 disabled:opacity-40 border border-gray-800 rounded-lg text-xs text-slate-300 cursor-pointer transition-colors"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Informe Ejecutivo IA */}
      {briefResult && parsedBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0B1120] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-[#121826] border-b border-gray-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                    INFORME EJECUTIVO IA - DNCP
                  </span>
                  {briefResult.ocid && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                      {briefResult.ocid}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-bold text-white leading-snug">
                  {getLlamadoTitulo(briefResult.llamado)}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Convocante: <strong className="text-slate-200">{getLlamadoConvocante(briefResult.llamado)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getPortalDncpUrl(briefResult.llamado)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
                  title="Abrir Portal DNCP en nueva pestaña para descargar el PBC"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Ver en Portal DNCP</span>
                </a>
                <button
                  type="button"
                  onClick={() => setBriefResult(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar informe"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barra de herramientas del Asistente DNCP */}
            <div className="px-5 py-3 bg-[#0e1525] border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={asistenteLoadingModo !== null}
                  onClick={() => handleConsultarAsistente('viabilidad')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {asistenteLoadingModo === 'viabilidad' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Posibilidades Reales (Pros y Contras)</span>
                </button>

                <button
                  type="button"
                  disabled={asistenteLoadingModo !== null}
                  onClick={() => handleConsultarAsistente('propuesta')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {asistenteLoadingModo === 'propuesta' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <ScrollText className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>Desarrollar Propuesta</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savingToDocs}
                  onClick={handleGuardarEnMisDocumentos}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                    savedToDocs
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100 disabled:opacity-50'
                  }`}
                >
                  {savingToDocs ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Guardando...</span>
                    </>
                  ) : savedToDocs ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Guardado en Mis Documentos</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Guardar en Mis Documentos</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={generatingPdf}
                  onClick={handleImprimirGuardarPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {generatingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>{generatingPdf ? 'Generando PDF...' : 'Imprimir / Guardar PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopiarInforme}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copiedBrief ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Informe copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar informe</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Body Modal: Informe base + Perfil + Hilo de análisis */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-200 flex-1">
              {parsedBrief.cuerpo && (
                <div className="bg-[#090d16] border border-gray-800/80 rounded-xl p-4 text-slate-200 leading-relaxed">
                  {renderMarkdownReact(parsedBrief.cuerpo)}
                </div>
              )}

              {parsedBrief.perfilEncaje && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                    <Target className="w-4 h-4 shrink-0" />
                    <span>Perfil de empresa que encaja</span>
                  </div>
                  <div className="text-amber-100/95 text-xs leading-relaxed">
                    {renderMarkdownReact(parsedBrief.perfilEncaje, 'amber')}
                  </div>
                </div>
              )}

              {asistenteError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white">Error del Asistente DNCP</p>
                      <p className="mt-0.5 text-rose-200/90">{asistenteError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAsistenteError(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {historial.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-gray-800">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span>Hilo de Análisis y Propuesta</span>
                  </div>

                  {historial.map((item) => {
                    const isUser = item.role === 'user';
                    const isViabilidad = !isUser && item.modo === 'viabilidad';
                    const isPropuesta = !isUser && item.modo === 'propuesta';

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 space-y-2 ${
                          isUser
                            ? 'bg-slate-800/70 border-slate-700 ml-4 sm:ml-8'
                            : isViabilidad
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : isPropuesta
                                ? 'bg-blue-950/20 border-blue-500/30'
                                : 'bg-[#090d16] border-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              isUser
                                ? 'text-slate-300'
                                : isViabilidad
                                  ? 'text-emerald-300'
                                  : isPropuesta
                                    ? 'text-blue-300'
                                    : 'text-slate-200'
                            }`}
                          >
                            {item.titulo}
                          </span>
                          <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                        </div>
                        <div className="text-slate-200 text-xs leading-relaxed">
                          {renderMarkdownReact(item.contenido)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {asistenteLoadingModo && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/90 border border-gray-800 text-xs text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span>
                    {asistenteLoadingModo === 'viabilidad'
                      ? 'Evaluando posibilidades reales (pros y contras) del llamado...'
                      : asistenteLoadingModo === 'propuesta'
                        ? 'Desarrollando borrador de propuesta técnica y documental...'
                        : 'Procesando consulta de seguimiento...'}
                  </span>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>

            {/* Barra de chat inferior para "Seguir analizando" */}
            <form
              onSubmit={handleChatSubmit}
              className="px-5 py-3.5 bg-[#121826] border-t border-gray-800 flex items-center gap-2.5 shrink-0"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={asistenteLoadingModo !== null}
                placeholder="Seguir analizando... Ej: ¿Qué pólizas o documentos exige? Ajustá la propuesta..."
                className="flex-1 min-w-0 px-3.5 py-2 bg-[#0B1120] border border-gray-800 focus:border-blue-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={asistenteLoadingModo !== null || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                {asistenteLoadingModo === 'chat' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Enviar</span>
              </button>
              <button
                type="button"
                onClick={() => setBriefResult(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 hidden sm:inline-flex"
              >
                Cerrar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminLicitacionesTab;
