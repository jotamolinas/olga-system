import React, { useState, useEffect, useRef, startTransition } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { AdminLoginRoute } from './components/AdminLoginRoute';
import { Persona, GlobalConfig, Pagare, KnowledgeDoc } from './types';
import { INITIAL_PERSONAS, INITIAL_CONFIG, INITIAL_PAGARES } from './initialData';
import { User, signOut } from 'firebase/auth';
import { initAuth, logout, getAccessToken } from './services/auth';
import { 
  fetchPersonasFromFirestore, syncPersonaToFirestore, deletePersonaFromFirestore,
  fetchPagaresFromFirestore, syncPagareToFirestore, updatePagareInFirestore, anularPagareFromFirestore,
  fetchKnowledgeDocsFromFirestore, syncKnowledgeDocToFirestore, deleteKnowledgeDocFromFirestore, guardarEscritoToFirestore 
} from './services/firestore';
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
import { KnowledgeBaseTab } from './components/KnowledgeBaseTab';
import { CheckoutModal } from './components/CheckoutModal';
import { DocumentoModal } from './components/DocumentoModal';
import { EscritosTab } from './components/EscritosTab';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminPagos } from './components/AdminPagos';
import { FichaProfesional } from './components/FichaProfesional';
import { ConfiguracionCuentaTab } from './components/ConfiguracionCuentaTab';
import { ConfiguracionTab } from './components/ConfiguracionTab';
import { NotificationBell } from './components/NotificationBell';
import { RegistroOperador } from './components/RegistroOperador';

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
import { doc, updateDoc, increment, setDoc, getDoc, getDocs, collection, query, where, onSnapshot, or, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './services/auth';
import ReactMarkdown from 'react-markdown';

// Icons
import { 
  CreditCard,
  FileText,
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
  AlertTriangle, LifeBuoy , Award, Download, HelpCircle} from 'lucide-react';

const Logo: React.FC<{ light?: boolean; large?: boolean; mini?: boolean }> = ({ light = false, large = false, mini = false }) => (
  <div className={`flex flex-col ${large ? 'items-center' : 'items-start'} gap-1.5`}>
    <svg width={large ? "110" : (mini ? "28" : "44")} height={large ? "64" : (mini ? "18" : "28")} viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
      <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="#FF3131" strokeWidth="6" strokeLinejoin="miter" strokeLinecap="butt"/>
    </svg>
    {!mini && (
      <div className={`flex flex-col ${large ? 'items-center' : 'items-start'}`}>
        <span className={`font-bold tracking-widest leading-none whitespace-nowrap ${large ? 'text-2xl mt-1.5' : 'text-xs'} ${light ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>O.L.G.A</span>
        <span className={`font-bold tracking-[0.05em] leading-tight mt-1 text-center ${large ? 'text-[8px] max-w-[200px]' : 'text-[6px] max-w-[130px]'} ${light ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
          ORGANIZACIÓN • LEGALIZACIÓN<br/>GESTIÓN • ADMINISTRACIÓN
        </span>
      </div>
    )}
  </div>
);

const imprimirDocumentoOficial = (htmlContent: string, usuario: any = null) => {
  // Use extended profile fields if available on user object
  const nombreCompleto = usuario?.nombreCompleto || usuario?.displayName || 'Escribano/a Sin Nombre Registrado';
  const numeroRegistro = usuario?.numeroRegistro || 'S/N';
  const matricula = usuario?.matricula || 'S/M';
  const direccion = usuario?.direccion || 'Dirección comercial no registrada';
  const ciudad = usuario?.ciudad || 'Ciudad no especificada';
  const telefono = usuario?.telefono || 'Sin teléfono de contacto';

  const plan = String(usuario?.planActual || usuario?.plan || 'trial').toLowerCase();
  const isOperador = usuario?.rol === 'operador' || usuario?.role === 'operador';
  const isWhitelisted = usuario?.email === 'jotamolinas@gmail.com' || isOperador;
  const isPaid = plan.includes('pro') || plan.includes('empresa') || plan.includes('full') || usuario?.estadoPlataforma === 'Aprobado';
  const isWatermarkRequired = !isWhitelisted && (!isPaid || plan.includes('trial') || plan.includes('prueba') || plan.includes('ninguno') || plan === 'demo' || !plan || usuario?.isTrialExpired);

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const printDocument = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dictamen - Oráculo de O.L.G.A.</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          color: #000;
          line-height: 1.6;
          margin: 0;
          padding: 2cm 2cm 3cm 2cm;
          font-size: 12pt;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 30px;
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
          text-align: justify;
        }
        .content a { color: #000; text-decoration: none; }
        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 9pt;
          border-top: 1px solid #ccc;
          padding-top: 10px;
          padding-bottom: 1cm;
          color: #555;
        }
        .firma-box {
          margin-top: 80px;
          text-align: center;
          page-break-inside: avoid;
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
        .watermark {
          display: none;
        }
        @media print {
          @page { margin: 0; }
          body { 
            padding: 2cm;
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
      </style>
    </head>
    <body>
      ${isWatermarkRequired ? '<div class="watermark">VERSIÓN DE PRUEBA - SÓLO PARA USO NO COMERCIAL</div>' : ''}
      <div class="header">
        <h1>ESCRIBANÍA PÚBLICA ${nombreCompleto || ''}</h1>
        <h2>Registro Notarial Nº ${numeroRegistro || ''} - Matrícula de la CSJ Nº ${matricula || ''}</h2>
      </div>
      
      <div class="content">
        ${htmlContent}
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
  const { pruebaActiva, diasRestantes, userData, isTrialExpired } = useTrialStatus(currentUser);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [role, setRole] = useState<'admin' | 'usuario'>('usuario');
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
  const isActualAdminUser = currentUser && (
    ADMIN_UIDS.includes(currentUser.uid) || 
    currentUser.email === "jotamolinas@gmail.com"
  );

  const isAdmin = forceAdmin && isActualAdminUser;

  useEffect(() => {
    if (isAdmin) {
      setRole('admin');
    } else {
      setRole('usuario');
    }
  }, [isAdmin]);

  // Mobile menu open/collapsed state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Core collections
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const stored = localStorage.getItem('olga_directorio_personas') || localStorage.getItem('ihara_personas');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error parsing personas from localStorage:', e);
    }
    return [];
  });
  const [config, setConfig] = useState<GlobalConfig>(() => {
    const saved = localStorage.getItem('ihara_config');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });
  const [pagares, setPagares] = useState<Pagare[]>(() => {
    try {
      const stored = localStorage.getItem('olga_pagares') || localStorage.getItem('ihara_pagares');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error parsing pagares from localStorage:', e);
    }
    return [];
  });
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);

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
  const [activeTab, setActiveTab] = useState<'tablero' | 'pagares' | 'personas' | 'escritos' | 'config' | 'chat' | 'knowledge' | 'monitor' | 'planes' | 'pagos' | 'soporte' | 'cuenta'>(forceAdmin ? 'monitor' : 'tablero');

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

  const handleOpenDocumentModal = (text: string, docId?: string, tipo?: string, categoria?: string) => {
    setDocumentoInitialText(text);
    setDocumentoModalDocId(docId);
    setDocumentoModalTipo(tipo);
    setDocumentoModalCategoria(categoria);
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
  const [pendingFiles, setPendingFiles] = useState<{name: string, data: string, mimeType: string}[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);

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
      
      setCurrentUser(user);
      
      try {
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
          if (!docSnap.exists()) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              // SOLO si el usuario es NUEVO, inyecta la metadata inicial:
              const fallbackProfile = { 
                uid: user.uid,
                email: user.email || '', 
                fecha_creacion: serverTimestamp(),
                planActual: 'trial',
                role: 'titular',
                rol: 'titular',
                estado_cuenta: 'activa',
                consultasUsadas: 0,
                escritosUsados: 0,
                usoIA: 0,
                diasRestantes: 5
              };
              await setDoc(userRef, fallbackProfile, { merge: true }).catch(console.error);
              setUserProfile(fallbackProfile);
              setIsCheckingProfile(false);
              return;
            }
          }

          const data = docSnap.data();
          if (!data) return;

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
          const firestoreSessionId = data.activeSessionId;
          const localSessionId = localStorage.getItem('appSessionId');

          // Lógica de Expulsión (Logout Automático para prevenir compartir cuentas):
          if (firestoreSessionId && localSessionId && firestoreSessionId !== localSessionId) {
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

          if (firestoreSessionId && !localSessionId) {
            localStorage.setItem('appSessionId', firestoreSessionId);
          } else if (!firestoreSessionId && localSessionId) {
            setDoc(doc(db, 'users', user.uid), { activeSessionId: localSessionId }, { merge: true }).catch(console.error);
          } else if (!firestoreSessionId && !localSessionId) {
            const newSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('appSessionId', newSessionId);
            setDoc(doc(db, 'users', user.uid), { activeSessionId: newSessionId }, { merge: true }).catch(console.error);
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
      setIsCheckingProfile(false);
    });
    
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // FASE 2: Sincronización de Pagarés por Workspace
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!workspaceId) return;

    const q = query(
      collection(db, 'pagares'),
      where('userId', '==', workspaceId) // Filtro maestro por Tenant
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data() as any;
        return { ...item, id: doc.id } as Pagare;
      });
      setPagares(data);
      try {
        localStorage.setItem('olga_pagares', JSON.stringify(data));
      } catch {}
    }, (error) => {
      console.error("Fallo en sincronización de pagarés:", error);
    });

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [workspaceId]); // Dependencia única

  // FASE 2: Sincronización de Personas por Workspace
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!workspaceId) return;

    const q = query(
      collection(db, 'personas'),
      where('userId', '==', workspaceId) // Filtro maestro por Tenant
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data() as any;
        return { ...item, id: doc.id } as Persona;
      });
      setPersonas(data);
      try {
        localStorage.setItem('olga_directorio_personas', JSON.stringify(data));
      } catch {}
    }, (error) => {
      console.error("Fallo en sincronización de personas:", error);
    });

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [workspaceId]); // Dependencia única

  // FASE 2: Sincronización de Base de Conocimiento por Workspace
  useEffect(() => {
    if (!workspaceId) return;

    const q = query(
      collection(db, 'knowledge_docs'),
      where('userId', '==', workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KnowledgeDoc));
      setKnowledgeDocs(data);
    }, (error) => {
      console.error("Fallo en sincronización de knowledge_docs:", error);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  useEffect(() => {
    localStorage.setItem('ihara_config', JSON.stringify(config));
  }, [config]);

  // One-time migration for old local storage data
  useEffect(() => {
    if (currentUser) {
      try {
        const localPagaresStr = localStorage.getItem('ihara_pagares');
        const localPersonasStr = localStorage.getItem('ihara_personas');
        let migrated = false;

        if (localPagaresStr) {
          const localPagares = JSON.parse(localPagaresStr);
          if (Array.isArray(localPagares) && localPagares.length > 0) {
            localPagares.forEach(p => {
              syncPagareToFirestore(currentUser.uid, p).catch(console.error);
            });
            localStorage.removeItem('ihara_pagares');
            migrated = true;
          }
        }

        if (localPersonasStr) {
          const localPersonas = JSON.parse(localPersonasStr);
          if (Array.isArray(localPersonas) && localPersonas.length > 0) {
            localPersonas.forEach(p => {
              syncPersonaToFirestore(currentUser.uid, p).catch(console.error);
            });
            localStorage.removeItem('ihara_personas');
            migrated = true;
          }
        }

        if (migrated) {
          console.log("Migrated data from local storage to Firestore!");
          fetchPagaresFromFirestore(currentUser.uid).then(setPagares).catch(console.error);
          fetchPersonasFromFirestore(currentUser.uid).then(setPersonas).catch(console.error);
        }
      } catch (e) {
        console.error("Migration error", e);
      }
    }
  }, [currentUser]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle syncing on changes wrapper for lists. 
  // Wait, if setPersonas is called on fetch, it triggers effect. We want isolated handlers to update firestore to avoid infinite loops or overwrites.
  // Actually, I can just keep local update logic in handlers! Let's do that.

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-[#FF3131] rounded-full animate-spin"></div>
        <div className="font-bold text-slate-400 text-sm tracking-widest uppercase">Verificando perfil...</div>
      </div>
    );
  }

  if (!currentUser) {
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
  if (!skipOnboarding && (!userProfile || !userProfile.perfilCompletado)) {
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
    // Unique check
    const exists = personas.some(p => p.nro_documento.trim().toLowerCase() === newPersona.nro_documento.trim().toLowerCase());
    if (exists) {
      return false;
    }

    if (!workspaceId) {
      console.error("Operación abortada: Workspace no identificado.");
      return false;
    }

    const creatorName = currentUser?.nombre || userProfile?.nombre || userProfile?.razonSocial || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario';
    const creatorRole = currentUser?.role || userProfile?.rol || userProfile?.role || 'titular';

    const per: Persona = {
      ...newPersona,
      userId: workspaceId,            // El propietario legal de los datos (Titular)
      creator_id: currentUser?.uid,   // Rastro de auditoría: Quién lo digitó
      createdBy: currentUser?.uid,
      creator_name: newPersona.creator_name || creatorName,
      creator_role: newPersona.creator_role || creatorRole
    };
    const updated = [...personas, per];
    setPersonas(updated);
    try {
      localStorage.setItem('olga_directorio_personas', JSON.stringify(updated));
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
    const per: Persona = {
      ...updatedPersona,
      userId: workspaceId
    };
    const updated = personas.map(p => p.id === per.id ? per : p);
    setPersonas(updated);
    try {
      localStorage.setItem('olga_directorio_personas', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving personas to localStorage:', e);
    }
    syncPersonaToFirestore(workspaceId, per).catch(e => console.error("Error actualizando persona:", e));
  };

  const handleDeletePersona = (id: string) => {
    const updated = personas.filter(p => p.id !== id);
    setPersonas(updated);
    try {
      localStorage.setItem('olga_directorio_personas', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving personas to localStorage:', e);
    }
    if (currentUser) deletePersonaFromFirestore(id);
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
        localStorage.setItem('olga_pagares', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving pagares to localStorage:', e);
      }
      await syncPagareToFirestore(workspaceId, pag);
    } catch (error) {
      console.error("Error en escritura:", error);
    }
  };

  const handleUpdatePagare = async (updatedPagare: Pagare) => {
    if (!workspaceId) {
      console.error("Operación abortada: Workspace no identificado.");
      return;
    }
    const updated = pagares.map(p => p.id === updatedPagare.id ? updatedPagare : p);
    setPagares(updated);
    try {
      localStorage.setItem('olga_pagares', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving pagares to localStorage:', e);
    }
    await updatePagareInFirestore(workspaceId, {
      ...updatedPagare,
      userId: workspaceId
    }).catch(e => console.error("Error updating pagare:", e));
  };

  const handleDeletePagare = (id: string) => {
    const updated = pagares.map(p => p.id === id ? { ...p, status: 'anulado', anuladoAt: new Date().toISOString() } : p);
    setPagares(updated);
    try {
      localStorage.setItem('olga_pagares', JSON.stringify(updated));
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
    const textToSend = typeof overrideText === "string" ? overrideText : chatInput;
    if ((!textToSend.trim() && pendingFiles.length === 0) || chatLoading) return;

    const userText = textToSend.trim() || 'Analiza el/los archivos adjuntos.';
    const currentPendingFiles = [...pendingFiles];
    
    if (role !== 'admin') {
      const planStr = String(userData?.planActual || userData?.plan || userProfile?.planActual || userProfile?.plan || 'trial').toLowerCase();
      const isOperador = userData?.rol === 'operador' || userData?.role === 'operador' || userProfile?.rol === 'operador' || userProfile?.role === 'operador';
      const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
      const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || userData?.estadoPlataforma === 'Aprobado' || userProfile?.estadoPlataforma === 'Aprobado' || isWhitelisted;

      // 1. BLOQUEO ESTRICTO: Si el usuario no tiene plan de pago y el trial expiró (días restantes <= 0 o expiración de 5 días), bloquear la consulta a la IA sin gastar tokens
      if (!isPaidPlan && (isTrialExpired || diasRestantes <= 0 || !pruebaActiva)) {
        setChatMessages(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          text: 'Tu período de prueba gratuita de 5 días ha finalizado. Para continuar consultando al Oráculo Jurídico de IA y acceder a todas las funciones sin restricciones, por favor adquiere o renueva un plan en la sección "Planes y Precios".', 
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
        let aiLimit = 20;
        if (planStr.includes('full')) aiLimit = 300;
        else if (planStr.includes('empresa')) aiLimit = 100;
        else if (planStr.includes('pro')) aiLimit = 50;
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
    
    setChatInput('');
    setPendingFiles([]);
    setChatMessages(prev => [...prev, { role: 'user', text: userText, timestamp: new Date() }]);
    setChatLoading(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Inyectamos contexto del panel en el prompt para guiar al modelo
      // Inyectamos también la memoria de conocimiento permanentemente si existe
      const knowledgeContext = knowledgeDocs.length > 0 
        ? `\n\n### BASE DE CONOCIMIENTO (DOCUMENTACIÓN DE APOYO) ###\nEl usuario ha subido manuales, leyes o documentos a tu memoria permanente. Úsalos como la fuente primaria para contestar o redactar contratos.\n` + knowledgeDocs.map(d => `- ${d.name}: ${d.content}`).join('\n')
        : '';

      const panelContextPrompt = `
      El usuario está utilizando el panel de control de administración y notarización O.L.G.A (Organización, Legalización, Gestión y Administración).
      Información actual del sistema de pagarés en tiempo real para ayudar con precisión:
      - Cantidad de pagarés redactados: ${pagares.length}
      - Cantidad de personas registradas: ${personas.length}
      - Escribanía titular: ${config.escribania.nombre} (Matrícula: ${config.escribania.nro_registro})
      - Frecuencias de pago activas: ${config.frecuencias.filter(f => f.activa).map(f => f.nombre).join(', ')}
      - Monedas autorizadas: ${config.monedas.filter(m => m.activa).map(m => m.codigo).join(', ')}
      - Rol del usuario actual: ${role === 'admin' ? 'Administrador' : 'Usuario'}
      ${knowledgeContext}
      Eres O.L.G.A., experta en leyes paraguayas, redacción de contratos privados, pagarés y escrituras públicas. 
      Conoces en profundidad la Ley 1.183/85 (Código Civil Paraguayo) sobre obligaciones y contratos, así como la Ley de Maquila y constituciones de sociedades (S.A., S.R.L., E.A.S.).
      Responde a las consultas del usuario justificando legalmente o redactando las cláusulas solicitadas con alto nivel técnico y notarial.
      Por favor, responde de manera concisa y sumamente inteligente en español como O.L.G.A. (Asistente de Organización Legal).
      `;

      const finalMessage = userText + `\n\n[CONTEXTO INTERNO DE OPERACIÓN: ${panelContextPrompt}]`;
      const attachments = currentPendingFiles.length > 0 ? currentPendingFiles.map(f => ({ data: f.data, mimeType: f.mimeType })) : undefined;

      const response = await sendMessageToOlga(
        finalMessage,
        history,
        'es',
        attachments
      );

      setChatMessages(prev => [
        ...prev,
        { role: 'model', text: response.text || 'Entendido. ¿En qué más puedo asistirte dentro del panel?', timestamp: new Date() }
      ]);
      
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
    } catch (err) {
      console.error("Error al enviar mensaje a la IA:", err);
      setChatMessages(prev => [
        ...prev,
        { role: 'model', text: 'Disculpa, experimenté una interrupción temporal en mi canal de IA. ¿Podrías volver a formular tu pregunta?', timestamp: new Date() }
      ]);
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

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden font-sans bg-pattern text-slate-800 print:block print:h-auto print:overflow-visible print:bg-white" id="main-panel-container">
      
      {/* Backdrop overlay for mobile & desktop menu */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-all duration-300 print:hidden"
        />
      )}

      {/* Sidebar Navigation Drawer (Collapsible) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 text-white flex flex-col p-6 shadow-2xl shrink-0 overflow-y-auto transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Brand identity */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Logo light />
          <div className="flex items-center gap-2">
            <span className="bg-[#FF3131] text-white py-1 px-2.5 rounded-xl flex items-center justify-center font-black text-[9px] uppercase tracking-widest leading-none">
              HQ Panel
            </span>
            {/* Close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="mt-6 bg-slate-800/60 p-4 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-black tracking-widest text-[#FF3131]">Identidad Verificada</p>
            {(() => {
              const plan = userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '';
              if (plan.includes('full')) {
                return (
                  <span
                    onClick={() => setShowBenefits(true)}
                    className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-extrabold px-2 py-1 rounded text-[10px] shadow-[0_0_10px_rgba(234,179,8,0.5)] cursor-pointer transition-transform hover:scale-105 inline-block"
                  >
                    PLAN FULL
                  </span>
                );
              }
              return activePlan === 'Pro' ? (
              <span className="md:hidden bg-slate-900 text-slate-100 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-slate-700">
                Nivel PRO
              </span>
            ) : activePlan === 'Intermedio' ? (
              <span className="md:hidden bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-blue-200">
                Intermedio
              </span>
            ) : pruebaActiva ? (
              <div className="md:hidden flex items-center gap-1">
                <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-amber-500/20">
                  Prueba: {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}
                </span>
                <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-blue-500/20 flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" /> {olgaDocsCount}/5
                </span>
              </div>
            ) : (
              <span className="md:hidden bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border border-red-200">
                Expirada
              </span>
            );
            })()}
          </div>
          
          <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-2xl border border-slate-800 relative group">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-700">
              {logoInstitucional ? (
                <img src={logoInstitucional} alt="Logo Notaría" className="w-full h-full object-cover" />
              ) : (
                <Building className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {isOperador 
                  ? (currentUser?.displayName || currentUser?.email || 'Operador Notarial')
                  : (workspaceName || customBranding.nombreInstitucion || userData?.razonSocial || userData?.nombre || currentUser?.phoneNumber || 'Usuario')
                }
              </p>
              <p className="text-[9px] text-slate-400 truncate uppercase tracking-wider mt-0.5 font-bold">
                {isOperador 
                  ? (workspaceName ? `Escribanía ${workspaceName}` : 'Operador Notarial')
                  : (customBranding.registroNotarial || (role === 'admin' ? 'Administrador' : 'Profesional Titular'))
                }
              </p>
            </div>
            <button 
              onClick={async () => {
                await logout();
                setCurrentUser(null);
                setUserProfile(null);
                setCustomBranding({ nombreInstitucion: '', ruc: '', registroNotarial: '' });
              }}
              className="p-2 bg-slate-800 hover:bg-[#FF3131] text-slate-400 hover:text-white rounded-xl transition-colors shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>


          {(role === 'admin' || isAdmin) && (
            <div className="pt-2 border-t border-slate-700/50">
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  onClick={() => setRole('admin')}
                  className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${role === 'admin' ? 'bg-[#FF3131] text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                  title="Acceso total para configurar parámetros de escribanía"
                >
                  <UserCheck className="w-3 h-3" />
                  Admin
                </button>
                <button
                  onClick={() => {
                    setRole('usuario');
                    if (activeTab === 'config' || activeTab === 'knowledge' || activeTab === 'monitor' || activeTab === 'pagos') setActiveTab('pagares');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${role === 'usuario' ? 'bg-[#FF3131] text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                  title="Acceso restringido para redactar y consultar"
                >
                  <Building className="w-3 h-3" />
                  Usuario
                </button>
              </div>
            </div>
          )}
        </div>

        {!isStandalone && (
          <div className="mt-6 shrink-0">
            {installMessage && (
              <div className="mb-2 p-3 bg-blue-900/40 border border-blue-500/30 rounded-xl">
                <p className="text-[10px] text-blue-200 leading-tight">
                  <span className="font-bold text-blue-400">Atención:</span> {installMessage}
                </p>
              </div>
            )}
            <button
              onClick={handleInstallClick}
              className="w-full box-border text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider">Instalar App</span>
                <span className="text-[9px] text-blue-100 font-medium">Usa O.L.G.A. nativamente</span>
              </div>
            </button>
          </div>
        )}

        {/* Tab navigations */}
        <nav className="mt-6 flex-grow space-y-2">
          <button
            onClick={() => {
              setActiveTab('tablero');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'tablero' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Activity className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Tablero</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('pagares');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'pagares' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Gestión Pagarés</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('personas');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'personas' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Fichero Personas</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('escritos');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'escritos' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Gestión Escritos</span>
          </button>

          {role === 'admin' && (
            <>
              <button
                onClick={() => {
                  setActiveTab('config');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'config' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-wider">Configuración</span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('knowledge');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'knowledge' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
              >
                <Database className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">Entrenamiento IA</span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('monitor');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'monitor' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
              >
                <Activity className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-wider">Monitor Central</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('pagos');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'pagos' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
              >
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">Gestión Cobros</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setActiveTab('chat');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'chat' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            {(role === 'admin' || (userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '').includes('full')) ? <Sparkles className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            <span className="text-xs font-black uppercase tracking-wider">{(role === 'admin' || (userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '').includes('full')) ? 'El Oráculo' : 'Asistente O.L.G.A.'}</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('cuenta');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'cuenta' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">Configuración</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('soporte');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all hover-lift ${activeTab === 'soporte' ? 'bg-[#FF3131] text-white shadow-lg shadow-red-600/10 font-bold' : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <LifeBuoy className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">{role === 'admin' ? 'Buzón de Consultas' : 'Soporte'}</span>
          </button>
        </nav>

        {/* Upgrade Banner in sidebar (Oculto para operadores) */}
        {currentUser?.role !== 'operador' && !isOperador && (() => {
          const plan = userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '';

          if (plan.includes('full')) {
            return null;
          }

          if (plan.includes('empresa')) {
            return null;
          }

          if (plan.includes('pro')) {
            return (
              <div className="mt-4 bg-purple-900/30 rounded-2xl p-4 border border-purple-500 text-center relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 blur-xl rounded-full"></div>
                <Target className="w-6 h-6 text-purple-400 mx-auto mb-2 relative z-10" />
                <h4 className="text-purple-400 font-bold text-xs mb-1 relative z-10">Sube a Plan Empresa</h4>
                <p className="text-purple-200/70 text-[9px] mb-3 leading-relaxed relative z-10">
                  Ideal para estudios jurídicos y equipos
                </p>
                <button
                  onClick={() => {
                    setActiveTab('planes');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full box-border bg-purple-600 text-white text-[10px] font-bold py-2 rounded-xl transition-colors shadow-sm relative z-10 tracking-widest uppercase"
                >
                  Ver Planes
                </button>
              </div>
            );
          }

          return (
            <div className="mt-4 bg-blue-900/30 rounded-2xl p-4 border border-blue-500 text-center relative overflow-hidden shadow-lg shrink-0">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 blur-xl rounded-full"></div>
              <Target className="w-6 h-6 text-blue-400 mx-auto mb-2 relative z-10" />
              <h4 className="text-blue-400 font-bold text-xs mb-1 relative z-10">Desbloquea Plan Pro</h4>
              <p className="text-blue-200/70 text-[9px] mb-3 leading-relaxed relative z-10">
                Automatiza actas y emite dictámenes oficiales
              </p>
              <button
                onClick={() => {
                  setActiveTab('planes');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full box-border bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-2 rounded-xl transition-colors shadow-sm relative z-10 tracking-widest uppercase"
              >
                Ver Planes
              </button>
            </div>
          );
        })()}

        {/* Corporate seal logo foot */}
        <div className="pt-6 border-t border-slate-800 mt-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase">
            <HeartHandshake className="w-3.5 h-3.5 text-[#FF3131]" />
            <span>ESTABLECIDO EN 1994</span>
          </div>
          <p className="text-[8px] text-slate-600">Registro Notarizado de Soluciones Financieras</p>
          <p className="text-[9px] font-mono text-slate-500/50 mt-2 cursor-text select-all">UID: {currentUser?.uid} {currentUser?.email ? ` | ${currentUser.email}` : ''}</p>
        </div>
      </aside>

      {/* Main Content Workspace viewport */}
      <main className="flex-grow flex flex-col h-full overflow-hidden relative" id="main-content-viewport">
        
        {/* Dynamic header display */}
        <header className="bg-white/80 border-b border-slate-100 p-4 md:p-5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {/* Hamburger menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl shrink-0 transition-colors border border-slate-200"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl overflow-hidden shrink-0 hidden sm:flex items-center justify-center bg-slate-900 border border-slate-200">
              {logoInstitucional ? (
                <img src={logoInstitucional} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-lg font-serif font-black text-slate-900 tracking-tight leading-none truncate">
                {isOperador 
                  ? (workspaceName || "Escribanía Titular")
                  : (customBranding.nombreInstitucion || userData?.razonSocial || workspaceName || config.escribania.nombre)
                }
              </h1>
              <p className="text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 truncate">
                {isOperador 
                  ? `Operador Notarial • ${workspaceName || 'Escribanía Titular'}`
                  : `${customBranding.registroNotarial || userData?.tipoPerfil || 'Escribanía'} Titular ${userData?.matricula || config.escribania.nro_registro}`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 flex-shrink-0">
            {/* INICIO DEL BLOQUE DE INSIGNIAS CONDICIONALES ACTUALIZADO MANUALMENTE */}
{(() => {
  const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador' || userData?.rol === 'operador' || userData?.role === 'operador';
  if (isOperador) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span className="bg-slate-800 text-white border border-slate-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[#FF3131]"></span>
          <span>OPERADOR NOTARIAL</span>
        </span>
      </div>
    );
  }

  const rawPlan = userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || 'VACIO';
  const currentPlan = String(rawPlan).trim().toLowerCase();
  
  if (currentPlan.includes('pro')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span className="bg-blue-600 text-white px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm whitespace-nowrap">
          PLAN PRO
        </span>
      </div>
    );
  }
  if (currentPlan.includes('empresa')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span 
          onClick={() => setShowEmpresaBenefits(true)}
          className="cursor-pointer bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white font-extrabold px-3 py-1 rounded-md border border-gray-600 shadow-[0_0_12px_rgba(255,255,255,0.2)] text-[10px] sm:text-xs transition-transform hover:scale-105 whitespace-nowrap"
        >
          PLAN EMPRESA
        </span>
      </div>
    );
  }
  if (currentPlan.includes('full')) {
    return (
      <div className="flex items-center shrink-0 flex-shrink-0">
        <span 
          onClick={() => setShowBenefits(true)}
          className="cursor-pointer bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-extrabold px-3 py-1 rounded shadow-[0_0_10px_rgba(234,179,8,0.5)] text-[10px] sm:text-xs transition-transform hover:scale-105 whitespace-nowrap"
        >
          PLAN FULL
        </span>
      </div>
    );
  }
  // Fase 9: Cálculo real y dinámico comparando la fecha actual contra fecha_creacion en Firestore
  const rawCreation = userProfile?.fecha_creacion || userData?.fecha_creacion || userProfile?.fechaCreacion || userData?.fechaCreacion || userProfile?.created_at;
  let dynamicDays = 5;
  let isExpiredTrial = isTrialExpired || !pruebaActiva || diasRestantes <= 0;

  if (rawCreation) {
    let creationDate = new Date();
    if (typeof rawCreation.toDate === 'function') {
      creationDate = rawCreation.toDate();
    } else if (rawCreation.seconds) {
      creationDate = new Date(rawCreation.seconds * 1000);
    } else {
      creationDate = new Date(rawCreation);
    }
    const diffDaysPassed = (Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24);
    dynamicDays = Math.max(0, Math.ceil(5 - diffDaysPassed));
    if (diffDaysPassed > 5 || dynamicDays <= 0) {
      isExpiredTrial = true;
      dynamicDays = 0;
    }
  } else {
    dynamicDays = userProfile?.diasRestantes ?? userData?.diasRestantes ?? diasRestantes ?? 5;
    if (dynamicDays <= 0) {
      isExpiredTrial = true;
      dynamicDays = 0;
    }
  }

  const diasMostrar = isExpiredTrial ? 0 : (dynamicDays > 5 ? 5 : (dynamicDays < 0 ? 0 : dynamicDays));
  const iaUsadas = userProfile?.usoIA || userData?.usoIA || userProfile?.consultasUsadas || userData?.consultasUsadas || 0;
  const escritosUsados = typeof olgaDocsCount !== 'undefined' ? olgaDocsCount : (userProfile?.escritosUsados || userData?.escritosUsados || 0);

  const detalleLimites = isExpiredTrial
    ? `Límites de prueba: Periodo finalizado (> 5 días). Escritos (${escritosUsados}/5) - Consultas IA (${iaUsadas}/5)`
    : `Límites de prueba: Escritos (${escritosUsados}/5) - Consultas IA (${iaUsadas}/5)`;

  return (
    <div className="flex items-center shrink-0 flex-shrink-0">
      <div className="relative group/trial flex items-center">
        <div 
          className={`${isExpiredTrial ? 'bg-red-50 text-red-700 border-red-300' : 'bg-amber-100 text-amber-900 border-amber-300'} border px-3 py-1 rounded-full text-[10px] sm:text-xs font-black shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-default`}
          title={detalleLimites}
        >
          <span>PRUEBA GRATUITA: {isExpiredTrial ? '0 DÍAS' : `${diasMostrar} DÍAS`}</span>
          <span 
            className={`${isExpiredTrial ? 'text-red-600 hover:text-red-900' : 'text-amber-700 hover:text-amber-950'} transition-colors inline-flex items-center cursor-help`}
            aria-label="Detalles de límites de prueba"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Tooltip flotante enriquecido al hover */}
        <div className="absolute right-0 top-full mt-1.5 hidden group-hover/trial:flex flex-col z-50 bg-slate-900 text-white text-[11px] font-medium py-1.5 px-3 rounded-xl shadow-xl border border-slate-700 whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
          <span className="font-bold text-amber-400">Límites de prueba:</span>
          <span className="text-slate-200">Escritos ({escritosUsados}/5) - Consultas IA ({iaUsadas}/5)</span>
          {isExpiredTrial && (
            <span className="text-red-400 text-[10px] mt-0.5 font-bold">Acceso bloqueado: periodo de 5 días expirado</span>
          )}
        </div>
      </div>
    </div>
  );
})()}

            {currentUser?.role !== 'operador' && !isOperador && (() => {
              const planActivoBtn = String(userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || '').toLowerCase();
              return !planActivoBtn.includes('pro') && !planActivoBtn.includes('empresa') && !planActivoBtn.includes('full');
            })() && (
              <button 
                onClick={() => setActiveTab('planes')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md hover:scale-105 shrink-0 flex-shrink-0 transition-transform cursor-pointer"
              >
                <Target className="w-3 h-3 animate-pulse text-blue-100" />
                <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">Obtener Planes</span>
              </button>
            )}

            {/* Campana de Notificaciones Notariales Global */}
            <NotificationBell 
              pagares={pagares} 
              onSelectPagare={(id) => {
                const found = pagares.find(p => p.id === id);
                if (found) {
                  handleAbrirPagarePreview(found);
                }
                setActiveTab('pagares');
              }}
            />

            <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase font-mono pb-0.5 hidden xs:block whitespace-nowrap shrink-0 flex-shrink-0">
              Serie: PJE-{config?.anio_serie || new Date().getFullYear()}
            </div>
          </div>
        </header>

        {/* Scrollable container for tab body content */}
        <div className={`flex-grow overflow-y-auto ${activeTab === 'chat' ? 'p-0 md:p-8 flex flex-col' : 'p-4 md:p-8'}`}>
          <div className={`w-full max-w-7xl mx-auto flex-grow flex flex-col ${activeTab === 'chat' ? 'pb-0 md:pb-24 h-full' : 'pb-24'}`}>
            
            {(() => {
              const rawPlan = String(userProfile?.planActual || userProfile?.plan || userData?.planActual || userData?.plan || '').toLowerCase();
              const tienePlanPago = rawPlan.includes('pro') || rawPlan.includes('empresa') || rawPlan.includes('full') || (userData?.estadoPlataforma === 'Aprobado') || role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
              const accesoBloqueadoPorTrial = !tienePlanPago && (isTrialExpired || !pruebaActiva || diasRestantes <= 0);

// 1. Lógica de cálculo de vencimiento
              let diasParaVencimientoPago = 999;
              let suscripcionVencida = false;
              const fechaVencimientoPlan = userProfile?.fecha_vencimiento_plan || userData?.fecha_vencimiento_plan;
              const esAdmin = role === 'admin' || currentUser?.email === 'jotamolinas@gmail.com';

              if (tienePlanPago && fechaVencimientoPlan && !esAdmin) {
                const vDate = new Date(fechaVencimientoPlan);
                diasParaVencimientoPago = Math.ceil((vDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                if (diasParaVencimientoPago < 0) suscripcionVencida = true;
              }

              const isSoftBlocked = (accesoBloqueadoPorTrial && !tienePlanPago) || suscripcionVencida;
              const isWarning = tienePlanPago && diasParaVencimientoPago <= 5 && diasParaVencimientoPago >= 0 && !esAdmin;

              return (
                <>
                  {/* BANNERS PREVENTIVOS Y GUARDIÁN BLANDO */}
                  {isSoftBlocked && activeTab !== 'planes' && (
                    <div className="bg-red-50 border-b border-red-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 mb-6 rounded-2xl animate-fade-in shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-900">Tu suscripción ha expirado</p>
                          <p className="text-xs text-red-700">Modo "Solo Lectura" activado. La creación de documentos y consultas IA están limitadas.</p>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('planes')} className="whitespace-nowrap px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md">
                        Renovar Plan
                      </button>
                    </div>
                  )}

                  {isWarning && !isSoftBlocked && activeTab !== 'planes' && (
                    <div className="bg-amber-50 border-b border-amber-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 mb-6 rounded-2xl animate-fade-in shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-900">Suscripción próxima a vencer</p>
                          <p className="text-xs text-amber-700">Tu plan actual vence en <strong>{diasParaVencimientoPago} días</strong>. Por favor, renueva tu plan para evitar interrupciones.</p>
                        </div>
                      </div>
                      <button onClick={() => setActiveTab('planes')} className="whitespace-nowrap px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-md">
                        Ver Planes
                      </button>
                    </div>
                  )}
                  
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
              />
            )}

            {activeTab === 'planes' && currentUser?.role !== 'operador' && !isOperador && (
              <PlanesTab 
                activePlan={activePlan}
                onPlanSelect={(planName, planPrice) => {
                  setSelectedPlanForCheckout({ name: planName, price: planPrice });
                  setCheckoutModalOpen(true);
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
              />
            )}

            {activeTab === 'escritos' && (
              <EscritosTab  
                currentUser={currentUser} 
                userProfile={userProfile || userData}
                personas={personas}
                onOpenDocument={handleOpenDocumentModal} 
              />
            )}
            
            {activeTab === 'cuenta' && (
              <ConfiguracionTab 
                onConfigUpdate={(data) => setCustomBranding(data)} 
                pagares={pagares} 
                userPlan={userProfile?.planActual || userProfile?.plan || activePlan}
                userData={userProfile || userData}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'config' && role === 'admin' && (
              <ConfigTab
                config={config}
                onUpdateConfig={handleUpdateConfig}
                isAdmin={role === 'admin'}
                
              />
            )}

            {activeTab === 'knowledge' && (
              <KnowledgeBaseTab
                docs={knowledgeDocs}
                setDocs={setKnowledgeDocs}
                currentUser={currentUser}
                onOpenDocument={handleOpenDocumentModal}
              />
            )}

            {activeTab === 'monitor' && role === 'admin' && (
              <SuperAdminDashboard />
            )}

            {activeTab === 'pagos' && role === 'admin' && (
              <AdminPagos isAdmin={role === 'admin'}
                 />
            )}

            {activeTab === 'soporte' && role === 'admin' && (
              <BuzonAdminTab />
            )}

            {activeTab === 'soporte' && role !== 'admin' && (
              <SoporteClienteTab currentUser={currentUser} userData={userProfile} />
            )}

            {activeTab === 'chat' && (
              /* Conversational assistance with O.L.G.A. IA */
              <div className="bg-white p-4 md:p-8 md:rounded-[2.5rem] border-0 md:border md:border-slate-100 shadow-none md:shadow-md flex-grow md:h-[78vh] flex flex-col space-y-4 md:space-y-6 animate-message" id="chat-assistant-container">
                <div className="border-b border-slate-50 pb-4 shrink-0">
                  <h2 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-2.5">
                    <Sparkles className="w-6 h-6 text-[#FF3131]" />
                    {(role === 'admin' || (userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '').includes('full')) ? 'El Oráculo de O.L.G.A.' : 'O.L.G.A. - Consulta Jurídica y Tributaria'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {(role === 'admin' || (userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '').includes('full')) 
                      ? 'Supervisión, auditoría y análisis documental avanzado. Usa los chips para atajos rápidos.' 
                      : 'Pregunte libremente a O.L.G.A. sobre legislación, redacción contractual o simulaciones.'}
                  </p>
                  {userData?.plan === 'Demo' && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                      Prueba Gratuita: {userData.usoIA || 0}/{userData.limiteIA || 20} consultas usadas - Vence en {
                        userData.fechaVencimientoDemo ? 
                        Math.max(0, Math.ceil(((userData.fechaVencimientoDemo.toDate ? userData.fechaVencimientoDemo.toDate() : new Date(userData.fechaVencimientoDemo)).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
                        : 0
                      } días
                    </div>
                  )}
                </div>

                {/* Dialog Messages viewport */}
                <div className="flex-grow overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-4 rounded-3xl max-w-[80%] shadow-sm text-xs md:text-sm font-medium ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-none'}`}>
                        {msg.role === 'model' ? (
                          <div className="flex flex-col gap-2 relative group w-full box-border">
                            <div id={`model-msg-${i}`} className="markdown-body prose prose-slate max-w-none prose-sm sm:prose-base prose-p:leading-relaxed prose-a:text-[#FF3131] prose-strong:text-slate-900 border-b border-transparent group-hover:border-slate-50 pb-2">
                              <ReactMarkdown>{msg.text.includes('[CONTEXTO INTERNO DE OPERACIÓN') ? msg.text.split('[CONTEXTO INTERNO DE OPERACIÓN')[0].trim() : msg.text}</ReactMarkdown>
                            </div>
                            <div className="flex items-center gap-2 self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {((activePlan === 'ninguno' || activePlan === undefined) && (!pruebaActiva || diasRestantes <= 0 || olgaDocsCount >= 5)) ? (
                                <div className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-2">
                                  <AlertTriangle className="w-3 h-3" />
                                  Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.
                                </div>
                              ) : (
                                <button 
                                  onClick={async () => {
                                    const extractedText = msg.text.includes('[CONTEXTO INTERNO DE OPERACIÓN') ? msg.text.split('[CONTEXTO INTERNO DE OPERACIÓN')[0].trim() : msg.text;
                                    handleOpenDocumentModal(extractedText);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors border border-blue-200"
                                >
                                  <FileText className="w-3 h-3" />
                                  Exportar a Escrito
                                </button>
                              )}
                              {role === 'admin' && (
                                <button 
                                  onClick={() => {
                                    const elm = document.getElementById(`model-msg-${i}`);
                                    imprimirDocumentoOficial(elm?.innerHTML || '', userProfile || userData || currentUser);
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
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl w-fit">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#FF3131] rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-[#FF3131] rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-[#FF3131] rounded-full animate-bounce delay-150"></div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">O.L.G.A. procesando...</span>
                    </div>
                  )}
                </div>

                {/* Question Input form bar */}
                {pruebaActiva ? (
                  <div className="flex flex-col gap-1 bg-slate-100 p-2 md:rounded-2xl shrink-0">
                    {/* Oracle Admin Chips */}
                    {(role === 'admin' || (userData?.planActual?.toLowerCase() || userData?.plan?.toLowerCase() || userProfile?.planActual?.toLowerCase() || userProfile?.plan?.toLowerCase() || '').includes('full')) && (
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
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendChatMessage();
                          }
                        }}
                        placeholder="Escriba su duda jurídica o anexos..."
                        className="flex-grow bg-transparent border-0 outline-none px-4 py-2 text-xs md:text-sm font-bold text-slate-700"
                      />
                      <button
                        onClick={() => handleSendChatMessage()}
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:bg-[#FF3131] hover:scale-105 transition-all"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
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
                      Para seguir auditando documentos y desbloquear los dictámenes con membrete oficial, completa tu Ficha Profesional.
                    </p>
                    {currentUser?.role !== 'operador' && !isOperador && (
                      <button 
                        onClick={() => setActiveTab('planes')}
                        className="bg-[#FF3131] hover:bg-red-600 shadow-lg shadow-red-600/20 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                      >
                        Completar Registro
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
                </>
              );
            })()}

          </div>
        </div>

        {/* Dynamic bottom bar info */}
        <footer className={`bg-slate-900 p-4 border-t border-slate-800 text-white/40 text-center text-[9px] font-mono tracking-widest uppercase mt-auto shrink-0 md:sticky md:bottom-0 ${activeTab === 'chat' ? 'hidden md:block' : ''}`}>
          SISTEMA O.L.G.A (ORGANIZACIÓN, LEGALIZACIÓN, GESTIÓN Y ADMINISTRACIÓN) — PROTOCOLO NOTARIAL IHARA & ASOCIADOS
        </footer>
      </main>

      {/* DETAILED PRINTABLE NOTARY CERTIFICATE PDF PREVIEW COMPONENT */}
      {selectedPagareForPreview && (
        <PagarePDFPreview
          pagare={selectedPagareForPreview}
          personas={personas}
          config={config}
          onClose={() => setSelectedPagareForPreview(null)}
          userData={userProfile}
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
                  className="flex-1 px-4 py-3 bg-[#FF3131] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-red-600 transition-colors"
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
        }}
        initialText={documentoInitialText}
        documentId={documentoModalDocId}
        tipo={documentoModalTipo}
        categoria={documentoModalCategoria}
        currentUser={currentUser}
        config={config}
        olgaDocsCount={olgaDocsCount}
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
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Consultas IA: Ilimitadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Generación de Pagarés y Escritos: Ilimitados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Gestión de Equipo: Habilitado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Soporte Prioritario
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
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Usuarios ilimitados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Soporte prioritario 24/7
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Módulos avanzados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Consultas IA: Ilimitadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Generación de Escritos: Ilimitados
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
      <Route path="/admin" element={<AdminLoginRoute />} />
      <Route path="/consola" element={<ConsolaApp />} />
      <Route path="/consola/admin" element={<ConsolaApp forceAdmin={true} />} />
      <Route path="/registro-operador" element={<RegistroOperador />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
