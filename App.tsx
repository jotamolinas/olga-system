import React, { useState, useEffect, useRef, startTransition } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { PrivacidadPage } from './components/PrivacidadPage';
import { TerminosPage } from './components/TerminosPage';
import { RecursosPage } from './components/RecursosPage';
import { AdminLoginRoute } from './components/AdminLoginRoute';
import { Persona, GlobalConfig, Pagare, Expediente } from './types';
import { INITIAL_PERSONAS, INITIAL_CONFIG, INITIAL_PAGARES } from './initialData';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { initAuth, logout, getAccessToken, ensureUserDocumentInFirestore } from './services/auth';
import { 
  fetchPersonasFromFirestore, syncPersonaToFirestore, deletePersonaFromFirestore, normalizePersona,
  fetchPagaresFromFirestore, syncPagareToFirestore, updatePagareInFirestore, anularPagareFromFirestore,
  guardarEscritoToFirestore,
  normalizeExpediente, syncExpedienteToFirestore, deleteExpedienteFromFirestore
} from './services/firestore';
import { buscarPersonaDuplicada, depurarDuplicadosLista } from './services/personaDedup';
import { LoginScreen } from './components/LoginScreen';

import { useTrialStatus } from './hooks/useTrialStatus';
import { useWorkspace } from './hooks/useWorkspace';


// Subcomponents
import { PlanesTab } from './components/PlanesTab';
import { SoporteClienteTab } from './components/SoporteClienteTab';
import { BuzonAdminTab } from './components/BuzonAdminTab';
import { TableroTab } from './components/TableroTab';
import { PersonasTab } from './components/PersonasTab';
import { PagaresTab } from './components/PagaresTab';
import { ConfigTab } from './components/ConfigTab';
import { PagarePDFPreview } from './components/PagarePDFPreview';
import { CheckoutModal } from './components/CheckoutModal';
import { DocumentoModal, limpiarTextoParaEscrito, wrapSignatureBlocksForPrint } from './components/DocumentoModal';
import { EscritosTab } from './components/EscritosTab';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SuperAdminOnboarding } from './components/SuperAdminOnboarding';
import { FichaProfesional } from './components/FichaProfesional';
import { ConfiguracionCuentaTab } from './components/ConfiguracionCuentaTab';
import { ConfiguracionTab } from './components/ConfiguracionTab';
import { NotificationBell } from './components/NotificationBell';
import { RegistroOperador } from './components/RegistroOperador';
import { EditorNotarialOficial } from './components/EditorNotarialOficial';
import { ModuloPresupuestos } from './components/ModuloPresupuestos';
import { Sidebar } from './components/Sidebar';
import { WhatsAppTab } from './components/WhatsAppTab';
import { ExpedientesTab } from './components/ExpedientesTab';

export interface AdminTramiteRecord {
  id: string;
  timestamp: number;
  idEscribano: string;
  localidadDocumento: string;
  estatusReal: string;
  _adminVault: {
    alerta: boolean;
    color: string;
    mensajeAdmin?: string;
    reporteTexto?: string;
    motivo?: string;
  };
}

