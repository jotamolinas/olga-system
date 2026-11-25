import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Smartphone,
  X,
} from 'lucide-react';
import { Expediente, PlazoProcesal } from '../types';
import {
  buildCausaDirectUrl,
  buildDocumentoDirectUrl,
  buildSecretariaOlgaParte,
  buildSecretariaOlgaParteGeneral,
  buildSecretariaOlgaUrgenteDia,
  buildWhatsAppSelfSendUrl,
  DEFAULT_SECRETARIA_SCHEDULE,
  fetchConnectedWorkspaceWhatsApp,
  formatAbogadoWhatsAppDisplay,
  formatSecretariaScheduleSummary,
  LinkedDocResumen,
  loadAbogadoCustomWhatsappSecretaria,
  loadAbogadoSecretariaSchedule,
  markSecretariaReminderSentToday,
  normalizeAbogadoWhatsAppPhone,
  normalizeSecretariaSchedule,
  resolveEffectiveAbogadoWhatsapp,
  sanitizeFrecuenciaDias,
  sanitizeHoraEnvio,
  saveAbogadoSecretariaSchedule,
  saveAbogadoWhatsappSecretaria,
  SecretariaReminderSchedule,
  shouldTriggerSecretariaReminder,
} from '../services/secretariaOlga';

export type ParteSecretariaMode = 'urgente' | 'general' | 'detallado';

interface ParteSecretariaModalProps {
  isOpen: boolean;
  onClose: () => void;
  expediente: Expediente | null;
  allExpedientes?: Expediente[];
  defaultMode?: ParteSecretariaMode;
  initialPlazo?: PlazoProcesal | null;
  userData?: any;
  currentUser?: any;
  workspaceId?: string;
  connectedWaPhone?: string;
  linkedDocs?: LinkedDocResumen[];
  isScheduledTrigger?: boolean;
  onWhatsappSaved?: (savedPhone: string) => void;
  onScheduleSaved?: (schedule: SecretariaReminderSchedule) => void;
}

const FRANJA_OPTIONS = [
  { value: '', label: 'Hora actual (Asunción) + control sugerido' },
  { value: '07:30 hs (Primera hora de despacho)', label: '07:30 hs — Primera hora de despacho' },
  { value: '10:30 hs (Media mañana / Judisoft)', label: '10:30 hs — Control de media mañana' },
  { value: '12:00 hs (Cierre de despacho judicial)', label: '12:00 hs — Cierre de despacho judicial' },
  { value: '16:00 hs (Revisión vespertina del estudio)', label: '16:00 hs — Revisión vespertina' },
];

