import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText, Search, ShieldCheck, ChevronDown, Check, Scale,
  ArrowRight, Users, MessageSquare, Building2, Car, Briefcase,
  Bot, Target, Stamp, Calculator, Sparkles, Printer,
  HelpCircle, ChevronRight, BookOpen, AlertCircle, CheckCircle2,
  Smartphone, FolderKanban, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../services/auth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Testimonials } from './Testimonials';
import { RECURSOS_ARTICLES } from '../data/recursosData';
import { SocialShareBar } from './SocialShareBar';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallButton, PWAInstallGuideModal } from './PWAInstallBanner';

const Logo: React.FC<{ darkTheme?: boolean }> = ({ darkTheme = false }) => (
  <div className="flex items-center gap-3 shrink-0">
    <svg width="44" height="26" viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="#FF3131" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="butt"/>
    </svg>
    <span
      className={`font-bold tracking-widest leading-none whitespace-nowrap text-lg ${darkTheme ? 'text-white' : 'text-slate-900'}`}
      style={{ fontFamily: '"Courier Prime", monospace' }}
    >
      O.L.G.A.
    </span>
  </div>
);

type RubroId = 'escribanos' | 'abogados' | 'playas' | 'inmobiliarias' | 'contadores';

interface RubroSolution {
  id: RubroId;
  tabLabel: string;
  title: string;
  dolor: string;
  solucion: string;
  highlights: string[];
}

const RUBRO_SOLUTIONS: RubroSolution[] = [
  {
    id: 'escribanos',
    tabLabel: '⚖️ Escribanos',
    title: 'Escribanías y Registros Notariales',
    dolor:
      'Perder tiempo calibrando hojas de seguridad CSJ, rehacer pagarés o armar escrituras y presupuestos desde cero.',
    solucion:
      'Impresión milimétrica calibrada para papel oficial (Certificación de Firmas, Concuerda, Legalización), Pagaré Fácil en 3 pasos, Constitución de S.A. con datos DNIT y presupuestos instantáneos con membrete propio.',
    highlights: [
      'Márgenes exactos 216 × 330 mm para fojas de seguridad CSJ sin desperdicio.',
      'Cálculo automático de honorarios y tasas bajo Arancel Oficial Ley 879/81.',
      'Actas, estatutos de S.A. y pagarés a la orden listos en minutos.',
    ],
  },
  {
    id: 'abogados',
    tabLabel: '🏛️ Abogados Litigantes',
    title: 'Abogados y Estudios Jurídicos',
    dolor:
      'Olvidar plazos cortos del CPC, revisar Judisoft manualmente sin seguimiento y redactar escritos desde cero.',
    solucion:
      'Análisis de cédulas y providencias con IA, control de plazos procesales, memoria acumulada del expediente (diferenciando parte adversa y propia) y Secretaría Privada por WhatsApp con avisos diarios, urgentes del día y enlaces directos a cada causa.',
    highlights: [
      'Lectura de PDFs y fotos de cédulas con cómputo de plazos según el CPC Paraguay.',
      'Memoria continua del caso para redactar escritos coherentes sin repetir datos.',
      'Parte diario por WhatsApp con lo urgente del día y acceso directo a la causa.',
    ],
  },
  {
    id: 'playas',
    tabLabel: '🚗 Playas de Vehículos',
    title: 'Playas de Vehículos y Concesionarias',
    dolor:
      'Errores de tipeo en pagarés, demoras al cerrar ventas financiadas y desorden en los vencimientos de cuotas.',
    solucion:
      'Emisión rápida y segura de pagarés a la orden en segundos, contratos claros y control ordenado de clientes y documentos listos para firmar.',
    highlights: [
      'Pagarés a la orden con montos en guaraníes en letras y sin protesto.',
      'Fichero ordenado de compradores y codeudores por C.I. o RUC.',
      'Contratos privados de compraventa listos para imprimir al cerrar la venta.',
    ],
  },
  {
    id: 'inmobiliarias',
    tabLabel: '🏢 Inmobiliarias',
    title: 'Inmobiliarias y Loteadoras',
    dolor:
      'Redacción lenta de contratos de alquiler o compraventa y papeleo disperso entre clientes y escribanías.',
    solucion:
      'Generación ágil de contratos, pagarés y presupuestos, con expediente digital ordenado por cliente para cerrar operaciones más rápido.',
    highlights: [
      'Contratos de alquiler, reserva y compraventa listos para personalizar.',
      'Respaldo de cuotas con pagarés ejecutivos y vencimientos claros.',
      'Carpeta digital por cliente y operación sin papeles perdidos.',
    ],
  },
  {
    id: 'contadores',
    tabLabel: '📊 Contadores y Estudios',
    title: 'Contadores y Estudios Contables',
    dolor:
      'Carga repetitiva de datos de socios, consultas manuales de RUC y seguimiento desordenado de trámites societarios.',
    solucion:
      'Autocompletado con consulta de RUC/DNIT, generación ágil de estatutos y actas para Constitución de S.A., y gestión centralizada de documentos y presupuestos de clientes.',
    highlights: [
      'Validación de RUC y dígito verificador conectada al fichero de socios.',
      'Estatutos sociales y actas de constitución generados en minutos.',
      'Presupuestos profesionales y seguimiento de trámites en un solo lugar.',
    ],
  },
];

