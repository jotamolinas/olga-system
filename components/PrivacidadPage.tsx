import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  FileCheck, 
  UserCheck, 
  EyeOff, 
  Database, 
  ArrowLeft, 
  ExternalLink,
  ChevronRight,
  Landmark,
  Scale
} from 'lucide-react';

export const PrivacidadPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Política de Privacidad y Protección de Datos | O.L.G.A. Legal-Tech';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', 'https://olgatech.com.py/privacidad');
    }
    return () => {
      document.title = 'O.L.G.A. | Software para Escribanías, Pagarés y Gestión Notarial en Paraguay';
      if (canonical) {
        canonical.setAttribute('href', 'https://olgatech.com.py/');
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans selection:bg-[#FF3131]/30 selection:text-white">
      {/* 1. Header Minimalista */}
      <header className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <svg width="36" height="22" viewBox="0 0 115 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 group-hover:scale-105 transition-transform">
              <path d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113" stroke="#FF3131" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="butt"/>
            </svg>
            <div className="flex flex-col">
              <span className="font-bold tracking-widest text-base leading-none text-white" style={{ fontFamily: '"Courier Prime", monospace' }}>
                O.L.G.A.
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                Legal-Tech • Paraguay
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link 
              to="/terminos" 
              className="text-slate-400 hover:text-white transition-colors hidden sm:inline-block"
            >
              Términos y Condiciones
            </Link>
            <button 
              onClick={() => navigate('/consola')} 
              className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all cursor-pointer font-bold tracking-wide"
            >
              Acceso Consola
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 sm:py-16 w-full">
        {/* Breadcrumb / Regresar */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Inicio</span>
          </Link>
        </div>

        {/* Encabezado */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300 mb-4 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Transparencia & Privacidad B2B</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
            Política de Privacidad
          </h1>
          <p className="text-sm text-slate-400">
            Última actualización: 1 de noviembre de 2026 • República del Paraguay
          </p>
        </div>

        {/* Tarjeta Bento Resumen Ejecutivo */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 sm:p-8 mb-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#FF3131]" />
            Compromiso Fundamental de Confidencialidad
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
            <div className="bg-[#09090b]/60 border border-white/5 rounded-xl p-4">
              <span className="font-bold text-white block mb-1 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" /> Cero Transferencia a Terceros
              </span>
              O.L.G.A. jamás comparte, vende, cede ni comercializa sus documentos legales, pagarés ni datos de comparecientes con terceros ni plataformas publicitarias.
            </div>
            <div className="bg-[#09090b]/60 border border-white/5 rounded-xl p-4">
              <span className="font-bold text-white block mb-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" /> Aislamiento de Workspaces
              </span>
              Los documentos de cada escribanía o empresa están aislados lógicamente y protegidos con cifrado de grado industrial en tránsito y reposo.
            </div>
          </div>
        </div>

        {/* Artículos de la Política */}
        <div className="space-y-10 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
          {/* 1. Introducción */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">01</span>
              Responsable del Tratamiento y Ámbito de Aplicación
            </h2>
            <p>
              La plataforma <strong>O.L.G.A.</strong> (Organización • Legalización • Gestión • Administración), disponible en el dominio <code>olgatech.com.py</code>, es un software SaaS B2B operado por <strong>Ihara Outsourcing</strong> con sede en Asunción, República del Paraguay.
            </p>
            <p>
              Esta Política de Privacidad regula el tratamiento de los datos personales y empresariales que son recopilados y procesados a través de nuestro software, en estricto cumplimiento con la legislación paraguaya, incluyendo la <strong>Ley N° 1682/01</strong> (y sus leyes modificatorias) &ldquo;Que reglamenta la información de carácter privado&rdquo;, así como las directrices notariales y comerciales vigentes.
            </p>
          </section>

          {/* 2. Datos recopilados */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">02</span>
              Datos Básicos que Recopilamos
            </h2>
            <p>
              Para proveer nuestros servicios de software notarial y corporativo, O.L.G.A. recopila exclusivamente la información básica indispensable para la operativa:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Datos de Perfil del Usuario:</strong> Nombre y apellido, dirección de correo electrónico, número de teléfono (+595), número de documento (C.I. o RUC) y denominación o razón social de la escribanía o empresa.
              </li>
              <li>
                <strong className="text-white">Datos Profesionales Notariales:</strong> En el caso de escribanos y notarios públicos, número de registro notarial, matrícula de la Corte Suprema de Justicia (CSJ) y membrete institucional.
              </li>
              <li>
                <strong className="text-white">Credenciales de Autenticación:</strong> Identificadores de sesión gestionados de forma cifrada mediante proveedores seguros (Firebase Auth / Google Identity). Nunca almacenamos contraseñas en texto plano.
              </li>
            </ul>
          </section>

          {/* 3. Privacidad de Documentos */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">03</span>
              Privacidad Absoluta de Documentos Legales y Pagarés
            </h2>
            <p>
              Reconocemos la naturaleza confidencial y el deber de reserva que rige la actividad notarial y corporativa. Por ello:
            </p>
            <div className="bg-[#121214] border-l-4 border-[#FF3131] p-5 rounded-r-xl space-y-2 text-slate-200">
              <p className="font-semibold text-white">
                Garantía Estricta de No Cesión a Terceros:
              </p>
              <p className="text-xs sm:text-sm text-slate-300">
                Los textos de matrices notariales, pagarés a la orden, certificados de firmas, fojas de seguridad CSJ y datos de comparecientes incorporados en la plataforma pertenecen exclusivamente al usuario titular. O.L.G.A. <strong>no comercializa, no transfiere ni cede bajo ninguna circunstancia</strong> dichos contenidos a terceros, burós de crédito, financieras ni redes publicitarias.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              El procesamiento automatizado de estos documentos (conversión de números a letras en guaraníes, formateo de fechas y calibración milimétrica) se ejecuta en servidores seguros y aislados, sin intervención de terceros ajenos a la plataforma.
            </p>
          </section>

          {/* 4. Medidas de Seguridad */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">04</span>
              Infraestructura, Cifrado y Seguridad
            </h2>
            <p>
              Implementamos rigurosos estándares técnicos y organizativos para salvaguardar la integridad de la información:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Cifrado en Tránsito y Reposo:</strong> Toda comunicación se transmite bajo protocolos criptográficos HTTPS (TLS 1.3). Las bases de datos en la nube (Google Cloud Platform / Firestore) emplean cifrado en reposo AES-256.
              </li>
              <li>
                <strong className="text-white">Control de Acceso por Roles (RBAC):</strong> Separación estricta entre titulares de cuenta, operadores colaboradores y administradores de sistema con pistas de auditoría registradas.
              </li>
              <li>
                <strong className="text-white">Copias de Seguridad Automatizadas:</strong> Respaldos periódicos redundantes para prevenir la pérdida de datos ante contingencias operativas.
              </li>
            </ul>
          </section>

          {/* 5. Derechos de los Usuarios */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">05</span>
              Derechos del Usuario (Acceso, Rectificación y Supresión)
            </h2>
            <p>
              De conformidad con las leyes vigentes de la República del Paraguay, todo usuario titular tiene derecho a:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>Acceder en todo momento a los datos de perfil y registros almacenados en su cuenta.</li>
              <li>Actualizar o rectificar datos inexactos o incompletos.</li>
              <li>Exportar o descargar copias de sus documentos y registros en formatos estándar.</li>
              <li>Solicitar la baja de la cuenta y eliminación permanente de sus registros una vez cancelada su suscripción.</li>
            </ul>
          </section>

          {/* 6. Conservación de Datos */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">06</span>
              Período de Conservación
            </h2>
            <p>
              Los datos se conservan durante el período en que la cuenta del usuario permanezca activa. Si el usuario decide cerrar su cuenta o cancelar el servicio, los datos serán retenidos únicamente por los plazos legalmente exigibles para fines tributarios y de respaldo administrativo, procediéndose luego a su borrado seguro.
            </p>
          </section>

          {/* 7. Contacto y Canal de Privacidad */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">07</span>
              Canal de Atención y Consultas
            </h2>
            <p>
              Para ejercer cualquiera de sus derechos o realizar consultas sobre el tratamiento de sus datos personales, puede ponerse en contacto con nuestro equipo de privacidad y soporte:
            </p>
            <div className="bg-[#121214] border border-white/5 rounded-xl p-5 text-xs sm:text-sm space-y-1 text-slate-300">
              <p><strong className="text-white">Responsable:</strong> Ihara Outsourcing • O.L.G.A. Legal-Tech</p>
              <p><strong className="text-white">Correo electrónico:</strong> <a href="mailto:soporte@olgatech.com.py" className="text-[#FF3131] hover:underline">soporte@olgatech.com.py</a></p>
              <p><strong className="text-white">Jurisdicción:</strong> Asunción, República del Paraguay</p>
            </div>
          </section>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="bg-[#09090b] border-t border-white/5 py-10 px-6 mt-12 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 O.L.G.A. • Ihara Outsourcing • Asunción, Paraguay</p>
          <div className="flex items-center gap-6">
            <Link to="/terminos" className="hover:text-white transition-colors">Términos y Condiciones</Link>
            <Link to="/" className="hover:text-white transition-colors">Inicio</Link>
            <a href="mailto:soporte@olgatech.com.py" className="hover:text-white transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
