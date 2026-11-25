import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Compass,
  Copy,
  Download,
  Monitor,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { PWAPlatform, UsePWAInstallResult } from '../hooks/usePWAInstall';

const INSTALL_URL = 'https://olgatech.com.py/consola';
const QR_IMAGE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
  INSTALL_URL
)}`;

interface PWAInstallButtonProps {
  pwa: UsePWAInstallResult;
  variant?: 'header' | 'sidebar' | 'banner';
  isDark?: boolean;
  compactOnMobile?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  pwa,
  variant = 'header',
  isDark = false,
  compactOnMobile = true,
}) => {
  if (pwa.isStandalone) return null;

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={() => void pwa.triggerInstall()}
        className="w-full px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        title="Instalar App en tu celular"
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="truncate">📲 Instalar App en tu celular</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void pwa.triggerInstall()}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition-all cursor-pointer shrink-0 ${
        isDark
          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
      } px-2.5 py-1.5 text-[10px] sm:text-xs shadow-xs`}
      title="Instalar O.L.G.A. como App en tu celular"
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span className={compactOnMobile ? 'hidden sm:inline whitespace-nowrap' : 'whitespace-nowrap'}>
        Instalar App
      </span>
      <span className={compactOnMobile ? 'sm:hidden whitespace-nowrap' : 'hidden'}>
        App
      </span>
    </button>
  );
};

interface PWAInstallGuideModalProps {
  pwa: UsePWAInstallResult;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({ pwa }) => {
  const [activeTab, setActiveTab] = useState<PWAPlatform>(pwa.platform);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (pwa.isGuideOpen) {
      setActiveTab(pwa.platform);
      setQrFailed(false);
    }
  }, [pwa.isGuideOpen, pwa.platform]);

  if (!pwa.isGuideOpen || pwa.isStandalone || typeof document === 'undefined') return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Silencioso si clipboard no está habilitado
    }
  };

  const tabs: { id: PWAPlatform; label: string }[] = [
    { id: 'ios', label: '📱 iPhone' },
    { id: 'android', label: '🤖 Android' },
    { id: 'desktop', label: '💻 Desde PC' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      onClick={() => pwa.setIsGuideOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Instalar O.L.G.A."
    >
      <div
        className="w-full max-w-md my-auto rounded-3xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black font-serif truncate">
                Instalar O.L.G.A.
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Elegí tu dispositivo para ver cómo agregar el ícono
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => pwa.setIsGuideOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            role="tablist"
            aria-label="Dispositivo para instalar O.L.G.A."
            className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800"
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-100 space-y-1">
                  <p className="font-black">Paso 1: Abrí en Safari</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Abrí <strong>olgatech.com.py</strong> usando <strong>Safari</strong>{' '}
                    <span className="italic">(no desde el navegador interno de WhatsApp)</span>.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-100 space-y-1">
                  <p className="font-black">Paso 2: Agregá a tu pantalla</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Tocá el botón <strong>Compartir</strong>{' '}
                    <span className="italic">(cuadrado con flecha hacia arriba ⬆️)</span> abajo y elegí{' '}
                    <strong>&quot;Agregar a inicio&quot;</strong>.
                  </p>
                </div>
              </div>

              {pwa.isIOSNonSafari && (
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl ? 'Enlace copiado — Pegalo en Safari' : 'Copiar enlace para abrir en Safari'}</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-3">
              {pwa.canNativeInstall ? (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3 text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Tu celular permite instalar la App directo sin descargas pesadas:
                  </p>
                  <button
                    type="button"
                    onClick={() => void pwa.triggerInstall()}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>📲 Instalar App ahora (1 clic)</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-100 space-y-1">
                      <p className="font-black">Paso 1: Abrí en Chrome</p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Abrí <strong>olgatech.com.py</strong> en <strong>Chrome</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3.5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-100 space-y-1">
                      <p className="font-black">Paso 2: Instalá desde el menú</p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Tocá los <strong>3 puntos (⋮)</strong> arriba a la derecha y elegí{' '}
                        <strong>&quot;Instalar aplicación&quot;</strong> o{' '}
                        <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4 text-center space-y-3">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug">
                  ¿Querés el ícono en tu celular? Escaneá este código con tu cámara
                </p>

                <div className="inline-flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200 shadow-xs mx-auto">
                  {!qrFailed ? (
                    <img
                      src={QR_IMAGE_URL}
                      alt="Código QR para abrir O.L.G.A. en tu celular"
                      width={180}
                      height={180}
                      onError={() => setQrFailed(true)}
                      className="w-[180px] h-[180px] object-contain"
                    />
                  ) : (
                    <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-2 text-slate-600 px-3">
                      <Monitor className="w-7 h-7 text-slate-400" />
                      <p className="text-[11px] font-bold text-slate-700">
                        Abrí en tu celular:
                      </p>
                      <p className="text-[11px] font-mono text-emerald-700 break-all">
                        olgatech.com.py/consola
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    olgatech.com.py/consola
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center px-1">
                Para instalarla en tu computadora, abrí{' '}
                <strong className="text-slate-700 dark:text-slate-300">olgatech.com.py</strong> en Chrome/Edge y tocá el ícono de instalar en la barra de direcciones.
              </p>
            </div>
          )}

          <div className="pt-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <PlusSquare className="w-3.5 h-3.5" />
              <span>Sin tiendas de aplicaciones</span>
            </span>
            <button
              type="button"
              onClick={() => pwa.setIsGuideOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