const SIX_PILLARS = [
  {
    num: '01',
    icon: FileText,
    title: 'Pagaré Fácil en 3 pasos',
    description:
      'Carga rápida, validación de C.I./RUC y generación de pagarés a la orden listos para imprimir sin errores de montos ni fechas.',
  },
  {
    num: '02',
    icon: Stamp,
    title: 'Impresión Milimétrica CSJ',
    description:
      'Calibración exacta para hojas de seguridad notariales (Certificación de Firmas, Concuerda y Legalización) con cero desperdicio.',
  },
  {
    num: '03',
    icon: MessageSquare,
    title: 'Secretaría Privada IA por WhatsApp',
    description:
      'Partes diarios, foco urgente del día (qué hacer, conseguir y enviar) y recordatorios para no perder ningún plazo procesal.',
  },
  {
    num: '04',
    icon: FolderKanban,
    title: 'Gestión de Escritos y Expedientes con IA',
    description:
      'Análisis de PDFs y fotos, cómputo de plazos CPC Paraguay y redacción asistida con memoria acumulada del caso.',
  },
  {
    num: '05',
    icon: Building2,
    title: 'Constitución de S.A. y Datos DNIT',
    description:
      'Fichero inteligente de personas, consulta de RUC y generación de estatutos y actas societarias en minutos.',
  },
  {
    num: '06',
    icon: Smartphone,
    title: 'Multiusuario y Marca Propia',
    description:
      'Personalización de membretes, Registro Notarial o Matrícula, RUC, timbrado y acceso desde PC o App móvil (PWA).',
  },
];

