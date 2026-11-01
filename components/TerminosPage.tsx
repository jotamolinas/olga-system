import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Scale, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Code2, 
  Landmark, 
  Stamp,
  BookOpen
} from 'lucide-react';

export const TerminosPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
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
              to="/privacidad" 
              className="text-slate-400 hover:text-white transition-colors hidden sm:inline-block"
            >
              Política de Privacidad
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
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            <span>Marco Legal & Condiciones de Servicio</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
            Términos y Condiciones
          </h1>
          <p className="text-sm text-slate-400">
            Última actualización: 1 de noviembre de 2026 • República del Paraguay
          </p>
        </div>

        {/* Tarjeta Bento Resumen Ejecutivo */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 sm:p-8 mb-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#FF3131]" />
            Aspectos Clave del Acuerdo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
            <div className="bg-[#09090b]/60 border border-white/5 rounded-xl p-4">
              <span className="font-bold text-white block mb-1 flex items-center gap-1.5">
                <Stamp className="w-3.5 h-3.5 text-amber-400" /> Responsabilidad Notarial
              </span>
              O.L.G.A. es un instrumento informático de asistencia y calibración; la validez notarial y fe pública de los instrumentos corresponden en exclusividad al profesional firmante.
            </div>
            <div className="bg-[#09090b]/60 border border-white/5 rounded-xl p-4">
              <span className="font-bold text-white block mb-1 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" /> Propiedad Intelectual
              </span>
              La plataforma, algoritmos y diseño son propiedad exclusiva de Ihara Outsourcing. El cliente es el titular exclusivo de los documentos e información que genera.
            </div>
          </div>
        </div>

        {/* Cláusulas de Términos */}
        <div className="space-y-10 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
          {/* 1. Aceptación */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">01</span>
              Aceptación de los Términos
            </h2>
            <p>
              El presente contrato de Términos y Condiciones rige el acceso y uso de la plataforma <strong>O.L.G.A.</strong> (Organización • Legalización • Gestión • Administración), provista a través de <code>olgatech.com.py</code> por <strong>Ihara Outsourcing</strong> en la República del Paraguay.
            </p>
            <p>
              Al registrarse, iniciar sesión o utilizar los módulos de O.L.G.A., el usuario (en adelante &ldquo;el Usuario&rdquo; o &ldquo;el Cliente&rdquo;) manifiesta haber leído, comprendido y aceptado en su totalidad las cláusulas aquí estipuladas. Si no está de acuerdo con estos términos, deberá abstenerse de utilizar la plataforma.
            </p>
          </section>

          {/* 2. Objeto y Licencia */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">02</span>
              Naturaleza del Software y Licencia de Uso B2B
            </h2>
            <p>
              O.L.G.A. es una solución de software como servicio (SaaS) dirigida a empresas, escribanías públicas, entidades financieras, loteadoras, playas de automóviles y profesionales del derecho.
            </p>
            <p>
              Ihara Outsourcing otorga al Cliente una licencia de uso limitada, no exclusiva, intransferible y revocable para acceder a las funciones del software según el plan o modalidad de suscripción contratada, condicionada al cumplimiento del pago oportuno y de las presentes normas.
            </p>
          </section>

          {/* 3. Matriz Notarial y Responsabilidad */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">03</span>
              Responsabilidad sobre la Matriz Notarial y Documentos Legales
            </h2>
            <p>
              O.L.G.A. provee herramientas tecnológicas avanzadas destinadas a optimizar la redacción, cálculo de aranceles (Ley N° 879/81), conversión literal de guaraníes y calibración milimétrica para fojas de seguridad de la Corte Suprema de Justicia (CSJ).
            </p>

            <div className="bg-[#121214] border-l-4 border-amber-500 p-5 rounded-r-xl space-y-2 text-slate-200">
              <div className="flex items-center gap-2 font-bold text-white">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Responsabilidad Exclusiva del Profesional o Notario:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                El Notario Público, Escribano de Registro o usuario firmante es el <strong>único y exclusivo responsable</strong> de la exactitud material y jurídica del contenido de la escritura matriz, certificaciones notariales, fojas de seguridad, pagarés y demás instrumentos formalizados. Corresponde al profesional verificar la identidad, capacidad civil de los otorgantes, existencia de mandatos, cumplimiento de tributos y correspondencia de las fojas de actuación.
              </p>
              <p className="text-xs text-slate-400">
                O.L.G.A. no reemplaza la labor del Notario ni ejerce fe pública notarial; opera como una herramienta asistencial de mecanización y procesamiento administrativo.
              </p>
            </div>
          </section>

          {/* 4. Propiedad Intelectual */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">04</span>
              Propiedad Intelectual y Titularidad de Datos
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Propiedad Intelectual de la Plataforma:</strong> La arquitectura de software, código fuente, algoritmos matemáticos y tipográficos, interfaz gráfica Bento, logotipos, marcas comerciales y manuales operativos son propiedad intelectual exclusiva de <strong>Ihara Outsourcing</strong>, protegidos por la <strong>Ley N° 1328/98 de Derechos de Autor y Derechos Conexos</strong> y tratados internacionales. Se prohíbe la ingeniería inversa, descompilación, clonación o comercialización no autorizada.
              </li>
              <li>
                <strong className="text-white">Titularidad de los Datos del Cliente:</strong> Todos los documentos, bases de datos de personas, historiales de pagarés, escrituras y contenidos cargados por el Usuario continúan siendo de su propiedad exclusiva. O.L.G.A. no adquiere derechos de propiedad ni de explotación sobre dichos datos.
              </li>
            </ul>
          </section>

          {/* 5. Cuentas y Seguridad */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">05</span>
              Cuentas, Credenciales y Uso de Operadores
            </h2>
            <p>
              El Usuario Titular es responsable de mantener la confidencialidad de sus claves de acceso, accesos mediante código OTP y autenticación por correo o Google. Toda actividad efectuada bajo su cuenta o a través de operadores colaboradores invitados será atribuible al Usuario Titular. En caso de detectar accesos indebidos, debe notificar inmediatamente a nuestro soporte.
            </p>
          </section>

          {/* 6. Planes, Pagos y Facturación */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">06</span>
              Planes de Suscripción y Facturación Electrónica (DNIT)
            </h2>
            <p>
              Los precios, características y límites de los planes de O.L.G.A. (Gratuito, Pro, Empresa o Full) se detallan en la sección pública de precios.
            </p>
            <p>
              Las suscripciones y recargas se abonan en Guaraníes (PYG) a través de los canales de pago habilitados (transferencia SIPAP / QR, tarjetas de crédito y billeteras). Toda transacción comercial es respaldada con comprobante de venta o factura electrónica conforme a las reglamentaciones de la Dirección Nacional de Ingresos Tributarios (DNIT) de Paraguay.
            </p>
          </section>

          {/* 7. Disponibilidad y Limitación de Responsabilidad */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">07</span>
              Disponibilidad del Servicio y Limitaciones
            </h2>
            <p>
              Ihara Outsourcing implementa estándares técnicos para procurar una disponibilidad continua de la plataforma. No obstante, no garantiza la ausencia total de interrupciones derivadas de cortes de energía, fallas de proveedores troncales de internet, mantenimientos programados de servidores o causas de fuerza mayor.
            </p>
            <p>
              En ningún caso la responsabilidad económica acumulada de Ihara Outsourcing excederá el importe efectivamente pagado por el Usuario en los tres (3) meses inmediatamente anteriores al hecho generador del reclamo.
            </p>
          </section>

          {/* 8. Ley Aplicable y Jurisdicción */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">08</span>
              Ley Aplicable y Jurisdicción Competente
            </h2>
            <p>
              Estos Términos y Condiciones se regirán e interpretarán de acuerdo con las leyes de la <strong>República del Paraguay</strong>.
            </p>
            <p>
              Cualquier controversia, litigio o divergencia que surja en relación con la validez, interpretación o cumplimiento de este acuerdo será sometida a la jurisdicción exclusiva de los <strong>Tribunales Ordinarios de la Ciudad de Asunción</strong>, con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera corresponder.
            </p>
          </section>

          {/* 9. Contacto */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[#FF3131] border border-white/10">09</span>
              Contacto Legal y Administrativo
            </h2>
            <div className="bg-[#121214] border border-white/5 rounded-xl p-5 text-xs sm:text-sm space-y-1 text-slate-300">
              <p><strong className="text-white">Operador:</strong> Ihara Outsourcing • O.L.G.A. Legal-Tech</p>
              <p><strong className="text-white">Portal:</strong> <a href="https://olgatech.com.py" className="text-[#FF3131] hover:underline">olgatech.com.py</a></p>
              <p><strong className="text-white">Atención Legal:</strong> <a href="mailto:soporte@olgatech.com.py" className="text-[#FF3131] hover:underline">soporte@olgatech.com.py</a></p>
              <p><strong className="text-white">Sede:</strong> Asunción, República del Paraguay</p>
            </div>
          </section>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="bg-[#09090b] border-t border-white/5 py-10 px-6 mt-12 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 O.L.G.A. • Ihara Outsourcing • Asunción, Paraguay</p>
          <div className="flex items-center gap-6">
            <Link to="/privacidad" className="hover:text-white transition-colors">Política de Privacidad</Link>
            <Link to="/" className="hover:text-white transition-colors">Inicio</Link>
            <a href="mailto:soporte@olgatech.com.py" className="hover:text-white transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