export const ParteSecretariaModal: React.FC<ParteSecretariaModalProps> = ({
  isOpen,
  onClose,
  expediente,
  allExpedientes = [],
  defaultMode,
  initialPlazo = null,
  userData,
  currentUser,
  workspaceId,
  connectedWaPhone = '',
  linkedDocs = [],
  isScheduledTrigger = false,
  onWhatsappSaved,
  onScheduleSaved,
}) => {
  const uid = String(currentUser?.uid || userData?.uid || '').trim();
  const wsId = String(workspaceId || uid).trim();

  const [detectedConnectedWa, setDetectedConnectedWa] = useState<string>(connectedWaPhone);
  const [customPhoneInput, setCustomPhoneInput] = useState('');
  const [savedCustomPhone, setSavedCustomPhone] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState<string | null>(null);

  const [scheduleDraft, setScheduleDraft] = useState<SecretariaReminderSchedule>({
    ...DEFAULT_SECRETARIA_SCHEDULE,
  });
  const [savedSchedule, setSavedSchedule] = useState<SecretariaReminderSchedule>({
    ...DEFAULT_SECRETARIA_SCHEDULE,
  });
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isTogglingMaster, setIsTogglingMaster] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null);

  const resolvedInitialMode: ParteSecretariaMode =
    defaultMode || (expediente ? 'detallado' : 'general');
  const [parteMode, setParteMode] = useState<ParteSecretariaMode>(resolvedInitialMode);
  const [selectedExpId, setSelectedExpId] = useState<string>(expediente?.id || '');
  const [selectedPlazoId, setSelectedPlazoId] = useState<string>('');
  const [horaFranja, setHoraFranja] = useState<string>('');
  const [parteText, setParteText] = useState<string>('');
  const [copiedParte, setCopiedParte] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeCausesList = useMemo(() => {
    const map = new Map<string, Expediente>();
    if (Array.isArray(allExpedientes)) {
      allExpedientes.forEach((exp) => {
        if (exp && exp.id && exp.anulado !== true && exp.eliminado !== true) {
          map.set(exp.id, exp);
        }
      });
    }
    if (expediente && expediente.id) {
      map.set(expediente.id, expediente);
    }
    return Array.from(map.values());
  }, [allExpedientes, expediente]);

  const effectiveExpediente = useMemo(() => {
    if (selectedExpId) {
      const found = activeCausesList.find((e) => e.id === selectedExpId);
      if (found) return found;
    }
    return expediente || activeCausesList[0] || null;
  }, [selectedExpId, activeCausesList, expediente]);

  const sortedPlazos = useMemo(() => {
    if (!effectiveExpediente || !Array.isArray(effectiveExpediente.plazos)) return [];
    return [...effectiveExpediente.plazos].sort((a, b) => {
      if (a.completado !== b.completado) return a.completado ? 1 : -1;
      return String(a.fechaVencimiento || '').localeCompare(String(b.fechaVencimiento || ''));
    });
  }, [effectiveExpediente]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const initialConnected = normalizeAbogadoWhatsAppPhone(connectedWaPhone);
    setDetectedConnectedWa(initialConnected);
    if (!initialConnected && wsId) {
      void fetchConnectedWorkspaceWhatsApp(wsId).then((fetched) => {
        if (active && fetched) {
          setDetectedConnectedWa(fetched);
        }
      });
    }
    const loadedCustom = loadAbogadoCustomWhatsappSecretaria(uid, userData, wsId);
    setCustomPhoneInput(loadedCustom ? formatAbogadoWhatsAppDisplay(loadedCustom) : '');
    setSavedCustomPhone(loadedCustom);
    setPhoneFeedback(null);

    const loadedSched = loadAbogadoSecretariaSchedule(uid, userData, wsId);
    setScheduleDraft(loadedSched);
    setSavedSchedule(loadedSched);
    setScheduleFeedback(null);
    setShowSchedulePanel(false);

    setCopiedParte(false);
    setCopiedLink(false);

    const initialMode: ParteSecretariaMode =
      defaultMode || (expediente ? 'detallado' : 'general');
    setParteMode(initialMode);
    setSelectedExpId(expediente?.id || activeCausesList[0]?.id || '');

    if (initialPlazo?.id) {
      setSelectedPlazoId(initialPlazo.id);
    } else {
      const targetExp = expediente || activeCausesList[0] || null;
      const plazosList = Array.isArray(targetExp?.plazos)
        ? [...targetExp.plazos].sort((a, b) => {
            if (a.completado !== b.completado) return a.completado ? 1 : -1;
            return String(a.fechaVencimiento || '').localeCompare(String(b.fechaVencimiento || ''));
          })
        : [];
      const firstPending = plazosList.find((p) => !p.completado) || plazosList[0];
      setSelectedPlazoId(firstPending ? firstPending.id : '__general__');
    }
    setHoraFranja('');
    return () => {
      active = false;
    };
  }, [isOpen, expediente?.id, initialPlazo?.id, defaultMode, uid, wsId, connectedWaPhone]);

  const activePlazo = useMemo(() => {
    if (!effectiveExpediente || !selectedPlazoId || selectedPlazoId === '__general__') return null;
    return sortedPlazos.find((p) => p.id === selectedPlazoId) || null;
  }, [effectiveExpediente, selectedPlazoId, sortedPlazos]);

  const regeneratedParte = useMemo(() => {
    const sourceList =
      activeCausesList.length > 0
        ? activeCausesList
        : effectiveExpediente
          ? [effectiveExpediente]
          : [];

    if (parteMode === 'urgente') {
      return buildSecretariaOlgaUrgenteDia({
        expedientes: sourceList,
        userData,
        currentUser,
        horaFranja,
      });
    }
    if (parteMode === 'general') {
      return buildSecretariaOlgaParteGeneral({
        expedientes: sourceList,
        userData,
        currentUser,
        horaFranja,
        includeUrgentPrefix: true,
      });
    }
    if (!effectiveExpediente) return '';
    return buildSecretariaOlgaParte({
      expediente: effectiveExpediente,
      plazo: activePlazo,
      userData,
      currentUser,
      linkedDocs:
        expediente && effectiveExpediente.id === expediente.id ? linkedDocs : [],
      horaFranja,
    });
  }, [
    parteMode,
    activeCausesList,
    effectiveExpediente,
    expediente,
    activePlazo,
    userData,
    currentUser,
    linkedDocs,
    horaFranja,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setParteText(regeneratedParte);
  }, [isOpen, regeneratedParte]);

  const scheduleEval = useMemo(
    () => shouldTriggerSecretariaReminder({ schedule: scheduleDraft }),
    [scheduleDraft]
  );

  const pendingGeneralSummary = useMemo(() => {
    let causesWithPending = 0;
    let totalPending = 0;
    let urgentTodayTomorrow = 0;
    activeCausesList.forEach((exp) => {
      if ((exp.estado || 'En trámite') === 'Finalizado') return;
      const pend = (Array.isArray(exp.plazos) ? exp.plazos : []).filter((p) => p && !p.completado);
      if (pend.length > 0) {
        causesWithPending += 1;
        totalPending += pend.length;
        pend.forEach((p) => {
          if (p.fechaVencimiento && /^\d{4}-\d{2}-\d{2}/.test(p.fechaVencimiento)) {
            const todayIso = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Asuncion',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date());
            const [ty, tm, td] = todayIso.split('-').map(Number);
            const [fy, fm, fd] = p.fechaVencimiento.slice(0, 10).split('-').map(Number);
            if (ty && tm && td && fy && fm && fd) {
              const diff = Math.round(
                (Date.UTC(fy, fm - 1, fd) - Date.UTC(ty, tm - 1, td)) / (1000 * 60 * 60 * 24)
              );
              if (diff <= 1) urgentTodayTomorrow += 1;
            }
          }
        });
      }
    });
    return { causesWithPending, totalPending, urgentTodayTomorrow };
  }, [activeCausesList]);

  if (!isOpen) return null;

  const waResolution = resolveEffectiveAbogadoWhatsapp({
    uid,
    workspaceId: wsId,
    userData,
    currentUser,
    connectedWaPhone: detectedConnectedWa,
    customPhoneOverride: customPhoneInput.trim() ? customPhoneInput : '',
  });

  const normalizedCustomDraft = normalizeAbogadoWhatsAppPhone(customPhoneInput);
  const effectivePhoneForSend =
    normalizedCustomDraft.length >= 8
      ? normalizedCustomDraft
      : waResolution.defaultPhone || savedCustomPhone;
  const isPhoneValid = effectivePhoneForSend.length >= 8;
  const waUrl = buildWhatsAppSelfSendUrl(effectivePhoneForSend, parteText);
  const causaUrl =
    parteMode === 'general' || parteMode === 'urgente'
      ? 'https://olgatech.com.py/consola?tab=expedientes'
      : effectiveExpediente
        ? buildCausaDirectUrl(effectiveExpediente.id)
        : 'https://olgatech.com.py/consola?tab=expedientes';

  const handleToggleMasterActive = async () => {
    if (isTogglingMaster) return;
    const nextActivo = !scheduleDraft.recordatorioActivo;
    setIsTogglingMaster(true);
    setScheduleFeedback(null);
    try {
      const normalized = normalizeSecretariaSchedule({
        ...scheduleDraft,
        recordatorioActivo: nextActivo,
        ultimoEnvioFecha: savedSchedule.ultimoEnvioFecha ?? scheduleDraft.ultimoEnvioFecha ?? null,
      });
      const res = await saveAbogadoSecretariaSchedule({
        uid,
        workspaceId: wsId,
        schedule: normalized,
      });
      setScheduleDraft(res.schedule);
      setSavedSchedule(res.schedule);
      onScheduleSaved?.(res.schedule);
      setScheduleFeedback(
        nextActivo
          ? 'Secretaría O.L.G.A. activada.'
          : 'Secretaría O.L.G.A. pausada.'
      );
      window.setTimeout(() => setScheduleFeedback(null), 3000);
    } catch {
      setScheduleFeedback('No se pudo actualizar el estado.');
    } finally {
      setIsTogglingMaster(false);
    }
  };

  const handleSaveCustomPhone = async (silent = false, forceClear = false) => {
    const rawValue = forceClear ? '' : customPhoneInput;
    const norm = normalizeAbogadoWhatsAppPhone(rawValue);
    if (!forceClear && rawValue.trim() && norm.length < 8) {
      if (!silent) {
        setPhoneFeedback('Ingresa un número de WhatsApp válido (ej. 0981 123 456 o +595981123456).');
      }
      return;
    }
    setIsSavingPhone(true);
    setPhoneFeedback(null);
    try {
      const res = await saveAbogadoWhatsappSecretaria({
        uid,
        workspaceId: wsId,
        phone: forceClear ? '' : norm,
      });
      setSavedCustomPhone(res.savedPhone);
      setCustomPhoneInput(res.savedPhone ? formatAbogadoWhatsAppDisplay(res.savedPhone) : '');
      onWhatsappSaved?.(res.savedPhone);
      if (!silent) {
        setPhoneFeedback(
          res.savedPhone
            ? `Avisos configurados en: ${formatAbogadoWhatsAppDisplay(res.savedPhone)}.`
            : waResolution.defaultPhone
              ? `Se usará automáticamente tu número vinculado (${formatAbogadoWhatsAppDisplay(waResolution.defaultPhone)}).`
              : 'Número alternativo eliminado.'
        );
      }
    } catch {
      if (!silent) {
        setPhoneFeedback('No se pudo guardar el número en este momento.');
      }
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true);
    setScheduleFeedback(null);
    try {
      const normalized = normalizeSecretariaSchedule({
        ...scheduleDraft,
        frecuenciaDias: sanitizeFrecuenciaDias(scheduleDraft.frecuenciaDias),
        horaEnvio: sanitizeHoraEnvio(scheduleDraft.horaEnvio),
        ultimoEnvioFecha: savedSchedule.ultimoEnvioFecha ?? scheduleDraft.ultimoEnvioFecha ?? null,
      });
      const res = await saveAbogadoSecretariaSchedule({
        uid,
        workspaceId: wsId,
        schedule: normalized,
      });
      setScheduleDraft(res.schedule);
      setSavedSchedule(res.schedule);
      onScheduleSaved?.(res.schedule);
      setScheduleFeedback('Programación guardada correctamente.');
      window.setTimeout(() => setScheduleFeedback(null), 3500);
    } catch {
      setScheduleFeedback('No se pudo guardar la programación.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSkipToday = async () => {
    try {
      const updated = await markSecretariaReminderSentToday({
        uid,
        workspaceId: wsId,
        currentSchedule: savedSchedule,
      });
      setSavedSchedule(updated);
      setScheduleDraft(updated);
      onScheduleSaved?.(updated);
    } finally {
      onClose();
    }
  };

  const handleCopyText = async (text: string, type: 'parte' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'parte') {
        setCopiedParte(true);
        window.setTimeout(() => setCopiedParte(false), 2000);
      } else {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      // Silencioso si clipboard no está disponible
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black font-serif truncate">
                Parte Secretaría O.L.G.A. — Autoenvío WhatsApp
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {parteMode === 'urgente'
                  ? `Foco Urgente del Día · ${pendingGeneralSummary.urgentTodayTomorrow} vencido(s)/hoy/mañana`
                  : parteMode === 'general'
                    ? `Parte General Compacto · ${pendingGeneralSummary.causesWithPending} causa(s) con ${pendingGeneralSummary.totalPending} actuación(es) pendiente(s)`
                    : effectiveExpediente
                      ? `${effectiveExpediente.caratula}${effectiveExpediente.nroExpediente ? ` • Expte. ${effectiveExpediente.nroExpediente}/${effectiveExpediente.anio}` : ''}`
                      : 'Sin causa seleccionada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
            aria-label="Cerrar parte"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {isScheduledTrigger && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-700/70 bg-amber-50/90 dark:bg-amber-950/35 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-amber-950 dark:text-amber-200">
                    Recordatorio programado ({savedSchedule.horaEnvio} hs)
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Tu parte diario de Secretaría O.L.G.A. está listo para autoenviar por WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSkipToday()}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-bold hover:bg-amber-100/70 cursor-pointer shrink-0"
              >
                Omitir por hoy
              </button>
            </div>
          )}

          {/* Llave ON/OFF + WhatsApp automático / alternativo opcional */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/25 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                    {scheduleDraft.recordatorioActivo
                      ? 'Secretaría O.L.G.A. Activa'
                      : 'Secretaría O.L.G.A. Inactiva'}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {effectivePhoneForSend
                      ? savedCustomPhone
                        ? `Avisos configurados en otro número: ${formatAbogadoWhatsAppDisplay(effectivePhoneForSend)}`
                        : `Usando automáticamente tu número vinculado: ${formatAbogadoWhatsAppDisplay(effectivePhoneForSend)}`
                      : 'Sin número vinculado aún: ingresa tu WhatsApp abajo para recibir avisos.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={scheduleDraft.recordatorioActivo}
                disabled={isTogglingMaster}
                onClick={() => void handleToggleMasterActive()}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black transition-all cursor-pointer disabled:opacity-60 ${
                  scheduleDraft.recordatorioActivo
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    scheduleDraft.recordatorioActivo ? 'bg-white' : 'bg-slate-400'
                  }`}
                />
                <span>{scheduleDraft.recordatorioActivo ? 'ON · Activa' : 'OFF · Inactiva'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900/80 dark:text-emerald-300">
                Recibir avisos en otro número (opcional)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="tel"
                  value={customPhoneInput}
                  onChange={(e) => {
                    setCustomPhoneInput(e.target.value);
                    setPhoneFeedback(null);
                  }}
                  placeholder={
                    waResolution.defaultPhone
                      ? `Dejá vacío para usar tu número vinculado (${formatAbogadoWhatsAppDisplay(waResolution.defaultPhone)})`
                      : 'Ej. 0981 123 456 o +595 981 123 456'
                  }
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-700/70 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 placeholder:font-normal"
                />
                <button
                  type="button"
                  disabled={isSavingPhone}
                  onClick={() => void handleSaveCustomPhone(false, false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  {isSavingPhone ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar</span>
                </button>
                {(savedCustomPhone || customPhoneInput.trim()) && waResolution.defaultPhone && (
                  <button
                    type="button"
                    disabled={isSavingPhone}
                    onClick={() => void handleSaveCustomPhone(false, true)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-bold cursor-pointer shrink-0 hover:bg-emerald-100/60"
                  >
                    Usar vinculado
                  </button>
                )}
              </div>
            </div>

            {phoneFeedback && (
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {phoneFeedback}
              </p>
            )}
          </div>

          {/* Programación editable del recordatorio automático */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-3">
            <button
              type="button"
              onClick={() => setShowSchedulePanel((prev) => !prev)}
              className="w-full flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Programación automática:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {formatSecretariaScheduleSummary(scheduleDraft)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                <span>{showSchedulePanel ? 'Ocultar' : 'Editar horario y días'}</span>
                {showSchedulePanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {showSchedulePanel && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Frecuencia (cada cuántos días)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={scheduleDraft.frecuenciaDias}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setScheduleDraft((prev) => ({
                          ...prev,
                          frecuenciaDias: Number.isFinite(val) && val >= 1 ? Math.floor(val) : 1,
                        }));
                        setScheduleFeedback(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">1 = diario, 2 = cada 2 días</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Hora de envío (HH:mm)
                    </label>
                    <input
                      type="time"
                      value={scheduleDraft.horaEnvio}
                      onChange={(e) => {
                        setScheduleDraft((prev) => ({
                          ...prev,
                          horaEnvio: e.target.value || '05:00',
                        }));
                        setScheduleFeedback(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col justify-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleDraft.recordatorioActivo}
                        onChange={(e) => {
                          setScheduleDraft((prev) => ({ ...prev, recordatorioActivo: e.target.checked }));
                          setScheduleFeedback(null);
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Recordatorio activo</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleDraft.incluirSabado}
                          onChange={(e) => {
                            setScheduleDraft((prev) => ({ ...prev, incluirSabado: e.target.checked }));
                            setScheduleFeedback(null);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Sábados</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleDraft.incluirDomingo}
                          onChange={(e) => {
                            setScheduleDraft((prev) => ({ ...prev, incluirDomingo: e.target.checked }));
                            setScheduleFeedback(null);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Domingos</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Estado hoy: <strong className="text-slate-800 dark:text-slate-200">{scheduleEval.statusLabel}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={isSavingSchedule}
                    onClick={() => void handleSaveSchedule()}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isSavingSchedule ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar programación</span>
                  </button>
                </div>

                {scheduleFeedback && (
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                    {scheduleFeedback}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Selector de modalidad: Urgente del Día vs Parte General vs Parte Detallado */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 p-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setParteMode('urgente')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center inline-flex items-center justify-center gap-1.5 ${
                parteMode === 'urgente'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-red-700 dark:text-red-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Urgente del Día (Acción)</span>
            </button>
            <button
              type="button"
              onClick={() => setParteMode('general')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                parteMode === 'general'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              Parte General Compacto
            </button>
            <button
              type="button"
              disabled={!effectiveExpediente}
              onClick={() => setParteMode('detallado')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                parteMode === 'detallado'
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              Parte Detallado (Causa)
            </button>
          </div>

          {/* Opciones de contexto del parte */}
          {parteMode === 'urgente' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-200/80 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/25 px-3.5 py-2.5 flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                  🚨 Foco Urgente del Día
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {pendingGeneralSummary.urgentTodayTomorrow > 0
                    ? `${pendingGeneralSummary.urgentTodayTomorrow} actuación(es) vencida(s), hoy o mañana con plan QUÉ HACER / PROVEER / ENVIAR.`
                    : 'Sin vencimientos hoy/mañana: muestra la próxima actuación prioritaria más cercana.'}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Franja horaria del parte</span>
                </label>
                <select
                  value={horaFranja}
                  onChange={(e) => setHoraFranja(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {FRANJA_OPTIONS.map((opt) => (
                    <option key={opt.value || 'auto'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : parteMode === 'general' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-3.5 py-2.5 flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Consolidado automático por urgencia
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {pendingGeneralSummary.causesWithPending} causa(s) activa(s) con plazos pendientes · {pendingGeneralSummary.totalPending} actuación(es)
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Franja horaria del parte</span>
                </label>
                <select
                  value={horaFranja}
                  onChange={(e) => setHoraFranja(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {FRANJA_OPTIONS.map((opt) => (
                    <option key={opt.value || 'auto'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeCausesList.length > 1 && (
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Causa seleccionada para Parte Detallado
                  </label>
                  <select
                    value={effectiveExpediente?.id || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedExpId(nextId);
                      const nextExp = activeCausesList.find((item) => item.id === nextId);
                      const firstPend = nextExp?.plazos?.find((p) => !p.completado) || nextExp?.plazos?.[0];
                      setSelectedPlazoId(firstPend ? firstPend.id : '__general__');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {activeCausesList.map((expItem) => (
                      <option key={expItem.id} value={expItem.id}>
                        {expItem.caratula}
                        {expItem.nroExpediente ? ` (Expte. ${expItem.nroExpediente}/${expItem.anio})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Actuación / Plazo foco del parte
                </label>
                <select
                  value={selectedPlazoId}
                  onChange={(e) => setSelectedPlazoId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                >
                  <option value="__general__">Control general de la causa (próximo paso)</option>
                  {sortedPlazos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.completado ? '✓ ' : ''}
                      {p.titulo} ({p.fechaVencimiento ? p.fechaVencimiento.split('-').reverse().join('/') : 's/f'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Franja horaria del recordatorio</span>
                </label>
                <select
                  value={horaFranja}
                  onChange={(e) => setHoraFranja(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                >
                  {FRANJA_OPTIONS.map((opt) => (
                    <option key={opt.value || 'auto'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Enlaces directos detectados */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {parteMode === 'general' || parteMode === 'urgente'
                  ? 'Enlaces directos incluidos por cada causa en el parte'
                  : 'Enlaces incluidos en el mensaje'}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyText(causaUrl, 'link')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>
                  {copiedLink
                    ? 'Enlace copiado'
                    : parteMode === 'general' || parteMode === 'urgente'
                      ? 'Copiar enlace del panel'
                      : 'Copiar enlace directo de la causa'}
                </span>
              </button>
            </div>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all">
              {causaUrl}
            </p>
            {parteMode === 'detallado' &&
              effectiveExpediente &&
              ((expediente && effectiveExpediente.id === expediente.id && linkedDocs.length > 0) ||
                effectiveExpediente.ultimoAnalisisIA?.archivoNombre) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {expediente &&
                    effectiveExpediente.id === expediente.id &&
                    linkedDocs.map((d) => {
                      const docUrl = buildDocumentoDirectUrl(d);
                      return (
                        <span
                          key={d.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-[10px] font-bold text-indigo-700 dark:text-indigo-300"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{d.tipo || 'Escrito vinculado'}</span>
                          {docUrl && <ExternalLink className="w-2.5 h-2.5 shrink-0" />}
                        </span>
                      );
                    })}
                  {effectiveExpediente.ultimoAnalisisIA?.archivoNombre && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[220px]">
                        PDF analizado: {effectiveExpediente.ultimoAnalisisIA.archivoNombre}
                      </span>
                    </span>
                  )}
                </div>
              )}
          </div>

          {/* Vista previa editable del parte */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mensaje completo del Parte (editable antes de enviar)
              </label>
              <button
                type="button"
                onClick={() => setParteText(regeneratedParte)}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerar</span>
              </button>
            </div>
            <textarea
              rows={12}
              value={parteText}
              onChange={(e) => setParteText(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] p-3.5 text-xs leading-relaxed text-slate-800 dark:text-slate-100 font-sans outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyText(parteText, 'parte')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedParte ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedParte ? 'Parte copiado' : 'Copiar Parte'}</span>
            </button>

            {waUrl && isPhoneValid ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (normalizedCustomDraft && normalizedCustomDraft !== savedCustomPhone) {
                    void handleSaveCustomPhone(true, false);
                  }
                  void markSecretariaReminderSentToday({
                    uid,
                    workspaceId: wsId,
                    currentSchedule: savedSchedule,
                  }).then((updated) => {
                    setSavedSchedule(updated);
                    setScheduleDraft(updated);
                    onScheduleSaved?.(updated);
                  });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Autoenviar a mi WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Ingresa tu número de WhatsApp arriba para habilitar el autoenvío"
                className="px-4 py-2 rounded-xl bg-emerald-600/40 text-white/80 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Ingresa tu WhatsApp arriba</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
