import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, ShieldCheck, ChevronDown, Check, Zap, Shield, Scale, ArrowRight, Users, MessageSquare, Activity, Settings, Building, Car, Briefcase, Home, Bot, Target } from 'lucide-react';

const Logo: React.FC<{ darkTheme?: boolean }> = ({ darkTheme = false }) => (
  <div className="flex items-center gap-5">
    <div className="flex flex-col items-center justify-center gap-1.5">
      <svg width="60" height="34" viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm shrink-0">
        <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="#FF3131" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="butt"/>
      </svg>
      <span className={`font-bold tracking-widest leading-none whitespace-nowrap text-xl ${darkTheme ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
        O.L.G.A
      </span>
    </div>
    <div className={`h-12 w-px ${darkTheme ? 'bg-slate-800' : 'bg-slate-300'} hidden sm:block`}></div>
    <span className={`font-bold tracking-[0.08em] leading-tight text-sm uppercase hidden sm:block ${darkTheme ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontFamily: '"Courier Prime", monospace' }}>
      Organización • Legalización<br/>Gestión • Administración
    </span>
  </div>
);

import { motion, AnimatePresence } from 'motion/react';

const CarouselMockup = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = [
    {
      id: 'pagares',
      title: 'Gestión de Pagarés',
      icon: <FileText className="w-5 h-5 text-blue-500" />,
      content: (
        <div className="w-full box-border h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner text-left">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
            <div className="font-black text-slate-800 text-sm tracking-tight">Registro de Pagarés</div>
            <div className="px-3 py-1 bg-[#FF3131] text-white rounded-lg text-[10px] font-bold shadow-sm">NUEVO PAGARÉ</div>
          </div>
          <div className="p-3 flex-1 overflow-hidden space-y-2 bg-slate-50/50">
            {[
              { name: 'Juan Carlos López', amount: '15.000.000 Gs.', date: '15 Oct 2023', status: 'VIGENTE', color: 'emerald' },
              { name: 'María Fernanda Ruiz', amount: '8.500.000 Gs.', date: '02 Nov 2023', status: 'VIGENTE', color: 'emerald' },
              { name: 'Empresa Constructora S.A.', amount: '45.000.000 Gs.', date: '10 Ago 2023', status: 'VENCIDO', color: 'red' },
              { name: 'Carlos Mendoza', amount: '3.200.000 Gs.', date: '28 Sep 2023', status: 'PAGADO', color: 'blue' }
            ].map((item, i) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-${item.color}-50 flex items-center justify-center shrink-0`}>
                    <FileText className={`w-4 h-4 text-${item.color}-500`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] font-medium text-slate-500">{item.date} • {item.amount}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 bg-${item.color}-50 text-${item.color}-600 rounded-md text-[8px] font-black tracking-wider`}>
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
      title: 'Fichero de Personas',
      icon: <Users className="w-5 h-5 text-emerald-500" />,
      content: (
        <div className="w-full box-border h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner">
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center">
             <div className="font-black text-slate-800 text-sm tracking-tight">Directorio de Clientes</div>
             <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><Search className="w-3.5 h-3.5" /></div>
          </div>
          <div className="p-3 flex-1 overflow-hidden grid grid-cols-2 gap-2">
            {[
              { name: 'Roberto Gómez', doc: 'CI: 3.452.123', type: 'Física' },
              { name: 'Tech Solutions S.A.', doc: 'RUC: 80012345-1', type: 'Jurídica' },
              { name: 'Ana Martínez', doc: 'CI: 4.123.987', type: 'Física' },
              { name: 'Distribuidora del Sur', doc: 'RUC: 80098765-4', type: 'Jurídica' },
              { name: 'Luis Fernando', doc: 'CI: 2.345.678', type: 'Física' },
              { name: 'Constructora PY', doc: 'RUC: 80055555-0', type: 'Jurídica' }
            ].map((item, i) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center shadow-sm text-center hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-slate-50 mb-2 flex items-center justify-center border border-slate-100">
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-[10px] font-bold text-slate-800 leading-tight mb-0.5">{item.name}</div>
                <div className="text-[8px] text-slate-500">{item.doc}</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'chat',
      title: 'Chat con O.L.G.A.',
      icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
      content: (
        <div className="w-full box-border h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner">
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FF3131]/10 shrink-0 flex items-center justify-center border border-[#FF3131]/20">
                 <ShieldCheck className="w-4 h-4 text-[#FF3131]" />
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex-1">
                <div className="text-xs text-slate-700 leading-relaxed">
                  Hola, soy <strong>O.L.G.A.</strong>, tu asistente legal. ¿Necesitas ayuda para redactar un pagaré o consultar un expediente?
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                <div className="w-full box-border h-full bg-slate-300" />
              </div>
              <div className="bg-slate-800 p-3 rounded-2xl rounded-tr-none shadow-sm flex-1 text-right">
                <div className="text-xs text-white leading-relaxed">
                  Quiero crear un pagaré a nombre de Juan Pérez por 5 millones de guaraníes.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FF3131]/10 shrink-0 flex items-center justify-center border border-[#FF3131]/20">
                 <ShieldCheck className="w-4 h-4 text-[#FF3131]" />
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex-1">
                <div className="text-xs text-slate-700 leading-relaxed">
                  ¡Entendido! He preparado el borrador del pagaré por <strong>5.000.000 Gs.</strong> a nombre de <strong>Juan Pérez</strong>. ¿Deseas revisarlo?
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Consola / Tablero',
      icon: <Activity className="w-5 h-5 text-amber-500" />,
      content: (
        <div className="w-full box-border h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner p-3 gap-3">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 bg-amber-50 rounded-md flex items-center justify-center"><Activity className="w-3 h-3 text-amber-500" /></div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Capital Activo</div>
              </div>
              <div className="text-sm font-black text-slate-800">125.5M <span className="text-[10px] text-slate-400 font-normal">Gs.</span></div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 bg-emerald-50 rounded-md flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Recuperado</div>
              </div>
              <div className="text-sm font-black text-slate-800">42.8M <span className="text-[10px] text-slate-400 font-normal">Gs.</span></div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-end">
             <div className="text-[10px] font-bold text-slate-500 mb-4">Evolución Anual</div>
             <div className="flex items-end gap-2 justify-between h-20">
               {[40, 70, 45, 90, 65, 80, 55, 60, 40].map((h, i) => (
                 <div key={i} className="w-full box-border bg-[#FF3131]/10 rounded-t-sm relative group overflow-hidden">
                   <div className="absolute bottom-0 w-full box-border bg-[#FF3131] transition-all rounded-t-sm" style={{ height: `${h}%` }} />
                 </div>
               ))}
             </div>
          </div>
        </div>
      )
    },
    {
      id: 'rubros',
      title: 'Configuración y Rubros',
      icon: <Settings className="w-5 h-5 text-slate-500" />,
      content: (
        <div className="w-full box-border h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-inner p-3 gap-3">
          <div className="flex items-center gap-3 mb-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center">
              <Building className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-black text-slate-800">Escribanía Legal</div>
              <div className="text-[9px] text-slate-500">Reg. N° 4598-A</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {[
              { label: 'Multa por mora activa', active: true },
              { label: 'Numeración automática', active: true },
              { label: 'Autenticación en 2 pasos', active: false }
            ].map((item, i) => (
              <div key={i} className={`p-3 flex items-center justify-between ${i !== 2 ? 'border-b border-slate-100' : ''}`}>
                 <div className="flex items-center gap-3">
                   <div className="w-6 h-6 bg-slate-50 border border-slate-100 rounded flex items-center justify-center">
                      <Settings className="w-3 h-3 text-slate-400" />
                   </div>
                   <div className="text-[10px] font-bold text-slate-700">{item.label}</div>
                 </div>
                 <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${item.active ? 'bg-emerald-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                   <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                 </div>
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
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="carousel-container w-full box-border h-full flex flex-col relative z-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          {slides[activeIndex].icon}
          <span className="font-bold text-slate-700">{slides[activeIndex].title}</span>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Ver diapositiva ${slides[i].title}`}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === activeIndex ? 'bg-blue-600 w-4' : 'bg-slate-300'}`}
            />
          ))}
        </div>
      </div>
      
      <div className="flex-1 w-full box-border overflow-hidden relative" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0"
            role="img"
            aria-label={`Vista previa de la interfaz de ${slides[activeIndex].title}`}
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* 1. NAVBAR */}
      <header className="fixed top-0 inset-x-0 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-50">
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <Logo darkTheme={true} />
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-base font-bold text-slate-400">
            <a href="#casos-de-uso" className="hover:text-white transition-colors">Casos de Uso</a>
            <a href="#beneficios" className="hover:text-white transition-colors">Beneficios</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div>
            <button 
              onClick={() => navigate('/consola')}
              className="px-6 py-2.5 bg-white text-slate-900 text-base font-bold rounded-xl hover:bg-slate-100 transition-all shadow-md flex items-center gap-2"
            >
              Ir a Consola
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col pt-20">
      {/* 2. HERO SECTION */}
      <section className="pt-12 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 w-full box-border">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-widest rounded-full border border-blue-100">
            Legal-Tech para Profesionales
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tight">
            Automatiza, Emite y Controla tus Pagarés con Inteligencia Artificial.
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto lg:mx-0">
            La plataforma legal-tech definitiva para Playas de Vehículos, Inmobiliarias, Estudios Contables y Profesionales. Genera documentos con validez y formato notarial en segundos, sin margen de error.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
            <a 
              href="#planes"
              className="w-full box-border sm:w-auto px-8 py-4 bg-blue-600 text-white text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 text-center flex items-center justify-center"
            >
              Comenzar Prueba Gratuita
            </a>
            <a 
              href="#casos-de-uso"
              className="w-full box-border sm:w-auto px-8 py-4 bg-white text-slate-600 border border-slate-200 text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-all text-center"
            >
              Ver Casos de Uso
            </a>
          </div>
          
          <div className="flex items-center justify-center lg:justify-start gap-4 text-xs font-bold text-slate-400 pt-4">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Sin tarjeta de crédito</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Configuración en 1 minuto</span>
          </div>
        </div>

        <div className="flex-1 w-full box-border max-w-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl -z-10" />
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-2 relative overflow-hidden">
            <div className="bg-slate-50 rounded-2xl border border-slate-100 h-96 flex flex-col p-6 relative">
              <CarouselMockup />
            </div>
          </div>
        </div>
      </section>

      {/* 3. CASOS DE USO */}
      <section id="casos-de-uso" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">¿Para quién es O.L.G.A.?</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto">La solución transversal para cualquier negocio o profesional que necesite gestionar cuentas por cobrar y documentos formales con total garantía jurídica.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <article className="bg-slate-50 border border-slate-100 p-6 rounded-3xl hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Car className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-3">Automotores y Concesionarias</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Agiliza la venta a cuotas. Emite pagarés impecables al instante para asegurar el cobro de cada vehículo.
              </p>
            </article>

            <article className="bg-slate-50 border border-slate-100 p-6 rounded-3xl hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-3">Estudios Contables y Jurídicos</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Digitaliza la gestión de tus clientes. Administra múltiples perfiles y automatiza la redacción tediosa.
              </p>
            </article>

            <article className="bg-slate-50 border border-slate-100 p-6 rounded-3xl hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Home className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-3">Inmobiliarias y Loteadoras</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Asegura los compromisos de pago de alquileres y terrenos con documentos de peso legal irrefutable.
              </p>
            </article>

            <article className="bg-slate-50 border border-slate-100 p-6 rounded-3xl hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-3">Escribanías y Notarías</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Optimiza el tiempo de tu despacho con auditoría inteligente y generación de actas sin errores de tipeo.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 4. SECCIÓN DE BENEFICIOS */}
      <section id="beneficios" className="py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Seguridad y Control Absoluto</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto">La tecnología al servicio de tu tranquilidad financiera y operativa. O.L.G.A. protege tus intereses en cada documento.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <article className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">Diseño de Autoridad</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Documentos impresos con formato notarial estricto que imponen respeto y garantizan el cumplimiento de pago.
              </p>
            </article>

            <article className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">Cero Errores Matemáticos</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Cálculo automático de cuotas, entregas iniciales y fechas de vencimiento. Olvídate de los errores manuales que cuestan dinero.
              </p>
            </article>

            <article className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">Base de Datos Centralizada</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Encuentra cualquier pagaré emitido en segundos, filtrando por cliente o fecha. Tu archivo legal, digitalizado y siempre disponible.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* SECCIÓN PLANES */}
      <section id="planes" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Planes de Suscripción O.L.G.A.</h2>
            <p className="text-slate-500 max-w-xl mx-auto mb-8">Elige el plan ideal para tu estudio o empresa y lleva la gestión notarial al siguiente nivel.</p>
            
            <div className="bg-slate-100 p-1.5 rounded-full inline-flex items-center gap-2 border border-slate-200">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Mensual
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${isAnnual ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Anual <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${isAnnual ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>Descuento</span>
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Plan Básico */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col hover:border-slate-300 transition-all duration-300 hover:-translate-y-2 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Plan Básico</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span><strong>2</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <span><strong>20</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-slate-400 line-through text-sm font-mono">Gs. 3.000.000</span>
                    <div className="text-3xl font-black text-slate-900 font-mono">Gs. 2.500.000</div>
                    <span className="text-xs text-slate-500">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-slate-900 font-mono">Gs. 250.000</div>
                    <span className="text-xs text-slate-500">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-slate-600 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Asistente O.L.G.A. Básico</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Generación de Pagarés</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Exportación de PDF (Marca de Agua)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Soporte Estándar</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 mt-auto">
                Seleccionar Plan
              </button>
            </div>
            
            {/* Plan Pro */}
            <div className="bg-gradient-to-b from-[#1b3b86] to-[#122359] border-2 border-blue-400/50 rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-blue-900/30 transform md:-translate-y-4 transition-all duration-300 hover:-translate-y-6">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#3b82f6] text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full flex items-center gap-1 shadow-lg shadow-blue-500/30">
                <Target className="w-3 h-3" /> Recomendado
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Plan Pro</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-blue-100 bg-white/10 p-2 rounded-lg border border-white/10">
                  <Users className="w-4 h-4 text-blue-300" />
                  <span><strong>5</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-blue-100 bg-white/10 p-2 rounded-lg border border-white/10">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span><strong>50</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-blue-300/50 line-through text-sm font-mono">Gs. 6.900.000</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 5.750.000</div>
                    <span className="text-xs text-blue-300/70">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 575.000</div>
                    <span className="text-xs text-blue-300/70">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-white/90 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Todo lo del Básico</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Gestión de Escritos Libre</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Plantillas Legales Simples</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Exportación Limpia (Sin Marca)</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-[#2563eb] text-white font-bold rounded-xl hover:bg-[#3b82f6] transition-all active:scale-95 mt-auto flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25">
                Seleccionar Plan <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Plan Empresa */}
            <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col transition-all duration-300 cursor-pointer shadow-lg shadow-slate-900/20 hover:-translate-y-2 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2">Plan Empresa</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span><strong className="text-white">10</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span><strong className="text-white">100</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-slate-500 line-through text-sm font-mono">Gs. 12.000.000</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 10.000.000</div>
                    <span className="text-xs text-slate-400">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 1.000.000</div>
                    <span className="text-xs text-slate-400">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-slate-300 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Todo lo del Pro</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Estatutos y Contratos Corporativos</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Historial de Auditoría (Logs)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Soporte Prioritario</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-slate-800 border-2 border-slate-700 text-white font-bold rounded-xl transition-all active:scale-95 mt-auto hover:bg-slate-700">
                Seleccionar Plan
              </button>
            </div>

            {/* Plan Full */}
            <div className="bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 text-white rounded-3xl p-8 flex flex-col group transition-all duration-300 cursor-pointer shadow-lg shadow-yellow-600/30 hover:-translate-y-2 border border-yellow-400">
              <h3 className="text-xl font-bold text-white mb-2">Plan Full</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-yellow-50 bg-yellow-800/40 p-2 rounded-lg border border-yellow-600/50">
                  <Users className="w-4 h-4 text-yellow-200" />
                  <span><strong className="text-white">15</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-50 bg-yellow-800/40 p-2 rounded-lg border border-yellow-600/50">
                  <Bot className="w-4 h-4 text-yellow-200" />
                  <span><strong className="text-white">300</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-yellow-200/80 line-through text-sm font-mono">Gs. 16.200.000</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 13.500.000</div>
                    <span className="text-xs text-yellow-100/80">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 1.350.000</div>
                    <span className="text-xs text-yellow-100/80">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-yellow-50 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Todo lo de Empresa</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> El Oráculo Legal</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Módulo Perfil SEPRELAD</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Procesamiento Masivo y Traducción</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-yellow-900 border-2 border-yellow-900 text-yellow-50 hover:text-white font-bold rounded-xl transition-all active:scale-95 mt-auto hover:bg-yellow-950 hover:border-yellow-950 shadow-md">
                Seleccionar Plan
              </button>
            </div>
            
          </div>
        </div>
      

      </section>

      {/* 5. SECCIÓN FAQ */}  
      <section id="faq" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Preguntas Frecuentes sobre nuestro Software de Gestión</h2>
          </div>

          <div className="space-y-4">
            <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button 
                className="w-full box-border px-6 py-5 flex items-center justify-between text-left font-bold text-slate-800 focus:outline-none"
                onClick={() => toggleFaq(0)}
              >
                ¿Sirve para mi negocio si no soy escribano?
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 0 ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === 0 && (
                <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed">
                  Sí. El sistema adapta dinámicamente el membrete para que Empresas, Contadores y Profesionales independientes emitan documentos con máxima formalidad.
                </div>
              )}
            </article>

            <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button 
                className="w-full box-border px-6 py-5 flex items-center justify-between text-left font-bold text-slate-800 focus:outline-none"
                onClick={() => toggleFaq(1)}
              >
                ¿Los pagarés generados tienen validez legal?
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 1 ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === 1 && (
                <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed">
                  Totalmente. La estructura del documento está diseñada bajo estrictos estándares jurídicos para ser un instrumento de cobro ejecutivo impecable.
                </div>
              )}
            </article>

            <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <button 
                className="w-full box-border px-6 py-5 flex items-center justify-between text-left font-bold text-slate-800 focus:outline-none"
                onClick={() => toggleFaq(2)}
              >
                ¿Cómo accedo al sistema?
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === 2 ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === 2 && (
                <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed">
                  Mediante un sistema seguro de validación por SMS, sin contraseñas vulnerables. Recibes un código único en tu celular cada vez que inicias sesión, garantizando máxima seguridad.
                </div>
              )}
            </article>
          </div>
        </div>
      </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="bg-slate-950 py-12 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              <Logo darkTheme={true} />
            </div>
            <p className="text-sm text-slate-500 font-medium text-center md:text-left">
              Desarrollado por Ihara Outsourcing - Líderes en Consultoría de Negocios y Expansión Corporativa.
            </p>
          </div>
          <p className="text-sm text-slate-600 font-medium text-center md:text-right">
            © 2026 O.L.G.A. Legal-Tech. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};
