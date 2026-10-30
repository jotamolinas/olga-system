import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, ShieldCheck, ChevronDown, Check, Zap, Scale, 
  ArrowRight, Users, MessageSquare, Activity, Settings, Building, 
  Car, Briefcase, Home, Bot, Target, Stamp, Calculator, Sparkles, 
  Printer, CheckCircle2, Star, Shield, HelpCircle, Layers, FileCheck,
  ChevronRight, Landmark, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../services/auth';
import { onAuthStateChanged, User } from 'firebase/auth';

const Logo: React.FC<{ darkTheme?: boolean }> = ({ darkTheme = false }) => (
  <div className="flex items-center gap-4">
    <div className="flex flex-col items-center justify-center gap-1">
      <svg width="48" height="28" viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xs shrink-0">
        <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="#FF3131" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="butt"/>
      </svg>
      <span className={`font-bold tracking-widest leading-none whitespace-nowrap text-lg ${darkTheme ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
        O.L.G.A
      </span>
    </div>
    <div className={`h-10 w-px ${darkTheme ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
    <span className={`font-semibold tracking-[0.06em] leading-tight text-xs uppercase hidden sm:block ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
      Organización • Legalización<br/>Gestión • Administración
    </span>
  </div>
);

const CarouselMockup: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = [
    {
      id: 'lienzo',
      title: 'Lienzo Notarial Milimétrico',
      badge: 'CSJ Oficial',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: <Stamp className="w-5 h-5 text-red-600" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="font-bold text-slate-900 text-xs tracking-tight">Hoja de Seguridad Notarial CSJ - Calibración Activa</div>
            </div>
            <div className="px-2.5 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono font-bold tracking-wide">
              216 × 330 mm
            </div>
          </div>
          <div className="p-3 flex-1 flex flex-col justify-between bg-slate-100/60 font-mono text-[11px] text-slate-600 space-y-2">
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-1 font-sans">
                <span>CERTIFICACIÓN DE FIRMAS (HOJA 0 / 1)</span>
                <span className="text-emerald-600 font-bold">Márgenes exactos: Top 55mm • Left 45mm</span>
              </div>
              <p className="text-slate-800 leading-relaxed font-sans text-xs">
                &ldquo;CERTIFICO: Que la firma que antecede y dice <span className="font-bold text-slate-900">ALBERTO GONZÁLEZ BENÍTEZ</span> con C.I. N° <span className="font-bold text-slate-900">3.456.789</span> es auténtica y fue puesta en mi presencia...&rdquo;
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-sans">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[9px]">DOCUMENTO</span>
                <span className="font-bold text-slate-800">Concuerda (H.2)</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[9px]">LEGALIZACIÓN</span>
                <span className="font-bold text-slate-800">Protocolo (H.3)</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-emerald-800 font-bold">
                Cero Desperdicio
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'presupuestos',
      title: 'Presupuestos Ley 879/81',
      badge: 'Exclusivo Full',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: <Calculator className="w-5 h-5 text-amber-600" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="font-bold text-slate-900 text-xs tracking-tight">Presupuesto Notarial Automático - Compraventa Inmueble</div>
            <div className="px-2 py-0.5 bg-amber-500/10 text-amber-800 border border-amber-300 rounded text-[10px] font-bold">
              Arancel Oficial
            </div>
          </div>
          <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-[11px] pb-1 border-b border-slate-100">
                <span className="text-slate-600">Valor Acto: <strong>Gs. 350.000.000</strong></span>
                <span className="text-slate-500">RUC: 80045612-3</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Honorarios Notariales (Escala Ley 879/81):</span>
                  <span className="font-semibold text-slate-800">Gs. 5.250.000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tasas Judiciales e Impuestos (IVA 10%):</span>
                  <span className="font-semibold text-slate-800">Gs. 2.875.000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Certificados Registrales y Gastos Administrativos:</span>
                  <span className="font-semibold text-slate-800">Gs. 650.000</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Total Liquidación</span>
                <span className="font-bold text-sm tracking-tight font-mono text-emerald-400">Gs. 8.775.000</span>
              </div>
              <div className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold tracking-wider uppercase border border-white/10">
                Imprimir 1-Clic
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pagares',
      title: 'Gestión de Pagarés a la Orden',
      badge: 'Fuerza Ejecutiva',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="font-bold text-slate-900 text-xs tracking-tight">Registro y Emisión de Pagarés</div>
            <div className="px-2.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold shadow-xs">NUEVO PAGARÉ</div>
          </div>
          <div className="p-3 flex-1 overflow-hidden space-y-2 bg-slate-50/50">
            {[
              { name: 'Juan Carlos López Benítez', amount: '15.000.000 Gs.', date: 'Vence 15 Mar 2026', status: 'VIGENTE', color: 'emerald' },
              { name: 'María Fernanda Ruiz Díaz', amount: '8.500.000 Gs.', date: 'Vence 02 Abr 2026', status: 'VIGENTE', color: 'emerald' },
              { name: 'Constructora del Este S.A.', amount: '45.000.000 Gs.', date: 'Venció 10 Feb 2026', status: 'NOTIFICADO', color: 'amber' }
            ].map((item, i) => (
              <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-tight">{item.name}</div>
                    <div className="text-[10px] text-slate-500">{item.date} • <strong className="text-slate-700">{item.amount}</strong></div>
                  </div>
                </div>
                <div className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold">
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'personas',
      title: 'Fichero de Personas & RUC',
      badge: 'Validación DV',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      icon: <Users className="w-5 h-5 text-purple-600" />,
      content: (
        <div className="w-full h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="font-bold text-slate-900 text-xs tracking-tight">Directorio Notarial y Tributario</div>
            <div className="p-1 bg-slate-100 rounded text-slate-600"><Search className="w-3.5 h-3.5" /></div>
          </div>
          <div className="p-3 flex-1 grid grid-cols-2 gap-2 text-left">
            {[
              { name: 'Roberto Gómez', doc: 'C.I. 3.452.123', type: 'Persona Física', status: 'Activo' },
              { name: 'Agroganadera Chaco S.A.', doc: 'RUC 80012345-1', type: 'Persona Jurídica', status: 'Validado' },
              { name: 'Ana Isabel Martínez', doc: 'C.I. 4.123.987', type: 'Persona Física', status: 'Activo' },
              { name: 'Distribuidora del Sur S.R.L.', doc: 'RUC 80098765-4', type: 'Persona Jurídica', status: 'Validado' }
            ].map((item, i) => (
              <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="text-[9px] font-semibold text-slate-400 uppercase">{item.type}</div>
                  <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">{item.doc}</div>
                </div>
                <div className="text-[9px] text-emerald-600 font-semibold mt-1">✓ {item.status}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="carousel-container w-full h-full flex flex-col relative z-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          {slides[activeIndex].icon}
          <span className="font-bold text-slate-800 text-sm">{slides[activeIndex].title}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${slides[activeIndex].badgeColor}`}>
            {slides[activeIndex].badge}
          </span>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
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
            transition={{ duration: 0.25, ease: "easeInOut" }}
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
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser || null);

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
      
      {/* 1. NAVBAR (WHITE / LIGHT THEME) */}
      <header className="sticky top-0 inset-x-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-50 shadow-xs">
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo darkTheme={false} />
          </div>
          
          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#modulos-notariales" className="hover:text-slate-900 transition-colors flex items-center gap-1.5">
              <span>Herramientas Notariales</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded">Nuevo</span>
            </a>
            <a href="#casos-de-uso" className="hover:text-slate-900 transition-colors">Casos de Uso</a>
            <a href="#beneficios" className="hover:text-slate-900 transition-colors">Beneficios</a>
            <a href="#planes" className="hover:text-slate-900 transition-colors">Planes</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/consola')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <span>{currentUser ? 'Ir a mi Consola' : 'Acceso a Consola'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col bg-white">
        
        {/* 2. HERO SECTION (FONDO BLANCO PURO & INSTITUCIONAL) */}
        <section className="pt-14 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-14 w-full bg-white">
          <div className="flex-1 space-y-7 text-center lg:text-left">
            
            {/* Insignia / Pill oficial en azul institucional */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-full border border-blue-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span>Software Notarial Oficial para Paraguay</span>
            </div>

            {/* H1 Título Principal */}
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black text-slate-900 leading-[1.12] tracking-tight">
              Automatiza tus Pagarés, Escritos y Gestión Notarial con Inteligencia Artificial.
            </h1>

            {/* Subtítulo gris legible */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              El software Legal-Tech líder en Paraguay para Escribanías, Playas de Vehículos, Inmobiliarias y Estudios Contables. Emite pagarés a la orden, calibra hojas de seguridad notarial (Certificación de Firmas, Concuerda y Legalización) y genera presupuestos exactos en segundos.
            </p>
            
            {/* Botones de Acción Hero */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <button 
                onClick={() => navigate('/consola')}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/20 text-center flex items-center justify-center cursor-pointer gap-2 group transition-all"
              >
                <span>{currentUser ? 'Entrar a mi Consola' : 'Comenzar Ahora'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <a 
                href="#planes"
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-bold uppercase tracking-wider rounded-xl shadow-sm text-center flex items-center justify-center gap-2 transition-all"
              >
                <span>Ver Planes y Tarifas</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>
            
            {/* Indicadores de confianza */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-600 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-center lg:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Normativa paraguaya y Ley 879/81</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Calibración milimétrica CSJ</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Sin tarjeta de crédito requerida</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-xl lg:max-w-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-slate-100 to-red-500/5 rounded-3xl blur-2xl -z-10" />
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-2 relative overflow-hidden">
              <div className="bg-slate-50 rounded-2xl border border-slate-200/80 h-[380px] flex flex-col p-5 relative">
                <CarouselMockup />
              </div>
            </div>
          </div>
        </section>

        {/* 3. NUEVA SECCIÓN DESTACADA: MÓDULOS NOTARIALES DE ALTA PRECISIÓN */}
        <section id="modulos-notariales" className="py-24 bg-slate-50 border-y border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest rounded-full border border-red-200 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-red-600" />
                <span>Tecnología Jurídica de Vanguardia</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Nuevas Herramientas Notariales y Corporativas
              </h2>
              <p className="text-slate-600 mt-4 text-base leading-relaxed">
                Diseñadas específicamente para el ejercicio notarial en Paraguay. Imprime en fojas oficiales sin descalibración y cotiza actos con exactitud arancelaria.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-stretch">
              
              {/* MÓDULO 1: LIENZO NOTARIAL MILIMÉTRICO */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 sm:p-10 flex flex-col justify-between shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="w-12 h-12 bg-red-50 text-red-600 border border-red-200 rounded-2xl flex items-center justify-center">
                      <Stamp className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full uppercase tracking-wider">
                      Disponible en Plan Empresa y Plan Full
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                    Lienzo Notarial Milimétrico
                  </h3>
                  
                  <p className="text-slate-600 leading-relaxed text-sm mb-6">
                    Calibración milimétrica estricta adaptada a los estándares oficiales de la <strong>Corte Suprema de Justicia (CSJ)</strong>. Permite redactar e imprimir directamente sobre fojas de seguridad notarial físicas, erradicando los desfasajes de margen y la pérdida de papel valorado.
                  </p>

                  <div className="space-y-3.5 border-t border-slate-100 pt-5 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Certificación de Firmas (Hoja 0 y Hoja 1):</strong> Espacios exactos para comparecientes, fecha, sellos y rúbricas.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Concuerda Notarial (Hoja 2):</strong> Estructura canónica para testimonios por exhibición y copias fieles de matrices.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Legalización y Protocolo (Hoja 3):</strong> Foliación milimétrica para escrituras matrices sin tocar bordes de seguridad.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Previsualización 1:1 en Pantalla:</strong> Inspección interactiva que replica las dimensiones exactas de 216 mm × 330 mm.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Formatos CSJ Homologados
                  </span>
                  <button 
                    onClick={() => navigate('/consola')}
                    className="text-sm font-bold text-slate-900 hover:text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Abrir en Consola</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MÓDULO 2: PRESUPUESTOS Y FACTURACIÓN NOTARIAL */}
              <div className="bg-white border-2 border-amber-300 rounded-3xl p-8 sm:p-10 flex flex-col justify-between shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-full pointer-events-none -z-0"></div>
                
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="w-12 h-12 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl flex items-center justify-center">
                      <Calculator className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-full uppercase tracking-wider shadow-2xs">
                      Exclusivo Plan Full
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                    Presupuestos y Facturación Notarial
                  </h3>
                  
                  <p className="text-slate-600 leading-relaxed text-sm mb-6">
                    Automatización integral de presupuestos de escribanía basados estrictamente en el <strong>Arancel Notarial Oficial (Ley 879/81)</strong>. Calcula honorarios mínimos, gastos administrativos, tasas registrales e IVA en segundos.
                  </p>

                  <div className="space-y-3.5 border-t border-slate-100 pt-5 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Arancel Notarial Ley 879/81:</strong> Algoritmo de escalas arancelarias para transferencias, hipotecas y contratos.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Plantillas Notariales Configurables:</strong> Inmuebles, Vehículos, Poderes, Constitución de S.A., S.R.L. y E.A.S.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Validación RUC/C.I. con Dígito Verificador:</strong> Comprobación instantánea de la cédula y RUC de los otorgantes.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <div className="text-sm text-slate-700">
                        <strong>Impresión Formal en 1 Clic:</strong> Liquidación limpia y desglosada con membrete notarial lista para el cliente.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between relative z-10">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Conforme Código de Organización Judicial
                  </span>
                  <a 
                    href="#planes"
                    className="text-sm font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1.5 transition-colors"
                  >
                    <span>Ver en Plan Full</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. CASOS DE USO (SEO TARGETING PARAGUAY) */}
        <section id="casos-de-uso" className="py-24 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Software Especializado para el Mercado Paraguayo
              </h2>
              <p className="text-slate-600 mt-4 text-base">
                O.L.G.A. centraliza la emisión de títulos ejecutivos, documentos notariales y cuentas por cobrar con estricto rigor jurídico.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <article className="bg-slate-50 border border-slate-200 p-6 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Escribanías y Notarías</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Impresión milimétrica en fojas de seguridad de la CSJ, cálculo de presupuestos bajo Ley 879/81 y actas sin errores de tipeo.
                </p>
              </article>

              <article className="bg-slate-50 border border-slate-200 p-6 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-5">
                  <Car className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Playas de Autos y Concesionarias</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Emisión instantánea de pagarés a la orden para venta financiada de vehículos. Respaldo ejecutivo sin vicios formales.
                </p>
              </article>

              <article className="bg-slate-50 border border-slate-200 p-6 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-5">
                  <Home className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Inmobiliarias y Loteadoras</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Compromisos de pago de cuotas de lotes y contratos de alquiler respaldados por títulos ejecutivos de cobro inmediato.
                </p>
              </article>

              <article className="bg-slate-50 border border-slate-200 p-6 rounded-3xl hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-5">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Estudios Jurídicos y Contables</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Digitalización y consulta de deudores por C.I. y RUC, redacción de acuerdos extrajudiciales y auditoría con IA.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 5. BENEFICIOS INSTITUCIONALES */}
        <section id="beneficios" className="py-24 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Garantía Operativa y Jurídica Integral
              </h2>
              <p className="text-slate-600 mt-4 text-base">
                Protección documental estricta para que cada trámite y cobro tenga pleno valor probatorio y ejecutivo.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <article className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mb-6">
                  <Scale className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Títulos con Fuerza Ejecutiva</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Pagarés redactados con exactitud jurídica conforme a la legislación paraguaya, listos para juicio ejecutivo de cobro sin riesgo de excepciones formales.
                </p>
              </article>

              <article className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mb-6">
                  <Printer className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Impresión Milimétrica CSJ</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Configurado para alimentar impresoras láser y de inyección directamente con las fojas de seguridad notarial físicas de la Corte Suprema de Justicia.
                </p>
              </article>

              <article className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xs hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Dígito Verificador & RUC</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Validación instantánea de la cédula tributaria de comparecientes y deudores, evitando errores de tipeo en escrituras públicas y pagarés.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 6. PLANES DE SUSCRIPCIÓN (4 NIVELES ACTUALIZADOS) */}
        <section id="planes" className="py-24 bg-white border-b border-slate-200 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
                Planes de Suscripción O.L.G.A.
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
                  <span>¿Cómo se accede al sistema y qué seguridad tiene la información?</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 4 ? 'rotate-180 text-slate-900' : ''}`} />
                </button>
                {openFaq === 4 && (
                  <div className="px-6 pb-5 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                    El acceso se gestiona mediante autenticación segura y cifrada en la nube con Firebase. Cada escribanía o empresa cuenta con aislamiento de datos, respaldos automáticos continuos y registro de auditoría de trámites para prevenir accesos no autorizados.
                  </div>
                )}
              </article>

            </div>
          </div>
        </section>

      </main>

      {/* 8. FOOTER INSTITUCIONAL */}
      <footer className="bg-slate-950 text-white py-14 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 border-b border-slate-800 pb-10 mb-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <Logo darkTheme={true} />
            <p className="text-xs text-slate-400 max-w-md text-center md:text-left mt-1">
              Plataforma Legal-Tech especializada en Escribanías, Pagarés a la Orden, Calibración de Fojas de Seguridad CSJ y Arancel Notarial Ley 879/81 en Paraguay.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400 font-semibold">
            <a href="#modulos-notariales" className="hover:text-white transition-colors">Herramientas Notariales</a>
            <a href="#casos-de-uso" className="hover:text-white transition-colors">Casos de Uso</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes y Precios</a>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a>
            <button onClick={() => navigate('/consola')} className="hover:text-white transition-colors cursor-pointer text-slate-300">Acceso Consola</button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 O.L.G.A. Legal-Tech (olgatech.com.py). Todos los derechos reservados.</p>
          <p>Desarrollado por <strong className="text-slate-400">Ihara Outsourcing</strong> • Asunción, Paraguay</p>
        </div>
      </footer>

    </div>
  );
};
