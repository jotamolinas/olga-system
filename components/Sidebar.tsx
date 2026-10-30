import React, { useState } from 'react';
import {
  Activity,
  Banknote,
  Users,
  FileText,
  Stamp,
  Settings,
  Database,
  CreditCard,
  Sparkles,
  MessageSquare,
  LifeBuoy,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  LogOut,
  X,
  Building,
  Sliders,
  ShieldCheck,
  Download
} from 'lucide-react';
import { GlobalConfig } from '../types';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  role: 'admin' | 'usuario';
  setRole: (role: 'admin' | 'usuario') => void;
  isAdmin: boolean;
  isOperador: boolean;
  currentUser: any;
  userProfile: any;
  userData: any;
  customBranding: any;
  workspaceName?: string;
  config: GlobalConfig;
  activePlan: string;
  esPlanFull: boolean;
  logoInstitucional: string | null;
  setShowBenefits: (show: boolean) => void;
  onLogout: () => void;
  isStandalone?: boolean;
  installMessage?: string | null;
  handleInstallClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isPinned,
  setIsPinned,
  role,
  setRole,
  isAdmin,
  isOperador,
  currentUser,
  userProfile,
  userData,
  customBranding,
  workspaceName,
  config,
  activePlan,
  esPlanFull,
  logoInstitucional,
  setShowBenefits,
  onLogout,
  isStandalone = true,
  installMessage,
  handleInstallClick
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // En móvil se expande si el drawer está abierto. En desktop se expande si está anclado o con hover.
  const isExpandedDesktop = isPinned || isHovered;
  const isExpanded = isMobileMenuOpen || isExpandedDesktop;

  const togglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      localStorage.setItem('olga_sidebar_pinned', String(nextPinned));
    } catch {
      // Ignorar restricciones de storage
    }
  };

  // Nombre visible del usuario o escribanía
  const displayName = isOperador
    ? (currentUser?.displayName || currentUser?.email || 'Operador Notarial')
    : (workspaceName || customBranding?.nombreInstitucion || userData?.razonSocial || userData?.nombre || currentUser?.phoneNumber || 'Escribanía Titular');

  const sublineText = isOperador
    ? (workspaceName ? `Escribanía ${workspaceName}` : 'Operador Notarial')
    : (customBranding?.registroNotarial || (role === 'admin' ? 'Administrador' : `Reg. Nº ${config?.escribania?.nro_registro || 'Titular'}`));

  // Insignia dinámica de plan
  const planRaw = userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || (config as any)?.tipoPlan || activePlan || 'basico';
  const planNameStr = String(planRaw).trim().toUpperCase();
  const planLower = planNameStr.toLowerCase();

  const esAdmin = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com';
  // El skin dorado es EXCLUSIVO para Plan Full. Plan Empresa usa el mismo skin de Plan Básico y Pro.
  const esSkinDorado = esAdmin || planLower.includes('full');
  // Plan Full y Plan Empresa tienen acceso a El Oráculo
  const tieneOraculo = esAdmin || planLower.includes('full') || planLower.includes('empresa');
  // Plan Pro, Full y Empresa tienen acceso a Lienzo Notarial y Presupuestos
  const tieneLienzoYPresupuestos = esAdmin || planLower.includes('pro') || planLower.includes('empresa') || planLower.includes('full');

  // En Plan Full y Empresarial se llama 'El Oráculo'; en Básico y Pro es 'Asistente IA'
  const nombreAsistente = tieneOraculo ? 'El Oráculo' : 'Asistente IA';

  const renderPlanBadge = () => {
    if (isOperador) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          OPERADOR
        </span>
      );
    }

    const planLower = planNameStr.toLowerCase();

    if (planLower.includes('full')) {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setShowBenefits(true);
          }}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.35)] cursor-pointer hover:scale-105 transition-transform"
        >
          {planNameStr.startsWith('PLAN ') ? planNameStr : `PLAN ${planNameStr}`}
        </span>
      );
    }

    if (planLower.includes('empresa')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-slate-900 text-white border border-slate-700 shadow-sm">
          {planNameStr.startsWith('PLAN ') ? planNameStr : `PLAN ${planNameStr}`}
        </span>
      );
    }

    if (planLower.includes('pro')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          {planNameStr.startsWith('PLAN ') ? planNameStr : `PLAN ${planNameStr}`}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {planNameStr.startsWith('PLAN ') ? planNameStr : `PLAN ${planNameStr}`}
      </span>
    );
  };

  // Menú completo de navegación
  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
    customRenderLabel?: () => string;
  }

  const navItems: NavItem[] = [
    { id: 'tablero', label: 'Dashboard', icon: Activity },
    { id: 'pagares', label: 'Gestión de Pagarés', icon: Banknote },
    { id: 'personas', label: 'Fichero Personas', icon: Users },
    { id: 'escritos', label: 'Gestión de Escritos', icon: FileText },
    // Lienzo Notarial y Presupuesto: Disponibles exclusivamente a partir de Plan Pro, Full, Empresa o Admin
    ...(tieneLienzoYPresupuestos ? [
      { id: 'lienzo', label: 'Lienzo Notarial', icon: Stamp },
      { id: 'facturacion', label: 'Presupuesto', icon: CreditCard },
    ] : []),
    // Asistente IA / El Oráculo
    {
      id: 'chat',
      label: nombreAsistente,
      icon: tieneOraculo ? Sparkles : MessageSquare,
      customRenderLabel: () => nombreAsistente
    },
    // Soporte
    {
      id: 'soporte',
      label: 'Soporte',
      icon: LifeBuoy,
      customRenderLabel: () => role === 'admin' ? 'Buzón de Consultas' : 'Soporte'
    },
    // Configuración de Escribanía / Cuenta
    { id: 'cuenta', label: 'Configuración Escribanía', icon: Sliders },
    // Opciones administrativas
    { id: 'config', label: 'Configuración Legal', icon: Settings, adminOnly: true },
    { id: 'knowledge', label: 'Entrenamiento IA', icon: Database, adminOnly: true },
    { id: 'monitor', label: 'Monitor Central', icon: ShieldCheck, adminOnly: true },
    { id: 'pagos', label: 'Gestión Cobros', icon: CreditCard, adminOnly: true },
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || role === 'admin');

  return (
    <>
      {/* Backdrop overlay para pantallas móviles */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 transition-all duration-300 md:hidden print:hidden"
        />
      )}

      {/* Contenedor principal de la Barra Lateral Inteligente */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-slate-900 border-r border-slate-800 text-slate-300 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.5)] flex flex-col h-screen overflow-x-hidden print:hidden select-none ${
          // En móvil es un drawer clásico con z-[100]
          'fixed inset-y-0 left-0 z-[100] w-72 transition-transform duration-300 ease-in-out ' +
          (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        } ${
          // En desktop (md:): si está fijada es relative w-64; si está suelta es fixed flotante con transición suave
          isPinned
            ? 'md:relative md:shrink-0 md:w-64 md:z-30 md:shadow-none'
            : `md:fixed md:left-0 md:top-0 md:z-50 md:transition-all md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isHovered
                  ? 'md:w-64 md:shadow-[12px_0_36px_-4px_rgba(0,0,0,0.6)]'
                  : 'md:w-[72px]'
              }`
        }`}
      >
        {/* ============================================================== */}
        {/* 1. CABECERA: PERFIL COMPACTO + LOGO + BOTÓN FIJAR            */}
        {/* ============================================================== */}
        <div className="p-3 border-b border-slate-800 shrink-0">
          {isExpanded ? (
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5 flex items-center justify-between gap-2.5 relative shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-xl ${
                  esPlanFull 
                    ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]' 
                    : 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                } flex items-center justify-center font-serif font-black text-xs shrink-0 overflow-hidden`}>
                  {logoInstitucional ? (
                    <img src={logoInstitucional} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span>O</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate font-medium mt-0.5">
                    {sublineText}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {renderPlanBadge()}
                  </div>
                </div>
              </div>

              {/* Botón de fijar en desktop o cerrar en móvil */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={togglePin}
                  className={`hidden md:flex p-1.5 rounded-xl transition-all cursor-pointer ${
                    isPinned
                      ? esPlanFull
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
                  title={isPinned ? 'Desanclar barra lateral (colapsar)' : 'Fijar barra lateral abierta'}
                >
                  {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl"
                  title="Cerrar menú"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            // Modo Encogido (Solo Avatar / Isotipo Centrado)
            <div className="flex justify-center">
              <button
                type="button"
                onClick={togglePin}
                className={`w-10 h-10 rounded-xl ${
                  esPlanFull 
                    ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]' 
                    : 'bg-slate-800 text-white border border-slate-700 shadow-md'
                } flex items-center justify-center font-serif font-black text-xs relative group cursor-pointer overflow-hidden`}
                title="O.L.G.A. - Clic para fijar barra abierta"
              >
                {logoInstitucional ? (
                  <img src={logoInstitucional} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span>O</span>
                )}
                {/* Tooltip flotante a la derecha */}
                <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                  {displayName}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 2. MENÚ DE NAVEGACIÓN CENTRAL CON DISTINCIÓN CONDICIONAL POR PLAN*/}
        {/* ============================================================== */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1 scrollbar-thin">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const labelText = item.customRenderLabel ? item.customRenderLabel() : item.label;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full transition-all duration-200 cursor-pointer relative group flex items-center ${
                  isExpanded
                    ? 'px-3 py-2.5 rounded-xl gap-3 text-left'
                    : 'w-10 h-10 mx-auto rounded-xl justify-center'
                } ${
                  isActive
                    ? esPlanFull
                      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent text-amber-300 font-semibold border border-amber-500/40 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)]'
                      : 'bg-slate-800 text-white font-semibold border border-slate-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                }`}
                title={!isExpanded ? labelText : undefined}
              >
                {/* Indicador luminoso lateral */}
                {isActive && (
                  <span
                    className={`absolute rounded-full ${
                      isExpanded ? 'left-1 w-1 h-5' : 'left-0.5 w-1 h-5'
                    } ${
                      esPlanFull
                        ? 'bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.6)]'
                        : 'bg-slate-400 shadow-none'
                    }`}
                  />
                )}

                {/* Icono */}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors stroke-[1.75] ${
                    isActive
                      ? esPlanFull
                        ? 'text-amber-400'
                        : 'text-white'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {/* Texto del ítem visible solo cuando la barra está desplegada */}
                {isExpanded && (
                  <span
                    className={`text-xs truncate flex-1 tracking-tight ${
                      isActive 
                        ? esPlanFull 
                          ? 'text-amber-200 font-semibold' 
                          : 'text-white font-semibold'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {labelText}
                  </span>
                )}

                {/* Icono ChevronRight a la derecha */}
                {isExpanded && (
                  <ChevronRight
                    className={`w-3.5 h-3.5 ml-auto shrink-0 transition-opacity ${
                      isActive 
                        ? esPlanFull 
                          ? 'text-amber-400 opacity-80' 
                          : 'text-slate-400 opacity-80'
                        : 'text-slate-600 opacity-40 group-hover:opacity-75'
                    }`}
                  />
                )}

                {/* Tooltip flotante minimalista en modo encogido */}
                {!isExpanded && (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                    {labelText}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ============================================================== */}
        {/* 3. SWITCH ROL ADMIN / USUARIO (SI ES ADMINISTRADOR)            */}
        {/* ============================================================== */}
        {(role === 'admin' || isAdmin) && isExpanded && (
          <div className="px-3 pb-2 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  role === 'admin'
                    ? 'bg-slate-700 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('usuario');
                  if (activeTab === 'config' || activeTab === 'knowledge' || activeTab === 'monitor' || activeTab === 'pagos') {
                    setActiveTab('pagares');
                  }
                }}
                className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  role === 'usuario'
                    ? 'bg-slate-700 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Usuario
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. PIE DEL SIDEBAR: TARJETA DE ASISTENCIA + BOTÓN EXPANDIR/CERRAR*/}
        {/* ============================================================== */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          {/* Tarjeta de Asistencia (Solo visible cuando está desplegado) */}
          {isExpanded && (
            <div className={`relative overflow-hidden rounded-2xl p-3.5 mb-2.5 text-center shrink-0 border ${
              esPlanFull 
                ? 'bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-slate-900 border-amber-500/30 shadow-[0_8px_24px_-6px_rgba(251,191,36,0.15)]' 
                : 'bg-slate-800/80 border-slate-700/70 shadow-lg'
            }`}>
              {/* Esfera / Icono */}
              {esPlanFull ? (
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 shadow-[0_6px_20px_rgba(251,191,36,0.55)] ring-4 ring-amber-400/20 transition-transform duration-300 hover:scale-105" />
              ) : (
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300">
                  <Sparkles className="w-5 h-5 text-slate-300" />
                </div>
              )}
              <p className="text-xs font-semibold text-white">
                {tieneOraculo ? 'El Oráculo' : 'Asistente IA'}
              </p>
              <p className="text-[11px] text-slate-400 mb-2.5 mt-0.5">
                {tieneOraculo ? 'Inteligencia Notarial y Auditoría' : 'Consultas y cálculos notariales'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  esSkinDorado 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-[0_4px_14px_rgba(245,158,11,0.35)]' 
                    : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 shadow-sm'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${esSkinDorado ? 'text-slate-950' : 'text-white/90'}`} />
                <span>{tieneOraculo ? 'Consultar al Oráculo →' : 'Consultar Asistente IA →'}</span>
              </button>
            </div>
          )}

          {/* Logotipo O.L.G.A. permanente en el Menú Lateral */}
          <div className="flex items-center justify-center py-2.5 px-1 mb-1.5 transition-all">
            <img
              src="/logo-olga.png?v=3"
              alt="Logo O.L.G.A."
              className={`object-contain drop-shadow-[0_2px_8px_rgba(251,49,49,0.25)] transition-all duration-300 ${
                isExpanded ? 'max-h-12 max-w-[150px]' : 'w-11 h-11'
              }`}
            />
          </div>

          {/* Fila de controles inferiores: Expandir/Fijar + Cerrar Sesión */}
          <div
            className={`flex items-center gap-1.5 ${
              isExpanded ? 'justify-between px-1' : 'flex-col justify-center'
            }`}
          >
            <button
              type="button"
              onClick={togglePin}
              className={`p-2 rounded-xl transition-colors cursor-pointer relative group ${
                isPinned
                  ? esPlanFull
                    ? 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
                    : 'text-white bg-slate-800 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isPinned ? 'Desanclar barra lateral' : 'Fijar barra lateral abierta'}
            >
              {isPinned ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              {!isExpanded && (
                <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                  Fijar barra lateral
                </span>
              )}
            </button>

            {isExpanded && (
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                O.L.G.A. • 2026
              </span>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer relative group"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              {!isExpanded && (
                <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-xs font-medium rounded-xl shadow-xl whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60]">
                  Cerrar Sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