const CarouselMockup: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = [
    {
      id: 'lienzo',
      title: 'Lienzo Notarial Milimétrico · CSJ Oficial',
      icon: <Stamp className="w-4 h-4 text-red-600 shrink-0" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center gap-2">
            <div className="font-bold text-slate-900 text-xs tracking-tight truncate">
              Hoja de Seguridad Notarial CSJ — Calibración Activa
            </div>
            <div className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono tabular-nums font-bold shrink-0">
              216 × 330 mm
            </div>
          </div>
          <div className="p-3.5 flex-1 flex flex-col justify-between bg-slate-100/60 text-slate-600 space-y-2.5">
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-500 border-b border-slate-100 pb-1">
                <span>Certificación de Firmas (Hoja 0 / 1)</span>
                <span className="text-emerald-700 font-semibold tabular-nums">Top 55mm · Left 45mm</span>
              </div>
              <p className="text-slate-800 leading-relaxed text-xs">
                &ldquo;CERTIFICO: Que la firma que antecede y dice <span className="font-bold text-slate-900">ALBERTO GONZÁLEZ BENÍTEZ</span> con C.I. N° <span className="font-bold text-slate-900 tabular-nums">3.456.789</span> es auténtica y fue puesta en mi presencia...&rdquo;
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Hoja 2</span>
                <span className="font-bold text-slate-800">Concuerda</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Hoja 3</span>
                <span className="font-bold text-slate-800">Legalización</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center">
                Cero Desperdicio
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'secretaria',
      title: 'Secretaría Privada IA · WhatsApp',
      icon: <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center gap-2">
            <div className="font-bold text-slate-900 text-xs tracking-tight truncate">
              Parte Diario de Causas y Plazos CPC
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 shrink-0">07:00 AM · WhatsApp</span>
          </div>
          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-900">Foco Urgente del Día</div>
              <p className="text-slate-700 leading-relaxed">
                <strong>Causa:</strong> López c/ Constructora Sur s/ Cobro de Guaraníes
              </p>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>• <strong>Vence hoy:</strong> Contestar traslado (Art. 215 CPC)</div>
                <div>• <strong>Conseguir:</strong> Liquidación actualizada firmada</div>
                <div>• <strong>Enlace directo:</strong> olgatech.com.py/consola?exp=402</div>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-lg flex justify-between items-center text-[11px]">
              <span className="text-slate-300">Recordatorio automático Judisoft incluido</span>
              <span className="font-bold text-emerald-400">Listo para actuar</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'presupuestos',
      title: 'Presupuestos Notariales · Ley 879/81',
      icon: <Calculator className="w-4 h-4 text-amber-600 shrink-0" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center gap-2">
            <div className="font-bold text-slate-900 text-xs tracking-tight truncate">
              Presupuesto Automático — Compraventa Inmueble
            </div>
            <span className="text-[10px] font-semibold text-amber-800 shrink-0">Arancel Oficial</span>
          </div>
          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[11px] pb-1 border-b border-slate-100">
                <span className="text-slate-600">Valor Acto: <strong className="tabular-nums">Gs. 350.000.000</strong></span>
                <span className="text-slate-500 font-mono tabular-nums">RUC 80045612-3</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Honorarios Notariales (Ley 879/81)</span>
                  <span className="font-semibold text-slate-800 tabular-nums">Gs. 5.250.000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tasas Judiciales e IVA 10%</span>
                  <span className="font-semibold text-slate-800 tabular-nums">Gs. 2.875.000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Certificados Registrales y Gastos</span>
                  <span className="font-semibold text-slate-800 tabular-nums">Gs. 650.000</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 block">Total Liquidación</span>
                <span className="font-bold text-sm font-mono tabular-nums text-emerald-400">Gs. 8.775.000</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-200">Con membrete propio</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'pagares',
      title: 'Pagaré Fácil en 3 Pasos · Fuerza Ejecutiva',
      icon: <FileText className="w-4 h-4 text-blue-600 shrink-0" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center gap-2">
            <div className="font-bold text-slate-900 text-xs tracking-tight truncate">
              Emisión y Control de Pagarés a la Orden
            </div>
            <span className="text-[10px] font-bold text-blue-700 shrink-0">3 pasos</span>
          </div>
          <div className="p-3.5 flex-1 overflow-hidden space-y-2">
            {[
              { name: 'Juan Carlos López Benítez', amount: '15.000.000 Gs.', date: 'Vence 15 Mar 2026', status: 'Vigente' },
              { name: 'María Fernanda Ruiz Díaz', amount: '8.500.000 Gs.', date: 'Vence 02 Abr 2026', status: 'Vigente' },
              { name: 'Constructora del Este S.A.', amount: '45.000.000 Gs.', date: 'Venció 10 Feb 2026', status: 'Notificado' },
            ].map((item, i) => (
              <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums truncate">
                    {item.date} · <strong className="text-slate-700">{item.amount}</strong>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-700 shrink-0">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="w-full h-full flex flex-col relative z-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {slides[activeIndex].icon}
          <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">{slides[activeIndex].title}</span>
        </div>
        <div className="flex gap-1.5 shrink-0" role="tablist" aria-label="Vistas del sistema">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Ver ${slide.title}`}
              onClick={() => setActiveIndex(i)}
              className={`h-2 rounded-full transition-all cursor-pointer ${i === activeIndex ? 'bg-blue-600 w-5' : 'bg-slate-300 w-2 hover:bg-slate-400'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden relative" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[activeIndex].id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0"
            role="img"
            aria-label={`Vista previa de ${slides[activeIndex].title}`}
          >
            {slides[activeIndex].content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeRubro, setActiveRubro] = useState<RubroId>('escribanos');
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser || null);
  const pwaInstall = usePWAInstall();

  useEffect(() => {
    // Garantizar que la Landing Page pública siempre tenga fondo blanco puro institucional
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('force-light');
    document.body.classList.remove('dark');
    document.body.classList.add('force-light');
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#1e293b';

    return () => {
      document.documentElement.classList.remove('force-light');
      document.body.classList.remove('force-light');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 flex flex-col selection:bg-red-500/10 selection:text-red-600 relative z-0">
      {/* 1. NAVBAR (3 ZONAS LIMPIAS) */}
      <header className="sticky top-0 inset-x-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-50 safe-header-top min-h-[64px] flex items-center">
        <nav className="w-full max-w-7xl mx-auto px-6 min-h-[64px] py-2 flex items-center justify-between gap-8">
          <button
            type="button"
            className="flex items-center cursor-pointer shrink-0"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Ir al inicio de O.L.G.A."
          >
            <Logo darkTheme={false} />
          </button>

          <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#soluciones-rubro" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Por Rubro
            </a>
            <a href="#pilares" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Los 6 Pilares
            </a>
            <a href="#planes" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Planes
            </a>
            <Link to="/recursos" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Recursos
            </Link>
            <a href="#faq" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton pwa={pwaInstall} isDark={false} />
            <button
              type="button"
              onClick={() => navigate('/consola')}
              className="px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{currentUser ? 'Entrar a mi Consola' : 'Entrar a mi Consola'}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </nav>
      </header>

      <PWAInstallGuideModal pwa={pwaInstall} />

      <main className="flex-1 flex flex-col bg-white">
        {/* 2. HERO PRINCIPAL CLARO Y DIRECTO */}
        <section className="pt-14 pb-20 lg:pt-20 lg:pb-24 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16 w-full bg-white">
          <div className="flex-1 space-y-7 text-center lg:text-left">
            <p className="text-xs font-semibold text-blue-700 tracking-wide">
              Software Legal-Tech en Paraguay · Gestión Notarial, Jurídica y Comercial
            </p>

            <h1 className="text-3xl sm:text-5xl lg:text-[48px] font-black text-slate-900 leading-[1.12] tracking-tight text-balance max-w-2xl mx-auto lg:mx-0">
              Dejá atrás el desorden operativo. Automatizá tu estudio o empresa con Inteligencia Artificial.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Los documentos dispersos, los trámites lentos y los plazos olvidados te cuestan horas y clientes. <strong className="text-slate-900 font-semibold">O.L.G.A.</strong> resuelve tu <strong className="text-slate-900 font-semibold">Organización, Legalización, Gestión y Administración</strong> en un solo sistema diseñado para escribanías, abogados, inmobiliarias, playas de vehículos y estudios contables en Paraguay.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => navigate('/consola')}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 text-center flex items-center justify-center cursor-pointer gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <span>Entrar a mi Consola</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <a
                href="#planes"
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-sm font-bold rounded-xl text-center flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <span>Ver Planes y Tarifas</span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1.5 text-xs font-medium text-slate-500 pt-4 border-t border-slate-200">
              <span>Normativa paraguaya y Ley 879/81</span>
              <span aria-hidden="true">·</span>
              <span>Hojas de seguridad CSJ (216 × 330 mm)</span>
              <span aria-hidden="true">·</span>
              <span>Acceso web y App móvil</span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-xl lg:max-w-xl relative">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-5 h-[360px] flex flex-col">
              <CarouselMockup />
            </div>
          </div>
        </section>

        {/* 3. SOLUCIONES DISEÑADAS PARA TU RUBRO (PESTAÑAS INTERACTIVAS DOLOR -> SOLUCIÓN) */}
        <section id="soluciones-rubro" className="py-20 lg:py-24 bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-12 space-y-3">
              <p className="text-xs font-semibold text-blue-700 tracking-wide">
                Adaptado al trabajo real en Paraguay
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-balance">
                Soluciones diseñadas para tu rubro
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                Elegí tu perfil y mirá en segundos qué problema operativo resuelve O.L.G.A. en tu día a día.
              </p>
            </div>

            {/* Pestañas interactivas de rubros */}
            <div
              role="tablist"
              aria-label="Seleccionar rubro profesional"
              className="flex flex-wrap items-center justify-center gap-2 mb-10"
            >
              {RUBRO_SOLUTIONS.map((rubro) => {
                const isActive = activeRubro === rubro.id;
                return (
                  <button
                    key={rubro.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveRubro(rubro.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {rubro.tabLabel}
                  </button>
                );
              })}
            </div>

            {/* Panel Dolor -> Solución (todos en DOM con hidden para SEO + lectura instantánea sin recarga) */}
            {RUBRO_SOLUTIONS.map((rubro) => {
              const isSelected = activeRubro === rubro.id;
              return (
                <div
                  key={rubro.id}
                  role="tabpanel"
                  hidden={!isSelected}
                  className={isSelected ? 'block' : 'hidden'}
                >
                  <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-10 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-7 mb-7 border-b border-slate-100">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">
                          Perfil profesional
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                          {rubro.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/consola')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
                      >
                        <span>Entrar a mi Consola</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                      {/* Dolor actual */}
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-7 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-2 text-xs font-bold text-red-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>El problema habitual (Dolor)</span>
                          </div>
                          <p className="text-slate-800 text-base sm:text-lg font-semibold leading-relaxed">
                            {rubro.dolor}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 pt-3 border-t border-slate-200/80">
                          Cada corrección manual o plazo pasado cuesta tiempo, papel valorado y confianza del cliente.
                        </p>
                      </div>

                      {/* Solución O.L.G.A. */}
                      <div className="rounded-2xl bg-emerald-50/40 border border-emerald-200 p-6 sm:p-7 flex flex-col justify-between space-y-5">
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Cómo lo resuelve O.L.G.A. (Solución)</span>
                          </div>
                          <p className="text-slate-800 text-base leading-relaxed">
                            {rubro.solucion}
                          </p>
                        </div>

                        <ul className="space-y-2.5 pt-4 border-t border-emerald-200/70">
                          {rubro.highlights.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                              <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. LOS 6 PILARES DE O.L.G.A. (GRILLA 3x2) */}
        <section id="pilares" className="py-20 lg:py-24 bg-white border-b border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-14 space-y-3">
              <p className="text-xs font-semibold text-blue-700 tracking-wide">
                Capacidades centrales de la plataforma
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-balance">
                Los 6 Pilares de O.L.G.A.
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                Herramientas concretas para emitir pagarés a la orden, imprimir hojas de seguridad CSJ, controlar plazos CPC Paraguay y ordenar tu estudio o empresa sin complicaciones.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SIX_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article
                    key={pillar.num}
                    className="bg-white border border-slate-200 rounded-2xl p-7 flex flex-col justify-between gap-5 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-mono tabular-nums font-bold text-slate-400">
                          {pillar.num}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900 leading-snug">
                        {pillar.title}
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* SIFEN & FACTURACIÓN ELECTRÓNICA PARAGUAY */}
        <section className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl text-center lg:text-left">
                <p className="text-xs font-semibold text-amber-300">
                  Compatibilidad Tributaria Nacional · SIFEN y DNIT
                </p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
                  Presupuestos notariales y validación de RUC listos para Paraguay
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  O.L.G.A. integra desglose arancelario bajo Ley 879/81, cálculo automático de IVA y comprobación de RUC y dígito verificador para que cada presupuesto y documento esté ordenado desde el primer clic.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                <div className="bg-white/10 border border-white/15 px-6 py-4 rounded-2xl text-center">
                  <span className="block text-2xl font-black text-amber-400 font-mono tabular-nums">10% / 5%</span>
                  <span className="text-xs text-slate-300">Desglose IVA Oficial</span>
                </div>
                <div className="bg-white/10 border border-white/15 px-6 py-4 rounded-2xl text-center">
                  <span className="block text-2xl font-black text-emerald-400 font-mono">RUC / DV</span>
                  <span className="text-xs text-slate-300">Validación DNIT</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. PLANES DE SUSCRIPCIÓN (4 NIVELES ACTUALIZADOS) */}
        <section id="planes" className="py-24 bg-white border-b border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
                Planes de Suscripción OLGA Legal Tech (O.L.G.A.)
              </h2>
              <p className="text-slate-600 text-base mb-8">
                Elige la escala adecuada para tu escribanía, empresa o estudio jurídico. Actualiza o cancela en cualquier momento.
              </p>
              
              <div className="bg-slate-100 p-1.5 rounded-full inline-flex items-center gap-1.5 border border-slate-200">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${!isAnnual ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isAnnual ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <span>Anual</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black ${isAnnual ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}>
                    2 Meses Gratis
                  </span>
                </button>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              
              {/* PLAN BÁSICO (INICIAL) */}
              <div className="group bg-white border-2 border-emerald-500/30 text-slate-900 rounded-[1.75rem] p-7 flex flex-col justify-between shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:bg-emerald-600 hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-600/30 hover:text-white cursor-default">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 transition-colors group-hover:text-emerald-100">
                    INICIAL
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-serif mb-4 transition-colors group-hover:text-white">
                    Plan Básico
                  </h3>
                  
                  <div className="flex flex-col gap-2 mb-6 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700 bg-slate-50/80 px-3 py-2.5 rounded-xl border border-slate-200/80 font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white">
                      <Users className="w-4 h-4 text-slate-500 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-slate-900 font-bold transition-colors group-hover:text-white">2</strong> Usuarios habilitados</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700 bg-slate-50/80 px-3 py-2.5 rounded-xl border border-slate-200/80 font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white">
                      <Bot className="w-4 h-4 text-emerald-600 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-slate-900 font-bold transition-colors group-hover:text-white">20</strong> Consultas IA / mes</span>
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-slate-100 transition-colors group-hover:border-white/20">
                    {isAnnual ? (
                      <div>
                        <div className="text-slate-400 line-through text-xs font-mono transition-colors group-hover:text-emerald-200">Gs. 3.000.000</div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 2.500.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-emerald-100">/ año (pago único)</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 250.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-emerald-100">/ mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-xs text-slate-600 transition-colors group-hover:text-emerald-50">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Pagarés a la Orden ilimitados</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Gestión básica de documentos</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Fichero de Personas (C.I. y RUC)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Asistente O.L.G.A. IA Estándar</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Exportación de PDF (Marca de Agua)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Soporte por correo</span>
                    </li>
                  </ul>
                </div>

                <button 
                  onClick={() => navigate('/consola')} 
                  className="w-full py-3 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 group-hover:bg-white group-hover:text-emerald-700 group-hover:border-white group-hover:shadow-lg"
                >
                  SELECCIONAR BÁSICO
                </button>
              </div>
              
              {/* PLAN PRO (PROFESIONAL) */}
              <div className="group bg-white border-2 border-blue-600 text-slate-900 rounded-[1.75rem] p-7 flex flex-col justify-between relative shadow-md shadow-blue-600/5 transition-all duration-300 ease-out hover:-translate-y-2 hover:bg-blue-600 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-600/30 hover:text-white cursor-default">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest py-1 px-3.5 rounded-full shadow-sm flex items-center gap-1 transition-colors group-hover:bg-white group-hover:text-blue-700 group-hover:shadow-md">
                  <Target className="w-3 h-3" /> Recomendado
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1 transition-colors group-hover:text-blue-100">
                    PROFESIONAL
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-serif mb-4 transition-colors group-hover:text-white">
                    Plan Pro
                  </h3>
                  
                  <div className="flex flex-col gap-2 mb-6 text-xs">
                    <div className="flex items-center gap-2.5 text-blue-950 bg-blue-50/70 px-3 py-2.5 rounded-xl border border-blue-200/80 font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white">
                      <Users className="w-4 h-4 text-blue-600 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-blue-950 font-bold transition-colors group-hover:text-white">5</strong> Usuarios habilitados</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-blue-950 bg-blue-50/70 px-3 py-2.5 rounded-xl border border-blue-200/80 font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white">
                      <Bot className="w-4 h-4 text-blue-600 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-blue-950 font-bold transition-colors group-hover:text-white">50</strong> Consultas IA / mes</span>
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-slate-100 transition-colors group-hover:border-white/20">
                    {isAnnual ? (
                      <div>
                        <div className="text-slate-400 line-through text-xs font-mono transition-colors group-hover:text-blue-200">Gs. 6.900.000</div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 5.750.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-blue-100">/ año (pago único)</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 575.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-blue-100">/ mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-xs text-slate-700 transition-colors group-hover:text-blue-50">
                    <li className="flex items-start gap-2.5 font-semibold text-slate-900 transition-colors group-hover:text-white">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Todo lo incluido en Plan Básico</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Gestión de Escritos Notariales y Legales Libre</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Plantillas Legales y Comerciales completas</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Exportación Limpia (Sin Marca de Agua)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Soporte Ágil y Asistido por WhatsApp</span>
                    </li>
                  </ul>
                </div>

                <button 
                  onClick={() => navigate('/consola')} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 group-hover:bg-white group-hover:text-blue-700 group-hover:shadow-lg"
                >
                  <span>SELECCIONAR PRO</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* PLAN EMPRESA (CORPORATIVO / ESCRIBANÍAS) */}
              <div className="group bg-white border-2 border-slate-900 text-slate-900 rounded-[1.75rem] p-7 flex flex-col justify-between shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:bg-[#0B0F17] hover:border-slate-800 hover:shadow-2xl hover:shadow-black/50 hover:text-white cursor-default">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 transition-colors group-hover:text-slate-400">
                    CORPORATIVO / ESCRIBANÍAS
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-serif mb-4 transition-colors group-hover:text-white">
                    Plan Empresa
                  </h3>
                  
                  <div className="flex flex-col gap-2 mb-6 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700 bg-slate-50/80 px-3 py-2.5 rounded-xl border border-slate-200/80 font-medium transition-colors group-hover:bg-white/10 group-hover:border-white/15 group-hover:text-white">
                      <Users className="w-4 h-4 text-slate-500 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-slate-900 font-bold transition-colors group-hover:text-white">10</strong> Usuarios habilitados</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-700 bg-slate-50/80 px-3 py-2.5 rounded-xl border border-slate-200/80 font-medium transition-colors group-hover:bg-white/10 group-hover:border-white/15 group-hover:text-white">
                      <Bot className="w-4 h-4 text-emerald-600 shrink-0 transition-colors group-hover:text-emerald-400" />
                      <span><strong className="text-slate-900 font-bold transition-colors group-hover:text-white">100</strong> Consultas IA / mes</span>
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-slate-100 transition-colors group-hover:border-white/20">
                    {isAnnual ? (
                      <div>
                        <div className="text-slate-400 line-through text-xs font-mono transition-colors group-hover:text-slate-400">Gs. 12.000.000</div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 10.000.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-slate-400">/ año (pago único)</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 1.000.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-slate-400">/ mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-xs text-slate-700 transition-colors group-hover:text-slate-200">
                    <li className="flex items-start gap-2.5 font-semibold text-slate-900 transition-colors group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Todo lo incluido en Plan Pro</span>
                    </li>

                    {/* RESALTADO: PRESUPUESTO LEY 879/81 */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-emerald-400" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">Presupuestos y Facturación Notarial (Ley 879/81)</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-slate-300">Cálculo de aranceles e IVA oficial automático</div>
                      </div>
                    </li>

                    {/* RESALTADO: LIENZO NOTARIAL CSJ */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-emerald-400" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">Lienzo Notarial Oficial (CSJ)</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-slate-300">Calibración milimétrica para Hoja de Seguridad (216×330 mm)</div>
                      </div>
                    </li>

                    {/* RESALTADO: EL ORÁCULO LEGAL IA Y BENEFICIOS */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-blue-400" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">El Oráculo Legal IA (Dictámenes Notariales)</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-slate-300">Dictámenes jurídicos inmediatos, análisis de títulos, jurisprudencia y blindaje de escrituras</div>
                      </div>
                    </li>

                    {/* BOTONES ESPECIALES SEPRELAD Y TRADUCCIÓN */}
                    <li className="flex flex-col gap-2 pt-1">
                      <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 transition-colors group-hover:text-white">
                        <Check className="w-4 h-4 text-slate-900 shrink-0 transition-colors group-hover:text-white" />
                        <span>Módulos Corporativos Especiales:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> SEPRELAD
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <FileText className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> Traducción Legal
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <Stamp className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> Certificación CSJ
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-emerald-400" />
                      <span>Estatutos, Contratos Corporativos y Concuerda</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-emerald-400" />
                      <span>Historial de Auditoría Notarial (Audit Logs)</span>
                    </li>
                  </ul>
                </div>

                <button 
                  onClick={() => navigate('/consola')} 
                  className="w-full py-3 bg-[#0B0F17] hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-98 group-hover:bg-white group-hover:text-slate-950 group-hover:shadow-lg"
                >
                  SELECCIONAR EMPRESA
                </button>
              </div>

              {/* PLAN FULL (GLOW GOLD EDITION) */}
              <div className="group bg-white border-2 border-amber-400 text-slate-900 rounded-[1.75rem] p-7 flex flex-col justify-between relative shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:bg-gradient-to-b hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/40 hover:text-white cursor-default">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest py-1 px-3.5 rounded-full shadow-md flex items-center gap-1 border border-amber-300 whitespace-nowrap transition-colors group-hover:bg-white group-hover:text-amber-800 group-hover:border-white">
                  <Star className="w-3 h-3 fill-current" /> Edición Definitiva
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1.5 transition-colors group-hover:text-amber-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 transition-colors group-hover:text-white" />
                    <span>GLOW GOLD EDITION</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-serif mb-4 transition-colors group-hover:text-white">
                    Plan Full
                  </h3>
                  
                  <div className="flex flex-col gap-2 mb-6 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-900 bg-[#FEF8E7] px-3 py-2.5 rounded-xl border border-[#FDE6B0] font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                      <Users className="w-4 h-4 text-amber-700 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-black font-bold transition-colors group-hover:text-white">15</strong> Usuarios habilitados</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-900 bg-[#FEF8E7] px-3 py-2.5 rounded-xl border border-[#FDE6B0] font-medium transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                      <Bot className="w-4 h-4 text-amber-700 shrink-0 transition-colors group-hover:text-white" />
                      <span><strong className="text-black font-bold transition-colors group-hover:text-white">300</strong> Consultas IA / mes</span>
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-amber-200 transition-colors group-hover:border-white/20">
                    {isAnnual ? (
                      <div>
                        <div className="text-slate-400 line-through text-xs font-mono transition-colors group-hover:text-amber-200">Gs. 16.200.000</div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 13.500.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-amber-100">/ año (pago único)</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-black text-slate-900 font-mono transition-colors group-hover:text-white">Gs. 1.350.000</div>
                        <span className="text-[11px] text-slate-500 transition-colors group-hover:text-amber-100">/ mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-xs text-slate-700 transition-colors group-hover:text-amber-50">
                    <li className="flex items-start gap-2.5 font-semibold text-slate-900 transition-colors group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Mismos beneficios de Plan Empresa con ventajas exclusivas:</span>
                    </li>

                    {/* EXCLUSIVO 1: SKIN DORADO */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">Interfaz Exclusiva &ldquo;Glow Gold Edition&rdquo; (Skin Dorado)</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-amber-100">Skin Glassmorphism Premium en oro y grafito notarial</div>
                      </div>
                    </li>

                    {/* EXCLUSIVO 2: ATENCIÓN 24HS */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80 shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">Atendimiento VIP 24 Horas &amp; Onboarding Dedicado</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-amber-100">Canal de atención telefónico y WhatsApp exclusivo 24/7</div>
                      </div>
                    </li>

                    {/* RESALTADO: PRESUPUESTOS */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <div>
                        <span className="text-slate-900 transition-colors group-hover:text-white">Presupuestos y Facturación Notarial (Ley 879/81)</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-amber-100">Aranceles oficiales, desglose y facturación instantánea</div>
                      </div>
                    </li>

                    {/* RESALTADO: LIENZO NOTARIAL */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 transition-colors group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Lienzo Notarial Completo con calibración CSJ multidocumento</span>
                    </li>

                    {/* RESALTADO: EL ORÁCULO LEGAL IA Y BENEFICIOS */}
                    <li className="flex items-start gap-2.5 font-bold text-slate-900 transition-colors group-hover:text-white">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <div>
                        <span>El Oráculo Legal IA sin restricciones</span>
                        <div className="text-[10px] font-normal text-slate-600 mt-0.5 transition-colors group-hover:text-amber-100">Dictámenes jurídicos inmediatos, análisis de títulos y jurisprudencia</div>
                      </div>
                    </li>

                    {/* BOTONES ESPECIALES SEPRELAD Y TRADUCCIÓN */}
                    <li className="flex flex-col gap-2 pt-1">
                      <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 transition-colors group-hover:text-white">
                        <Check className="w-4 h-4 text-slate-900 shrink-0 transition-colors group-hover:text-white" />
                        <span>Módulos de Máxima Potencia Habilitados:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> SEPRELAD
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <FileText className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> Traducción Legal
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-300/80 text-black shadow-2xs transition-colors group-hover:bg-white/15 group-hover:border-white/25 group-hover:text-white">
                          <Stamp className="w-3.5 h-3.5 text-slate-800 shrink-0 transition-colors group-hover:text-white" /> Certificación CSJ
                        </span>
                      </div>
                    </li>

                    <li className="flex items-start gap-2.5 text-slate-600 transition-colors group-hover:text-amber-100">
                      <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5 transition-colors group-hover:text-white" />
                      <span>Estatutos, Contratos Corporativos, Concuerda y Audit Logs</span>
                    </li>
                  </ul>
                </div>

                <button 
                  onClick={() => navigate('/consola')} 
                  className="w-full py-3 bg-[#E88300] hover:bg-[#D47700] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-600/20 cursor-pointer active:scale-98 group-hover:bg-white group-hover:text-amber-800 group-hover:shadow-lg"
                >
                  SELECCIONAR PLAN FULL
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* TESTIMONIOS Y RESEÑAS GOOGLE */}
        <Testimonials />

        {/* SECCIÓN PÚBLICA DE GUÍAS Y RECURSOS LEGALES (SEO PARAGUAY + COMPARTIR EN REDES) */}
        <section id="recursos" className="py-24 bg-white border-t border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-bold uppercase tracking-wider mb-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Biblioteca Legal-Tech • Paraguay</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  Guías y Recursos Legales por Rubro
                </h2>
                <p className="text-slate-600 mt-3 text-base leading-relaxed">
                  Artículos prácticos creados por OLGA Legal Tech para escribanos, playas de vehículos, inmobiliarias, abogados, contadores y empresas. Compártelos directo en LinkedIn o WhatsApp.
                </p>
              </div>

              <Link
                to="/recursos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-sm"
              >
                <span>Ver las {RECURSOS_ARTICLES.length} Guías</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                RECURSOS_ARTICLES[0],
                RECURSOS_ARTICLES[1],
                RECURSOS_ARTICLES[3],
                RECURSOS_ARTICLES[4],
                RECURSOS_ARTICLES[5],
                RECURSOS_ARTICLES[7],
              ]
                .filter(Boolean)
                .map((item) => {
                  const shareUrl = `https://olgatech.com.py/recursos/${item.slug}`;
                  return (
                    <article
                      key={item.slug}
                      className="bg-slate-50/70 hover:bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-slate-800 border border-slate-200">
                            {item.category}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{item.readTime}</span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 leading-snug mb-2.5">
                          <Link to={`/recursos/${item.slug}`} className="hover:text-blue-600 transition-colors">
                            {item.title}
                          </Link>
                        </h3>

                        <p className="text-sm text-slate-600 leading-relaxed mb-5">{item.excerpt}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <Link
                          to={`/recursos/${item.slug}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                        >
                          <span>Leer guía</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <SocialShareBar url={shareUrl} title={item.title} compact={true} />
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        </section>

        {/* 7. PREGUNTAS FRECUENTES (FAQ OPTIMIZADO PARA PARAGUAY) */}
        <section id="faq" className="py-24 bg-slate-50 border-t border-slate-200">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Centro de Ayuda</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Preguntas Frecuentes
              </h2>
              <p className="text-slate-600 mt-2 text-sm">
                Respuestas claras sobre la operativa, validez jurídica y calibración en Paraguay.
              </p>
            </div>

            <div className="space-y-4">
              
              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(0)}
                >
                  <span>¿Cómo funciona la calibración milimétrica en fojas de seguridad de la CSJ?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 0 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 0 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    El Lienzo Notarial Milimétrico de O.L.G.A. cuenta con coordenadas milimétricas predefinidas para papel oficial (216 mm × 330 mm). Permite colocar texto de Certificación de Firmas (Hoja 0 y Hoja 1), Concuerda (Hoja 2) y Legalización/Protocolo (Hoja 3) exactamente donde las directrices de la Corte Suprema de Justicia lo exigen, garantizando que al alimentar la foja física en la impresora el texto encaje sin desfasajes ni pérdidas de timbrados.
                  </div>
                )}
              </article>

              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(1)}
                >
                  <span>¿El cálculo de presupuestos notariales cumple con el Arancel Oficial (Ley 879/81)?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 1 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 1 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    Sí. El módulo de Presupuestos (exclusivo del Plan Full) integra las escalas de honorarios mínimos legales establecidas en el Código de Organización Judicial de la República del Paraguay (Ley 879/81), desglosando con precisión matemática honorarios notariales, IVA, tasas judiciales y gastos administrativos para compraventa de inmuebles, rodados, hipotecas y contratos constitutivos.
                  </div>
                )}
              </article>

              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(2)}
                >
                  <span>¿Sirve para Playas de Autos, Inmobiliarias o Negocios Comerciales?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 2 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 2 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    Absolutamente. Las playas de vehículos, loteadoras, inmobiliarias y empresas comerciales utilizan O.L.G.A. para emitir pagarés a la orden con redacción jurídica rigurosa, calcular montos en guaraníes en letras sin discrepancias y mantener un fichero ordenado de clientes con C.I. y RUC, asegurando títulos ejecutivos listos para cobro.
                  </div>
                )}
              </article>

              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(3)}
                >
                  <span>¿Tienen validez ejecutiva los pagarés emitidos por O.L.G.A.?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 3 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 3 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    Totalmente. La redacción cumple estrictamente con los artículos pertinentes del Código Civil y Procesal Civil paraguayo para títulos de crédito a la orden, con cláusulas sin protesto, fijación de domicilio especial y mención exacta de cuotas y vencimientos.
                  </div>
                )}
              </article>

              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(4)}
                >
                  <span>¿Cómo funciona la Secretaría Privada IA por WhatsApp para abogados?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 4 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 4 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    Al cargar tus causas o analizar cédulas y providencias en O.L.G.A., el sistema calcula los plazos del CPC Paraguay y te envía partes diarios por WhatsApp en el horario que elijas, detallando lo urgente del día (qué hacer, conseguir y enviar), enlaces directos a cada expediente y recordatorios para revisar Judisoft.
                  </div>
                )}
              </article>

              <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <button 
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(5)}
                >
                  <span>¿Cómo se accede al sistema y qué seguridad tiene la información?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 5 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 5 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    El acceso se gestiona mediante autenticación segura y cifrada en la nube con Firebase. Cada escribanía, estudio jurídico o empresa cuenta con aislamiento de datos, respaldos automáticos continuos y registro de auditoría de trámites para prevenir accesos no autorizados.
                  </div>
                )}
              </article>

            </div>
          </div>
        </section>

      </main>

      {/* 8. FOOTER INSTITUCIONAL */}
      <footer className="bg-slate-950 text-white py-14 px-6 mt-auto border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 border-b border-slate-800 pb-10 mb-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <Logo darkTheme={true} />
            <p className="text-xs text-slate-400 max-w-md text-center md:text-left mt-1">
              Software legal-tech en Paraguay para gestión notarial, sistema para abogados CPC Paraguay, pagarés a la orden, hojas de seguridad CSJ y secretaría IA por WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400 font-semibold">
            <a href="#soluciones-rubro" className="hover:text-white transition-colors">Soluciones por Rubro</a>
            <a href="#pilares" className="hover:text-white transition-colors">Los 6 Pilares</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes y Precios</a>
            <Link to="/recursos" className="hover:text-white transition-colors">Guías y Recursos</Link>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a>
            <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
            <Link to="/terminos" className="hover:text-white transition-colors">Términos</Link>
            <button onClick={() => navigate('/consola')} className="hover:text-white transition-colors cursor-pointer text-slate-300">Entrar a mi Consola</button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <p>© 2026 OLGA Legal Tech — O.L.G.A. (olgatech.com.py). Todos los derechos reservados.</p>
          
          {/* Social Media SVG Icons */}
          <div className="flex items-center gap-4">
            <a 
              href="https://www.linkedin.com/company/146929506" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="LinkedIn de OLGA Legal Tech (O.L.G.A.)"
              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xs hover:scale-105 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </a>

            <a 
              href="https://www.facebook.com/olgalegaltech" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Facebook de OLGA Legal Tech (O.L.G.A.)"
              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xs hover:scale-105 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 1 0 0 20v-7h-2.5v-3H12V9.5a3.5 3.5 0 0 1 3.5-3.5h2.5v3H16c-.55 0-1 .45-1 1v2h3.5l-.5 3H15v7a10 10 0 0 0-3-18z"/>
              </svg>
            </a>

            <a 
              href="https://www.instagram.com/olgalegaltech" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Instagram de OLGA Legal Tech (O.L.G.A.)"
              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xs hover:scale-105 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>

          <p>Desarrollado por <strong className="text-slate-400">OLGA Legal Tech (Olgatech)</strong> - Paraguay</p>
        </div>
      </footer>

    </div>
  );
};