// Chat & AI
import { sendMessageToOlga } from './services/gemini';
import { notifySuperAdminWhatsApp } from './services/adminAlerts';
import { doc, updateDoc, increment, setDoc, getDoc, getDocs, collection, query, where, onSnapshot, or, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from './services/auth';
import ReactMarkdown from 'react-markdown';

// Icons
import { 
  CreditCard,
  FileText,
  Banknote,
  Users,
  Settings,
  MessageSquare,
  ShieldAlert,
  UserCheck,
  Building,
  HeartHandshake,
  Globe,
  Sparkles,
  Search,
  CheckCircle2, CheckCircle, Star,
  Phone,
  Mail,
  Menu,
  X,
  Send,
  Paperclip,
  Camera,
  Mic,
  Plus,
  Image as ImageIcon,
  
  Database,
  Activity,
  RefreshCcw,
  Printer,
  Lock,
  Target,
  Zap,
  ShieldCheck,
  User as UserIcon, LogOut,
  AlertTriangle, LifeBuoy , Award, Download, HelpCircle,
  Stamp,
  Loader2,
  Megaphone,
  Wrench,
  Bell
} from 'lucide-react';

const Logo: React.FC<{ light?: boolean; large?: boolean; mini?: boolean }> = ({ light = false, large = false, mini = false }) => (
  <div className={`flex flex-col ${large ? 'items-center' : 'items-start'} gap-1.5`}>
    <svg width={large ? "110" : (mini ? "28" : "44")} height={large ? "64" : (mini ? "18" : "28")} viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
      <defs>
        <linearGradient id="olgaGoldLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="url(#olgaGoldLogoGrad)" strokeWidth="6" strokeLinejoin="miter" strokeLinecap="butt"/>
    </svg>
    {!mini && (
      <div className={`flex flex-col ${large ? 'items-center' : 'items-start'}`}>
        <span className={`font-bold tracking-widest leading-none whitespace-nowrap ${large ? 'text-2xl mt-1.5' : 'text-xs'} bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded shadow-xs`} style={{ fontFamily: '"Courier Prime", monospace' }}>O.L.G.A</span>
        <span className={`font-bold tracking-[0.05em] leading-tight mt-1 text-center ${large ? 'text-[8px] max-w-[200px]' : 'text-[6px] max-w-[130px]'} ${light ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
          ORGANIZACIÓN • LEGALIZACIÓN<br/>GESTIÓN • ADMINISTRACIÓN
        </span>
      </div>
    )}
  </div>
);

const imprimirDocumentoOficial = (htmlContent: string, usuario: any = null, isSoftBlockedUser: boolean = false) => {
  // Use extended profile fields if available on user object
  const nombreCompleto = usuario?.nombreCompleto || usuario?.displayName || 'Escribano/a Sin Nombre Registrado';
  const numeroRegistro = usuario?.numeroRegistro || 'S/N';
  const matricula = usuario?.matricula || 'S/M';
  const direccion = usuario?.direccion || 'Dirección comercial no registrada';
  const ciudad = usuario?.ciudad || 'Ciudad no especificada';
  const telefono = usuario?.telefono || 'Sin teléfono de contacto';

  const isOperador = usuario?.rol === 'operador' || usuario?.role === 'operador';
  const isWhitelisted = usuario?.email === 'jotamolinas@gmail.com' || isOperador;
  // La variable unificada isSoftBlocked es la única responsable de activar la marca de agua
  const isWatermarkRequired = !isWhitelisted && isSoftBlockedUser;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const preparedHtmlContent = wrapSignatureBlocksForPrint(htmlContent);

  const printDocument = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dictamen - Oráculo de O.L.G.A.</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 2.5cm 2.5cm 2.5cm 3cm;
        }
        html, body {
          font-family: 'Times New Roman', serif;
          color: #000;
          line-height: 1.55;
          margin: 0;
          padding: 0;
          font-size: 12pt;
          height: auto;
          overflow: visible;
        }
        body {
          padding: 2.5cm 2.5cm 2.5cm 3cm;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 28px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .header h1 {
          font-size: 18pt;
          text-transform: uppercase;
          margin: 0 0 5px 0;
          letter-spacing: 1px;
        }
        .header h2 {
          font-size: 12pt;
          font-weight: normal;
          margin: 0;
          color: #333;
        }
        .content {
          position: relative;
          height: auto;
          overflow: visible;
          text-align: justify;
          line-height: 1.55;
        }
        .hoja-notarial-pagina {
          position: relative !important;
          height: auto !important;
          overflow: visible !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .hoja-notarial-pagina:last-child,
        .hoja-notarial-pagina:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .content p, .content li, .content blockquote {
          orphans: 3;
          widows: 3;
          text-align: justify;
          line-height: 1.55;
        }
        .content h1, .content h2, .content h3, .content h4 {
          break-after: avoid;
          page-break-after: avoid;
        }
        .content a { color: #000; text-decoration: none; }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 9pt;
          border-top: 1px solid #ccc;
          padding-top: 10px;
          color: #555;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .firma-box, .signature-block, .signatures-group {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .signature-block {
          margin-top: 24px;
        }
        .signature-block hr {
          width: 260px;
          max-width: 100%;
          border: none;
          border-top: 1px solid #000;
          margin: 24px 0 6px 0;
        }
        .signature-block p {
          margin: 0;
          text-align: left;
          line-height: 1.45;
        }
        .firma-box {
          margin-top: 64px;
          text-align: center;
        }
        .firma-linea {
          border-top: 1px solid #000;
          width: 250px;
          margin: 0 auto 5px auto;
        }
        .firma-nombre {
          font-weight: bold;
          font-size: 11pt;
        }
        .firma-titulo {
          font-size: 10pt;
        }
        ${isWatermarkRequired ? `
        .watermark {
          display: none;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .watermark {
            display: block !important;
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) rotate(-45deg) !important;
            font-size: 80px !important;
            color: rgba(255, 0, 0, 0.15) !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
            z-index: 9999 !important;
            pointer-events: none !important;
            text-align: center !important;
            width: 100% !important;
            line-height: 1.2 !important;
          }
        }
        ` : `
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        `}
      </style>
    </head>
    <body>
      ${isWatermarkRequired ? '<div class="watermark">VERSIÓN DE PRUEBA - SÓLO PARA USO NO COMERCIAL</div>' : ''}
      <div class="header">
        <h1>ESCRIBANÍA PÚBLICA ${nombreCompleto || ''}</h1>
        <h2>Registro Notarial Nº ${numeroRegistro || ''} - Matrícula de la CSJ Nº ${matricula || ''}</h2>
      </div>
      
      <div class="content">
        ${preparedHtmlContent}
      </div>

      <div class="firma-box">
        <div class="firma-linea"></div>
        <div class="firma-nombre">${nombreCompleto}</div>
        <div class="firma-titulo">Notario y Escribano Público</div>
      </div>

      <div class="footer">
        Dirección: ${direccion} - ${ciudad} | Teléfono: ${telefono}
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            window.onafterprint = function() { window.close(); }
          }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printDocument);
  printWindow.document.close();
};

const ConsolaApp: React.FC<{ forceAdmin?: boolean }> = ({ forceAdmin = false }) => {
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [isStandalone, setIsStandalone] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setInstallMessage("Para instalar O.L.G.A., debes abrir la app en una NUEVA PESTAÑA (icono superior derecho) o desde el menú de tu navegador.");
      setTimeout(() => setInstallMessage(null), 8000);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setDeferredPrompt(null);
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  // Authentication & Roles state
  const [currentUser, setCurrentUser] = useState<(User & { role?: string; rol?: string; nombre?: string }) | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { pruebaActiva, diasRestantes, userData, isTrialExpired, isSoftBlocked, tienePlanPago } = useTrialStatus(currentUser, userProfile);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [role, setRole] = useState<'admin' | 'usuario'>('usuario');

  // Estado reactivo de tema (Claro / Oscuro)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const storedTheme = localStorage.getItem('olga_theme');
      if (storedTheme) return storedTheme === 'dark';
      const storedFondo = localStorage.getItem('olga_facturacion_fondo_blanco');
      if (storedFondo !== null) return !JSON.parse(storedFondo);
    } catch {}
    return false; // Por defecto modo claro (fondo blanco)
  });

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e?.detail?.isDark !== undefined) {
        setIsDarkMode(Boolean(e.detail.isDark));
      } else {
        try {
          setIsDarkMode(localStorage.getItem('olga_theme') === 'dark');
        } catch {}
      }
    };
    window.addEventListener('olga_theme_changed', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('olga_theme_changed', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);
  const [olgaDocsCount, setOlgaDocsCount] = useState<number>(0);
  const [sessionKickedAlert, setSessionKickedAlert] = useState<string | null>(null);

  // Hook unificado de Workspace y membrete del Titular
  const { workspaceId, workspaceName, workspaceData } = useWorkspace(currentUser, userProfile || userData);

  // FASE 2: Sincronización de Documentos Olga por Workspace
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!workspaceId) {
      setOlgaDocsCount(0);
      return;
    }

    const q = query(
      collection(db, 'documentos_olga'),
      where('userId', '==', workspaceId) // Filtro maestro por Tenant
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOlgaDocsCount(snapshot.size);
    }, (error) => {
      console.error("Fallo en sincronización de documentos_olga:", error);
    });

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [workspaceId]); // Dependencia única

  // Aviso Global de Plataforma (system_config/global_announcement)
  const [globalAnnouncement, setGlobalAnnouncement] = useState<{
    active: boolean;
    announcementId: string;
    title: string;
    message: string;
    type: 'informativo' | 'importante' | 'novedad' | 'mantenimiento' | 'promocion';
    targetSegment: 'all' | 'active' | 'plan_full' | 'trial' | 'expired' | 'cortesia';
    versionKey: string;
  } | null>(null);

  const [dismissedAnnouncementKey, setDismissedAnnouncementKey] = useState<string>(() => {
    try {
      return localStorage.getItem('olga_dismissed_announcement_version') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!currentUser?.uid) {
      setGlobalAnnouncement(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'system_config', 'global_announcement'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setGlobalAnnouncement((prev) => (prev === null ? prev : null));
          return;
        }
        const data = snapshot.data() as any;
        if (!data?.active) {
          setGlobalAnnouncement((prev) => (prev === null ? prev : null));
          return;
        }

        const updatedAtMs =
          typeof data.updatedAt?.toMillis === 'function'
            ? data.updatedAt.toMillis()
            : typeof data.updatedAt?.seconds === 'number'
              ? data.updatedAt.seconds * 1000
              : typeof data.updatedAt === 'number'
                ? data.updatedAt
                : 0;

        const title = String(data.title || '').trim();
        const message = String(data.message || '').trim();
        const announcementId =
          String(data.announcementId || '').trim() ||
          (updatedAtMs ? String(updatedAtMs) : `${title}::${message}`);
        const versionKey = announcementId;

        const type: 'informativo' | 'importante' | 'novedad' | 'mantenimiento' | 'promocion' =
          ['informativo', 'importante', 'novedad', 'mantenimiento', 'promocion'].includes(String(data.type))
            ? data.type
            : 'novedad';

        const targetSegment: 'all' | 'active' | 'plan_full' | 'trial' | 'expired' | 'cortesia' =
          ['all', 'active', 'plan_full', 'trial', 'expired', 'cortesia'].includes(String(data.targetSegment))
            ? data.targetSegment
            : 'all';

        setGlobalAnnouncement((prev) => {
          if (
            prev &&
            prev.active &&
            prev.announcementId === announcementId &&
            prev.title === title &&
            prev.message === message &&
            prev.type === type &&
            prev.targetSegment === targetSegment &&
            prev.versionKey === versionKey
          ) {
            return prev;
          }
          return {
            active: true,
            announcementId,
            title,
            message,
            type,
            targetSegment,
            versionKey,
          };
        });
      },
      (error) => {
        console.error('Error al escuchar aviso global de plataforma:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const shouldShowGlobalAnnouncement = (() => {
    if (!globalAnnouncement || !globalAnnouncement.active) return false;
    if (!globalAnnouncement.title && !globalAnnouncement.message) return false;
    if (dismissedAnnouncementKey === globalAnnouncement.versionKey) return false;
    try {
      if (localStorage.getItem('olga_dismissed_announcement_version') === globalAnnouncement.versionKey) {
        return false;
      }
    } catch {}

    const emailStr = String(currentUser?.email || userProfile?.email || userData?.email || '').toLowerCase();
    const rawUserPlan = String(
      userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || ''
    ).toLowerCase();
    let categoriaCuenta = userProfile?.categoriaCuenta || userData?.categoriaCuenta;
    if (!categoriaCuenta) {
      if (emailStr.includes('jotamolinas') || emailStr.includes('probit.com.py') || emailStr.includes('olga')) {
        categoriaCuenta = 'equipo';
      } else {
        categoriaCuenta = 'cliente';
      }
    }

    switch (globalAnnouncement.targetSegment) {
      case 'all':
        return true;
      case 'plan_full':
        return rawUserPlan.includes('full') && !isSoftBlocked;
      case 'cortesia':
        return categoriaCuenta === 'cortesia' || categoriaCuenta === 'equipo';
      case 'active':
        return categoriaCuenta === 'cliente' && tienePlanPago && !isSoftBlocked;
      case 'trial':
        return categoriaCuenta === 'cliente' && !tienePlanPago && !isSoftBlocked && pruebaActiva;
      case 'expired':
        return isSoftBlocked;
      default:
        return true;
    }
  })();

  const recordedSeenAnnouncementRef = useRef<Set<string>>(new Set());
  const currentAnnouncementId = globalAnnouncement?.announcementId || '';
  const currentUserId = currentUser?.uid || '';
  const currentViewerName = String(
    userProfile?.razonSocial ||
      userProfile?.nombre ||
      userData?.razonSocial ||
      userData?.nombre ||
      currentUser?.displayName ||
      currentUser?.email?.split('@')[0] ||
      'Usuario'
  ).trim();
  const currentViewerEmail = String(currentUser?.email || userProfile?.email || userData?.email || '').trim();

  useEffect(() => {
    if (!shouldShowGlobalAnnouncement || !currentAnnouncementId || !currentUserId) return;

    const seenStorageKey = `olga_seen_announcement_${currentAnnouncementId}_${currentUserId}`;
    if (recordedSeenAnnouncementRef.current.has(seenStorageKey)) return;

    try {
      if (localStorage.getItem(seenStorageKey) === '1') {
        recordedSeenAnnouncementRef.current.add(seenStorageKey);
        return;
      }
    } catch {}

    recordedSeenAnnouncementRef.current.add(seenStorageKey);

    updateDoc(doc(db, 'system_config', 'global_announcement'), {
      vistoPor: arrayUnion({
        uid: currentUserId,
        nombre: currentViewerName,
        email: currentViewerEmail,
        vistoEn: new Date().toISOString(),
      }),
    })
      .then(() => {
        try {
          localStorage.setItem(seenStorageKey, '1');
        } catch {}
      })
      .catch((error) => {
        console.error('Error registrando lectura de aviso global:', error);
      });
  }, [
    shouldShowGlobalAnnouncement,
    currentAnnouncementId,
    currentUserId,
    currentViewerName,
    currentViewerEmail,
  ]);

  const handleDismissGlobalAnnouncement = () => {
    if (!globalAnnouncement) return;
    try {
      localStorage.setItem('olga_dismissed_announcement_version', globalAnnouncement.versionKey);
    } catch {}
    setDismissedAnnouncementKey(globalAnnouncement.versionKey);
  };
  
  // Plan selection and Checkout Modal state
  const [activePlan, setActivePlan] = useState<'ninguno' | 'Intermedio' | 'Pro'>('ninguno');
  
  useEffect(() => {
    if (userData && userData.estadoPlataforma === 'Aprobado' && userData.plan) {
      setActivePlan(userData.plan as 'Intermedio' | 'Pro');
    } else {
      setActivePlan('ninguno');
    }
  }, [userData]);

  const rawAdminUids = (import.meta as any).env.VITE_ADMIN_UID || "";
  const envAdminUids = rawAdminUids.split(',').map((uid: string) => uid.trim());
  const ADMIN_UIDS = [
    ...envAdminUids,
    "sjqCJTQ1lNMRIMk31VRwz9Rwhud2", 
    "SDzZ9vL9y4cGQc4sHatRI2QugBr2",
    "SDzZ9vL9y4cGQc4sHatRl2QugBr2",
    "SDzZ9yL9y4cGQc4sHatRI2QugBr2",
    "SDzZ9yL9y4cGQc4sHatRl2QugBr2",
    "5DzZ9vL9y4cGQc4sHatRI2QugBr2",
    "SDz29yL9y4cG0c4sHatRl20ugRc2"
  ];
  const firestoreAdminRole = String(
    userProfile?.role || userProfile?.rol || userData?.role || userData?.rol || ''
  ).toUpperCase().trim();
  const isActualAdminUser = Boolean(
    currentUser && (
      ADMIN_UIDS.includes(currentUser.uid) ||
      currentUser.email === "jotamolinas@gmail.com" ||
      firestoreAdminRole === 'SUPERADMIN' ||
      firestoreAdminRole === 'ADMIN'
    )
  );

  const isAdmin = forceAdmin && isActualAdminUser;

  const planActual = String(userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || activePlan || 'basico').toLowerCase().trim();
  const esAbogado = String(userProfile?.tipoPerfil || userData?.tipoPerfil || '').toLowerCase() === 'abogado';
  const canUseExpedientes = esAbogado || isActualAdminUser || role === 'admin';
  // El skin dorado y efecto Glassmorphism es EXCLUSIVO para Plan Full. Plan Empresa usa el mismo skin de Plan Básico y Pro.
  const esPlanFull = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || planActual.includes('full');
  const esPlanPro = planActual.includes('pro');
  const esPlanEmpresa = planActual.includes('empresa');
  const getExplicitAddonFlag = (field: 'whatsappEnabled' | 'lienzoEnabled' | 'presupuestoEnabled'): boolean | undefined => {
    if (typeof userProfile?.[field] === 'boolean') return userProfile[field];
    if (typeof userData?.[field] === 'boolean') return userData[field];
    return undefined;
  };
  const resolveAddonPermission = (
    field: 'whatsappEnabled' | 'lienzoEnabled' | 'presupuestoEnabled',
    defaultByPlan: boolean
  ): boolean => {
    const explicit = getExplicitAddonFlag(field);
    if (explicit === true) return true;
    if (explicit === false) return false;
    return defaultByPlan;
  };
  const planIncluyeLienzoYPresupuestos = esPlanPro || esPlanEmpresa || planActual.includes('full');
  const canUseWhatsApp = resolveAddonPermission('whatsappEnabled', false);
  const canUseLienzo = resolveAddonPermission('lienzoEnabled', planIncluyeLienzoYPresupuestos);
  const canUsePresupuesto = resolveAddonPermission('presupuestoEnabled', planIncluyeLienzoYPresupuestos);
  // Plan Full y Empresa tienen acceso a El Oráculo
  const tieneOraculo = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || planActual.includes('full') || esPlanEmpresa;

  useEffect(() => {
    if (isAdmin) {
      setRole('admin');
    } else {
      setRole('usuario');
    }
  }, [isAdmin]);

  // Mobile menu open/collapsed state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Estado de anclaje de la barra lateral vertical inteligente (Glow UI / Chrome style)
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('olga_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });
  const [showBenefits, setShowBenefits] = useState(false);
  const [showEmpresaBenefits, setShowEmpresaBenefits] = useState(false);
  
  // Custom admin login modal state
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Handle escape to close admin login modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAdminLoginModal) {
        setShowAdminLoginModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminLoginModal]);

  // Core collections (Aisladas estrictamente por Workspace autenticado desde directorio_personas)
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [config, setConfig] = useState<GlobalConfig>(() => {
    const saved = localStorage.getItem('ihara_config');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });
  const [pagares, setPagares] = useState<Pagare[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);

  // Purgar claves globales antiguas de localStorage para evitar fugas entre cuentas en el mismo navegador
  useEffect(() => {
    try {
      localStorage.removeItem('olga_directorio_personas_global');
      localStorage.removeItem('olga_directorio_personas');
      localStorage.removeItem('ihara_personas');
      localStorage.removeItem('olga_pagares');
      localStorage.removeItem('ihara_pagares');
    } catch {}
  }, []);

  // Sincronización Institucional de ConfiguracionTab (Real-time de textos institucionales)
  const [customBranding, setCustomBranding] = useState<{
    nombreInstitucion: string;
    ruc: string;
    registroNotarial: string;
  }>(() => {
    try {
      const stored = localStorage.getItem('olga_configuracion_institucional');
      if (stored) {
        const p = JSON.parse(stored);
        if (p.logoUrl || p.logo_institucional) {
          delete p.logoUrl;
          delete p.logo_institucional;
          localStorage.setItem('olga_configuracion_institucional', JSON.stringify(p));
        }
        return {
          nombreInstitucion: p.nombreInstitucion || '',
          ruc: p.ruc || '',
          registroNotarial: p.registroNotarial || ''
        };
      }
    } catch {}
    return {
      nombreInstitucion: '',
      ruc: '',
      registroNotarial: ''
    };
  });

  useEffect(() => {
    const handleConfigEvent = (e: any) => {
      if (e.detail) {
        setCustomBranding({
          nombreInstitucion: e.detail.nombreInstitucion || '',
          ruc: e.detail.ruc || '',
          registroNotarial: e.detail.registroNotarial || ''
        });
      }
    };
    window.addEventListener('olga_config_updated', handleConfigEvent);
    return () => window.removeEventListener('olga_config_updated', handleConfigEvent);
  }, []);

  // Mock Tramites for Admin Monitor
  const [adminTramites, setAdminTramites] = useState<AdminTramiteRecord[]>([
    {
      id: 'TRM-99120',
      timestamp: Date.now() - 1000 * 60 * 5, // 5 min ago
      idEscribano: '134',
      localidadDocumento: 'Asunción',
      estatusReal: 'RENUNCIA',
      _adminVault: {
        alerta: true,
        color: 'rojo',
        mensajeAdmin: '⚠️ ALERTA CRÍTICA: Escribano ID 134 no apto. Dictamen judicial generado.',
        reporteTexto: 'DICTAMEN DE INTERCEPCIÓN PERICIAL\n\nI. DETALLES DEL PROFESIONAL INTERCEPTADO:\n• Registro Notarial Asignado: Reg. Nº 134\n• Análisis pericial de coincidencia: DISCREPANCIA CRÍTICA / INHABILITACIÓN ACTIVA\n\nPor tanto, se solicita que este reporte técnico sea tomado como prueba documental de cargo.'
      }
    },
    {
      id: 'TRM-99121',
      timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      idEscribano: '2',
      localidadDocumento: 'Encarnación',
      estatusReal: 'ACTIVO',
      _adminVault: {
        alerta: true,
        color: 'amarillo',
        motivo: 'Advertencia de competencia territorial para Encarnación. Su jurisdicción legal es Ciudad del Este.'
      }
    },
    {
      id: 'TRM-99122',
      timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      idEscribano: '12',
      localidadDocumento: 'Capitán Miranda',
      estatusReal: 'ACTIVO',
      _adminVault: {
        alerta: false,
        color: 'verde'
      }
    }
  ]);

  // UI Active tabs
  const [activeTab, setActiveTab] = useState<'tablero' | 'pagares' | 'personas' | 'escritos' | 'config' | 'chat' | 'monitor' | 'planes' | 'pagos' | 'soporte' | 'cuenta' | 'lienzo' | 'facturacion' | 'onboarding-sifen' | 'whatsapp' | 'expedientes'>(forceAdmin ? 'monitor' : 'tablero');

  useEffect(() => {
    if (isCheckingProfile || !currentUser) return;
    if (
      (activeTab === 'whatsapp' && !canUseWhatsApp) ||
      (activeTab === 'lienzo' && (!canUseLienzo || esAbogado)) ||
      (activeTab === 'facturacion' && !canUsePresupuesto) ||
      (activeTab === 'expedientes' && !canUseExpedientes)
    ) {
      setActiveTab('tablero');
    }
  }, [activeTab, canUseWhatsApp, canUseLienzo, canUsePresupuesto, esAbogado, canUseExpedientes, isCheckingProfile, currentUser]);

  // Plan selection and Checkout Modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutToast, setCheckoutToast] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<{name: string, price: string} | null>(null);

  // Preview Pagare state
  const [selectedPagareForPreview, setSelectedPagareForPreview] = useState<Pagare | null>(null);

  const handleAbrirPagarePreview = (pagare: Pagare | null) => {
    startTransition(() => {
      setSelectedPagareForPreview(pagare);
    });
  };

  // Documento Modal state
  const [documentoModalOpen, setDocumentoModalOpen] = useState(false);
  const [documentoInitialText, setDocumentoInitialText] = useState('');
  const [documentoModalDocId, setDocumentoModalDocId] = useState<string | undefined>(undefined);
  const [documentoModalTipo, setDocumentoModalTipo] = useState<string | undefined>(undefined);
  const [documentoModalCategoria, setDocumentoModalCategoria] = useState<string | undefined>(undefined);
  const [documentoModalTipoHoja, setDocumentoModalTipoHoja] = useState<'blanca' | 'protocolo' | undefined>(undefined);
  const [documentoModalIncludeHeader, setDocumentoModalIncludeHeader] = useState<boolean>(true);

  const formatearMensajeChatVisual = (texto: string): string => {
    const base = texto.includes('[CONTEXTO INTERNO DE OPERACIÓN')
      ? texto.split('[CONTEXTO INTERNO DE OPERACIÓN')[0].trim()
      : texto;
    return base
      .replace(/===INICIO_DOCUMENTO===/g, '\n\n---\n\n')
      .replace(/===FIN_DOCUMENTO===/g, '\n\n---\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const extraerDocumentoPuro = (texto: string): string => {
    const sinContexto = texto.includes('[CONTEXTO INTERNO DE OPERACIÓN')
      ? texto.split('[CONTEXTO INTERNO DE OPERACIÓN')[0].trim()
      : texto;

    const inicioTag = '===INICIO_DOCUMENTO===';
    const finTag = '===FIN_DOCUMENTO===';
    const inicioIdx = sinContexto.indexOf(inicioTag);
    const finIdx = sinContexto.indexOf(finTag);

    let resultado = '';

    if (inicioIdx !== -1 && finIdx !== -1 && finIdx > inicioIdx) {
      resultado = sinContexto.slice(inicioIdx + inicioTag.length, finIdx).trim();
    } else if (inicioIdx !== -1) {
      resultado = sinContexto.slice(inicioIdx + inicioTag.length).trim();
      const recIdx = resultado.search(/\n?\s*(?:\*{0,2})RECOMENDACI[ÓO]N DE O\.L\.G\.A\.?:/i);
      if (recIdx !== -1) {
        resultado = resultado.slice(0, recIdx).trim();
      }
    } else {
      let fallback = sinContexto;
      const recIdx = fallback.search(/(?:\*{0,2})RECOMENDACI[ÓO]N DE O\.L\.G\.A\.?:/i);
      if (recIdx !== -1) {
        fallback = fallback.slice(0, recIdx).trim();
      }

      const paragraphs = fallback.split(/\n{2,}/);
      const cleanedParagraphs: string[] = [];
      let skippingIntro = true;
      let lastWasDatosExtraidos = false;

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (skippingIntro) {
          if (/^(?:\*{0,2})DATOS EXTRA[ÍI]DOS:/i.test(trimmed)) {
            lastWasDatosExtraidos = true;
            continue;
          }
          if (/^(?:\*{0,2})(?:Entendido\b|Como O\.L\.G\.A\.)/i.test(trimmed)) {
            lastWasDatosExtraidos = false;
            continue;
          }
          if (lastWasDatosExtraidos && /^(?:[-•*]|\d+\.)\s+/.test(trimmed)) {
            continue;
          }
          skippingIntro = false;
          lastWasDatosExtraidos = false;
        }

        cleanedParagraphs.push(trimmed);
      }

      resultado = cleanedParagraphs.join('\n\n').trim();
    }

    return limpiarTextoParaEscrito(resultado);
  };

  const handleOpenDocumentModal = (
    text: string,
    docId?: string,
    tipo?: string,
    categoria?: string,
    tipoHoja: 'blanca' | 'protocolo' = 'blanca',
    includeHeader: boolean = true
  ) => {
    setDocumentoInitialText(limpiarTextoParaEscrito(text));
    setDocumentoModalDocId(docId);
    setDocumentoModalTipo(tipo);
    setDocumentoModalCategoria(categoria);
    setDocumentoModalTipoHoja(tipoHoja || 'blanca');
    setDocumentoModalIncludeHeader(includeHeader);
    setDocumentoModalOpen(true);
  };

  // Chat/Olga IA state
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      role: 'model',
      text: '¡Hola! Soy O.L.G.A.. He adaptado este canal de comunicación como tu asistente inteligente dentro de tu panel de control de pagarés y escribanía. Puedes hacerme cualquier consulta legal, estructuración de cuotas, o solicitarme que te ayude a simular condiciones especiales.',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [hasUnreadChatResponse, setHasUnreadChatResponse] = useState(false);
  const [chatReadyToast, setChatReadyToast] = useState(false);
  const activeTabRef = useRef(activeTab);
  const chatToastTimerRef = useRef<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{name: string, data: string, mimeType: string}[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chat') {
      setHasUnreadChatResponse(false);
      setChatReadyToast(false);
      if (chatToastTimerRef.current) {
        window.clearTimeout(chatToastTimerRef.current);
        chatToastTimerRef.current = null;
      }
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (chatToastTimerRef.current) {
        window.clearTimeout(chatToastTimerRef.current);
        chatToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribe = initAuth(async (user, token) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setIsCheckingProfile(false);
        return;
      }
      
      setIsCheckingProfile(true);
      setCurrentUser(user);

      // Sesión local para este inicio de sesión
      let localSessionId = localStorage.getItem('appSessionId');
      if (!localSessionId) {
        localSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('appSessionId', localSessionId);
      }

      // El usuario acaba de iniciar sesión: ACEPTAR la sesión actual y sobrescribir el activeSessionId de Firestore
      let isFirstSnapshotAfterAuth = true;
      
      try {
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
          if (!docSnap.exists()) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              // SOLO si el usuario es NUEVO, crear y garantizar el documento en Firestore con 5 días de prueba:
              const createdProfile = await ensureUserDocumentInFirestore(user, {
                provider: user.phoneNumber ? 'telefono' : 'email',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                displayName: user.displayName || '',
                sessionId: localSessionId,
              });
              if (user) {
                (user as any).role = createdProfile?.role || createdProfile?.rol || 'titular';
                (user as any).rol = (user as any).role;
                (user as any).nombre =
                  createdProfile?.nombre ||
                  user.displayName ||
                  user.email?.split('@')[0] ||
                  user.phoneNumber ||
                  'Mi Escribanía';
              }
              setUserProfile(createdProfile);
              setIsCheckingProfile(false);
              return;
            } else {
              // Si el usuario ya existe en Firestore pero aún no estaba en caché:
              const existingData = userSnap.data() || {};
              const repairedData = await ensureUserDocumentInFirestore(user, {
                provider: user.phoneNumber ? 'telefono' : 'email',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                displayName: user.displayName || '',
              });
              const mergedData = { ...existingData, ...repairedData };
              if (user) {
                (user as any).role = mergedData?.role || mergedData?.rol || 'usuario';
                (user as any).rol = (user as any).role;
                (user as any).nombre =
                  mergedData?.nombre ||
                  mergedData?.razonSocial ||
                  mergedData?.nombreInstitucion ||
                  mergedData?.nombreCompleto ||
                  user.displayName ||
                  user.email?.split('@')[0] ||
                  user.phoneNumber ||
                  'Usuario';
              }
              setUserProfile(mergedData);
              setIsCheckingProfile(false);
              return;
            }
          }

          const data = docSnap.data();
          if (!data) return;

          // Sincronización automática del plan del operador con el titular (tenant)
          if ((data.rol === 'operador' || data.role === 'operador') && data.tenant_id) {
            try {
              const tenantRef = doc(db, 'users', data.tenant_id);
              const tenantSnap = await getDoc(tenantRef);
              if (tenantSnap.exists()) {
                const tenantData = tenantSnap.data();
                const planTitular = tenantData.planActual || tenantData.plan || 'Plan Básico';
                
                // Si el plan del operador es distinto al del titular, lo actualizamos en Firestore
                if (data.planActual !== planTitular) {
                  await updateDoc(doc(db, 'users', user.uid), {
                    planActual: planTitular,
                    plan: planTitular
                  });
                  // Actualizar el estado local para que la UI se refresque inmediatamente
                  data.planActual = planTitular;
                  data.plan = planTitular;
                }
              }
            } catch (error) {
              console.error("Error sincronizando el plan del operador con el titular:", error);
            }
          }

          // Autorreparación de cuentas existentes o recién autenticadas incompletas
          const updates: any = {};
          const fiveDaysDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
          const fiveDaysTs = Timestamp.fromDate(fiveDaysDate);
          const fiveDaysIso = fiveDaysDate.toISOString();

          if (!data.uid) {
            updates.uid = user.uid;
          }
          if (user.email && !data.email) {
            updates.email = user.email.toLowerCase();
          }
          if (user.phoneNumber && !data.telefono) {
            updates.telefono = user.phoneNumber;
            updates.phoneNumber = user.phoneNumber;
          }
          if (!data.nombre) {
            updates.nombre =
              user.displayName ||
              (user.email ? user.email.split('@')[0] : '') ||
              user.phoneNumber ||
              'Mi Escribanía';
          }
          const isAbogadoDoc = String(data.tipoPerfil || '').toLowerCase() === 'abogado';
          if (!data.escribania && !isAbogadoDoc) {
            updates.escribania = data.razonSocial || data.nombreInstitucion || 'Mi Escribanía';
          }
          if (!data.fecha_creacion) {
            updates.fecha_creacion = user.metadata?.creationTime
              ? Timestamp.fromDate(new Date(user.metadata.creationTime))
              : serverTimestamp();
          }
          if (!data.creadoEn) {
            updates.creadoEn = serverTimestamp();
          }
          if (!data.fechaRegistro) {
            updates.fechaRegistro = user.metadata?.creationTime
              ? new Date(user.metadata.creationTime).toISOString()
              : new Date().toISOString();
          }
          const existingExpAny =
            data.fecha_expiracion ||
            data.trialEndsAt ||
            data.fechaVencimiento ||
            data.vencimientoPlan ||
            data.fecha_vencimiento_plan;
          if (!existingExpAny) {
            updates.fecha_expiracion = fiveDaysTs;
            updates.trialEndsAt = fiveDaysTs;
            updates.fechaVencimiento = fiveDaysIso;
            updates.vencimientoPlan = fiveDaysIso;
            if (!data.planActual) updates.planActual = data.plan || 'trial';
            if (!data.plan) updates.plan = data.planActual || 'trial';
            if (!data.estadoSuscripcion) updates.estadoSuscripcion = 'trial';
            if (!data.estado_cuenta) updates.estado_cuenta = 'activa';
          } else {
            if (!data.fecha_expiracion) updates.fecha_expiracion = existingExpAny;
            if (!data.trialEndsAt) updates.trialEndsAt = existingExpAny;
          }
          if (Object.keys(updates).length > 0) {
            setDoc(doc(db, 'users', user.uid), updates, { merge: true }).catch(console.error);
            Object.assign(data, updates);
          }

          // Parche Crítico Fase 9.1: Asegurar que la cuenta de Gavanah mantenga su poder de Operador Notarial
          const isGavanah = 
            (user.email && user.email.toLowerCase().includes('gavanah')) ||
            (data.email && data.email.toLowerCase().includes('gavanah')) ||
            (data.nombre && data.nombre.toLowerCase().includes('gavanah'));

          if (isGavanah && (data.role !== 'operador' || data.rol !== 'operador' || data.planActual !== 'Operador Notarial')) {
            console.log("Restaurando rol y plan de operador para cuenta Gavanah...");
            await updateDoc(doc(db, 'users', user.uid), {
              role: 'operador',
              rol: 'operador',
              planActual: 'Operador Notarial'
            }).catch(console.error);
            data.role = 'operador';
            data.rol = 'operador';
            data.planActual = 'Operador Notarial';
          }

          // Validación Estricta de Expiración para cuentas Trial (5 días)
          const planStr = String(data.planActual || data.plan || '').toLowerCase().trim();
          const roleStr = String(data.role || data.rol || '').toLowerCase().trim();
          const isOperadorData = roleStr === 'operador' || roleStr === 'admin' || roleStr === 'superadmin' || isGavanah;
          const isApprovedAccount = String(data.estadoPlataforma || '').toUpperCase() === 'APROBADO' || String(data.estadoPago || '').toUpperCase() === 'APROBADO';
          const isPrivilegedUser = user.email === 'jotamolinas@gmail.com' || isOperadorData || isApprovedAccount;

          if (!isPrivilegedUser && (planStr === 'trial' || planStr === '' || planStr === 'prueba')) {
            let expDate: Date | null = null;
            const rawExp =
              data.fecha_expiracion ||
              data.trialEndsAt ||
              data.fechaVencimiento ||
              data.vencimientoPlan;
            if (rawExp) {
              if (typeof rawExp.toDate === 'function') expDate = rawExp.toDate();
              else if (typeof rawExp.toMillis === 'function') expDate = new Date(rawExp.toMillis());
              else if (typeof rawExp.seconds === 'number') expDate = new Date(rawExp.seconds * 1000);
              else expDate = new Date(rawExp);
            }

            // Fallback de Seguridad: Si un usuario antiguo en trial no tiene fecha_expiracion, calcular fecha_creacion + 5 días
            if (!expDate || isNaN(expDate.getTime())) {
              const rawCreation =
                data.fecha_creacion ||
                data.fechaCreacion ||
                data.creadoEn ||
                data.fechaRegistro ||
                data.created_at ||
                data.createdAt;
              if (rawCreation) {
                let creationDate: Date | null = null;
                if (typeof rawCreation.toDate === 'function') creationDate = rawCreation.toDate();
                else if (typeof rawCreation.toMillis === 'function') creationDate = new Date(rawCreation.toMillis());
                else if (typeof rawCreation.seconds === 'number') creationDate = new Date(rawCreation.seconds * 1000);
                else creationDate = new Date(rawCreation);
                if (creationDate && !isNaN(creationDate.getTime())) {
                  expDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000);
                }
              }
            }

            const yaExpiradoPorFecha = expDate ? Date.now() > expDate.getTime() : false;
            if (yaExpiradoPorFecha && data.estado_cuenta !== 'expirada') {
              updateDoc(doc(db, 'users', user.uid), { estado_cuenta: 'expirada' }).catch(console.error);
            }
          }

          const firestoreSessionId = data.activeSessionId;
          const currentLocalSession = localStorage.getItem('appSessionId') || localSessionId;

          // Si el usuario acaba de hacer login (el estado pasó de no user a user), aceptar la sesión
          // y sincronizar en Firestore con el del dispositivo local
          if (isFirstSnapshotAfterAuth) {
            isFirstSnapshotAfterAuth = false;
            if (firestoreSessionId !== currentLocalSession) {
              setDoc(doc(db, 'users', user.uid), { activeSessionId: currentLocalSession }, { merge: true }).catch(console.error);
            }
          } else {
            // Lógica de Expulsión: El bloqueo SÓLO debe dispararse si firestoreSessionId existe,
            // localSessionId existe, y son DIFERENTES.
            if (firestoreSessionId && currentLocalSession && firestoreSessionId !== currentLocalSession) {
              console.warn("⚠️ Sesión revocada: Se ha iniciado sesión desde otro dispositivo.");
              localStorage.removeItem('appSessionId');
              if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
              }
              setSessionKickedAlert("Sesión revocada: Se ha iniciado sesión desde otro dispositivo.");
              signOut(auth).catch(console.error);
              logout().catch(console.error);
              setCurrentUser(null);
              setUserProfile(null);
              setIsCheckingProfile(false);
              return;
            }
          }

          if (user) {
            (user as any).role = data?.role || data?.rol || 'usuario';
            (user as any).rol = (user as any).role;
            (user as any).nombre = data?.nombre || data?.razonSocial || data?.nombreInstitucion || data?.nombreCompleto || user.displayName || user.email?.split('@')[0] || 'Usuario';
          }
          setUserProfile(data);
          setIsCheckingProfile(false);
        }, (err) => {
          console.error("Error fetching user profile:", err);
          setUserProfile({
            email: user.email || '',
            planActual: 'Sin Plan',
            rol: 'usuario',
            diasRestantes: 5
          });
          setIsCheckingProfile(false);
        });
      } catch (err) {
        console.error("Error setting up profile snapshot:", err);
        setUserProfile({
          email: user.email || '',
          planActual: 'Sin Plan',
          rol: 'usuario',
          diasRestantes: 5
        });
        setIsCheckingProfile(false);
      }

      // Parche Fase 9.1: Reparación proactiva por cuenta administradora para restaurar el poder de Gavanah
      if (user.email === 'jotamolinas@gmail.com') {
        getDocs(collection(db, 'users')).then((usersSnap) => {
          usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            const matchGavanah = 
              (uData.email && uData.email.toLowerCase().includes('gavanah')) ||
              (uData.nombre && uData.nombre.toLowerCase().includes('gavanah')) ||
              uDoc.id.toLowerCase().includes('gavanah');

            if (matchGavanah && (uData.role !== 'operador' || uData.rol !== 'operador' || uData.planActual !== 'Operador Notarial')) {
              console.log("Admin restaurando cuenta de Gavanah en Firestore:", uDoc.id);
              updateDoc(doc(db, 'users', uDoc.id), {
                role: 'operador',
                rol: 'operador',
                planActual: 'Operador Notarial'
              }).catch(console.error);
            }
          });
        }).catch(err => console.warn("Admin repair scan:", err));
      }
      
    }, () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      setCurrentUser(null);
      setUserProfile(null);
      setPersonas([]);
      setIsCheckingProfile(false);
    });
    
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // FASE 2: Sincronización de Pagarés por Workspace (Aislamiento Estricto Multi-Usuario)
  useEffect(() => {
    if (!workspaceId) {
      setPagares([]);
      return;
    }

    const q = query(
      collection(db, 'pagares'),
      where('userId', '==', workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const item = docSnap.data() as any;
        return { ...item, id: docSnap.id } as Pagare;
      });
      setPagares(data);
      try {
        localStorage.setItem(`olga_pagares_${workspaceId}`, JSON.stringify(data));
      } catch {}
    }, (error) => {
      console.error("Fallo en sincronización de pagarés:", error);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  // Sincronización en tiempo real de Expedientes Judiciales por Workspace (Abogados y Super Admin)
  useEffect(() => {
    if (!workspaceId || !canUseExpedientes) {
      setExpedientes([]);
      return;
    }

    const q = query(
      collection(db, 'expedientes'),
      where('ownedByWorkspace', '==', workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => normalizeExpediente(docSnap.data(), docSnap.id));
      setExpedientes(list);
    }, (error) => {
      console.error('Fallo en sincronización de expedientes:', error);
    });

    return () => unsubscribe();
  }, [workspaceId, canUseExpedientes]);

  // FASE 2: Sincronización de Personas por Workspace en directorio_personas (Retrocompatible Multi-Usuario)
  useEffect(() => {
    if (!workspaceId) {
      setPersonas([]);
      return;
    }

    let activo = true;
    const uid = String(currentUser?.uid || auth?.currentUser?.uid || '').trim();
    const mapa = new Map<string, Persona>();

    const aplicarMapa = () => {
      if (!activo) return;
      const { listaLimpia } = depurarDuplicadosLista(Array.from(mapa.values()));
      const normalizadas = listaLimpia.map((p) => normalizePersona(p, p.id));
      setPersonas(normalizadas);
      try {
        localStorage.setItem(`olga_directorio_personas_${workspaceId}`, JSON.stringify(normalizadas));
      } catch {}
    };

    // 1. Carga inmediata retrocompatible desde directorio_personas
    fetchPersonasFromFirestore(workspaceId)
      .then((cloudPersonas) => {
        if (!activo) return;
        cloudPersonas.forEach((p) => {
          mapa.set(p.id, normalizePersona(p, p.id));
        });
        aplicarMapa();
      })
      .catch((err) => console.error("Error fetching directorio_personas on mount:", err));

    // 2. Suscripción en tiempo real a directorio_personas por ownedByWorkspace y userId
    const unsubs: Array<() => void> = [];

    const qWorkspace = query(
      collection(db, 'directorio_personas'),
      where('ownedByWorkspace', '==', workspaceId)
    );
    unsubs.push(
      onSnapshot(
        qWorkspace,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              mapa.delete(change.doc.id);
            } else {
              mapa.set(change.doc.id, normalizePersona(change.doc.data(), change.doc.id));
            }
          });
          aplicarMapa();
        },
        (error) => {
          console.error("Fallo en sincronización ownedByWorkspace de directorio_personas:", error);
        }
      )
    );

    const userTarget = uid || workspaceId;
    const qUser = query(
      collection(db, 'directorio_personas'),
      where('userId', '==', userTarget)
    );
    unsubs.push(
      onSnapshot(
        qUser,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              mapa.delete(change.doc.id);
            } else {
              mapa.set(change.doc.id, normalizePersona(change.doc.data(), change.doc.id));
            }
          });
          aplicarMapa();
        },
        (error) => {
          console.error("Fallo en sincronización userId de directorio_personas:", error);
        }
      )
    );

    return () => {
      activo = false;
      unsubs.forEach((u) => u());
    };
  }, [workspaceId, currentUser?.uid]);

  useEffect(() => {
    localStorage.setItem('ihara_config', JSON.stringify(config));
  }, [config]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle syncing on changes wrapper for lists. 
  // Wait, if setPersonas is called on fetch, it triggers effect. We want isolated handlers to update firestore to avoid infinite loops or overwrites.
  // Actually, I can just keep local update logic in handlers! Let's do that.

  const isBypassAuth =
    Boolean((import.meta as any).env && (import.meta as any).env.DEV) &&
    typeof window !== 'undefined' &&
    (window.localStorage?.getItem('olga_bypass_auth') === 'true' ||
      Boolean((window as any).__OLGA_BYPASS_AUTH__));

  if (!isBypassAuth && (isCheckingProfile || (currentUser && !userProfile))) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
        {/* Glows ambientales de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
          {/* Contenedor del Logo con sutil animación */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-black/60 flex items-center justify-center p-3.5 backdrop-blur-md">
              <img 
                src="/logo-olga.png?v=3" 
                alt="O.L.G.A." 
                className="w-full h-full object-contain animate-pulse"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {/* Anillo de carga giratorio alrededor del logo */}
            <div className="absolute -inset-1.5 rounded-[1.75rem] border-2 border-transparent border-t-[#FF3131] border-r-amber-500/50 animate-spin pointer-events-none"></div>
          </div>

          {/* Nombre y mensaje */}
          <h1 className="text-2xl font-black text-white font-serif tracking-tight mb-2">
            O.L.G.A.
          </h1>
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-5 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-ping"></span>
            Iniciando sesión...
          </p>

          {/* Barra de progreso sutil y elegante */}
          <div className="w-48 h-1 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-[#FF3131] via-amber-400 to-[#FF3131] animate-[pulse_1.5s_ease-in-out_infinite] w-full"></div>
          </div>
          <span className="text-[11px] text-slate-500 mt-3 font-medium">Preparando tu espacio de trabajo</span>
        </div>
      </div>
    );
  }

  if (!isBypassAuth && !currentUser) {
    return (
      <div className="relative">
        {sessionKickedAlert && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[92%] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-slate-900 border-2 border-[#FF3131] text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-[#FF3131] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">{sessionKickedAlert}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Por directiva de seguridad, solo se permite una sesión activa simultánea por cuenta.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSessionKickedAlert(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <LoginScreen onLogin={() => setSessionKickedAlert(null)} sessionRevokedAlert={sessionKickedAlert} />
      </div>
    );
  }

  const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador' || userData?.rol === 'operador' || userData?.role === 'operador' || (currentUser as any)?.role === 'operador';
  const currentWorkspaceId = workspaceId || (isOperador
    ? (userProfile?.tenant_id || userProfile?.tenantId || userData?.tenant_id || userData?.tenantId || currentUser?.uid)
    : currentUser?.uid);

  // Lectura Exclusiva de Logo Institucional desde Firestore (users/{workspaceId})
  const logoInstitucional = workspaceData?.logo_institucional || userProfile?.logo_institucional || null;

  const skipOnboarding = currentUser?.email === "jotamolinas@gmail.com" || isOperador;

  // Verificación blindada: un usuario ya tiene perfil si cuenta con perfilCompletado o cualquiera de los datos notariales/empresariales registrados
  const yaTienePerfil = Boolean(
    userProfile?.perfilCompletado === true ||
    userProfile?.razonSocial ||
    userProfile?.tipoPerfil ||
    userProfile?.nombreInstitucion ||
    userProfile?.matricula ||
    userProfile?.ruc ||
    userData?.perfilCompletado === true ||
    userData?.razonSocial ||
    userData?.tipoPerfil ||
    userData?.nombreInstitucion
  );

  // Forzar FichaProfesional si el perfil está incompleto hasta que guarde perfilCompletado: true
  if (!skipOnboarding && userProfile && !yaTienePerfil) {
    return (
      <FichaProfesional 
        currentUser={currentUser}
        userData={userProfile} 
        onComplete={() => {
          setIsCheckingProfile(true);
          getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
            if (docSnap.exists()) setUserProfile(docSnap.data());
            setIsCheckingProfile(false);
          });
        }} 
      />
    );
  }

  // Handlers for Personas CRUD
  const handleAddPersona = (newPersona: Persona): boolean => {
    // Unique check estricto por documento base, normalizado o nombre
    const duplicado = buscarPersonaDuplicada(newPersona, personas);
    if (duplicado) {
      console.warn(`Persona duplicada detectada: ${newPersona.nombre} (${newPersona.nro_documento}) coincide con ${duplicado.nombre} (${duplicado.nro_documento})`);
      return false;
    }

    if (!workspaceId) {
      console.error("Operación abortada: Workspace no identificado.");
      return false;
    }

    const uid = String(currentUser?.uid || auth?.currentUser?.uid || workspaceId).trim();
    const per: Persona = normalizePersona(
      {
        ...newPersona,
        responsable: (newPersona.responsable && newPersona.responsable !== 'MONKEY BUSINESS IA') ? newPersona.responsable : null,
        representanteLegal: newPersona.representanteLegal || (newPersona.tipo_persona === 'física' ? 'No aplica' : (newPersona.representante_id ? 'Asignado' : 'Sin Asignar')),
        userId: uid,
        ownedByWorkspace: workspaceId,
        creator_id: uid,
        createdBy: uid,
        creator_name: currentUser?.displayName || (currentUser as any)?.nombre || currentUser?.email?.split('@')[0] || 'Usuario',
        created_at: new Date().toISOString()
      },
      newPersona.id
    );
    const updated = [...personas, per];
    setPersonas(updated);
    try {
      localStorage.setItem(`olga_directorio_personas_${workspaceId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving personas to localStorage:', e);
    }
    syncPersonaToFirestore(workspaceId, per).catch(e => console.error("Error en escritura persona:", e));

    return true;
  };

  const handleUpdatePersona = (updatedPersona: Persona) => {
    if (!workspaceId) {
      console.error("Operación abortada: Workspace no identificado.");
      return;
    }
    if (!updatedPersona || !updatedPersona.id) {
      console.error("Operación abortada: Persona o ID no válido para actualización.");
      return;
    }
    const uid = String(currentUser?.uid || auth?.currentUser?.uid || workspaceId).trim();
    const per: Persona = normalizePersona(
      {
        ...updatedPersona,
        userId: updatedPersona.userId || uid,
        ownedByWorkspace: updatedPersona.ownedByWorkspace || workspaceId
      },
      updatedPersona.id
    );
    setPersonas(prev => {
      const exists = prev.some(p => p.id === per.id);
      const updated = exists 
        ? prev.map(p => p.id === per.id ? per : p)
        : [...prev, per];
      try {
        localStorage.setItem(`olga_directorio_personas_${workspaceId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving personas to localStorage:', e);
      }
      return updated;
    });
    syncPersonaToFirestore(workspaceId, per).catch(e => console.error("Error actualizando persona:", e));
  };

  const handleDeletePersona = (id: string) => {
    const updated = personas.filter(p => p.id !== id);
    setPersonas(updated);
    try {
      if (workspaceId) {
        localStorage.setItem(`olga_directorio_personas_${workspaceId}`, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Error saving personas to localStorage:', e);
    }
    if (currentUser) deletePersonaFromFirestore(id).catch(e => console.error("Error eliminando persona:", e));
  };

  // FASE 3: Handlers for Pagares CRUD con Asignación de Propiedad (Titular)
  const handleAddPagare = async (newPagare: Pagare) => {
    if (!workspaceId) {
      console.error("Operación abortada: Workspace no identificado.");
      return;
    }

    try {
      const creatorName = currentUser?.nombre || userProfile?.nombre || userProfile?.razonSocial || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario';
      const creatorRole = currentUser?.role || userProfile?.rol || userProfile?.role || 'titular';

      const pag = {
        ...newPagare,
        userId: workspaceId,            // El propietario legal de los datos (Titular)
        creator_id: currentUser?.uid,   // Rastro de auditoría: Quién lo digitó
        createdBy: currentUser?.uid,
        creator_name: newPagare.creator_name || creatorName,
        creator_role: newPagare.creator_role || creatorRole,
        created_at: newPagare.created_at || new Date().toISOString(),
        status: newPagare.status || 'activo'
      };
      const updated = [pag, ...pagares];
      setPagares(updated);
      try {
        if (workspaceId) {
          localStorage.setItem(`olga_pagares_${workspaceId}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn('Error saving pagares to localStorage:', e);
      }
      await syncPagareToFirestore(workspaceId, pag);
    } catch (error) {
      console.error("Error en escritura:", error);
    }
  };

  const handleUpdatePagare = async (updatedPagare: Pagare) => {
    const updated = pagares.map(p => p.id === updatedPagare.id ? updatedPagare : p);
    setPagares(updated);
    if (selectedPagareForPreview && selectedPagareForPreview.id === updatedPagare.id) {
      setSelectedPagareForPreview(updatedPagare);
    }
    try {
      if (workspaceId) {
        localStorage.setItem(`olga_pagares_${workspaceId}`, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Error saving pagares to localStorage:', e);
    }
    const effectiveWs = workspaceId || updatedPagare.userId || currentUser?.uid;
    if (effectiveWs) {
      await updatePagareInFirestore(effectiveWs, {
        ...updatedPagare,
        userId: effectiveWs
      }).catch(e => console.error("Error updating pagare in Firestore:", e));
    }
  };

  const handleDeletePagare = (id: string) => {
    const updated = pagares.map(p => p.id === id ? { ...p, status: 'anulado', anuladoAt: new Date().toISOString() } : p);
    setPagares(updated);
    try {
      if (workspaceId) {
        localStorage.setItem(`olga_pagares_${workspaceId}`, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Error saving pagares to localStorage:', e);
    }
    if (currentUser) {
      anularPagareFromFirestore(id).catch(e => console.error("Error anulating pagare:", e));
    }
  };

  const handleUpdateConfig = (newConfig: GlobalConfig) => {
    setConfig(newConfig);
  };

  // Handler for conversational messaging with Olga
  const handleSendChatMessage = async (overrideText?: string) => {
    if (isSoftBlocked) return;
    const textToSend = typeof overrideText === "string" ? overrideText : chatInput;
    if ((!textToSend.trim() && pendingFiles.length === 0) || chatLoading) return;

    const userText = textToSend.trim() || 'Analiza el/los archivos adjuntos.';
    const currentPendingFiles = [...pendingFiles];
    
    if (role !== 'admin') {
      const planStr = String(userData?.planActual || userData?.plan || userProfile?.planActual || userProfile?.plan || 'trial').toLowerCase();
      const isOperador = userData?.rol === 'operador' || userData?.role === 'operador' || userProfile?.rol === 'operador' || userProfile?.role === 'operador';
      const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
      const isApprovedPayment = String(userData?.estadoPago || userProfile?.estadoPago || '').toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma || userProfile?.estadoPlataforma || '').toUpperCase() === 'APROBADO';
      const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('básico') || planStr.includes('basico') || isApprovedPayment || isWhitelisted;

      // 1. BLOQUEO ESTRICTO: Si el usuario no tiene plan de pago y el trial expiró (días restantes <= 0 o expiración de 5 días), bloquear la consulta a la IA sin gastar tokens
      if (isSoftBlocked) {
        setChatMessages(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          text: 'Tu acceso ha expirado. El uso del Oráculo de IA está bloqueado. Por favor, adquiere o renueva un plan en la sección "Planes y Precios" para continuar.', 
          timestamp: new Date() 
        }]);
        setChatInput('');
        setPendingFiles([]);
        return;
      }

      // 2. Control de límite de consultas para usuarios en periodo de prueba activa
      if (!isPaidPlan) {
        const usoIA = userData?.usoIA || 0;
        const limiteIA = 20;
        if (usoIA >= limiteIA) {
          setChatMessages(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
          setChatMessages(prev => [...prev, { 
            role: 'model', 
            text: 'Has alcanzado el límite de 20 consultas de tu período de prueba gratuita. Por favor, adquiere un Plan en la sección "Planes y Precios" para continuar consultando al Oráculo.', 
            timestamp: new Date() 
          }]);
          setChatInput('');
          setPendingFiles([]);
          return;
        }
      } else {
        // Control de límite para planes de pago
        let aiLimit = 30;
        if (planStr.includes('full')) aiLimit = 300;
        else if (planStr.includes('empresa')) aiLimit = 100;
        else if (planStr.includes('pro')) aiLimit = 50;
        else if (planStr.includes('basico') || planStr.includes('básico')) aiLimit = 30;
        else if (isApprovedPayment || isWhitelisted) aiLimit = 300;

        if (currentUser?.email === 'jotamolinas@gmail.com' || isOperador) {
          aiLimit = 999999;
        }

        const consultasRealizadas = userData?.usoIA || 0;
        if (consultasRealizadas >= aiLimit) {
          setChatMessages(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
          setChatMessages(prev => [...prev, { 
            role: 'model', 
            text: `Has alcanzado el límite de ${aiLimit} consultas de tu plan actual. Por favor, actualiza tu plan en la pestaña "Planes y Precios" para continuar consultando al Oráculo.`, 
            timestamp: new Date() 
          }]);
          setChatInput('');
          setPendingFiles([]);
          return;
        }
      }
    }
    
    const streamMsgId = `olga-stream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setChatInput('');
    setPendingFiles([]);
    setChatMessages(prev => [
      ...prev,
      { role: 'user', text: userText, timestamp: new Date() },
      { id: streamMsgId, role: 'model', text: '', timestamp: new Date() }
    ]);
    setChatLoading(true);

    try {
      // Limitar historial a los últimos 10 mensajes, omitiendo el saludo inicial de bienvenida y garantizando empezar por 'user'
      const rawHistory = chatMessages
        .slice(1)
        .filter((m) => typeof m?.text === 'string' && m.text.trim().length > 0)
        .slice(-10)
        .map((m) => ({
          role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
          parts: [{ text: m.text }]
        }));
      while (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
        rawHistory.shift();
      }
      const history = rawHistory;

      const fechaHoyParaguay = new Date().toLocaleDateString('es-PY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Asuncion'
      });

      const panelContextPrompt = `
[CONTEXTO INTERNO DE OPERACIÓN]
FECHA ACTUAL EN PARAGUAY: ${fechaHoyParaguay}. Usa SIEMPRE esta fecha actual (y el año en curso) para todos los contratos, pagarés y documentos que redactes, salvo que el usuario indique otra fecha explícitamente.
ESTÁNDAR NOTARIAL PARAGUAYO (OBLIGATORIO):
- Nivel Profesional (Escribanos y Abogados de Paraguay): Prohibido redactar contratos escuetos o resúmenes de 6-7 líneas. Todo contrato o escrito debe tener redacción jurídica rigurosa, formal y completa conforme al Código Civil Paraguayo (Ley N° 1.183/85) y leyes concordantes.
- Cláusulas completas obligatorias en contratos de arrendamiento/locación: Incluir como mínimo cláusulas desarrolladas y numeradas (PRIMERA, SEGUNDA, etc.) de: 1) Objeto e individualización del inmueble (dejando [completar Finca / Matrícula / Cta. Cte. Catastral] si el usuario no lo dio), 2) Plazo y renovación, 3) Precio, lugar/forma de pago y mora automática con interés punitorio, 4) Depósito de garantía y restitución, 5) Destino del inmueble y prohibición de subarriendo/cesión, 6) Servicios básicos (ANDE, ESSAP/agua, tasas municipales) e impuestos, 7) Estado de conservación, inventario y mejoras, 8) Rescisión anticipada, incumplimiento y desalojo, 9) Domicilios especiales constituidos a todos los efectos legales, 10) Jurisdicción y competencia (Tribunales de la Circunscripción Judicial correspondiente a la ciudad del inmueble).
- FORMATO ESTRICTO DE DOCUMENTOS Y FIRMAS: Prohibido usar etiquetas HTML (<br>, &nbsp;, <div>, <p>, etc.). Al final del documento, incluye SIEMPRE el cierre de conformidad y el bloque de firmas limpio uno debajo del otro con líneas de firma visibles (_______________________________), Nombre Completo, C.I. N° y Rol (NUNCA uses &nbsp; ni espacios artificiales para dos columnas).
- DELIMITADORES OBLIGATORIOS DE DOCUMENTO: Siempre que redactes un contrato, escrito, poder, acta o nota, DEBES envolver el documento puro entre las etiquetas exactas:
===INICIO_DOCUMENTO===
(aquí va únicamente el título, cuerpo legal y bloque de firmas del documento)
===FIN_DOCUMENTO===
Cualquier saludo inicial, resumen de datos extraídos o sección de "RECOMENDACIÓN DE O.L.G.A.:" debe ir estrictamente FUERA de esas etiquetas.
El usuario está utilizando el panel de control de administración y notarización O.L.G.A (Organización, Legalización, Gestión y Administración).
Información actual del sistema en tiempo real para ayudar con precisión:
- Cantidad de pagarés redactados: ${pagares.length}
- Cantidad de personas registradas: ${personas.length}
- Escribanía titular: ${config.escribania.nombre} (Matrícula: ${config.escribania.nro_registro})
- Frecuencias de pago activas: ${config.frecuencias.filter(f => f.activa).map(f => f.nombre).join(', ')}
- Monedas autorizadas: ${config.monedas.filter(m => m.activa).map(m => m.codigo).join(', ')}
- Rol del usuario actual: ${role === 'admin' ? 'Administrador' : 'Usuario'}
Eres O.L.G.A., experta en leyes paraguayas, redacción de contratos privados, pagarés y escrituras públicas.
Conoces en profundidad la Ley 1.183/85 (Código Civil Paraguayo) sobre obligaciones y contratos, así como la Ley de Maquila y constituciones de sociedades (S.A., S.R.L., E.A.S.).
Responde a las consultas del usuario justificando legalmente o redactando las cláusulas solicitadas con alto nivel técnico y notarial, de manera rigurosa y en español.`;

      const attachments = currentPendingFiles.length > 0 ? currentPendingFiles.map(f => ({ data: f.data, mimeType: f.mimeType })) : undefined;

      const response = await sendMessageToOlga(
        userText,
        history,
        'es',
        attachments,
        {
          systemInstructionExtra: panelContextPrompt,
          timeoutMs: 90000,
          onChunk: (textPartial) => {
            setChatMessages(prev =>
              prev.map(m => (m.id === streamMsgId ? { ...m, text: textPartial } : m))
            );
          }
        }
      );

      const finalResponseText = response.text || 'Entendido. ¿En qué más puedo asistirte dentro del panel?';
      setChatMessages(prev =>
        prev.map(m => (m.id === streamMsgId ? { ...m, text: finalResponseText } : m))
      );

      if (activeTabRef.current !== 'chat') {
        setHasUnreadChatResponse(true);
        setChatReadyToast(true);
        if (chatToastTimerRef.current) {
          window.clearTimeout(chatToastTimerRef.current);
        }
        chatToastTimerRef.current = window.setTimeout(() => {
          setChatReadyToast(false);
          chatToastTimerRef.current = null;
        }, 10000);
      }
      
      if (role !== 'admin' && auth.currentUser && auth.currentUser.uid) {
        try {
          const isDemo = userData?.plan === 'Demo';
          const usoIA = userData?.usoIA || 0;
          const limiteIA = userData?.limiteIA || 20;
          const fechaVencimiento = userData?.fechaVencimientoDemo ? (userData.fechaVencimientoDemo.toDate ? userData.fechaVencimientoDemo.toDate() : new Date(userData.fechaVencimientoDemo)) : new Date(0);
          const isDemoValid = isDemo && (usoIA < limiteIA && new Date() <= fechaVencimiento);
          const hasValidPlan = userData?.estadoPlataforma === 'Aprobado' || isDemoValid;
          
          if (hasValidPlan) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { usoIA: increment(1) });
          }
        } catch (e) {
           console.warn("Could not increment AI queries", e);
        }
      }
    } catch (err: any) {
      console.warn("Aviso al enviar mensaje a la IA:", err?.message || err);
      const rawErrorText = typeof err?.message === 'string' ? err.message : '';
      const fallbackErrorText =
        /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|Free Tier|cuota gratuita|facturaci[óo]n|Settings > Secrets|Gemini API/i.test(rawErrorText)
          ? 'El Oráculo está atendiendo un alto volumen de consultas en este momento. No se trata de un error del sistema ni de tu cuenta; por favor, aguarda unos segundos y vuelve a enviar tu solicitud.'
          : rawErrorText || 'Disculpa, experimenté una interrupción temporal en mi canal de IA. ¿Podrías volver a formular tu pregunta?';
      setChatMessages(prev =>
        prev.map(m => (m.id === streamMsgId ? { ...m, text: m.text ? `${m.text}\n\n_${fallbackErrorText}_` : fallbackErrorText } : m))
      );
    } finally {
      setChatLoading(false);
    }
  };

  const processFile = async (file: File) => {
    setChatLoading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setPendingFiles(prev => [...prev, { name: file.name, data: base64Data, mimeType: file.type }]);
        setChatLoading(false);
      };
      reader.onerror = () => {
        throw new Error("Failed to read file");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error procesando archivo:", error);
      setChatMessages(prev => [
        ...prev,
        { role: 'model', text: 'Ocurrió un error al intentar leer el documento. Verifica que sea un archivo válido.', timestamp: new Date() }
      ]);
      setChatLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i]);
    }
    // clear the input so the same files can be selected again if removed
    e.target.value = '';
  };

  const handleAttachmentClick = (type: string) => {
    if (type === 'Local' || type === 'Documento/PDF' || type === 'Imagen' || type === 'Cámara' || type === 'Audio') {
      if (!fileInputRef.current) {
        console.error("Ref is missing!");
        return;
      }
      // If we wanted to, we could change the `accept` attribute based on `type` here
      setAttachmentMenuOpen(false);
      fileInputRef.current.click();
    }
  };

  // En el workspace compartido, los pagarés pertenecen a la notaría
  const visiblePagares = pagares;

  const isAdminConsoleTab = activeTab === 'monitor' || activeTab === 'onboarding-sifen' || activeTab === 'pagos';
  const isSuperAdminView = (role === 'admin' || forceAdmin) && isAdminConsoleTab;
  const isDarkLayout = isDarkMode || isSuperAdminView;
  const layoutBg = isDarkLayout ? 'bg-[#09090b]' : 'bg-gray-50';
  const layoutText = isDarkLayout ? 'text-gray-200' : 'text-gray-900';

  return (
    <div 
      className={`flex flex-col md:flex-row ${isSuperAdminView ? 'min-h-screen overflow-x-hidden md:h-screen md:overflow-hidden' : 'h-screen overflow-hidden'} font-sans ${layoutBg} ${layoutText} transition-all duration-300 print:block print:h-auto print:overflow-visible print:bg-white print:pl-0 ${
        !isSidebarPinned ? 'md:pl-[72px]' : ''
      }`} 
      id="main-panel-container"
    >
      {/* Sidebar de Navegación Vertical Inteligente Glow UI */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isPinned={isSidebarPinned}
        setIsPinned={setIsSidebarPinned}
        role={role}
        setRole={setRole}
        isAdmin={isAdmin}
        isOperador={isOperador}
        currentUser={currentUser}
        userProfile={userProfile}
        userData={userData}
        customBranding={customBranding}
        workspaceName={workspaceName}
        config={config}
        activePlan={activePlan}
        esPlanFull={esPlanFull}
        canUseWhatsApp={canUseWhatsApp}
        canUseLienzo={canUseLienzo}
        canUsePresupuesto={canUsePresupuesto}
        logoInstitucional={logoInstitucional}
        setShowBenefits={setShowBenefits}
        onLogout={async () => {
          localStorage.removeItem('appSessionId');
          await logout();
          setCurrentUser(null);
          setUserProfile(null);
          setPersonas([]);
          setPagares([]);
          setExpedientes([]);
          setCustomBranding({ nombreInstitucion: '', ruc: '', registroNotarial: '' });
        }}
        isStandalone={isStandalone}
        installMessage={installMessage}
        handleInstallClick={handleInstallClick}
        isSoftBlocked={isSoftBlocked}
        hasUnreadChatResponse={hasUnreadChatResponse}
        isChatLoading={chatLoading}
      />

      {/* Main Content Workspace viewport */}
      <main className={`flex-grow flex flex-col relative w-full min-w-0 max-w-full ${isSuperAdminView ? 'min-h-screen md:min-h-0 md:h-full md:overflow-hidden' : 'h-full overflow-hidden'}`} id="main-content-viewport">
        
        {/* Dynamic header display */}
        <header className={`${
          isDarkLayout
            ? 'bg-[#12141C]/80 border-b border-white/10 text-gray-100 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.4)]'
            : esPlanFull 
              ? 'bg-[#F4F4F0]/80 border-b border-amber-200/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] text-gray-900' 
              : 'bg-white/95 border-b border-slate-200/70 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.03)] text-gray-900'
        } safe-header-top safe-header-md-py pb-3 px-4 md:px-8 min-h-[64px] flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl print:hidden`}>
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {/* Hamburger menu button (solo en pantallas móviles) */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`p-2 rounded-xl shrink-0 transition-colors border md:hidden cursor-pointer ${
                isDarkLayout
                  ? 'bg-[#2c2f36] hover:bg-[#363a42] text-gray-100 border-[#424650]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl overflow-hidden shrink-0 hidden sm:flex items-center justify-center bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-400 border border-orange-200/60 shadow-[0_4px_12px_rgba(249,115,22,0.25)]">
              {logoInstitucional ? (
                <img src={logoInstitucional} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-serif font-black text-sm">O</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`text-sm md:text-lg font-serif font-black ${isDarkLayout ? "text-white" : "text-slate-900"} tracking-tight leading-none truncate`}>
                {isOperador 
                  ? (workspaceName || "Escribanía Titular")
                  : esAbogado
                    ? (
                        userProfile?.razonSocial?.trim() ||
                        userData?.razonSocial?.trim() ||
                        customBranding.nombreInstitucion?.trim() ||
                        (workspaceName && workspaceName !== 'Mi Escribanía' ? workspaceName.trim() : '') ||
                        userProfile?.nombre?.trim() ||
                        userData?.nombre?.trim() ||
                        currentUser?.displayName?.trim() ||
                        currentUser?.phoneNumber?.trim() ||
                        'Estudio Jurídico'
                      )
                    : (
                        customBranding.nombreInstitucion?.trim() ||
                        userData?.razonSocial?.trim() ||
                        workspaceName?.trim() ||
                        config.escribania.nombre?.trim() ||
                        userData?.nombre?.trim() ||
                        currentUser?.displayName?.trim() ||
                        currentUser?.phoneNumber?.trim() ||
                        'Mi Escribanía'
                      )
                }
              </h1>
              <p className="text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 truncate">
                {isOperador 
                  ? `Operador Notarial • ${workspaceName || 'Escribanía Titular'}`
                  : esAbogado
                    ? 'Estudio Jurídico • Panel Legal'
                    : (() => {
                        const regText = String(customBranding.registroNotarial || '').trim();
                        const matText = String(userData?.matricula || config.escribania.nro_registro || '').trim();
                        const rawTipo = String(userData?.tipoPerfil || '').trim();
                        const tipoLabel = !rawTipo || rawTipo.toLowerCase() === 'escribania' ? 'Escribanía' : rawTipo;
                        if (regText) return `${regText}${matText ? ` • ${matText}` : ''}`;
                        if (matText) return `${tipoLabel} Titular • Reg. ${matText}`;
                        return `${tipoLabel} • Panel Notarial`;
                      })()
                }
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 flex-shrink-0">
            {/* INICIO DEL BLOQUE DE INSIGNIAS CONDICIONALES ACTUALIZADO MANUALMENTE */}
{(() => {
  const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador' || userData?.rol === 'operador' || userData?.role === 'operador';
  if (isOperador) {
    const planActualOp = userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan;
    const textoPlan = planActualOp && planActualOp !== 'Operador Notarial' ? String(planActualOp).toUpperCase() : 'PLAN BÁSICO';
    const nombrePlanOp = textoPlan.startsWith('PLAN ') ? textoPlan : `PLAN ${textoPlan}`;
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span className="bg-slate-800 text-white border border-slate-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap" title="Operador Notarial (Plan Heredado)">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{nombrePlanOp}</span>
        </span>
      </div>
    );
  }

  // Dinamismo Multiusuario: Lectura directa del plan desde el estado global del usuario logueado o perfil
  const planRaw = userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || (config as any)?.tipoPlan || '';
  const planTexto = String(planRaw).trim().toUpperCase();
  const nombrePlan = planTexto.startsWith('PLAN ') ? planTexto : `PLAN ${planTexto}`;
  const planLower = planTexto.toLowerCase();

  // Eliminar el Badge 'PLAN TRIAL' (UI Header): solo mostrar si tiene un plan de pago real
  if (!planLower || planLower === 'trial' || planLower.includes('trial') || planLower.includes('prueba') || planLower === 'ninguno' || planLower === 'sin plan') {
    return null;
  }

  if (planLower.includes('full')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span 
          onClick={() => setShowBenefits(true)}
          className="cursor-pointer bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold px-3 py-1 rounded-full shadow-[0_4px_14px_rgba(251,191,36,0.35)] text-[10px] sm:text-xs transition-transform hover:scale-105 whitespace-nowrap"
        >
          {nombrePlan}
        </span>
      </div>
    );
  }

  if (planLower.includes('empresa')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span 
          onClick={() => setShowEmpresaBenefits(true)}
          className="cursor-pointer bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white font-extrabold px-3 py-1 rounded-md border border-gray-600 shadow-[0_0_12px_rgba(255,255,255,0.2)] text-[10px] sm:text-xs transition-transform hover:scale-105 whitespace-nowrap"
        >
          {nombrePlan}
        </span>
      </div>
    );
  }

  if (planLower.includes('pro')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span className="bg-blue-600 text-white px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm whitespace-nowrap">
          {nombrePlan}
        </span>
      </div>
    );
  }

  // Plan Básico u otro plan personalizado dinámico registrado en el usuario
  return (
    <div className="flex items-center shrink-0 flex-shrink-0">
      <span className="bg-emerald-600 text-white px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm whitespace-nowrap">
        {nombrePlan}
      </span>
    </div>
  );
})()}

            {role !== 'admin' && (currentUser as any)?.role !== 'SUPERADMIN' && userProfile?.role !== 'SUPERADMIN' && currentUser?.role !== 'operador' && !isOperador && (() => {
              const planActivoBtn = String(userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || '').toLowerCase();
              const isPagoAprobado = String(userData?.estadoPago || userProfile?.estadoPago || '').toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma || userProfile?.estadoPlataforma || '').toUpperCase() === 'APROBADO';
              const hasActivePlan = planActivoBtn.includes('pro') || planActivoBtn.includes('empresa') || planActivoBtn.includes('full') || planActivoBtn.includes('basico') || planActivoBtn.includes('básico') || isPagoAprobado;
              return !hasActivePlan;
            })() && (
              <button 
                onClick={() => setActiveTab('planes')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:scale-105 shrink-0 flex-shrink-0 transition-transform cursor-pointer"
              >
                <Target className="w-3 h-3 animate-pulse text-amber-100" />
                <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Obtener Planes</span>
              </button>
            )}

            {/* Campana de Notificaciones Notariales y Judiciales Global */}
            <NotificationBell 
              currentUser={currentUser}
              pagares={pagares}
              expedientes={canUseExpedientes ? expedientes : []}
              onSelectPagare={(id) => {
                const found = pagares.find(p => p.id === id);
                if (found) {
                  handleAbrirPagarePreview(found);
                }
                setActiveTab('pagares');
              }}
              onSelectExpediente={() => {
                setActiveTab('expedientes');
              }}
            />

            <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase font-mono pb-0.5 hidden xs:block whitespace-nowrap shrink-0 flex-shrink-0">
              Serie: PJE-{config?.anio_serie || new Date().getFullYear()}
            </div>
          </div>
        </header>

        {/* Scrollable container for tab body content */}
        <div className={`flex-grow w-full max-w-full overflow-x-hidden overflow-y-auto print:overflow-visible print:h-auto print:p-0 ${activeTab === 'chat' ? 'p-0 md:p-8 flex flex-col overflow-y-auto' : (activeTab === 'monitor' || activeTab === 'pagos') ? 'p-0 flex flex-col flex-1 overflow-y-auto md:overflow-hidden' : 'p-4 md:p-8 overflow-y-auto'}`}>
          <div className={`w-full min-w-0 max-w-7xl mx-auto flex-grow flex flex-col print:max-w-none print:w-full print:p-0 print:pb-0 ${activeTab === 'chat' ? 'pb-0 md:pb-24 h-full' : (activeTab === 'monitor' || activeTab === 'pagos') ? 'min-h-full md:h-full flex-1 overflow-visible md:overflow-hidden pb-24 md:pb-0' : 'pb-24'}`}>
            
            {(() => {
              return (
                <>
                  {/* AVISO GLOBAL DE PLATAFORMA (SuperAdmin -> Usuarios segmentados) */}
                  {shouldShowGlobalAnnouncement && globalAnnouncement && (() => {
                    const isMantenimiento = globalAnnouncement.type === 'mantenimiento';
                    const isPromocion = globalAnnouncement.type === 'promocion';
                    const isImportante = globalAnnouncement.type === 'importante';
                    const isInformativo = globalAnnouncement.type === 'informativo';
                    const containerCls = isMantenimiento || isImportante
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : isPromocion
                        ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-emerald-300 text-emerald-950'
                        : isInformativo
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50/60 border-blue-200 text-slate-900';
                    const iconBoxCls = isMantenimiento || isImportante
                      ? 'bg-amber-100 text-amber-700'
                      : isPromocion
                        ? 'bg-emerald-100 text-emerald-700'
                        : isInformativo
                          ? 'bg-slate-200/80 text-slate-700'
                          : 'bg-blue-100 text-blue-700';
                    const badgeCls = isMantenimiento || isImportante
                      ? 'bg-amber-200/70 text-amber-900'
                      : isPromocion
                        ? 'bg-emerald-200/70 text-emerald-900'
                        : isInformativo
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-blue-100 text-blue-800';
                    const badgeLabel = isMantenimiento
                      ? 'Mantenimiento'
                      : isImportante
                        ? 'Importante'
                        : isPromocion
                          ? 'Promoción'
                          : isInformativo
                            ? 'Informativo'
                            : 'Novedad';

                    return (
                      <div
                        className={`border rounded-2xl p-4 flex items-start justify-between gap-4 shrink-0 mb-5 shadow-sm print:hidden ${
                          activeTab === 'monitor' ? 'mx-4 mt-3 mb-2' : activeTab === 'chat' ? 'mx-4 mt-4 md:mx-0 md:mt-0' : ''
                        } ${containerCls}`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${iconBoxCls}`}>
                            {isMantenimiento ? (
                              <Wrench className="w-5 h-5" />
                            ) : isImportante ? (
                              <AlertTriangle className="w-5 h-5" />
                            ) : isPromocion ? (
                              <Sparkles className="w-5 h-5" />
                            ) : isInformativo ? (
                              <Bell className="w-5 h-5" />
                            ) : (
                              <Megaphone className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeCls}`}>
                                {badgeLabel}
                              </span>
                              {globalAnnouncement.title && (
                                <p className="text-sm font-bold leading-snug">
                                  {globalAnnouncement.title}
                                </p>
                              )}
                            </div>
                            {globalAnnouncement.message && (
                              <p className="text-xs leading-relaxed opacity-90 whitespace-pre-line">
                                {globalAnnouncement.message}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDismissGlobalAnnouncement}
                          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
                          aria-label="Cerrar aviso"
                          title="Cerrar aviso"
                        >
                          <X className="w-4 h-4 opacity-70" />
                        </button>
                      </div>
                    );
                  })()}

                  {/* BANNERS UNIFICADOS (Reglas estrictas de 3 estados) */}

                  {/* Estado 1 (Softblocked): Si isSoftBlocked es true (sea ex-trial o ex-pago), muestra UNICAMENTE el banner ROJO */}
                  {isSoftBlocked && activeTab !== 'planes' && (
                    <div className="bg-red-50 border-b border-red-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 mb-6 rounded-2xl animate-fade-in shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-900">Tu acceso ha expirado</p>
                          <p className="text-xs text-red-700">Tu acceso ha expirado. Modo Solo Lectura activado. Adquiere o renueva tu plan para restaurar los privilegios.</p>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('planes')} className="whitespace-nowrap px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md">
                        Renovar Plan
                      </button>
                    </div>
                  )}

                  {/* Estado 2 (Prueba Activa): Si isSoftBlocked es false Y no tiene plan de pago, muestra UNICAMENTE el banner AMARILLO */}
                  {(!tienePlanPago && !isSoftBlocked && activeTab !== 'planes') && (
                    <div className="bg-amber-50 border-b border-amber-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 mb-6 rounded-2xl animate-fade-in shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-900">Modo de prueba activo</p>
                          <p className="text-xs text-amber-700">⚠️ Modo de prueba. Te quedan <strong>{diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}</strong> de acceso completo para evaluar la plataforma.</p>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('planes')} className="whitespace-nowrap px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md">
                        Ver Planes
                      </button>
                    </div>
                  )}

                  {/* Estado 3 (Pago Activo): Si isSoftBlocked es false Y tiene un plan de pago aprobado, no se muestra ningún banner */}
                  
                  {activeTab === 'tablero' && (
              <TableroTab 
                pagares={pagares}
                personas={personas}
                config={config}
                onSelectPagareForPreview={handleAbrirPagarePreview}
                onOpenDocument={handleOpenDocumentModal} 
                onAddPagare={handleAddPagare}
                onUpdatePagare={handleUpdatePagare}
                onDeletePagare={handleDeletePagare}
                onAddPersona={handleAddPersona}
                onUpdatePersona={handleUpdatePersona}
                onDeletePersona={handleDeletePersona}
                isAdmin={role === 'admin'}
                userData={userProfile || userData}
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                isSoftBlocked={isSoftBlocked}
                esPlanFull={esPlanFull}
                canUseWhatsApp={canUseWhatsApp}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'planes' && currentUser?.role !== 'operador' && !isOperador && (
              <PlanesTab 
                activePlan={activePlan}
                onPlanSelect={(planName, planPrice) => {
                  setSelectedPlanForCheckout({ name: planName, price: planPrice });
                  setCheckoutModalOpen(true);
                  if (currentUser?.uid) {
                    const modalidad = planPrice.includes('año') ? 'Anual' : 'Mensual';
                    const activeProfile = userProfile || userData;
                    void (async () => {
                      try {
                        await setDoc(doc(db, 'users', currentUser.uid), {
                          ultimoPlanInteres: planName,
                          modalidadInteres: modalidad,
                          fechaSolicitudPlan: serverTimestamp(),
                        }, { merge: true });
                        notifySuperAdminWhatsApp({
                          type: 'plan_request',
                          userName:
                            activeProfile?.nombreCompleto ||
                            activeProfile?.nombre ||
                            activeProfile?.razonSocial ||
                            currentUser.displayName ||
                            currentUser.email ||
                            'Usuario',
                          userEmail: currentUser.email || activeProfile?.email || '',
                          userPhone: activeProfile?.telefono || currentUser.phoneNumber || '',
                          details: `${planName} (${modalidad}) - ${planPrice}`,
                        });
                      } catch {
                        // Silencioso para no afectar la apertura del checkout
                      }
                    })();
                  }
                }}
              />
            )}

            {activeTab === 'pagares' && (
              <PagaresTab
                pagares={visiblePagares}
                onUpdatePagare={handleUpdatePagare}
                personas={personas}
                config={config}
                onAddPagare={handleAddPagare}
                onDeletePagare={handleDeletePagare}
                onAddPersona={handleAddPersona}
                onSelectPagareForPreview={handleAbrirPagarePreview}
                isAdmin={role === 'admin'}
                userData={userProfile || userData}
                isSoftBlocked={isSoftBlocked}
                esPlanFull={esPlanFull}
                canUseWhatsApp={canUseWhatsApp}
              />
            )}

            {activeTab === 'personas' && (
              <PersonasTab
                personas={personas}
                pagares={pagares}
                onAddPersona={handleAddPersona}
                onUpdatePersona={handleUpdatePersona}
                onDeletePersona={handleDeletePersona}
                isAdmin={role === 'admin'}
                currentUser={currentUser}
                userData={userProfile || userData}
                isSoftBlocked={isSoftBlocked}
                esPlanFull={esPlanFull}
              />
            )}

            {activeTab === 'escritos' && (
              <EscritosTab  
                currentUser={currentUser} 
                userProfile={userProfile || userData}
                personas={personas}
                onOpenDocument={handleOpenDocumentModal} 
                esPlanFull={esPlanFull}
                isSoftBlocked={isSoftBlocked}
                canUseWhatsApp={canUseWhatsApp}
              />
            )}

            {activeTab === 'expedientes' && canUseExpedientes && (
              <ExpedientesTab
                expedientes={expedientes}
                personas={personas}
                userData={userProfile || userData}
                workspaceId={currentWorkspaceId || workspaceId}
                esPlanFull={esPlanFull}
                isSoftBlocked={isSoftBlocked}
                onSaveExpediente={async (exp) => {
                  const targetWs = currentWorkspaceId || workspaceId;
                  if (!targetWs) {
                    throw new Error('Workspace no identificado.');
                  }
                  const saved = await syncExpedienteToFirestore(targetWs, exp);
                  setExpedientes((prev) => {
                    const exists = prev.some((item) => item.id === saved.id);
                    return exists
                      ? prev.map((item) => (item.id === saved.id ? saved : item))
                      : [saved, ...prev];
                  });
                }}
                onDeleteExpediente={async (expedienteId) => {
                  await deleteExpedienteFromFirestore(expedienteId);
                  setExpedientes((prev) => prev.filter((item) => item.id !== expedienteId));
                }}
                onOpenDocument={handleOpenDocumentModal}
              />
            )}

            {activeTab === 'lienzo' && !esAbogado && (
              isSoftBlocked && getExplicitAddonFlag('lienzoEnabled') !== true ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                  <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Acceso Restringido</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Acceso Restringido. Tu plan ha expirado. Renueva tu suscripción para volver a utilizar el Lienzo Notarial y Presupuestos.
                  </p>
                  <button
                    onClick={() => setActiveTab('planes')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
                  >
                    Ver Planes / Renovar
                  </button>
                </div>
              ) : canUseLienzo ? (
                <EditorNotarialOficial 
                  onVolver={() => setActiveTab('escritos')} 
                  esPlanFull={esPlanFull}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                  <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Módulo no contratado o deshabilitado</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    El <strong>Lienzo Notarial Oficial</strong> no está habilitado para tu cuenta actual. Está disponible desde el <strong>Plan Pro</strong> o como módulo adicional.
                  </p>
                  <button
                    onClick={() => setActiveTab('planes')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
                  >
                    Ver Planes Disponibles
                  </button>
                </div>
              )
            )}

            {activeTab === 'facturacion' && (
              isSoftBlocked && getExplicitAddonFlag('presupuestoEnabled') !== true ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                  <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Acceso Restringido</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Acceso Restringido. Tu plan ha expirado. Renueva tu suscripción para volver a utilizar el Lienzo Notarial y Presupuestos.
                  </p>
                  <button
                    onClick={() => setActiveTab('planes')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
                  >
                    Ver Planes / Renovar
                  </button>
                </div>
              ) : canUsePresupuesto ? (
                <ModuloPresupuestos 
                  onVolver={() => setActiveTab(canUseLienzo ? 'lienzo' : 'escritos')}
                  userId={currentUser?.uid || currentUser?.email || 'default'}
                  userProfile={userProfile || userData}
                  onIrAConfiguracion={() => setActiveTab('cuenta')}
                  escribaniaNombre={workspaceName || customBranding.nombreInstitucion || userData?.razonSocial || config.escribania.nombre}
                  registroNotarial={customBranding.registroNotarial || userData?.matricula || config.escribania.nro_registro}
                  rucEscribania={customBranding.ruc || userData?.ruc || '80012345-6'}
                  direccionEscribania={(customBranding as any)?.direccion || userData?.direccion || config.escribania.direccion}
                  telefonoEscribania={(customBranding as any)?.telefono || userData?.telefono || config.escribania.telefono}
                  esPlanFull={esPlanFull}
                  canUseWhatsApp={canUseWhatsApp}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                  <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Módulo no contratado o deshabilitado</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    El <strong>Módulo de Presupuestos</strong> no está habilitado para tu cuenta actual. Está disponible desde el <strong>Plan Pro</strong> o como módulo adicional.
                  </p>
                  <button
                    onClick={() => setActiveTab('planes')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
                  >
                    Ver Planes Disponibles
                  </button>
                </div>
              )
            )}
            
            {activeTab === 'cuenta' && (
              <ConfiguracionTab 
                onConfigUpdate={(data) => setCustomBranding(data)} 
                pagares={pagares} 
                userPlan={userProfile?.planActual || userProfile?.plan || activePlan}
                userData={userProfile || userData}
                currentUser={currentUser}
                esPlanFull={esPlanFull}
              />
            )}

            {activeTab === 'config' && role === 'admin' && (
              <ConfigTab
                config={config}
                onUpdateConfig={handleUpdateConfig}
                isAdmin={role === 'admin'}
                esPlanFull={esPlanFull}
              />
            )}

            {activeTab === 'monitor' && role === 'admin' && (
              <SuperAdminDashboard mode="monitor" />
            )}

            {activeTab === 'pagos' && role === 'admin' && (
              <SuperAdminDashboard mode="pagos" />
            )}

            {activeTab === 'onboarding-sifen' && role === 'admin' && (
              <SuperAdminOnboarding />
            )}

            {(activeTab === 'monitor' || activeTab === 'pagos' || activeTab === 'onboarding-sifen') && role !== 'admin' && (
              <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
                <div className="w-full max-w-md bg-[#121214] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  {isCheckingProfile ? (
                    <>
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">Cargando Monitor Central</h3>
                        <p className="text-xs text-gray-400">Verificando credenciales de Super Admin...</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white">Acceso Super Admin Requerido</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {currentUser
                            ? 'Tu sesión actual no tiene permisos de Super Administrador para esta vista.'
                            : 'Iniciá sesión con tu cuenta de Super Administrador para acceder al Monitor Central y Gestión de Cobros.'}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                        <a
                          href="/admin"
                          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors text-center"
                        >
                          Ir a Login Admin
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveTab('tablero')}
                          className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Volver al Tablero
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'soporte' && role === 'admin' && (
              <BuzonAdminTab esPlanFull={esPlanFull} />
            )}

            {activeTab === 'soporte' && role !== 'admin' && (
              <SoporteClienteTab currentUser={currentUser} userData={userProfile} esPlanFull={esPlanFull} />
            )}

            {activeTab === 'whatsapp' && (
              canUseWhatsApp === true ? (
                <WhatsAppTab
                  workspaceId={workspaceId}
                  esPlanFull={esPlanFull}
                  escribania={{
                    nombre: workspaceName || customBranding.nombreInstitucion || userData?.razonSocial || config.escribania.nombre,
                    ruc: customBranding.ruc || userData?.ruc || '',
                    registro: customBranding.registroNotarial || userData?.matricula || config.escribania.nro_registro || '',
                    telefono: (customBranding as any)?.telefono || userData?.telefono || config.escribania.telefono || '',
                    direccion: (customBranding as any)?.direccion || userData?.direccion || config.escribania.direccion || '',
                  }}
                  onOpenEscritos={() => setActiveTab('escritos')}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-2xl">
                  <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Módulo WhatsApp IA no contratado</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    El módulo de <strong>WhatsApp Institucional e IA</strong> no está habilitado para tu cuenta. Solicita su activación al equipo comercial de O.L.G.A.
                  </p>
                  <button
                    onClick={() => setActiveTab('soporte')}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
                  >
                    Solicitar Activación
                  </button>
                </div>
              )
            )}

            {activeTab === 'chat' && (() => {
              const rawPlan = String(userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || activePlan || '').toLowerCase();
              const tienePlanPago = rawPlan.includes('basico') || rawPlan.includes('básico') || rawPlan.includes('pro') || rawPlan.includes('empresa') || rawPlan.includes('full') || String(userData?.estadoPago || userProfile?.estadoPago).toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma || userProfile?.estadoPlataforma).toUpperCase() === 'APROBADO' || role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
              // Skin dorado SOLO para Plan Full:
              const esPlanFullSkin = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || rawPlan.includes('full');
              // El Oráculo para Plan Full y Plan Empresa:
              const tieneOraculoChat = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || rawPlan.includes('full') || rawPlan.includes('empresa');
              const tieneAccesoChat = pruebaActiva || tienePlanPago;

              return (
                /* Conversational assistance with O.L.G.A. IA */
                <div className="p-4 md:p-8 md:rounded-[2.5rem] flex-grow md:h-[78vh] flex flex-col space-y-4 md:space-y-6 animate-message bg-slate-900 border border-slate-800 shadow-xl text-white" id="chat-assistant-container">
                  <div className="pb-4 shrink-0 border-b border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-slate-800 border border-slate-700 text-slate-300">
                          {tieneOraculoChat ? <Sparkles className="w-6 h-6 text-amber-400" /> : <MessageSquare className="w-6 h-6 text-slate-300" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-white font-serif font-bold text-2xl tracking-tight">
                              {tieneOraculoChat ? 'El Oráculo de O.L.G.A.' : 'Asistente IA - O.L.G.A.'}
                            </h2>
                            <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider shadow-xs ${
                              esPlanFullSkin 
                                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950' 
                                : tieneOraculoChat
                                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                                  : 'bg-red-600 text-white'
                            }`}>
                              {tieneOraculoChat ? 'EL ORÁCULO' : 'ASISTENTE IA'}
                            </span>
                          </div>
                          <p className="text-xs mt-1 text-slate-400">
                            {tieneOraculoChat 
                              ? 'Supervisión, auditoría y análisis documental avanzado con El Oráculo.' 
                              : 'Consultas sobre legislación, pagarés, personas, redacción de escritos y cálculos notariales.'}
                          </p>
                        </div>
                      </div>

                      {/* Estado de acceso / Plan badge */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isSoftBlocked ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm bg-red-500/10 text-red-400 border-red-500/30">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            {tieneOraculoChat ? 'El Oráculo Bloqueado' : 'Asistente IA Bloqueado'}
                          </div>
                        ) : tienePlanPago ? (
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                            esPlanFullSkin 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${esPlanFullSkin ? 'bg-amber-500' : tieneOraculoChat ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                            {tieneOraculoChat ? 'El Oráculo Habilitado' : 'Asistente IA Habilitado'}
                          </div>
                        ) : (userData?.plan === 'Demo' || (!userData?.plan && pruebaActiva)) ? (
                          <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                            esPlanFull 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            Prueba Gratuita: {userData?.usoIA || 0}/{userData?.limiteIA || 20} consultas usadas - Vence en {
                              userData?.fechaVencimientoDemo ? 
                              Math.max(0, Math.ceil(((userData.fechaVencimientoDemo.toDate ? userData.fechaVencimientoDemo.toDate() : new Date(userData.fechaVencimientoDemo)).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
                              : Math.max(0, diasRestantes)
                            } días
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Dialog Messages viewport */}
                  <div className="flex-grow overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    {chatMessages.map((msg, i) => {
                      if (msg.role === 'model' && !msg.text) return null;
                      return (
                      <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-4 rounded-3xl max-w-[80%] shadow-sm text-xs md:text-sm font-medium ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-none'}`}>
                          {msg.role === 'model' ? (
                            <div className="flex flex-col gap-2 relative group w-full box-border">
                              <div id={`model-msg-${i}`} className="markdown-body prose prose-slate max-w-none prose-sm sm:prose-base prose-p:leading-relaxed prose-a:text-[#FF3131] prose-strong:text-slate-900 border-b border-transparent group-hover:border-slate-50 pb-2">
                                <ReactMarkdown>{formatearMensajeChatVisual(msg.text)}</ReactMarkdown>
                              </div>
                              <div className="flex items-center gap-2 self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {(!tienePlanPago && (activePlan === 'ninguno' || activePlan === undefined) && (!pruebaActiva || diasRestantes <= 0 || olgaDocsCount >= 5)) ? (
                                  <div className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      const extractedText = extraerDocumentoPuro(msg.text);
                                      handleOpenDocumentModal(extractedText, undefined, 'Escrito Oficial', undefined, 'blanca');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors border border-blue-200"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Exportar a Escrito
                                  </button>
                                )}
                                {(role === 'admin' || esPlanFull || tieneOraculoChat) && (
                                  <button 
                                    onClick={() => {
                                      const elm = document.getElementById(`model-msg-${i}`);
                                      imprimirDocumentoOficial(elm?.innerHTML || '', userProfile || userData || currentUser, isSoftBlocked);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors border border-slate-200"
                                  >
                                    <Printer className="w-3 h-3" />
                                    Imprimir Dictamen
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          )}
                        </div>
                      </div>
                      );
                    })}

                    {chatLoading && (
                      <div className="flex flex-col gap-1 p-3 bg-white border border-slate-200 rounded-2xl w-fit max-w-md shadow-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-150"></div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">O.L.G.A. procesando...</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          Generando en segundo plano. Puedes seguir trabajando en otros módulos y te avisaremos cuando esté listo.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Question Input form bar */}
                  {(tieneAccesoChat || isSoftBlocked) ? (
                    <div className="flex flex-col gap-1 bg-slate-100 p-2 md:rounded-2xl shrink-0">
                      {/* Oracle Admin / Full Plan Chips */}
                      {!isSoftBlocked && (esPlanFull || tieneOraculoChat) && (
                        <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2 border-b border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage('Actúa como auditor legal. Analiza este documento y enumera cualquier cláusula abusiva, usura o renuncia ilegal de derechos según el Código Civil Paraguayo.')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors rounded-xl text-[10px] font-bold border border-rose-200/50"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Escáner de Abusos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage('Actúa como Oficial de Cumplimiento. Revisa este texto y emite un dictamen de alerta temprana sobre posibles riesgos de lavado de dinero o inconsistencias financieras.')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors rounded-xl text-[10px] font-bold border border-amber-200/50"
                          >
                            <RefreshCcw className="w-3 h-3" />
                            Perfil SEPRELAD
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage('Traduce este documento al español, utilizando terminología jurídica y notarial estricta de Paraguay.')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors rounded-xl text-[10px] font-bold border border-blue-200/50"
                          >
                            <Globe className="w-3 h-3" />
                            Traducir al español
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendChatMessage('Redacta un correo formal y cortés solicitando a las partes que aclaren las inconsistencias de este documento.')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors rounded-xl text-[10px] font-bold border border-emerald-200/50"
                          >
                            <Mail className="w-3 h-3" />
                            Redactar Requerimiento
                          </button>
                        </div>
                      )}

                      {/* Pending Files Display */}
                      {pendingFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 mb-1">
                          {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                              <span className="max-w-[150px] truncate">{pf.name}</span>
                              <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 px-2 text-slate-500 overflow-visible relative">
                        <div className="relative">
                          <button onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)} type="button" className={`p-2 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${attachmentMenuOpen ? 'bg-slate-200 text-slate-800' : 'hover:text-slate-800'}`} title="Adjuntar">
                            <Plus className="w-4 h-4" />
                          </button>
                          {attachmentMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 overflow-hidden">
                              <button onClick={() => handleAttachmentClick('Documento/PDF')} type="button" className="w-full box-border text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-slate-400" /> Documento / PDF
                              </button>
                              <button onClick={() => handleAttachmentClick('Imagen')} type="button" className="w-full box-border text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-slate-400" /> Imagen de galería
                              </button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleAttachmentClick('Cámara')} type="button" className="p-2 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0" title="Cámara">
                          <Camera className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAttachmentClick('Audio')} type="button" className="p-2 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0" title="Grabar Audio">
                          <Mic className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleFileUpload}
                          accept="image/*,application/pdf,.doc,.docx"
                          multiple
                        />
                        <input
                          type="text"
                          value={chatInput}
                          disabled={isSoftBlocked}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendChatMessage();
                            }
                          }}
                          placeholder={isSoftBlocked ? "⚠️ Chat deshabilitado. Plan expirado." : (tieneOraculoChat ? "Consulte al Oráculo o anexe documentos a auditar..." : "Escriba su consulta al Asistente IA...")}
                          className={`flex-grow bg-transparent border-0 outline-none px-4 py-2 text-xs md:text-sm font-bold ${isSoftBlocked ? 'text-slate-400 bg-slate-200/50 rounded-xl cursor-not-allowed placeholder:text-red-500 placeholder:font-bold' : 'text-slate-700'}`}
                        />
                        <button
                          type="button"
                          disabled={isSoftBlocked}
                          onClick={() => handleSendChatMessage()}
                          className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-xl transition-all flex-shrink-0 ${
                            isSoftBlocked 
                              ? 'bg-slate-400 text-slate-200 cursor-not-allowed shadow-none' 
                              : esPlanFull 
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_4px_15px_rgba(245,158,11,0.35)] cursor-pointer' 
                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md cursor-pointer'
                          }`}
                          title={isSoftBlocked ? "Chat deshabilitado. Plan expirado." : "ENVIAR CONSULTA"}
                        >
                          <Send className="w-4 h-4 ml-0.5" />
                          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">ENVIAR CONSULTA</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-slate-50 border border-slate-200 rounded-3xl shrink-0 mx-2 md:mx-4 mb-2 md:mb-4 mt-2">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-slate-500" />
                      </div>
                      <h3 className="text-sm md:text-base font-bold text-slate-800 text-center mb-2">Tu periodo de prueba de 5 días ha finalizado.</h3>
                      <p className="text-xs text-slate-500 text-center max-w-md mb-6 leading-relaxed">
                        Para seguir consultando al asistente y desbloquear los dictámenes con membrete oficial, activa un Plan Profesional.
                      </p>
                      {currentUser?.role !== 'operador' && !isOperador && (
                        <button 
                          onClick={() => setActiveTab('planes')}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.35)] py-2.5 px-6 text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                        >
                          Ver Planes y Precios
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
                </>
              );
            })()}

          </div>
        </div>

        {/* Dynamic bottom bar info */}
        {role !== 'admin' && activeTab !== 'monitor' && (
        <footer className={`${isDarkLayout ? 'bg-[#16171E] border-white/10 text-slate-400' : 'bg-white/90 border-slate-200/80 text-slate-500'} border-t p-4 text-center text-[9px] font-mono tracking-widest uppercase mt-auto shrink-0 md:sticky md:bottom-0 backdrop-blur-sm print:hidden ${activeTab === 'chat' ? 'hidden md:block' : ''}`}>
          SISTEMA O.L.G.A (ORGANIZACIÓN, LEGALIZACIÓN, GESTIÓN Y ADMINISTRACIÓN) — PROTOCOLO NOTARIAL
        </footer>
      )}
      </main>

      {/* DETAILED PRINTABLE NOTARY CERTIFICATE PDF PREVIEW COMPONENT */}
      {selectedPagareForPreview && (
        <PagarePDFPreview
          pagare={selectedPagareForPreview}
          personas={personas}
          config={config}
          onClose={() => setSelectedPagareForPreview(null)}
          userData={userProfile}
          onUpdatePagare={handleUpdatePagare}
          canUseWhatsApp={canUseWhatsApp}
        />
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full box-border max-w-sm shadow-2xl p-6 border border-slate-100 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#FF3131] mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black uppercase text-slate-800 tracking-wider text-center">Acceso Administrador</h3>
            <p className="text-xs text-slate-500 text-center mt-2 mb-6">
              Ingrese el email autorizado para acceder a las opciones de configuración y entrenamiento de I.A.
            </p>
            
            <form 
              className="w-full box-border space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (adminLoginEmail.trim() === "jotamolinas@gmail.com") {
                  setRole("admin");
                  setShowAdminLoginModal(false);
                } else {
                  setAdminLoginError("Acceso denegado. Email no autorizado.");
                }
              }}
            >
              <div>
                <input
                  type="email"
                  placeholder="ejemplo@email.com"
                  className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm p-3 rounded-2xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all"
                  value={adminLoginEmail}
                  onChange={(e) => {
                    setAdminLoginEmail(e.target.value);
                    setAdminLoginError('');
                  }}
                  autoFocus
                />
                {adminLoginError && (
                  <p className="text-red-500 text-xs mt-2 font-medium">{adminLoginError}</p>
                )}
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold uppercase tracking-wider rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <CheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => {
            setCheckoutModalOpen(false);
            setSelectedPlanForCheckout(null);
          }}
          onSuccess={() => {
            setCheckoutModalOpen(false);
            setSelectedPlanForCheckout(null);
            setCheckoutToast(true);
            setTimeout(() => setCheckoutToast(false), 5000);
          }}
          planName={selectedPlanForCheckout.name}
          planPrice={selectedPlanForCheckout.price}
          currentUser={currentUser}
          userData={userProfile || userData}
        />
      )}

      {/* Documento Modal */}
      <DocumentoModal 
        userData={userProfile || userData} 
        isOpen={documentoModalOpen}
        onClose={() => {
          setDocumentoModalOpen(false);
          setDocumentoInitialText('');
          setDocumentoModalDocId(undefined);
          setDocumentoModalTipo(undefined);
          setDocumentoModalCategoria(undefined);
          setDocumentoModalTipoHoja(undefined);
          setDocumentoModalIncludeHeader(true);
        }}
        initialText={documentoInitialText}
        documentId={documentoModalDocId}
        tipo={documentoModalTipo}
        categoria={documentoModalCategoria}
        tipoHoja={documentoModalTipoHoja}
        initialIncludeHeader={documentoModalIncludeHeader}
        currentUser={currentUser}
        config={config}
        olgaDocsCount={olgaDocsCount}
        canUseWhatsApp={canUseWhatsApp}
      />

            {/* Modal de Beneficios Plan Full */}
      {showBenefits && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-yellow-500 rounded-xl p-6 w-full box-border max-w-sm shadow-2xl relative">
            <h3 className="text-yellow-500 text-lg font-black mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" /> Beneficios Plan Full
            </h3>
            <ul className="space-y-3 mb-6 text-sm text-slate-200">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> El Oráculo Legal IA: Consultas y Dictámenes Ilimitados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Presupuestos Ley 879/81 y Lienzo Notarial CSJ
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" /> ✨ Skin Dorado Glow Gold Edition Exclusivo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Fichero, Pagarés, Escritos y Auditoría Notarial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Soporte VIP 24/7 y Onboarding Dedicado
              </li>
            </ul>
            <button
              onClick={() => setShowBenefits(false)}
              className="w-full box-border bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors border border-slate-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Beneficios Plan Empresa */}
      {showEmpresaBenefits && (
        <div className="bg-black/80 backdrop-blur-md fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-500 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-gray-100 text-lg font-black mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-300" /> Beneficios Plan Empresa
            </h3>
            <ul className="space-y-3 mb-6 text-sm text-slate-200">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> El Oráculo Legal IA: Consultas y Dictámenes Ilimitados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Presupuestos Ley 879/81 y Lienzo Notarial CSJ
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Fichero, Pagarés, Escritos y Auditoría Notarial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Debida Diligencia SEPRELAD y Traducción Masiva
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Soporte VIP 24/7 y Onboarding Dedicado
              </li>
            </ul>
            <button
              onClick={() => setShowEmpresaBenefits(false)}
              className="w-full box-border bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors border border-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Toast */}
      {checkoutToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold">¡Comprobante enviado!</p>
              <p className="text-emerald-100 text-sm">Un administrador verificará la transferencia en breve para activar tu cuenta. Muchas gracias.</p>
            </div>
            <button 
              onClick={() => setCheckoutToast(false)}
              className="p-1 hover:bg-emerald-500 rounded-full ml-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Toast flotante de respuesta IA lista en segundo plano */}
      {chatReadyToast && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-[calc(100vw-3rem)] sm:w-auto animate-fade-in print:hidden">
          <div className="bg-slate-900 text-white border border-slate-700/80 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                ✨ O.L.G.A. tiene una nueva respuesta
              </p>
              <p className="text-xs text-slate-300 mt-1 leading-snug">
                Tu documento o consulta ya está listo en El Oráculo.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('chat');
                    setChatReadyToast(false);
                    setHasUnreadChatResponse(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  Ver respuesta
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatReadyToast(false)}
              aria-label="Cerrar notificación"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Guardia de seguridad para rutas exclusivas de Super Admin
const SuperAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsSuper(false);
        setLoading(false);
        return;
      }

      const rawAdminUids = (import.meta as any).env?.VITE_ADMIN_UID || "";
      const envAdminUids = rawAdminUids.split(',').map((uid: string) => uid.trim());
      const ADMIN_UIDS = [
        ...envAdminUids,
        "sjqCJTQ1lNMRIMk31VRwz9Rwhud2", 
        "SDzZ9vL9y4cGQc4sHatRI2QugBr2",
        "SDzZ9vL9y4cGQc4sHatRl2QugBr2",
        "SDzZ9yL9y4cGQc4sHatRI2QugBr2",
        "SDzZ9yL9y4cGQc4sHatRl2QugBr2",
        "5DzZ9vL9y4cGQc4sHatRI2QugBr2",
        "SDz29yL9y4cG0c4sHatRl20ugRc2"
      ];

      let superAdminDetected = ADMIN_UIDS.includes(user.uid) || user.email === 'jotamolinas@gmail.com';

      if (!superAdminDetected) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const r = String(data?.role || '').toUpperCase();
            if (r === 'SUPERADMIN' || r === 'ADMIN') {
              superAdminDetected = true;
            }
          }
        } catch (_) {}
      }

      setIsSuper(superAdminDetected);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-400">Verificando credenciales Super Admin...</p>
      </div>
    );
  }

  if (!isSuper) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="safe-header-top min-h-[64px] border-b border-gray-800 bg-slate-900/80 px-6 py-3.5 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a
            href="/consola/admin"
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            ← Volver al Monitor Central
          </a>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Super Admin Autorizado
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  console.log('[App Component] Rendering main App router component');
  useEffect(() => {
    console.log('[App Component] Main App router mounted successfully');
  }, []);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/recursos" element={<RecursosPage />} />
      <Route path="/recursos/:slug" element={<RecursosPage />} />
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/admin" element={<AdminLoginRoute />} />
      <Route
        path="/admin/sifen-onboarding"
        element={
          <SuperAdminGuard>
            <SuperAdminOnboarding />
          </SuperAdminGuard>
        }
      />
      <Route path="/consola" element={<ConsolaApp />} />
      <Route path="/consola/admin" element={<ConsolaApp forceAdmin={true} />} />
      <Route path="/registro-operador" element={<RegistroOperador />} />
      <Route path="/lienzo-notarial/hoja-0" element={<EditorNotarialOficial hojaInicial="hoja-0" />} />
      <Route path="/lienzo-notarial/hoja-1" element={<EditorNotarialOficial hojaInicial="hoja-1" />} />
      <Route path="/lienzo-notarial/hoja-2" element={<EditorNotarialOficial hojaInicial="hoja-2" />} />
      <Route path="/lienzo-notarial/hoja-3" element={<EditorNotarialOficial hojaInicial="hoja-3" />} />
      <Route path="/lienzo-notarial" element={<EditorNotarialOficial />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
