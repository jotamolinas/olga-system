import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, Timestamp, doc, deleteDoc, onSnapshot, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { 
  FileText, Loader2, Calendar, Trash2, Settings, MoreVertical, 
  Copy, FolderInput, X, Check, Edit3, Plus, Printer, Save, 
  RotateCcw, Eye, Search, AlertCircle, FileCheck, Sparkles, 
  Paperclip, Send, ChevronDown, ChevronUp, CheckCheck,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  HelpCircle, ArrowRight, ArrowLeft, Clipboard, ShieldCheck
} from 'lucide-react';
import { redactarEscritoConIA } from '../services/gemini';
import { User } from 'firebase/auth';
import { ModalAdministrarCarpetas, Carpeta } from './ModalAdministrarCarpetas';
import { EditorNotarialOficial } from './EditorNotarialOficial';

interface Escrito {
  id: string;
  texto: string;
  fechaCreacion?: Timestamp;
  createdAt?: string;
  tipo: string;
  userId: string;
  categoria?: string;
  correlativo?: string | number;
  creator_id?: string;
  createdBy?: string;
  creator_name?: string;
  creator_role?: string;
}

interface EscritosTabProps {
  currentUser: User | null;
  userProfile?: any;
  personas?: any[];
  onOpenDocument: (text: string, docId?: string, tipo?: string, categoria?: string) => void;
}

// =========================================================================
// UTILIDADES: CONVERSIÓN DE NÚMEROS A LETRAS Y AUTOFILL INTELIGENTE
// =========================================================================

export function numeroALetras(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '';
  num = Math.floor(Math.abs(num));
  if (num === 0) return 'CERO';

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diez_diecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintis = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function getTriplets(n: number): string {
    if (n === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      if (c === 1 && d === 0 && u === 0) res += 'CIEN ';
      else res += centenas[c] + ' ';
    }

    if (d === 1) {
      res += diez_diecinueve[u] + ' ';
    } else if (d === 2) {
      res += veintis[u] + ' ';
    } else {
      if (d > 0) {
        res += decenas[d] + ' ';
        if (u > 0) res += 'Y ';
      }
      if (u > 0) res += unidades[u] + ' ';
    }
    return res.trim();
  }

  let str = '';
  const milesMillones = Math.floor(num / 1000000000);
  const millones = Math.floor((num % 1000000000) / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const restos = num % 1000;

  if (milesMillones > 0) {
    if (milesMillones === 1) str += 'MIL MILLONES ';
    else str += getTriplets(milesMillones) + ' MIL MILLONES ';
  }

  if (millones > 0) {
    if (millones === 1) str += 'UN MILLÓN ';
    else str += getTriplets(millones) + ' MILLONES ';
  }

  if (miles > 0) {
    if (miles === 1) str += 'MIL ';
    else str += getTriplets(miles) + ' MIL ';
  }

  if (restos > 0) {
    str += getTriplets(restos);
  }

  return str.trim();
}

// Alias de conversión legal de números a letras
export const c9e = numeroALetras;

export function procesarAutofillPlantilla(
  textoPlantilla: string,
  personaActiva?: any | null
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  let texto = textoPlantilla;

  // Inyector de Fechas del sistema
  texto = texto.replace(/\[DIA\]|\{\{DIA\}\}/g, dia);
  texto = texto.replace(/\[MES\]|\{\{MES\}\}/g, mes);
  texto = texto.replace(/\[AÑO\]|\[ANIO\]|\{\{AÑO\}\}|\{\{ANIO\}\}/g, anio);
  texto = texto.replace(/a los _____ días del mes de ____________ del año (?:2026|dos mil veintiséis)/g, `a los ${dia} días del mes de ${mes} del año ${anio}`);
  texto = texto.replace(/a los _____ días del mes de ____________ de 2026/g, `a los ${dia} días del mes de ${mes} del año ${anio}`);

  // Desactivación estricta de pre-carga de usuario (Evitar Datos Pre-cargados / Limpieza de Usuario):
  // Todos los nombres, cédulas y datos personales en la plantilla inicial deben generarse estrictamente
  // como espacios vacíos (_______) para que el asistente pregunte por ellos.
  texto = texto.replace(/\{\{NOMBRE\}\}/g, '_______');
  texto = texto.replace(/\{\{DOCUMENTO\}\}/g, '_______');
  texto = texto.replace(/\{\{NACIONALIDAD\}\}/g, '_______');
  texto = texto.replace(/\{\{ESTADO_CIVIL\}\}/g, '_______');
  texto = texto.replace(/\{\{PROFESION\}\}/g, '_______');
  texto = texto.replace(/\{\{DIRECCION\}\}/g, '_______');

  return texto;
}

export function construirConstitucionSA(
  numSocios: number = 2
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  const incisosLetras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  const partesComparecientes: string[] = [];

  // Bucle dinámico según la cantidad de socios solicitada (N)
  for (let i = 1; i <= numSocios; i++) {
    const isFirst = i === 1;
    const isLast = i === numSocios;
    const prefijo = numSocios === 1 ? '' : (isFirst ? 'por una parte' : (isLast ? 'y por la otra' : 'por otra parte'));

    // Bloque notarial estricto con espacios vacíos (_______) sin pre-carga de usuario
    const bloqueSocio = `Don/Doña _______, de nacionalidad _______, mayor de edad, estado civil _______, profesión _______, domiciliado/a en _______, titular de la Cédula de Identidad Civil Nº _______`;

    partesComparecientes.push(prefijo ? `${prefijo}, ${bloqueSocio}` : bloqueSocio);
  }

  const parrafoComparecientes = `comparecen ante mí: ${partesComparecientes.join('; ')}; personas hábiles y civilmente capaces para este acto, a quienes doy fe de conocer, y dicen:`;

  const lineasSuscripcion: string[] = [];
  for (let i = 1; i <= numSocios; i++) {
    const letra = incisosLetras[i - 1] || `${i}`;
    lineasSuscripcion.push(`   ${letra}) _______ suscribe _______ acciones ordinarias, representativas de GUARANÍES _______ (Gs. _______);`);
  }

  const articuloQuinto = `ARTÍCULO 5º (EMISIÓN Y SUSCRIPCIÓN): El Capital Social inicial queda totalmente emitido, suscripto e integrado por los comparecientes en las siguientes proporciones:
${lineasSuscripcion.join('\n')}
totalizando el cien por ciento (100%) del capital emitido y suscripto en este acto de constitución.`;

  const directoresTransitorios: string[] = [
    `- PRESIDENTE DEL DIRECTORIO: Don/Doña _______;`,
    `- DIRECTOR TITULAR: Don/Doña _______;`
  ];
  if (numSocios >= 3) {
    for (let s = 3; s <= numSocios; s++) {
      directoresTransitorios.push(`- DIRECTOR TITULAR: Don/Doña _______;`);
    }
  }
  directoresTransitorios.push(`- SÍNDICO TITULAR: Don/Doña _______;`);

  return `ESCRITURA NÚMERO ______.- CONSTITUCIÓN DE SOCIEDAD ANÓNIMA DENOMINADA "____________________ S.A.".-

En la ciudad de Asunción, Capital de la República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anio}, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, ${parrafoComparecientes}
Que han resuelto constituir una Sociedad Anónima de conformidad con las disposiciones del Código Civil de la República del Paraguay y leyes complementarias vigentes, la cual se regirá por los siguientes Estatutos Sociales:

========================= ESTATUTOS SOCIALES =========================

CAPÍTULO I: DENOMINACIÓN, DOMICILIO, DURACIÓN Y OBJETO:
ARTÍCULO 1º: DENOMINACIÓN: La sociedad se denominará "____________________ S.A.", fijando su domicilio legal en la ciudad de Asunción, República del Paraguay, pudiendo establecer sucursales, agencias o representaciones en cualquier punto del país o del extranjero.
ARTÍCULO 2º: DURACIÓN: La duración de la sociedad será de noventa y nueve (99) años contados a partir de su correspondiente inscripción en la Dirección General de los Registros Públicos.
ARTÍCULO 3º: OBJETO: La sociedad tendrá por objeto dedicarse por cuenta propia, de terceros o asociada a terceros a actividades comerciales, industriales, importación, exportación, prestación de servicios profesionales y técnicos, representaciones y mandatos mercantiles.

CAPÍTULO II: CAPITAL SOCIAL Y ACCIONES:
ARTÍCULO 4º: El Capital Social autorizado se fija en la suma de GUARANÍES ____________________ (Gs. ____________), representado por ______ acciones nominativas ordinarias de valor nominal de GUARANÍES ____________________ (Gs. ____________) cada una, con derecho a un voto por acción.

${articuloQuinto}

CAPÍTULO III: DE LA ADMINISTRACIÓN Y REPRESENTACIÓN:
ARTÍCULO 6º: La dirección y administración de la sociedad estará a cargo de un Directorio compuesto por un (1) Presidente y Directores Titulares y Suplentes, elegidos por la Asamblea General Ordinaria por el período de un (1) ejercicio comercial, pudiendo ser reelectos indefinidamente.

CAPÍTULO IV: DE LA FISCALIZACIÓN:
ARTÍCULO 7º: La fiscalización de la gestión social estará a cargo de un Síndico Titular y un Síndico Suplente designados anualmente por la Asamblea General Ordinaria de conformidad con las disposiciones del Código Civil paraguayo.

CAPÍTULO V: DE LAS ASAMBLEAS:
ARTÍCULO 8º (CLASES DE ASAMBLEAS): Las Asambleas de Accionistas serán Ordinarias y Extraordinarias. Serán convocadas por el Directorio, o a pedido del Síndico o por accionistas que representen por lo menos el cinco por ciento (5%) del capital integrado. La Asamblea General Ordinaria se reunirá anualmente dentro de los cuatro (4) meses posteriores al cierre del ejercicio social para considerar la memoria del Directorio, balance general, estado de resultados, destino de utilidades y elección de autoridades.
ARTÍCULO 9º (QUÓRUM Y MAYORÍAS): La Asamblea Ordinaria sesionará en primera convocatoria con la presencia de accionistas que representen la mayoría de las acciones con derecho a voto. Las resoluciones se adoptarán por mayoría absoluta de los votos presentes. Las Asambleas Extraordinarias se regirán por el quórum y mayorías calificados conforme al Código Civil.

CAPÍTULO VI: DEL EJERCICIO SOCIAL:
ARTÍCULO 10º (EJERCICIO SOCIAL): El ejercicio social cerrará el treinta y uno (31) de diciembre de cada año, fecha en la que se confeccionará el Inventario General, Balance General y Cuadro Demostrativo de Pérdidas y Ganancias conforme a las normas contables y leyes tributarias vigentes.
ARTÍCULO 11º (DISTRIBUCIÓN DE UTILIDADES): De las utilidades líquidas y realizadas que resulten de cada ejercicio, se destinará obligatoriamente: a) Un cinco por ciento (5%) para el Fondo de Reserva Legal, hasta alcanzar el veinte por ciento (20%) del Capital Social; b) La remuneración del Directorio y Síndicos aprobada por la Asamblea; c) El remanente tendrá el destino que determine la Asamblea General de Accionistas.

CAPÍTULO VII: DE LA DISOLUCIÓN Y LIQUIDACIÓN:
ARTÍCULO 12º (DISOLUCIÓN): La sociedad se disolverá por cualquiera de las causales previstas en el Artículo 1003 y concordantes del Código Civil de la República del Paraguay.
ARTÍCULO 13º (LIQUIDACIÓN): La liquidación de la sociedad será practicada por el Directorio en ejercicio o por los liquidadores designados por la Asamblea General de Accionistas bajo la fiscalización del Síndico actuante, procediéndose a la cancelación del pasivo social y a la distribución del remanente entre los accionistas en proporción al capital integrado.

===================== DISPOSICIONES TRANSITORIAS =====================
PRIMERA: DESIGNACIÓN DEL PRIMER DIRECTORIO Y SINDICATURA: De conformidad con los presentes Estatutos Sociales, los comparecientes resuelven por unanimidad designar para integrar los órganos de administración y fiscalización del primer ejercicio social a las siguientes personas:
${directoresTransitorios.join('\n')}
quienes encontrándose presentes aceptan expresamente los cargos conferidos, fijan domicilio especial a los efectos sociales en la sede de la sociedad y prestan juramento de ley para su fiel y leal desempeño.

Leída y ratificada la presente escritura, la firman los comparecientes en señal de plena conformidad, ante mí, el Notario autorizante que doy fe.`;
}

// Modelos y Plantillas Notariales Oficiales
export interface PlantillaNotarial {
  id: string;
  nombre: string;
  categoriaSugerida: string;
  descripcion: string;
  contenido: string;
}

export const PLANTILLAS_NOTARIALES: PlantillaNotarial[] = [
  {
    id: 'hoja_en_blanco',
    nombre: 'Hoja en Blanco',
    categoriaSugerida: 'Sin Categoría',
    descripcion: 'Modo de redacción completamente libre y vacía.',
    contenido: ''
  },
  {
    id: 'constitucion_sa',
    nombre: 'Constitución de S.A.',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Estatutos y formalización de Sociedad Anónima (C.C. Paraguayo).',
    contenido: `ESCRITURA NÚMERO ______.- CONSTITUCIÓN DE SOCIEDAD ANÓNIMA DENOMINADA "____________________ S.A.".-

En la ciudad de Asunción, Capital de la República del Paraguay, a los _____ días del mes de ____________ del año dos mil veintiséis, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, comparecen los señores:
1) Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, domiciliado/a en ____________________, titular de la Cédula de Identidad Civil Nº ____________; y
2) Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, domiciliado/a en ____________________, titular de la Cédula de Identidad Civil Nº ____________;
personas hábiles y civilmente capaces para este acto, a quienes doy fe de conocer, y dicen:
Que han resuelto constituir una Sociedad Anónima de conformidad con las disposiciones del Código Civil de la República del Paraguay y leyes complementarias vigentes, la cual se regirá por los siguientes Estatutos Sociales:

========================= ESTATUTOS SOCIALES =========================

CAPÍTULO I: DENOMINACIÓN, DOMICILIO, DURACIÓN Y OBJETO:
ARTÍCULO 1º: DENOMINACIÓN: La sociedad se denominará "____________________ S.A.", fijando su domicilio legal en la ciudad de Asunción, República del Paraguay, pudiendo establecer sucursales, agencias o representaciones en cualquier punto del país o del extranjero.
ARTÍCULO 2º: DURACIÓN: La duración de la sociedad será de noventa y nueve (99) años contados a partir de su correspondiente inscripción en la Dirección General de los Registros Públicos.
ARTÍCULO 3º: OBJETO: La sociedad tendrá por objeto dedicarse por cuenta propia, de terceros o asociada a terceros a actividades comerciales, industriales, importación, exportación, prestación de servicios profesionales y técnicos, representaciones y mandatos mercantiles.

CAPÍTULO II: CAPITAL SOCIAL Y ACCIONES:
ARTÍCULO 4º: El Capital Social autorizado se fija en la suma de GUARANÍES ____________________ (Gs. ____________), representado por ______ acciones nominativas ordinarias de valor nominal de GUARANÍES ____________________ (Gs. ____________) cada una, con derecho a un voto por acción.

ARTÍCULO 5º (EMISIÓN Y SUSCRIPCIÓN): El Capital Social inicial queda totalmente emitido, suscripto e integrado por los comparecientes en las siguientes proporciones:
   a) _______ suscribe _______ acciones ordinarias, representativas de GUARANÍES _______ (Gs. _______);
   b) _______ suscribe _______ acciones ordinarias, representativas de GUARANÍES _______ (Gs. _______);
totalizando el cien por ciento (100%) del capital emitido y suscripto en este acto de constitución.

CAPÍTULO III: DE LA ADMINISTRACIÓN Y REPRESENTACIÓN:
ARTÍCULO 6º: La dirección y administración de la sociedad estará a cargo de un Directorio compuesto por un (1) Presidente y Directores Titulares y Suplentes, elegidos por la Asamblea General Ordinaria por el período de un (1) ejercicio comercial, pudiendo ser reelectos indefinidamente.

CAPÍTULO IV: DE LA FISCALIZACIÓN:
ARTÍCULO 7º: La fiscalización de la gestión social estará a cargo de un Síndico Titular y un Síndico Suplente designados anualmente por la Asamblea General Ordinaria de conformidad con las disposiciones del Código Civil paraguayo.

CAPÍTULO V: DE LAS ASAMBLEAS:
ARTÍCULO 8º (CLASES DE ASAMBLEAS): Las Asambleas de Accionistas serán Ordinarias y Extraordinarias. Serán convocadas por el Directorio, o a pedido del Síndico o por accionistas que representen por lo menos el cinco por ciento (5%) del capital integrado. La Asamblea General Ordinaria se reunirá anualmente dentro de los cuatro (4) meses posteriores al cierre del ejercicio social para considerar la memoria del Directorio, balance general, estado de resultados, destino de utilidades y elección de autoridades.
ARTÍCULO 9º (QUÓRUM Y MAYORÍAS): La Asamblea Ordinaria sesionará en primera convocatoria con la presencia de accionistas que representen la mayoría de las acciones con derecho a voto. Las resoluciones se adoptarán por mayoría absoluta de los votos presentes. Las Asambleas Extraordinarias se regirán por el quórum y mayorías calificados conforme al Código Civil.

CAPÍTULO VI: DEL EJERCICIO SOCIAL:
ARTÍCULO 10º (EJERCICIO SOCIAL): El ejercicio social cerrará el treinta y uno (31) de diciembre de cada año, fecha en la que se confeccionará el Inventario General, Balance General y Cuadro Demostrativo de Pérdidas y Ganancias conforme a las normas contables y leyes tributarias vigentes.
ARTÍCULO 11º (DISTRIBUCIÓN DE UTILIDADES): De las utilidades líquidas y realizadas que resulten de cada ejercicio, se destinará obligatoriamente: a) Un cinco por ciento (5%) para el Fondo de Reserva Legal, hasta alcanzar el veinte por ciento (20%) del Capital Social; b) La remuneración del Directorio y Síndicos aprobada por la Asamblea; c) El remanente tendrá el destino que determine la Asamblea General de Accionistas.

CAPÍTULO VII: DE LA DISOLUCIÓN Y LIQUIDACIÓN:
ARTÍCULO 12º (DISOLUCIÓN): La sociedad se disolverá por cualquiera de las causales previstas en el Artículo 1003 y concordantes del Código Civil de la República del Paraguay.
ARTÍCULO 13º (LIQUIDACIÓN): La liquidación de la sociedad será practicada por el Directorio en ejercicio o por los liquidadores designados por la Asamblea General de Accionistas bajo la fiscalización del Síndico actuante, procediéndose a la cancelación del pasivo social y a la distribución del remanente entre los accionistas en proporción al capital integrado.

===================== DISPOSICIONES TRANSITORIAS =====================
PRIMERA: DESIGNACIÓN DEL PRIMER DIRECTORIO Y SINDICATURA: De conformidad con los presentes Estatutos Sociales, los comparecientes resuelven por unanimidad designar para integrar los órganos de administración y fiscalización del primer ejercicio social a las siguientes personas:
- PRESIDENTE DEL DIRECTORIO: Don/Doña _______;
- DIRECTOR TITULAR: Don/Doña _______;
- SÍNDICO TITULAR: Don/Doña _______;
quienes encontrándose presentes aceptan expresamente los cargos conferidos, fijan domicilio especial a los efectos sociales en la sede de la sociedad y prestan juramento de ley para su fiel y leal desempeño.

Leída y ratificada la presente escritura, la firman los comparecientes en señal de plena conformidad, ante mí, el Notario autorizante que doy fe.`
  },
  {
    id: 'contrato_compraventa',
    nombre: 'Contrato Privado de Compraventa',
    categoriaSugerida: 'Compraventa',
    descripcion: 'Contrato privado de compraventa de bienes y derechos con cláusulas de mora y pactos de reserva.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA

Conste por el presente instrumento privado celebrado entre las partes:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, con Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, en adelante denominado/a EL VENDEDOR; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, con Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, en adelante denominado/a EL COMPRADOR;

Ambas partes, reconociéndose mutua y suficiente capacidad legal para contratar y obligarse, convienen en celebrar el presente Contrato Privado de Compraventa, el cual se regirá por las siguientes cláusulas y condiciones:

PRIMERA: OBJETO.- EL VENDEDOR declara ser legítimo propietario, libre de todo gravamen, medida cautelar, inhibición o restricción de dominio, del siguiente bien:
____________________________________________________________________________________________________________________.
Por el presente acto, EL VENDEDOR vende, cede y transfiere a favor de EL COMPRADOR todos los derechos de propiedad y posesión sobre el bien individualizado.

SEGUNDA: PRECIO Y FORMA DE PAGO.- El precio justo, real y convenido por la presente compraventa es de GUARANÍES ____________________ (Gs. ____________), suma que EL COMPRADOR abona a EL VENDEDOR de la siguiente manera:
____________________________________________________________________________________________________________________.
EL VENDEDOR declara recibir la suma acordada a su entera satisfacción, sirviendo el presente de suficiente recibo y formal carta de pago.

TERCERA: ENTREGA Y ESTADO DEL BIEN.- En este mismo acto, EL VENDEDOR hace entrega formal y material del bien a EL COMPRADOR, quien declara recibirlo en el estado de conservación en que se encuentra, manifestando su plena conformidad.

CUARTA: EVICCIÓN Y SANEAMIENTO.- EL VENDEDOR se obliga por la evicción y el saneamiento de ley conforme a lo preceptuado en el Código Civil Paraguayo.

QUINTA: JURISDICCIÓN Y COMPETENCIA.- Para todos los efectos legales emergentes del presente contrato, las partes se someten a la jurisdicción y competencia de los Juzgados de Primera Instancia en lo Civil y Comercial de la ciudad de Asunción, República del Paraguay, renunciando expresamente a cualquier otro fuero o jurisdicción que pudiera corresponderles.

En prueba de conformidad y previa lectura, firman dos (2) ejemplares de un mismo tenor y a un solo efecto, en la ciudad de Asunción, a los _____ días del mes de ____________ del año 2026.


____________________________________                  ____________________________________
            EL VENDEDOR                                           EL COMPRADOR`
  },
  {
    id: 'escritura_transferencia',
    nombre: 'Escritura de Transferencia',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Escritura pública notarial protocolizada de transferencia de dominio.',
    contenido: `ESCRITURA NÚMERO ______.- TRANSFERENCIA DE DOMINIO POR ESCRITURA PÚBLICA.-

En la ciudad de Asunción, Capital de la República del Paraguay, a los _____ días del mes de ____________ del año dos mil veintiséis, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, comparecen:
Por una parte, como PARTE TRANSMITENTE: Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________; y
Por la otra parte, como PARTE ADQUIRENTE: Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________;
personas civilmente capaces a quienes doy fe de conocer por haberme exhibido sus respectivos documentos de identidad, y dicen:

PRIMERA: ANTECEDENTES Y DOMINIO.- La PARTE TRANSMITENTE declara ser legítima propietaria del bien individualizado con Finca / Matrícula Nº __________, Padrón Nº __________, ubicado en el Distrito de ____________________. Dicho bien fue adquirido conforme a la Escritura Pública Nº ______ de fecha ____________, autorizada por el Notario Público ____________________, debidamente inscripta en la Dirección General de los Registros Públicos bajo el Nº ______ al Folio ______ del año ______.

SEGUNDA: TRANSFERENCIA DE DOMINIO.- En virtud del presente acto, la PARTE TRANSMITENTE VENDE Y TRANSFIERE a favor de la PARTE ADQUIRENTE el dominio, posesión y todos los derechos que le competen sobre el bien descrito, libre de todo gravamen e inhibición.

TERCERA: PRECIO DE VENTA.- La presente transferencia se efectúa por el precio total y convenido de GUARANÍES ____________________ (Gs. ____________), que la PARTE TRANSMITENTE declara haber recibido íntegramente en dinero en efectivo antes de este acto, otorgando por este instrumento formal y cancelatorio recibo de pago.

CUARTA: CERTIFICADOS REGISTRALES.- El Notario autorizante deja expresa constancia de haber tenido a la vista el Certificado de Condiciones de Dominio y el Certificado de Anotaciones Personales expedidos por la Dirección General de los Registros Públicos, de los cuales resulta que sobre el bien no pesan gravámenes ni restricciones de dominio, y que la parte transmitente goza de plena libre disposición de sus bienes.

Previa lectura que de todo su contenido les di en alta voz, se ratifican en su tenor y la firman de conformidad ante mí, Notario autorizante que doy fe.`
  },
  {
    id: 'transferencia_automotores',
    nombre: 'Transferencia de Automotores',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Contrato notarial de compraventa y transferencia vehicular con asunción de responsabilidad civil.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA Y TRANSFERENCIA DE VEHÍCULO AUTOMOTOR

Entre los suscritos:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio en ____________________, en adelante denominado/a LA PARTE VENDEDORA; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio en ____________________, en adelante denominado/a LA PARTE COMPRADORA;

Ambas partes convienen en formalizar el presente Contrato Privado de Compraventa de Vehículo Automotor bajo los siguientes términos:

PRIMERA: INDIVIDUALIZACIÓN DEL VEHÍCULO.- LA PARTE VENDEDORA declara ser legítima y exclusiva titular del siguiente rodado:
- MARCA: ____________________
- MODELO: ____________________
- AÑO DE FABRICACIÓN: ________
- COLOR: ____________________
- TIPO: ____________________
- NÚMERO DE CHASIS: ________________________
- NÚMERO DE MOTOR: _________________________
- MATRÍCULA / CHAPA Nº: ____________
- CÉDULA DEL AUTOMOTOR Nº: ____________

SEGUNDA: PRECIO Y CANCELACIÓN.- El precio acordado para la compraventa es de GUARANÍES ____________________ (Gs. ____________), abonado íntegramente por LA PARTE COMPRADORA al contado en este acto, otorgando LA PARTE VENDEDORA el más formal y definitivo recibo de pago.

TERCERA: ENTREGA Y RESPONSABILIDAD.- LA PARTE VENDEDORA hace entrega en este acto del rodado en perfecto estado de funcionamiento, junto con sus llaves y documentación pertinente. LA PARTE COMPRADORA asume toda responsabilidad civil, penal, contravencional y tributaria derivada del uso, tenencia y circulación del automotor a partir de la fecha y hora de la firma del presente contrato.

CUARTA: OBLIGACIÓN DE FORMALIZACIÓN NOTARIAL.- Las partes se comprometen a concurrir a la Escribanía Pública designada para la suscripción de la Escritura Pública definitiva de Transferencia de Dominio dentro del plazo de ______ días.

En prueba de conformidad, se suscriben dos (2) ejemplares de idéntico tenor en la ciudad de Asunción, República del Paraguay, a los _____ días del mes de ____________ de 2026.


____________________________________                  ____________________________________
         PARTE VENDEDORA                                       PARTE COMPRADORA`
  },
  {
    id: 'poder_especial',
    nombre: 'Poder Especial',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Poder especial amplio y suficiente para trámites judiciales, bancarios y administrativos.',
    contenido: `ESCRITURA NÚMERO ______.- PODER ESPECIAL AMPLIO Y SUFICIENTE.-

En la ciudad de Asunción, Capital de la República del Paraguay, a los _____ días del mes de ____________ del año dos mil veintiséis, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, comparece:
Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio legal en ____________________; persona hábil y con capacidad civil necesaria para este acto, a quien doy fe de conocer, y expresa:

Que por el presente instrumento formal confiere PODER ESPECIAL amplio y suficiente a favor de Don/Doña ____________________, titular de la Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, para que en su nombre y representación ejercite las siguientes facultades:

PRIMERO: ÁMBITO JUDICIAL: Para que intervenga en todos los juicios, litigios y trámites judiciales en que el/la poderdante tenga interés, sea en calidad de actor/a, demandado/a o tercerista, ante todos los Juzgados, Tribunales de Apelación y la Corte Suprema de Justicia de la República del Paraguay, con facultades de demandar, reconvenir, oponer excepciones, transigir, apelar y desistir.

SEGUNDO: ÁMBITO ADMINISTRATIVO Y PÚBLICO: Para gestionar, tramitar, formular peticiones y suscribir documentos ante la Dirección Nacional de Ingresos Tributarios (DNIT), Dirección General de los Registros Públicos (DGRP), Municipalidades de la República, Ministerios, Secretarías de Estado y demás entes públicos y descentralizados.

TERCERO: ÁMBITO BANCARIO Y PRIVADO: Para representarlo/a ante entidades bancarias, financieras y cooperativas, solicitar extractos, gestionar créditos y realizar depósitos o extracciones vinculadas a las facultades concedidas.

Leída que le fue la presente escritura, la ratifica en todas sus cláusulas y la firma de conformidad ante mí, Notario autorizante que doy fe.`
  },
  {
    id: 'transferencia_inmuebles',
    nombre: 'Transferencia de Inmuebles',
    categoriaSugerida: 'Compraventa',
    descripcion: 'Borrador de transferencia de inmueble con datos de finca, padrón y dimensiones perimétricas.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA Y TRANSFERENCIA DE INMUEBLE

En la ciudad de Asunción, República del Paraguay, a los _____ días del mes de ____________ del año 2026, entre los suscritos:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________, en adelante denominado/a LA PARTE VENDEDORA; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________, en adelante denominado/a LA PARTE COMPRADORA;

Convienen en celebrar el presente Contrato Privado de Transferencia Inmobiliaria bajo las siguientes cláusulas:

PRIMERA: INDIVIDUALIZACIÓN DEL INMUEBLE.- LA PARTE VENDEDORA declara ser legítima propietaria del bien inmueble individualizado con Finca / Matrícula Nº __________, Padrón Nº __________, Lote Nº ______, Manzana Nº ______, ubicado en el Distrito de ____________________, el cual consta de las siguientes dimensiones y linderos:
- Al Norte mide: ______ metros, lindando con: ____________________.
- Al Sur mide: ______ metros, lindando con: ____________________.
- Al Este mide: ______ metros, lindando con: ____________________.
- Al Oeste mide: ______ metros, lindando con: ____________________.
Superficie Total: ____________ metros cuadrados.

SEGUNDA: PRECIO Y CONDICIONES DE PAGO.- La presente transferencia se concierta por el precio total de GUARANÍES ____________________ (Gs. ____________), que LA PARTE COMPRADORA abona a LA PARTE VENDEDORA en dinero efectivo, otorgando ésta formal carta de pago por dicho monto.

TERCERA: CONDICIONES DE DOMINIO.- LA PARTE VENDEDORA garantiza bajo fe de juramento que el inmueble se encuentra libre de hipotecas, embargos, servidumbres o litigios, y que no pesa sobre su persona inhibición alguna para disponer libremente de sus bienes.

CUARTA: ESCRITURACIÓN PÚBLICA.- Las partes se comprometen a concurrir a la Escribanía Pública que designe LA PARTE COMPRADORA a fin de protocolizar la correspondiente Escritura Pública de Transferencia de Dominio.

En fe de lo acordado, se firman dos ejemplares de un mismo tenor y efecto legal.


____________________________________                  ____________________________________
         PARTE VENDEDORA                                       PARTE COMPRADORA`
  }
];

const LOCAL_STORAGE_DRAFT_TEXT = 'olga_escritos_redaccion_draft_texto';
const LOCAL_STORAGE_DRAFT_PLANTILLA = 'olga_escritos_redaccion_draft_plantilla';
const LOCAL_STORAGE_DRAFT_TITULO = 'olga_escritos_redaccion_draft_titulo';
const LOCAL_STORAGE_DRAFT_CATEGORIA = 'olga_escritos_redaccion_draft_categoria';

export const EscritosTab: React.FC<EscritosTabProps> = ({ currentUser, userProfile, personas, onOpenDocument }) => {
  // FASE 2: Identificador maestro del Workspace (Tenant)
  const { workspaceId } = useWorkspace(currentUser, userProfile);
  // Estado de prueba gratuita / billing
  const { pruebaActiva, diasRestantes, isTrialExpired } = useTrialStatus(currentUser);

  // Modo de navegación: Redacción activa vs Archivo de Documentos
  const [activeSubTab, setActiveSubTab] = useState<'redaccion' | 'archivo'>('redaccion');

  // Visibilidad condicional del Editor Notarial (Oculto por defecto según directriz UI/UX)
  const [mostrarEditor, setMostrarEditor] = useState<boolean>(false);
  const [showSplitScreen, setShowSplitScreen] = useState<boolean>(false);

  // Estado del Redactor de Escritos
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>('');
  const [editorText, setEditorText] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('Escrito en Blanco');
  const [selectedCategoryForSave, setSelectedCategoryForSave] = useState<string>('Contratos Privados');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  // Estados de formato activo en la barra de herramientas del editor (queryCommandState)
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  // Estados del Banner de Redacción con IA
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiAttachments, setAiAttachments] = useState<{ name: string; mimeType: string; data: string; size: number }[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiDraftProposal, setAiDraftProposal] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBannerCollapsed, setAiBannerCollapsed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const editorTextareaRef = editorContentRef;

  // Callback ref para garantizar la inyección inmediata del HTML al montar el nodo contentEditable
  const setEditorRef = (el: HTMLDivElement | null) => {
    (editorContentRef as any).current = el;
    if (el && editorText) {
      if (el.innerHTML !== editorText) {
        el.innerHTML = editorText;
      }
    }
  };

  // Sincronización garantizada del contenido en el editor visual al abrir o alternar documento
  useEffect(() => {
    if (mostrarEditor && editorContentRef.current) {
      if (editorText && editorContentRef.current.innerHTML !== editorText) {
        editorContentRef.current.innerHTML = editorText;
      }
    }
  }, [mostrarEditor, editorText]);

  // Estado de la Lista de Escritos Guardados
  const [escritos, setEscritos] = useState<Escrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchFilter, setSearchFilter] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<Escrito | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [docToDelete, setDocToDelete] = useState<Escrito | null>(null);

  // Fase 8: Trazabilidad UX - Código de Soporte Técnico
  const [copiedSupportId, setCopiedSupportId] = useState<string | null>(null);
  const [supportCopiedToast, setSupportCopiedToast] = useState<string | null>(null);
  const [activeEditingDoc, setActiveEditingDoc] = useState<Escrito | null>(null);

  const handleCopiarCodigoSoporte = async (docObj: Escrito) => {
    const effectiveWorkspaceId = workspaceId || docObj.userId || currentUser?.uid || 'no-workspace';
    const correlativo = docObj.correlativo || String(docObj.id || '').slice(0, 4) || 'DOC';
    const textToCopy = `Solicitud Soporte O.L.G.A. | Workspace: ${effectiveWorkspaceId} | Pagaré ID: ${docObj.id} | Correlativo: ${correlativo}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedSupportId(docObj.id);
      setSupportCopiedToast("Código de soporte copiado");
      setTimeout(() => setCopiedSupportId(null), 3000);
      setTimeout(() => setSupportCopiedToast(null), 3000);
    } catch (err) {
      console.error("Error al copiar código de soporte:", err);
    }
  };

  // Estado del Asistente Flotante de Autocompletado (Autofill Wizard)
  const [autofillInput, setAutofillInput] = useState<string>('');
  const [mostrarTooltipAyuda, setMostrarTooltipAyuda] = useState<boolean>(false);
  const autofillInputRef = useRef<HTMLInputElement>(null);

  // Historial de Estados para Deshacer / Retroceder en el Asistente Flotante
  const [historialTextos, setHistorialTextos] = useState<string[]>([]);

  // Diccionario de Memoria Global (Context-Awareness y Cálculos Automáticos)
  const [memoria, setMemoria] = useState<{
    denominacion?: string;
    capital?: number;
    capitalTotal?: number;
    capitalFormateado?: string;
    capitalLetras?: string;
    acciones?: number;
    totalAcciones?: number;
    accionesSuscriptas?: number;
    ultimaAccionesSocio?: number;
    valorNominal?: number;
    comparecientes?: string[];
    cedulas?: string[];
    [key: string]: any;
  }>({});

  // Modo de edición: saber si se está editando un documento existente abierto desde la grilla
  const [editandoDocumentoExistente, setEditandoDocumentoExistente] = useState<boolean>(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Carga inicial del borrador local persistido
  useEffect(() => {
    try {
      const savedText = localStorage.getItem(LOCAL_STORAGE_DRAFT_TEXT);
      const savedPlantilla = localStorage.getItem(LOCAL_STORAGE_DRAFT_PLANTILLA);
      const savedTitle = localStorage.getItem(LOCAL_STORAGE_DRAFT_TITULO);
      const savedCat = localStorage.getItem(LOCAL_STORAGE_DRAFT_CATEGORIA);

      if (savedPlantilla) {
        setSelectedPlantillaId(savedPlantilla);
      }
      if (savedTitle) {
        setDocumentTitle(savedTitle);
      }
      if (savedCat) {
        setSelectedCategoryForSave(savedCat);
      }
      if (savedText !== null) {
        setEditorText(savedText);
      } else {
        // Por defecto, Hoja en Blanco
        setEditorText('');
      }
    } catch (e) {
      console.warn('Error leyendo borrador local de redacción:', e);
    }
  }, []);

  // Persistencia local en cada cambio del editor
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, editorText);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_PLANTILLA, selectedPlantillaId);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_TITULO, documentTitle);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_CATEGORIA, selectedCategoryForSave);
      } catch (e) {
        console.warn('Error guardando borrador local:', e);
      }
    }, 400);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editorText, selectedPlantillaId, documentTitle, selectedCategoryForSave]);

  // Sincronización del contentEditable con el estado de React editorText
  useEffect(() => {
    if (editorContentRef.current) {
      const currentHtml = editorContentRef.current.innerHTML;
      const currentText = editorContentRef.current.innerText;
      if (currentHtml !== editorText && currentText !== editorText) {
        if (
          editorText.includes('<p>') || 
          editorText.includes('<div>') || 
          editorText.includes('<br>') || 
          editorText.includes('<b>') || 
          editorText.includes('<i>') || 
          editorText.includes('<u>') ||
          editorText.includes('<span') ||
          editorText.includes('id="espacio-activo"')
        ) {
          editorContentRef.current.innerHTML = editorText;
        } else {
          editorContentRef.current.innerText = editorText;
        }
      }
    }
  }, [editorText]);

  // Consulta de formato activo en la selección del editor (queryCommandState)
  const checkFormatStates = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // Ignorar si la selección se encuentra fuera del área editable
    }
  };

  // Sincronizar estado de formato con el evento selectionchange
  useEffect(() => {
    const handleSelectionChange = () => {
      checkFormatStates();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Ejecutor de comandos de formato de texto enriquecido tipo Word (document.execCommand)
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    try {
      document.execCommand(command, false, value);
      if (editorContentRef.current) {
        setEditorText(editorContentRef.current.innerHTML);
        editorContentRef.current.focus();
      }
      setTimeout(checkFormatStates, 15);
    } catch (e) {
      console.warn('Error ejecutando comando de formato:', command, e);
    }
  };

  // Atajo de teclado ESC (Cerrar Editor Notarial y volver al Dashboard principal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mostrarEditor) {
        if (isAiModalOpen || isAdminModalOpen || movingDoc) {
          return;
        }
        setMostrarEditor(false);
        setShowSplitScreen(false);
        setSelectedPlantillaId('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarEditor, isAiModalOpen, isAdminModalOpen, movingDoc]);

  // =========================================================================
  // MOTOR DE DETECCIÓN DE ESPACIOS EN BLANCO Y ASISTENTE (AUTOFILL WIZARD)
  // =========================================================================

  // Extraer texto plano actual para análisis de variables
  const currentPlainText = React.useMemo(() => {
    return editorText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  }, [editorText]);

  // Contar espacios en blanco totales y pendientes
  const blankMatches = React.useMemo(() => {
    const regex = /_{3,}/g;
    const matches: { index: number; length: number }[] = [];
    let match;
    while ((match = regex.exec(currentPlainText)) !== null) {
      matches.push({ index: match.index, length: match[0].length });
    }
    return matches;
  }, [currentPlainText]);

  const totalBlanks = blankMatches.length;

  // =========================================================================
  // SINCRONIZACIÓN CONTEXTUAL DEL ASISTENTE (AUTOFILL WIZARD)
  // Analiza estrictamente las 3 o 4 palabras inmediatamente anteriores
  // al ÚNICO espacio que actualmente tiene el <span id="espacio-activo">,
  // ignorando los demás espacios vacíos del documento.
  // =========================================================================
  const currentBlankContext = React.useMemo(() => {
    if (totalBlanks === 0) return null;

    let textBeforeActive = '';
    let textAfterActive = '';

    if (editorText.includes('id="espacio-activo"')) {
      const idx = editorText.indexOf('id="espacio-activo"');
      const startTag = editorText.lastIndexOf('<span', idx);
      textBeforeActive = startTag !== -1 ? editorText.substring(0, startTag) : editorText.substring(0, idx);

      const closeTag = editorText.indexOf('</span>', idx);
      if (closeTag !== -1) {
        textAfterActive = editorText.substring(closeTag + 7, closeTag + 80);
      }
    } else {
      // Si aún no se ha inyectado el span en el DOM/estado, analizar el primer espacio vacío
      const match = editorText.match(/_{3,}/);
      if (match && match.index !== undefined) {
        textBeforeActive = editorText.substring(0, match.index);
        textAfterActive = editorText.substring(match.index + match[0].length, match.index + match[0].length + 80);
      } else {
        return null;
      }
    }

    // Limpieza estricta de HTML y entidades para extraer texto puro previo
    const plainBefore = textBeforeActive
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    // ESTRICTAMENTE los últimos 30 caracteres justo antes de la etiqueta (ignorando todo lo anterior)
    const textoPrevio = plainBefore.slice(-30).toLowerCase();

    const plainAfter = textAfterActive
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .toLowerCase();

    // 1. REGLA ESTRICTA DE ESTADO CIVIL:
    // SOLO debe aplicarse si la palabra 'civil' está literalmente pegada al espacio en blanco
    // (ej. 'estado civil: _______', 'estado civil _______', 'civil _______')
    const esEstadoCivilPegado = /(?:estado\s+civil|civil)\s*[:\.]?\s*$/i.test(plainBefore);
    if (esEstadoCivilPegado) {
      return {
        instruccion: 'Insertar Estado Civil',
        ayuda: 'Estado civil legal: SOLTERO/A, CASADO/A, VIUDO/A o DIVORCIADO/A.',
        placeholder: 'Ej. SOLTERO / CASADO'
      };
    }

    // 2. VENTANA DE ANÁLISIS DE CONTEXTO INMEDIATO PREVIO
    // Se analizan los últimos caracteres para priorizar la palabra clave más cercana al espacio _______
    const windowText = plainBefore.slice(-120).toLowerCase();

    // Helper para medir la posición final (último índice) de un patrón en la ventana previa.
    // Cuanto mayor sea lastPos, más cerca se encuentra del espacio en blanco.
    const getLastIndex = (regex: RegExp): number => {
      let last = -1;
      let m: RegExpExecArray | null;
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
      const r = new RegExp(regex.source, flags);
      while ((m = r.exec(windowText)) !== null) {
        last = m.index + m[0].length;
      }
      return last;
    };

    interface ContextCandidate {
      pos: number;
      instruccion: string;
      ayuda: string;
      placeholder: string;
    }

    const candidates: ContextCandidate[] = [];

    // CÉDULA DE IDENTIDAD
    // Si el texto previo contiene la palabra 'Cédula', 'CI Nº', etc., se prioriza con su posición exacta
    const posCedula = getLastIndex(/(?:cédula|cedula|c\.i\.|ci\s*n[º°]|c\.i\s*n[º°]|identidad\s+civil\s*n[º°]|identidad\s*n[º°]|documento\s+de\s+identidad)/i);
    if (posCedula !== -1) {
      candidates.push({
        pos: posCedula,
        instruccion: 'Insertar Cédula de Identidad',
        ayuda: 'Número de Cédula de Identidad Civil paraguaya o documento de identidad del otorgante.',
        placeholder: 'Ej. 3.456.789'
      });
    }

    // COMPARECIENTES Y NOMBRES (don/doña, comparece, la otra parte, etc.)
    const posNombre = getLastIndex(/(?:don\/doña|don\b|doña\b|la\s+otra\s+parte|por\s+una\s+parte|comparecen\b|comparece\b|señor\/a|señor\b|señora\b)/i);
    if (posNombre !== -1) {
      if (windowText.includes('comprador')) {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre del Comprador',
          ayuda: 'Nombres y apellidos completos de la parte compradora.',
          placeholder: 'Ej. MARÍA ELENA GONZÁLEZ'
        });
      } else if (windowText.includes('vendedor')) {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre del Vendedor',
          ayuda: 'Nombres y apellidos completos de la parte vendedora.',
          placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
        });
      } else {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre',
          ayuda: 'Nombres y apellidos completos según constan en el documento de identidad civil vigente.',
          placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
        });
      }
    }

    // SI LA SUSCRIPCIÓN INICIA JUSTO DESPUÉS DEL ESPACIO (ej. "a) _______ suscribe")
    if (plainAfter.startsWith('suscribe') || plainAfter.startsWith('suscriben')) {
      candidates.push({
        pos: windowText.length,
        instruccion: 'Insertar Nombre',
        ayuda: 'Nombres y apellidos completos del socio o compareciente suscriptor.',
        placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
      });
    }

    // DOMICILIO (Condición de contexto para domicilio o ciudad)
    const posDomicilio = getLastIndex(/(?:domiciliado\/a\s+en|domiciliado\s+en|domiciliada\s+en|domiciliado\/a|domiciliado\b|domiciliada\b|con\s+domicilio\s+en|domicilio\b|ciudad\s+de)/i);
    if (posDomicilio !== -1) {
      candidates.push({
        pos: posDomicilio,
        instruccion: 'Insertar Domicilio',
        ayuda: 'Dirección o domicilio real de la parte compareciente (calle, número y ciudad).',
        placeholder: 'Ej. CALLE PALMA Nº 452, ASUNCIÓN'
      });
    }

    // PROFESIÓN / OCUPACIÓN
    const posProfesion = getLastIndex(/(?:profesión|profesion|ocupación|ocupacion|de\s+profesión|de\s+profesion)/i);
    if (posProfesion !== -1) {
      candidates.push({
        pos: posProfesion,
        instruccion: 'Insertar Profesión',
        ayuda: 'Profesión, oficio u ocupación principal del compareciente.',
        placeholder: 'Ej. ABOGADO / COMERCIANTE / INGENIERO'
      });
    }

    // NACIONALIDAD
    const posNacionalidad = getLastIndex(/(?:nacionalidad|de\s+nacionalidad)/i);
    if (posNacionalidad !== -1) {
      candidates.push({
        pos: posNacionalidad,
        instruccion: 'Insertar Nacionalidad',
        ayuda: 'Nacionalidad de origen o adquirida del compareciente.',
        placeholder: 'Ej. PARAGUAYA'
      });
    }

    // PRESIDENTE DEL DIRECTORIO
    const posPresidente = getLastIndex(/(?:presidente|presidenta)/i);
    if (posPresidente !== -1) {
      candidates.push({
        pos: posPresidente,
        instruccion: 'Insertar Nombre del Presidente',
        ayuda: 'Nombre del compareciente designado como Presidente del Directorio.',
        placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
      });
    }

    // DIRECTOR TITULAR
    const posDirector = getLastIndex(/(?:director\s+titular|directora\s+titular|director\b|directora\b|vicepresidente)/i);
    if (posDirector !== -1) {
      candidates.push({
        pos: posDirector,
        instruccion: 'Insertar Director Titular',
        ayuda: 'Nombre del compareciente designado como Director Titular.',
        placeholder: 'Ej. MARÍA ELENA GONZÁLEZ'
      });
    }

    // SÍNDICO TITULAR
    const posSindico = getLastIndex(/(?:síndico\s+titular|sindico\s+titular|síndico\b|sindico\b)/i);
    if (posSindico !== -1) {
      candidates.push({
        pos: posSindico,
        instruccion: 'Insertar Síndico Titular',
        ayuda: 'Nombre del profesional o persona designada como Síndico Titular.',
        placeholder: 'Ej. LIC. CARLOS BENÍTEZ'
      });
    }

    // ESCRITURA NOTARIAL
    const posEscritura = getLastIndex(/(?:escritura\s+número|escritura\s+nº|escritura\s+n°|escritura\s+pública|escritura\b)/i);
    if (posEscritura !== -1) {
      candidates.push({
        pos: posEscritura,
        instruccion: 'Insertar Número de Escritura',
        ayuda: 'Número de orden correlativo de la escritura pública asignado por el Registro Notarial.',
        placeholder: 'Ej. 42 / Cuarenta y dos'
      });
    }

    // REGISTRO NOTARIAL
    const posRegistro = getLastIndex(/(?:registro\s+notarial|registro\s+nº|registro\s+n°)/i);
    if (posRegistro !== -1) {
      candidates.push({
        pos: posRegistro,
        instruccion: 'Insertar Número de Registro Notarial',
        ayuda: 'Número oficial asignado a la Escribanía / Registro Notarial ante la Corte Suprema de Justicia.',
        placeholder: 'Ej. 748'
      });
    }

    // DENOMINACIÓN SOCIAL
    const posDenominacion = getLastIndex(/(?:denominada|denominación|denominacion|denominará|denominara|razón\s+social|razon\s+social)/i);
    if (posDenominacion !== -1) {
      candidates.push({
        pos: posDenominacion,
        instruccion: 'Insertar Denominación o Razón Social',
        ayuda: 'Nombre de fantasía o denominación social de la Sociedad Anónima (sin incluir S.A.).',
        placeholder: 'Ej. AGRO INDUSTRIAL DEL ESTE'
      });
    }

    // ACCIONES SUSCRIPTAS
    const posSuscribe = getLastIndex(/(?:suscribe\b|suscriben\b)/i);
    if (posSuscribe !== -1 || plainAfter.startsWith('acciones')) {
      candidates.push({
        pos: posSuscribe !== -1 ? posSuscribe : windowText.length,
        instruccion: 'Insertar Cantidad de Acciones Suscriptas',
        ayuda: 'Número de acciones ordinarias que suscribe el compareciente.',
        placeholder: 'Ej. 50 / Cincuenta'
      });
    }

    // CANTIDAD TOTAL DE ACCIONES
    const posAcciones = getLastIndex(/(?:representado\s+por|total\s+de\s+acciones|cantidad\s+de\s+acciones|acciones\s+nominativas|acciones\b)/i);
    if (posAcciones !== -1) {
      candidates.push({
        pos: posAcciones,
        instruccion: 'Insertar Cantidad de Acciones',
        ayuda: 'Cantidad total de acciones emitidas de la sociedad.',
        placeholder: 'Ej. 100 / Cien'
      });
    }

    // VALOR NOMINAL POR ACCIÓN
    const posNominal = getLastIndex(/(?:valor\s+nominal|nominal\b)/i);
    if (posNominal !== -1) {
      candidates.push({
        pos: posNominal,
        instruccion: 'Insertar Valor Nominal por Acción',
        ayuda: 'Valor nominal individual asignado a cada acción en Guaraníes.',
        placeholder: 'Ej. 500.000 / QUINIENTOS MIL'
      });
    }

    // MONTO SUSCRIPTO EN GUARANÍES
    const posMontoSuscripto = getLastIndex(/(?:representativas\s+de|representativa\s+de)/i);
    if (posMontoSuscripto !== -1) {
      candidates.push({
        pos: posMontoSuscripto,
        instruccion: 'Insertar Monto Suscripto en Guaraníes',
        ayuda: 'Monto en Guaraníes correspondiente a las acciones suscriptas.',
        placeholder: 'Ej. 250000000'
      });
    }

    // MONTO EN GUARANÍES (CIFRAS)
    const posGs = getLastIndex(/(?:gs\.|gs\b)/i);
    if (posGs !== -1) {
      candidates.push({
        pos: posGs,
        instruccion: 'Insertar Monto en Guaraníes (Cifras)',
        ayuda: 'Monto numérico en Guaraníes.',
        placeholder: 'Ej. 50.000.000'
      });
    }

    // MONTO / PRECIO / CAPITAL SOCIAL
    const posMonto = getLastIndex(/(?:guaraníes|guaranies|capital\s+social|suma\s+de|precio\b|monto\b)/i);
    if (posMonto !== -1) {
      const isMonetaryBlock = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i.test(textAfterActive);
      candidates.push({
        pos: posMonto,
        instruccion: isMonetaryBlock ? 'Insertar Monto o Capital Social (Bloque Completo)' : 'Insertar Monto o Precio',
        ayuda: isMonetaryBlock
          ? 'Ingrese el monto en números (ej. 50000000). El sistema formateará y reemplazará automáticamente el bloque completo por: GUARANÍES CINCUENTA MILLONES (Gs. 50.000.000).'
          : 'Monto en Guaraníes. Si escribe números, se formatearán y convertirán automáticamente a letras.',
        placeholder: isMonetaryBlock ? 'Ej. 50000000' : 'Ej. 50000000 / CINCUENTA MILLONES'
      });
    }

    // INMUEBLES - FINCA O MATRÍCULA
    const posFinca = getLastIndex(/(?:finca\b|matrícula\b|matricula\b)/i);
    if (posFinca !== -1) {
      candidates.push({
        pos: posFinca,
        instruccion: 'Insertar Finca o Matrícula',
        ayuda: 'Número de Finca o Matrícula Inmobiliaria registrada ante la DGRP.',
        placeholder: 'Ej. Finca Nº 12.345'
      });
    }

    // INMUEBLES - PADRÓN
    const posPadron = getLastIndex(/(?:padrón\b|padron\b)/i);
    if (posPadron !== -1) {
      candidates.push({
        pos: posPadron,
        instruccion: 'Insertar Número de Padrón',
        ayuda: 'Número de Padrón Catastral del inmueble.',
        placeholder: 'Ej. Padrón Nº 8.910'
      });
    }

    // INMUEBLES - LOTE O MANZANA
    const posLote = getLastIndex(/(?:lote\b|manzana\b)/i);
    if (posLote !== -1) {
      candidates.push({
        pos: posLote,
        instruccion: 'Insertar Lote o Manzana',
        ayuda: 'Individualización de Lote o Manzana conforme al plano catastral.',
        placeholder: 'Ej. Lote 04'
      });
    }

    // INMUEBLES - DISTRITO O LOCALIDAD
    const posDistrito = getLastIndex(/(?:distrito\b|localidad\b)/i);
    if (posDistrito !== -1) {
      candidates.push({
        pos: posDistrito,
        instruccion: 'Insertar Distrito o Localidad',
        ayuda: 'Distrito o jurisdicción municipal donde se encuentra el inmueble.',
        placeholder: 'Ej. Distrito de San Lorenzo'
      });
    }

    // INMUEBLES - LINDEROS
    const posLinderos = getLastIndex(/(?:lindando\b|linderos\b|al\s+norte|al\s+sur|al\s+este|al\s+oeste)/i);
    if (posLinderos !== -1) {
      candidates.push({
        pos: posLinderos,
        instruccion: 'Insertar Lindero del Inmueble',
        ayuda: 'Nombre del propietario colindante o calle.',
        placeholder: 'Ej. Propiedad de Juan González'
      });
    }

    // INMUEBLES - MEDIDA O DIMENSIÓN
    const posMedida = getLastIndex(/(?:metros\b|mide\b)/i);
    if (posMedida !== -1) {
      candidates.push({
        pos: posMedida,
        instruccion: 'Insertar Medida o Dimensión',
        ayuda: 'Dimensión en metros lineales o superficie del terreno.',
        placeholder: 'Ej. 12,50'
      });
    }

    // INMUEBLES - INDIVIDUALIZACIÓN GENERAL
    const posBien = getLastIndex(/(?:siguiente\s+bien|objeto\b|inmueble\b)/i);
    if (posBien !== -1) {
      candidates.push({
        pos: posBien,
        instruccion: 'Insertar Individualización del Bien',
        ayuda: 'Descripción detallada o individualización registral del bien transferido.',
        placeholder: 'Ej. Inmueble individualizado con Finca Nº 12.345, Padrón 8.910...'
      });
    }

    // FECHAS - DÍA DEL OTORGAMIENTO
    const posDia = getLastIndex(/(?:días\b|dias\b|a\s+los\b)/i);
    if (posDia !== -1) {
      candidates.push({
        pos: posDia,
        instruccion: 'Insertar Día del Otorgamiento',
        ayuda: 'Día del mes en que se redacta el instrumento notarial.',
        placeholder: 'Ej. 15 / quince'
      });
    }

    // FECHAS - MES DE CELEBRACIÓN
    const posMes = getLastIndex(/(?:mes\s+de|mes\b)/i);
    if (posMes !== -1) {
      candidates.push({
        pos: posMes,
        instruccion: 'Insertar Mes de Celebración',
        ayuda: 'Nombre del mes correspondiente a la fecha de firma.',
        placeholder: 'Ej. octubre'
      });
    }

    // FECHAS - AÑO DE OTORGAMIENTO
    const posAnio = getLastIndex(/(?:año\s+de|del\s+año|del\s+ano|año\b|ano\b)/i);
    if (posAnio !== -1) {
      candidates.push({
        pos: posAnio,
        instruccion: 'Insertar Año de Otorgamiento',
        ayuda: 'Año de otorgamiento del instrumento notarial.',
        placeholder: 'Ej. 2026 / dos mil veintiséis'
      });
    }

    // SELECCIÓN POR PRIORIDAD DE PROXIMIDAD:
    // Se elige el candidato cuya palabra clave finaliza más cerca del espacio _______
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.pos - a.pos);
      const mejorCandidato = candidates[0];
      return {
        instruccion: mejorCandidato.instruccion,
        ayuda: mejorCandidato.ayuda,
        placeholder: mejorCandidato.placeholder
      };
    }

    // 3. LIMPIEZA DEL TÍTULO GENÉRICO (FALLBACK LIMPIO SIN RUIDO, SIN FECHAS Y SIN CARACTERES EXTRAÑOS)
    // Se limpia cualquier residuo con .replace() para descartar fechas (ej. 2026), saltos y símbolos
    const fragmentoLimpio = plainBefore
      .slice(-40)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\b(año|ano)?\s*20\d{2}\b/gi, '') // Eliminar residuos de años/fechas como 2026
      .replace(/_{2,}/g, '') // Eliminar guiones bajos
      .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, ' ') // Eliminar signos extraños
      .replace(/\s+/g, ' ')
      .trim();

    return {
      instruccion: 'Completar campo faltante...',
      ayuda: fragmentoLimpio.length > 3
        ? `Complete el dato requerido para: "${fragmentoLimpio}".`
        : 'Complete el dato notarial correspondiente para continuar con el autocompletado del documento.',
      placeholder: 'Ingrese el dato requerido...'
    };
  }, [editorText, totalBlanks]);

  // Mensaje o instrucción del asistente de autocompletado si hay espacios en blanco activos
  const mensajeAsistente = totalBlanks > 0 && currentBlankContext ? currentBlankContext.instruccion : null;

  // Condición de Modo Autocompletado Activo:
  // Se oculta la cabecera completa si mensajeAsistente tiene algún valor (modo llenado paso a paso),
  // y solo se restaura cuando termina (mensajeAsistente === null / sin espacios pendientes) o al seleccionar 'Hoja en Blanco'.
  const condicionAutocompletado = Boolean(mensajeAsistente) && selectedPlantillaId !== 'hoja_en_blanco';

  // Lógica inteligente de visibilidad de la barra de herramientas de formato de texto (Negrita, Cursiva, Alineación, Listas)
  // Oculta si el asistente flotante está activo con espacios pendientes.
  // Visible si:
  // 1. Es 'Hoja en Blanco (Redacción Libre)'
  // 2. Se está editando un documento existente (abierto desde la grilla)
  // 3. Se completó el 100% de los espacios en blanco (mensajeAsistente === null o totalBlanks === 0)
  const mostrarBarraHerramientas = 
    selectedPlantillaId === 'hoja_en_blanco' ||
    editandoDocumentoExistente ||
    totalBlanks === 0 ||
    !mensajeAsistente;

  // =========================================================================
  // MOTOR DE AUTOCOMPLETADO SILENCIOSO Y CÁLCULOS MATEMÁTICOS (CONTEXT-AWARENESS)
  // =========================================================================
  const intentarResolverEspacioSilencioso = (
    htmlContent: string,
    memoriaActual: Record<string, any>
  ): { resolved: boolean; newHtml: string; newMemoria: Record<string, any> } => {
    let startIndex = -1;
    let matchLength = 0;

    const spanMatch = htmlContent.match(/<span id="espacio-activo"[^>]*>.*?<\/span>/i);
    if (spanMatch && spanMatch.index !== undefined) {
      startIndex = spanMatch.index;
      matchLength = spanMatch[0].length;
    } else {
      const rawMatch = htmlContent.match(/_{3,}/);
      if (rawMatch && rawMatch.index !== undefined) {
        startIndex = rawMatch.index;
        matchLength = rawMatch[0].length;
      }
    }

    if (startIndex === -1) {
      return { resolved: false, newHtml: htmlContent, newMemoria: memoriaActual };
    }

    const textBefore = htmlContent.substring(0, startIndex);
    const textAfter = htmlContent.substring(startIndex + matchLength);

    const regexGsAfter = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i;
    const matchGs = textAfter.match(regexGsAfter);

    const plainBefore = textBefore
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    const plainAfter = textAfter
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .toLowerCase();

    const sanitizedWords = plainBefore
      .replace(/[,;:"'«»“”\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const last4Words = sanitizedWords.slice(-4).join(' ').toLowerCase();
    const last2Words = sanitizedWords.slice(-2).join(' ').toLowerCase();
    const lastWord = sanitizedWords.slice(-1).join(' ').toLowerCase();

    // 1. REGLA 1: AUTO-CÁLCULO DE VALOR NOMINAL (MATEMÁTICA AUTOMÁTICA)
    // Cuando el analizador de contexto detecte que el siguiente espacio corresponde al 'Valor nominal'
    // o 'Monto o Capital Social (Bloque Nominal)', el sistema DEBE calcular automáticamente:
    // memoria.capitalTotal / memoria.totalAcciones
    // Luego convertirá el resultado a formato GUARANÍES [LETRAS] (Gs. [NÚMEROS]) y lo inyectará directamente,
    // saltando la pregunta al usuario.
    const isValorNominal =
      last4Words.includes('valor nominal') ||
      last2Words.includes('valor nominal') ||
      lastWord === 'nominal';

    const capTotal = typeof memoriaActual.capitalTotal === 'number' && memoriaActual.capitalTotal > 0
      ? memoriaActual.capitalTotal
      : (typeof memoriaActual.capital === 'number' && memoriaActual.capital > 0 ? memoriaActual.capital : 0);

    const totAcc = typeof memoriaActual.totalAcciones === 'number' && memoriaActual.totalAcciones > 0
      ? memoriaActual.totalAcciones
      : (typeof memoriaActual.acciones === 'number' && memoriaActual.acciones > 0 ? memoriaActual.acciones : 0);

    if (isValorNominal && capTotal > 0 && totAcc > 0) {
      const valorNominal = Math.floor(capTotal / totAcc);
      const letras = numeroALetras(valorNominal);
      const numFormateado = valorNominal.toLocaleString('es-PY');
      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      let textoFinal = '';
      let gsBlockLength = 0;

      if (matchGs) {
        gsBlockLength = matchGs[0].length;
        if (endsWithGuaranies) {
          textoFinal = `${letras} (Gs. ${numFormateado})`;
        } else {
          textoFinal = `GUARANÍES ${letras} (Gs. ${numFormateado})`;
        }
      } else {
        textoFinal = `${numFormateado} (${letras})`;
      }

      const newHtml = textBefore + textoFinal + textAfter.substring(gsBlockLength);
      const newMemoria = { ...memoriaActual, valorNominal, capitalTotal: capTotal, totalAcciones: totAcc };
      return { resolved: true, newHtml, newMemoria };
    }

    // 2. REGLA 2: AUTOCOMPLETADO SILENCIOSO - DENOMINACIÓN SOCIAL
    // Si el espacio requiere el Nombre de la Empresa y ya está en memoria:
    const isDenominacion =
      last4Words.includes('denominará') ||
      last4Words.includes('denominara') ||
      last4Words.includes('denominada') ||
      last4Words.includes('denominación') ||
      last4Words.includes('denominacion') ||
      (last4Words.includes('sociedad') && plainAfter.startsWith('s.a'));

    if (isDenominacion && memoriaActual.denominacion && memoriaActual.denominacion.trim().length > 0) {
      const newHtml = textBefore + memoriaActual.denominacion + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    // 3. REGLA 2: AUTOCOMPLETADO SILENCIOSO - COMPARECIENTES EN SUSCRIPCIÓN
    // Si en la suscripción se pide el nombre del socio (ej. "a) _______ suscribe"):
    const isSuscripcionCompareciente =
      plainAfter.startsWith('suscribe') ||
      plainAfter.startsWith('suscriben');

    if (
      isSuscripcionCompareciente &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      const incisoMatch = plainBefore.match(/([a-z]|\d+)\)\s*$/i);
      let socioIndex = 0;
      if (incisoMatch) {
        const letra = incisoMatch[1].toLowerCase();
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        const foundIdx = alphabet.indexOf(letra);
        if (foundIdx !== -1) {
          socioIndex = foundIdx;
        } else if (/^\d+$/.test(letra)) {
          socioIndex = parseInt(letra, 10) - 1;
        }
      }

      if (socioIndex >= 0 && socioIndex < memoriaActual.comparecientes.length) {
        const nombreSocio = memoriaActual.comparecientes[socioIndex];
        const newHtml = textBefore + nombreSocio + textAfter;
        return { resolved: true, newHtml, newMemoria: memoriaActual };
      }
    }

    // 4. REGLA 2: CÁLCULO AUTOMÁTICO DE MONTO SUSCRIPTO POR SOCIO (ACCIONES * VALOR NOMINAL)
    // Cuando el usuario ingrese la cantidad de acciones que suscribe un socio (ej. 25),
    // el inmediatamente siguiente espacio de 'Monto en Guaraníes' debe ser autocompletado multiplicando 25 * memoria.valorNominal.
    const matchAccionesEnLinea = plainBefore.match(/(\d+[\d\.]*)\s+acciones\s+ordinarias,\s+representativas\s+de\s+(guaraníes|guaranies)?\s*$/i) ||
      plainBefore.match(/(\d+[\d\.]*)\s+acciones.*?representativas\s+de\s+(guaraníes|guaranies)?\s*$/i);

    const cantAccEncontrada = matchAccionesEnLinea
      ? parseInt(matchAccionesEnLinea[1].replace(/\./g, ''), 10)
      : (typeof memoriaActual.ultimaAccionesSocio === 'number' && memoriaActual.ultimaAccionesSocio > 0 ? memoriaActual.ultimaAccionesSocio : null);

    const isMontoSuscripcion = plainBefore.includes('representativas de') || last4Words.includes('representativas de') || last4Words.includes('representativa de');

    if (
      (matchAccionesEnLinea || isMontoSuscripcion) &&
      cantAccEncontrada &&
      typeof memoriaActual.valorNominal === 'number' &&
      memoriaActual.valorNominal > 0
    ) {
      const montoSocio = cantAccEncontrada * memoriaActual.valorNominal;
      const letras = numeroALetras(montoSocio);
      const numForm = montoSocio.toLocaleString('es-PY');
      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      let textoFinal = '';
      let gsBlockLength = 0;
      if (matchGs) {
        gsBlockLength = matchGs[0].length;
        if (endsWithGuaranies) {
          textoFinal = `${letras} (Gs. ${numForm})`;
        } else {
          textoFinal = `GUARANÍES ${letras} (Gs. ${numForm})`;
        }
      } else {
        textoFinal = `${numForm} (${letras})`;
      }

      const newHtml = textBefore + textoFinal + textAfter.substring(gsBlockLength);
      const newMemoria = { ...memoriaActual, ultimaAccionesSocio: undefined };
      return { resolved: true, newHtml, newMemoria };
    }

    // 5. RECICLAJE DE NOMBRES EN DISPOSICIONES TRANSITORIAS (PRIMER DIRECTORIO)
    // En el apartado de Disposiciones Transitorias (donde se designa el primer Directorio),
    // el código debe recuperar automáticamente los nombres de los socios guardados en el estado memoria (memoria.comparecientes)
    // e inyectarlos directamente en el texto como Presidente y Directores Titulares, sin volver a preguntarle al usuario.
    const ultimos35 = plainBefore.slice(-35).toLowerCase();

    const isDesignacionPresidente =
      ultimos35.includes('presidente del directorio') ||
      ultimos35.includes('presidente:') ||
      (ultimos35.includes('presidente') && plainBefore.toLowerCase().includes('transitorias'));

    if (
      isDesignacionPresidente &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      const nombrePresidente = memoriaActual.comparecientes[0];
      const newHtml = textBefore + nombrePresidente + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    const isDesignacionDirector =
      (ultimos35.includes('director titular') ||
       ultimos35.includes('directores titulares') ||
       (ultimos35.includes('director') && plainBefore.toLowerCase().includes('transitorias'))) &&
      !ultimos35.includes('presidente');

    if (
      isDesignacionDirector &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      // Si hay más socios, asigna el socio 2 (o sucesivos según la cantidad de directores ya inyectados)
      const matchesDirectores = plainBefore.match(/director titular:\s*don\/doña\s+([^;]+)/gi) || [];
      const indexSocio = 1 + matchesDirectores.length;
      const nombreDirector = memoriaActual.comparecientes[indexSocio] || memoriaActual.comparecientes[1] || memoriaActual.comparecientes[0];
      const newHtml = textBefore + nombreDirector + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    return { resolved: false, newHtml: htmlContent, newMemoria: memoriaActual };
  };

  // =========================================================================
  // FOCO VISUAL, SINCRONIZACIÓN Y AUTO-SCROLL CONTEXTUAL
  // =========================================================================

  // Resaltado visual del espacio en blanco activo con resolución silenciosa previa:
  useEffect(() => {
    if (!mostrarEditor || selectedPlantillaId === 'hoja_en_blanco') return;

    // Si hay espacios en blanco pendientes, verificar si alguno se puede resolver silenciosamente
    if (/_{3,}/.test(editorText)) {
      const res = intentarResolverEspacioSilencioso(editorText, memoria);
      if (res.resolved) {
        let finalHtml = res.newHtml;
        let finalMem = res.newMemoria;
        let maxIt = 15;
        while (maxIt > 0) {
          maxIt--;
          const nextRes = intentarResolverEspacioSilencioso(finalHtml, finalMem);
          if (nextRes.resolved) {
            finalHtml = nextRes.newHtml;
            finalMem = nextRes.newMemoria;
          } else {
            break;
          }
        }

        if (/_{3,}/.test(finalHtml) && !finalHtml.includes('id="espacio-activo"')) {
          finalHtml = finalHtml.replace(
            /_{3,}/,
            '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
          );
        }

        setEditorText(finalHtml);
        setMemoria(finalMem);
        if (editorContentRef.current) {
          editorContentRef.current.innerHTML = finalHtml;
        }
        return;
      }
    }

    if (/_{3,}/.test(editorText) && !editorText.includes('id="espacio-activo"')) {
      const textoConEspacioActivo = editorText.replace(
        /_{3,}/,
        '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
      );
      setEditorText(textoConEspacioActivo);
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = textoConEspacioActivo;
      }
    }
  }, [mostrarEditor, selectedPlantillaId, editorText, memoria]);

  // Auto-Scroll Contextual (Acompañamiento Dinámico):
  useEffect(() => {
    if (!mostrarEditor || totalBlanks === 0) return;

    const timer = setTimeout(() => {
      const espacioActivo = document.getElementById('espacio-activo');
      if (espacioActivo) {
        espacioActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [totalBlanks, currentBlankContext?.instruccion, mostrarEditor]);

  // Auto-Focus Directo al Asistente Flotante (Flujo de Teclado Continuo):
  // Ejecuta un .focus() manual sobre autofillInputRef cada vez que el estado mensajeAsistente
  // (o el título/instrucción de la ventanita) cambie, asegurando que el cursor no quede atascado en el contentEditable.
  useEffect(() => {
    if (mostrarEditor && condicionAutocompletado && mensajeAsistente) {
      const focusTimer = setTimeout(() => {
        if (autofillInputRef.current) {
          autofillInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(focusTimer);
    }
  }, [mensajeAsistente, currentBlankContext?.instruccion, mostrarEditor, condicionAutocompletado]);

  // =========================================================================
  // HISTORIAL DE ESTADOS Y DESHACER (RETROCEDER) DEL ASISTENTE FLOTANTE
  // =========================================================================
  const handleRetroceder = () => {
    if (historialTextos.length === 0) return;
    const nuevoHistorial = [...historialTextos];
    const textoPrevio = nuevoHistorial.pop();
    setHistorialTextos(nuevoHistorial);
    if (textoPrevio !== undefined) {
      setEditorText(textoPrevio);
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = textoPrevio;
      }
      setAutofillInput('');
      setMostrarTooltipAyuda(false);
      setTimeout(() => {
        const espacioActivo = document.getElementById('espacio-activo');
        if (espacioActivo) {
          espacioActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        autofillInputRef.current?.focus();
      }, 100);
    }
  };

  // =========================================================================
  // INYECCIÓN DE DATOS: MOTOR INTERCEPTOR, SMART REPLACE Y MEMORIA GLOBAL
  // =========================================================================
  const handleAplicarAutofill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const valorOriginal = autofillInput.trim();
    if (!valorOriginal) return;

    // Guardar copia exacta del texto actual en el historial de estados antes de la inyección
    const container = editorContentRef.current;
    const htmlBase = container ? container.innerHTML : editorText;
    setHistorialTextos(prev => [...prev, htmlBase]);

    // 1. MOTOR INTERCEPTOR DE NÚMEROS A LETRAS
    const soloDigitos = valorOriginal.replace(/\./g, '').replace(/,/g, '').trim();
    const esNumeroPuro = /^\d+$/.test(soloDigitos) && soloDigitos.length > 0;

    let textoFinal = '';
    let numVal = 0;
    let letras = '';
    let numFormateado = '';

    if (esNumeroPuro) {
      numVal = parseInt(soloDigitos, 10);
      numFormateado = numVal.toLocaleString('es-PY');
      letras = numeroALetras(numVal);
      // Formato legal notarial requerido: 50.000.000 (CINCUENTA MILLONES)
      textoFinal = `${numFormateado} (${letras})`;
    } else {
      textoFinal = valorOriginal.toUpperCase();
    }

    // 2. ACTUALIZACIÓN DEL DICCIONARIO DE MEMORIA (REGLA 1 & REGLA 2)
    const nuevaMemoria: Record<string, any> = { ...memoria };
    const instruccionActual = currentBlankContext?.instruccion || '';

    if (
      instruccionActual.includes('Denominación') ||
      instruccionActual.includes('Razón Social')
    ) {
      const denomLimpia = valorOriginal.toUpperCase().replace(/\s+S\.?A\.?$/i, '').trim();
      nuevaMemoria.denominacion = denomLimpia;
    } else if (
      (instruccionActual.includes('Monto') || instruccionActual.includes('Capital Social')) &&
      esNumeroPuro
    ) {
      nuevaMemoria.capital = numVal;
      nuevaMemoria.capitalTotal = numVal;
      nuevaMemoria.capitalFormateado = numFormateado;
      nuevaMemoria.capitalLetras = letras;
    } else if (
      instruccionActual.includes('Cantidad de Acciones') &&
      !instruccionActual.includes('Suscriptas') &&
      esNumeroPuro
    ) {
      nuevaMemoria.acciones = numVal;
      nuevaMemoria.totalAcciones = numVal;
    } else if (
      instruccionActual.includes('Cantidad de Acciones Suscriptas') &&
      esNumeroPuro
    ) {
      nuevaMemoria.accionesSuscriptas = numVal;
      nuevaMemoria.ultimaAccionesSocio = numVal;
    } else if (
      (instruccionActual.includes('Compareciente') || instruccionActual.includes('Nombre')) &&
      !instruccionActual.includes('Presidente') &&
      !instruccionActual.includes('Director') &&
      !instruccionActual.includes('Síndico')
    ) {
      const socioUpper = valorOriginal.toUpperCase().trim();
      const socios = [...(nuevaMemoria.comparecientes || [])];
      if (!socios.includes(socioUpper)) {
        socios.push(socioUpper);
      }
      nuevaMemoria.comparecientes = socios;
    } else if (
      instruccionActual.includes('Valor Nominal') &&
      esNumeroPuro
    ) {
      nuevaMemoria.valorNominal = numVal;
    }

    // 3. INYECCIÓN LIMPIA CON SMART REPLACE (REGLA 3: Inyección de Bloques Monetarios)
    // Si el asistente pide un monto y el documento tiene el formato GUARANÍES _______ (Gs. _______) o similar,
    // al ingresar un número (ej. 50000000), formatea y reemplaza el bloque completo por
    // GUARANÍES CINCUENTA MILLONES (Gs. 50.000.000), evitando espacios residuales o duplicaciones.

    let startIndex = -1;
    let matchLength = 0;

    const spanMatch = htmlBase.match(/<span id="espacio-activo"[^>]*>.*?<\/span>/i);
    if (spanMatch && spanMatch.index !== undefined) {
      startIndex = spanMatch.index;
      matchLength = spanMatch[0].length;
    } else {
      const rawMatch = htmlBase.match(/_{3,}/);
      if (rawMatch && rawMatch.index !== undefined) {
        startIndex = rawMatch.index;
        matchLength = rawMatch[0].length;
      }
    }

    let nuevoHtml = '';
    if (startIndex !== -1) {
      const textBefore = htmlBase.substring(0, startIndex);
      const textAfter = htmlBase.substring(startIndex + matchLength);

      const regexGs = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i;
      const matchGs = textAfter.match(regexGs);

      const plainBefore = textBefore
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();

      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      if (matchGs && esNumeroPuro) {
        const gsBlockLength = matchGs[0].length;
        const bloqueMonetario = endsWithGuaranies
          ? `${letras} (Gs. ${numFormateado})`
          : `GUARANÍES ${letras} (Gs. ${numFormateado})`;
        nuevoHtml = textBefore + bloqueMonetario + textAfter.substring(gsBlockLength);
      } else {
        nuevoHtml = textBefore + textoFinal + textAfter;
      }
    } else {
      nuevoHtml = htmlBase;
    }

    // 4. BUCLE DE AUTOCOMPLETADO SILENCIOSO Y CÁLCULOS MATEMÁTICOS (REGLAS 2 Y 4)
    // Inyecta automáticamente datos ya presentes en memoria o calcula automáticamente
    // el valor nominal / montos suscriptos sin volver a solicitar datos redundantes.
    let iterHtml = nuevoHtml;
    let iterMemoria = nuevaMemoria;
    let continueResolving = true;
    let maxIterations = 20;

    while (continueResolving && maxIterations > 0) {
      maxIterations--;
      const res = intentarResolverEspacioSilencioso(iterHtml, iterMemoria);
      if (res.resolved) {
        iterHtml = res.newHtml;
        iterMemoria = res.newMemoria;
      } else {
        continueResolving = false;
      }
    }

    // 5. RESALTAR EL SIGUIENTE ESPACIO VACÍO PENDIENTE (SI QUEDAN MÁS)
    if (/_{3,}/.test(iterHtml)) {
      iterHtml = iterHtml.replace(
        /_{3,}/,
        '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
      );
    }

    if (container) {
      container.innerHTML = iterHtml;
    }
    setEditorText(iterHtml);
    setMemoria(iterMemoria);
    setAutofillInput('');
    setMostrarTooltipAyuda(false);

    // Si ya no quedan espacios en blanco, scroll suave al inicio
    if (!/_{3,}/.test(iterHtml)) {
      setTimeout(() => {
        const bloque = document.getElementById('editor-notarial-activo-bloque');
        bloque?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } else {
      setTimeout(() => {
        autofillInputRef.current?.focus();
      }, 50);
    }
  };

  // Click outside listener para menú contextual
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Carpetas configuradas
  const defaultCarpetas: Carpeta[] = [
    { id: '1', nombre: 'Compraventa', orden: 1, predeterminada: true },
    { id: '2', nombre: 'Pagarés', orden: 2, predeterminada: true },
    { id: '3', nombre: 'Alquiler', orden: 3, predeterminada: true },
    { id: '4', nombre: 'Contratos Privados', orden: 4, predeterminada: true },
    { id: '5', nombre: 'Traspasos', orden: 5, predeterminada: true }
  ];

  const userCarpetas: Carpeta[] = userProfile?.carpetas || defaultCarpetas;
  const sortedCarpetas = React.useMemo(() => [...userCarpetas].sort((a, b) => a.orden - b.orden), [userCarpetas]);

  const extractedCategories = React.useMemo(() => 
    Array.from(new Set(escritos.map(e => e.categoria).filter(c => c && c !== 'Sin Categoría' && !sortedCarpetas.some(sc => sc.nombre === c)))) as string[]
  , [escritos, sortedCarpetas]);
  
  const categorias = ['Todos', ...sortedCarpetas.map(c => c.nombre), ...extractedCategories];

  const allCarpetasToAdmin = React.useMemo(() => {
    const combined: Carpeta[] = [...sortedCarpetas];
    let nextOrder = combined.length > 0 ? Math.max(...combined.map(c => c.orden)) + 1 : 1;
    extractedCategories.forEach(catName => {
      combined.push({
        id: `extracted-${catName.toLowerCase().replace(/\s+/g, '-')}`,
        nombre: catName,
        orden: nextOrder++,
        predeterminada: false
      });
    });
    return combined;
  }, [sortedCarpetas, extractedCategories]);

  // FASE 2: Sincronización en tiempo real de Documentos Olga por Workspace
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'documentos_olga'), where('userId', '==', workspaceId));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docsMap = new Map<string, Escrito>();
        querySnapshot.forEach((d) => {
          const data = d.data();
          let categoria = data.categoria || 'Sin Categoría';
          if (!data.categoria && data.tipo) {
            const lowerTipo = data.tipo.toLowerCase();
            if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
            else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
            else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
            else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
            else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
          }
          docsMap.set(d.id, { id: d.id, ...data, categoria } as Escrito);
        });

        // Leer documentos temporales del localStorage SOLO si no existen ya en Firestore
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          try {
            const tempDocs = JSON.parse(tempDocsString);
            const remainingTempDocs: any[] = [];
            tempDocs.forEach((tDoc: any, idx: number) => {
              if (tDoc.userId === workspaceId || tDoc.userId === auth?.currentUser?.uid) {
                // Filtro para evitar duplicación visual de escritos ya sincronizados desde Firestore
                const yaExisteEnFirestore = Array.from(docsMap.values()).some(
                  d => d.texto?.trim() === tDoc.texto?.trim() && d.tipo?.replace(' (Guardado Local)', '') === tDoc.tipo?.replace(' (Guardado Local)', '')
                );
                if (!yaExisteEnFirestore) {
                  remainingTempDocs.push(tDoc);
                  let categoria = tDoc.categoria || 'Sin Categoría';
                  if (!tDoc.categoria && tDoc.tipo) {
                    const lowerTipo = tDoc.tipo.toLowerCase();
                    if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
                    else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
                    else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
                    else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
                    else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
                  }
                  docsMap.set(`temp-${idx}`, {
                    id: `temp-${idx}`,
                    texto: tDoc.texto,
                    tipo: `${tDoc.tipo} (Guardado Local)`,
                    categoria: categoria,
                    userId: tDoc.userId,
                    fechaCreacion: {
                      toMillis: () => new Date(tDoc.fechaCreacion).getTime(),
                      toDate: () => new Date(tDoc.fechaCreacion)
                    } as any
                  });
                }
              }
            });
            // Si algunos ya fueron sincronizados en Firestore, depurar el respaldo local para evitar residuos
            if (remainingTempDocs.length !== tempDocs.length) {
              localStorage.setItem('escritos_temporales', JSON.stringify(remainingTempDocs));
            }
          } catch (e) {
            console.error('Error parsing temp docs', e);
          }
        }

        const docs = Array.from(docsMap.values());
        docs.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.fechaCreacion?.toMillis?.() || 0);
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.fechaCreacion?.toMillis?.() || 0);
          return timeB - timeA;
        });

        setEscritos(docs);
        setLoading(false);
      },
      (err: any) => {
        if (err.code === 'permission-denied') {
          console.warn('Permisos denegados temporalmente al cargar escritos.', err);
          setError('No se pudieron cargar los documentos en este momento.');
        } else {
          console.error('Error fetching escritos:', err);
          setError('Error al sincronizar escritos.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [workspaceId]); // Dependencia única

  const getPersonaActiva = () => {
    try {
      if (personas && Array.isArray(personas) && personas.length > 0) {
        return personas[0];
      }
      const rawDirectorio = localStorage.getItem('olga_directorio_personas');
      if (rawDirectorio) {
        const parsed = JSON.parse(rawDirectorio);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch (e) {
      console.warn('Error obteniendo persona activa:', e);
    }
    return null;
  };

  // Manejo del selector de plantillas:
  // Al seleccionar cualquier plantilla (o Hoja en Blanco), se despliega inmediatamente el Editor Notarial Activo.
  const handleSelectPlantilla = (plantillaId: string) => {
    if (!plantillaId) return;
    setMostrarEditor(true);
    setEditandoDocumentoExistente(false);
    setSelectedPlantillaId(plantillaId);
    setMemoria({});

    let textoParaEditor = '';
    const found = PLANTILLAS_NOTARIALES.find(p => p.id === plantillaId);
    if (!found || plantillaId === 'hoja_en_blanco') {
      // Limpieza total del editor
      textoParaEditor = '';
      setEditorText('');
      setDocumentTitle('Escrito en Blanco');
      setSelectedCategoryForSave('Contratos Privados');
    } else if (plantillaId === 'constitucion_sa') {
      // Generador Dinámico de Socios (Prompt Inicial):
      // Pregunta al usuario la cantidad de socios que conformarán la S.A.
      let numSocios = 2;
      try {
        const respuestaPrompt = window.prompt('¿Cuántos socios conformarán la S.A.? (Ej. 2, 3, 4)', '2');
        if (respuestaPrompt !== null) {
          const parsed = parseInt(respuestaPrompt.trim(), 10);
          if (!isNaN(parsed) && parsed >= 1) {
            numSocios = parsed;
          }
        }
      } catch (err) {
        console.warn('Error al solicitar cantidad de socios:', err);
      }

      // Reconstruye el texto con N comparecientes sin datos pre-cargados de usuario
      textoParaEditor = construirConstitucionSA(numSocios);
      setEditorText(textoParaEditor);
      setDocumentTitle('Constitución de S.A.');
      setSelectedCategoryForSave('Contratos Privados');
    } else {
      // Plantillas limpias con espacios en blanco (_______)
      textoParaEditor = procesarAutofillPlantilla(found.contenido);
      setEditorText(textoParaEditor);
      setDocumentTitle(found.nombre);
      setSelectedCategoryForSave(found.categoriaSugerida);
    }

    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = textoParaEditor;
    }

    setTimeout(() => {
      const editorBloque = document.getElementById('editor-notarial-activo-bloque');
      if (editorBloque) {
        editorBloque.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (editorContentRef.current) {
        if (editorContentRef.current.innerHTML !== textoParaEditor) {
          editorContentRef.current.innerHTML = textoParaEditor;
        }
      }
      if (plantillaId === 'hoja_en_blanco') {
        if (editorContentRef.current) {
          editorContentRef.current.focus();
        }
      } else {
        // En plantillas con autocompletado, enfocar de inmediato el campo del Asistente Flotante
        autofillInputRef.current?.focus();
      }
    }, 100);
  };

  // Botón explícito para '+ Nuevo Escrito' (despliega el editor en hoja limpia)
  const handleNuevoEscrito = () => {
    setSelectedPlantillaId('hoja_en_blanco');
    setEditandoDocumentoExistente(false);
    setActiveEditingDoc(null);
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
    setMostrarEditor(true);
    setMemoria({});
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = '';
    }
    setTimeout(() => {
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = '';
      }
      if (editorTextareaRef.current) {
        editorTextareaRef.current.focus();
        editorTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const el = document.getElementById('editor-notarial-activo-bloque');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Botón explícito para limpiar completamente el editor (Hoja en Blanco)
  const handleLimpiarEditor = () => {
    setSelectedPlantillaId('hoja_en_blanco');
    setEditandoDocumentoExistente(false);
    setActiveEditingDoc(null);
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
    setShowSplitScreen(false);
    setMemoria({});
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = '';
    }
  };

  // Copiar contenido al portapapeles
  const handleCopiarTexto = () => {
    if (!editorText) return;
    navigator.clipboard.writeText(editorText);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  // Guardar escrito en base de datos y localStorage
  const handleGuardarEscrito = async () => {
    if (!editorText.trim()) {
      alert('El documento está vacío. Escriba o seleccione una plantilla antes de guardar.');
      return;
    }

    const user = auth?.currentUser;
    if (!user) {
      alert('Debes iniciar sesión para guardar el escrito.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const tipoDoc = documentTitle.trim() || 'Escrito Notarial';
      const cat = selectedCategoryForSave || 'Contratos Privados';

      // Limpiar etiquetas temporales de resaltado antes de persistir
      const textoLimpio = editorText.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1');

      if (!workspaceId) {
        console.error("Operación abortada: Workspace no identificado.");
        setIsSavingDraft(false);
        return;
      }

      const creatorName = (currentUser as any)?.nombre || userProfile?.nombre || userProfile?.razonSocial || (currentUser as any)?.displayName || currentUser?.email?.split('@')[0] || (user as any)?.displayName || user?.email?.split('@')[0] || 'Usuario';
      const creatorRole = (currentUser as any)?.role || (currentUser as any)?.rol || userProfile?.rol || userProfile?.role || 'titular';

      const docId = activeEditingDoc?.id;
      const isExistingFirestoreDoc = !!(docId && !docId.startsWith('temp-'));

      if (isExistingFirestoreDoc && docId) {
        // ACTUALIZACIÓN DIRECTA (updateDoc) SOBRE EL DOCUMENTO EXISTENTE
        const docRef = doc(db, 'documentos_olga', docId);
        await updateDoc(docRef, {
          texto: textoLimpio,
          tipo: tipoDoc,
          categoria: cat,
          ultimaModificacion: serverTimestamp(),
          lastModifiedBy: user?.uid,
          lastModifiedByName: creatorName
        });
      } else if (docId && docId.startsWith('temp-')) {
        // Actualización de borrador local
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          const tempDocs = JSON.parse(tempDocsString);
          const idx = parseInt(docId.replace('temp-', ''), 10);
          if (!isNaN(idx) && tempDocs[idx]) {
            tempDocs[idx].texto = textoLimpio;
            tempDocs[idx].tipo = tipoDoc;
            tempDocs[idx].categoria = cat;
            localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
          }
        }
      } else {
        // CREACIÓN DE NUEVO DOCUMENTO (addDoc)
        const nuevoDocData = {
          texto: textoLimpio,
          tipo: tipoDoc,
          userId: workspaceId,            // El propietario legal de los datos (Titular)
          creator_id: user?.uid,          // Rastro de auditoría: Quién lo digitó
          createdBy: user?.uid,
          creator_name: creatorName,
          creator_role: creatorRole,
          categoria: cat,
          createdAt: new Date().toISOString(),
          fechaCreacion: serverTimestamp()
        };
        await addDoc(collection(db, 'documentos_olga'), nuevoDocData);
      }

      // 3. Cerrar Editor Post-Guardado y resetear estado de edición activa
      setMostrarEditor(false);
      setShowSplitScreen(false);
      setSelectedPlantillaId('');
      setActiveEditingDoc(null);
      setEditandoDocumentoExistente(false);

      // 4. Mensaje Verde de Éxito con Toast
      const mensajeFinal = isExistingFirestoreDoc 
        ? `¡"${tipoDoc}" actualizado exitosamente en la carpeta ${cat}!`
        : `¡"${tipoDoc}" guardado exitosamente en la carpeta ${cat}!`;
      setMensajeExito(mensajeFinal);
      setSaveSuccessBanner(mensajeFinal);
      setTimeout(() => {
        setMensajeExito(null);
        setSaveSuccessBanner(null);
      }, 4500);

      // Desplazar suavemente a la cuadrícula de documentos guardados
      const seccionArchivo = document.getElementById('seccion-gestion-documental');
      if (seccionArchivo) {
        seccionArchivo.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error al guardar documento:', err);
      // Guardado como respaldo local de emergencia únicamente en caso de fallo de conexión
      try {
        const tipoDoc = documentTitle.trim() || 'Escrito Notarial';
        const cat = selectedCategoryForSave || 'Contratos Privados';
        const textoLimpio = editorText.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1');
        const rawTemp = localStorage.getItem('escritos_temporales');
        const list = rawTemp ? JSON.parse(rawTemp) : [];
        list.push({
          texto: textoLimpio,
          tipo: tipoDoc,
          userId: user.uid,
          categoria: cat,
          fechaCreacion: new Date().toISOString()
        });
        localStorage.setItem('escritos_temporales', JSON.stringify(list));
      } catch (backupErr) {
        console.warn('Error guardando copia local de emergencia:', backupErr);
      }
      alert('Ocurrió un error al guardar en la nube. Se ha respaldado una copia local.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Imprimir / Descargar como PDF con los estilos de la hoja notarial (Legal/Oficio y márgenes paraguayos)
  const handleImprimirPDF = () => {
    const rawContent = editorContentRef.current?.innerHTML || editorText;
    const content = rawContent.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1');
    if (!content || !content.trim()) {
      alert('El documento está vacío. Escriba o seleccione una plantilla antes de imprimir.');
      return;
    }

    const title = documentTitle.trim() || 'Escrito Notarial';
    const planStr = String(userProfile?.planActual || userProfile?.plan || 'trial').toLowerCase();
    const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador';
    const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
    const isApproved = String(userProfile?.estadoPago).toUpperCase() === 'APROBADO' || String(userProfile?.estadoPlataforma).toUpperCase() === 'APROBADO';
    const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('básico') || planStr.includes('basico') || isApproved || isWhitelisted;
    const isWatermarkRequired = !isPaidPlan;

    const htmlToPrint = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: legal portrait;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .hoja-notarial-print {
      width: 100%;
      max-width: 850px;
      margin: 0 auto;
      padding-top: 180px;
      padding-bottom: 100px;
      padding-left: 140px;
      padding-right: 60px;
      min-height: 1100px;
      box-sizing: border-box;
      font-size: 18px;
      line-height: 1.75;
      text-align: justify;
    }
    ul {
      list-style-type: disc !important;
      padding-left: 2rem !important;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }
    ol {
      list-style-type: decimal !important;
      padding-left: 2rem !important;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }
    li {
      display: list-item !important;
      margin-bottom: 0.25rem;
    }
    p {
      margin-bottom: 0.75rem;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .hoja-notarial-print {
        padding-top: 180px;
        padding-bottom: 100px;
        padding-left: 140px;
        padding-right: 60px;
      }
      ${isWatermarkRequired ? `
      .watermark {
        display: block !important;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 80px;
        color: rgba(255, 0, 0, 0.15);
        font-weight: bold;
        text-transform: uppercase;
        z-index: 9999;
        pointer-events: none;
        text-align: center;
        width: 100%;
        line-height: 1.2;
      }
      ` : ''}
    }
  </style>
</head>
<body>
  ${isWatermarkRequired ? '<div class="watermark">VERSIÓN DE PRUEBA - SÓLO PARA USO NO COMERCIAL</div>' : ''}
  <div class="hoja-notarial-print">
    ${content}
  </div>
</body>
</html>`;

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlToPrint);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
        }, 400);
        return;
      }
    } catch (e) {
      console.warn('window.open no disponible, usando fallback con iframe:', e);
    }

    // Fallback con iframe invisible en caso de que window.open sea bloqueado por el navegador/iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlToPrint);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1200);
      }, 400);
    }
  };

  // Manejo de archivos adjuntos para IA
  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAiError(null);
    Array.from(files).forEach(file => {
      if (file.size > 15 * 1024 * 1024) {
        setAiError(`El archivo "${file.name}" supera el límite permitido de 15 MB.`);
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      let detectedMime = file.type || '';
      if (!detectedMime || detectedMime === 'application/octet-stream') {
        if (ext === 'pdf') detectedMime = 'application/pdf';
        else if (ext === 'png') detectedMime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') detectedMime = 'image/jpeg';
        else if (ext === 'webp') detectedMime = 'image/webp';
        else if (ext === 'txt') detectedMime = 'text/plain';
      }

      // Si es un archivo de texto plano, leerlo directamente como texto
      if (ext === 'txt' || detectedMime === 'text/plain') {
        const textReader = new FileReader();
        textReader.onload = () => {
          const content = textReader.result as string;
          setAiPrompt(prev => {
            const prefix = prev ? `${prev}\n\n` : '';
            return `${prefix}[Texto adjunto de ${file.name}]:\n${content.slice(0, 10000)}`;
          });
        };
        textReader.readAsText(file);
        return;
      }

      // Para imágenes y PDFs, leer como DataURL para extraer base64 limpio
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        setAiAttachments(prev => [
          ...prev,
          {
            name: file.name,
            mimeType: detectedMime || 'application/pdf',
            data: base64Data,
            size: file.size
          }
        ]);
      };
      reader.onerror = () => {
        setAiError(`No se pudo leer el archivo "${file.name}".`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAiAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Generación asistida por IA
  const handleGenerarConIA = async () => {
    const planStr = String(userProfile?.planActual || userProfile?.plan || 'trial').toLowerCase();
    const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador';
    const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
    const isApproved = String(userProfile?.estadoPago).toUpperCase() === 'APROBADO' || String(userProfile?.estadoPlataforma).toUpperCase() === 'APROBADO';
    const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('básico') || planStr.includes('basico') || isApproved || isWhitelisted;

    if (!isPaidPlan && (isTrialExpired || diasRestantes <= 0 || !pruebaActiva)) {
      setAiError('Tu período de prueba gratuita de 5 días ha finalizado. Por favor, adquiere o renueva un plan en la sección "Planes y Precios" para continuar redactando con IA.');
      return;
    }

    if (!aiPrompt.trim() && aiAttachments.length === 0) {
      setAiError('Por favor, ingresa una instrucción o adjunta un archivo para redactar con IA.');
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const resultado = await redactarEscritoConIA(
        aiPrompt.trim(),
        editorText.trim(),
        aiAttachments.map(att => ({ data: att.data, mimeType: att.mimeType, name: att.name }))
      );

      if (!resultado || !resultado.trim()) {
        setAiError('La IA no devolvió contenido para esta solicitud. Por favor, reformula tu instrucción.');
        return;
      }

      // Flujo de Revisión Previa: El texto NO se sobreescribe de inmediato en el documento.
      // Se carga en la caja de previsualización para que el usuario pueda revisarlo y editarlo libremente.
      setAiDraftProposal(resultado);
    } catch (err: any) {
      console.warn('Aviso de generación con IA:', err);
      const displayMsg = err?.message || 'Error al conectar con el servicio de IA.';
      setAiError(displayMsg);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Botón explícito de Inserción / Aprobación
  const handleInsertarEnDocumento = (modo: 'anexar' | 'reemplazar' = 'anexar') => {
    if (!aiDraftProposal) return;

    let nuevoTexto = '';
    if (modo === 'reemplazar' || !editorText.trim()) {
      nuevoTexto = aiDraftProposal.trim();
    } else {
      nuevoTexto = `${editorText.trim()}\n\n${aiDraftProposal.trim()}`;
    }

    setEditorText(nuevoTexto);
    // Desplegar el editor y desactivar vista previa
    setMostrarEditor(true);
    setPreviewMode(false);
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = nuevoTexto;
    }

    // Persistencia local inmediata y segura
    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, nuevoTexto);
    } catch (err) {
      console.warn('Error guardando en localStorage:', err);
    }

    // Scroll suave y enfoque automático en el Editor Notarial Activo
    setTimeout(() => {
      if (editorTextareaRef.current) {
        if (editorTextareaRef.current.innerHTML !== nuevoTexto) {
          editorTextareaRef.current.innerHTML = nuevoTexto;
        }
        editorTextareaRef.current.focus();
        editorTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);

    setSaveSuccessBanner('¡Texto redactado por IA insertado con éxito en el Editor Notarial Activo!');
    setTimeout(() => setSaveSuccessBanner(null), 4000);

    // Limpieza de propuesta tras inserción aprobada
    setAiDraftProposal(null);
    setAiPrompt('');
    setAiAttachments([]);
    setIsAiModalOpen(false);
  };

  // Cargar documento seleccionado en el Editor Notarial Activo
  const handleEditarDocumento = (escrito: Escrito) => {
    const docTexto = escrito.texto || '';
    setMostrarEditor(true);
    setEditandoDocumentoExistente(true);
    setActiveEditingDoc(escrito);
    setSelectedPlantillaId('');
    setEditorText(docTexto);
    setDocumentTitle(escrito.tipo.replace(' (Guardado Local)', ''));
    setSelectedCategoryForSave(escrito.categoria || 'Contratos Privados');
    setPreviewMode(false);
    setMemoria({});

    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, docTexto);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TITULO, escrito.tipo.replace(' (Guardado Local)', ''));
      localStorage.setItem(LOCAL_STORAGE_DRAFT_CATEGORIA, escrito.categoria || 'Contratos Privados');
    } catch (e) {
      console.warn('Error sincronizando borrador local:', e);
    }

    // Inyección forzada garantizada en el nodo contentEditable
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = docTexto;
    }

    // Foco Automático, inyección asegurada y scroll suave al Editor Notarial Activo
    setTimeout(() => {
      const editorBloque = document.getElementById('editor-notarial-activo-bloque');
      if (editorBloque) {
        editorBloque.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = docTexto;
        editorContentRef.current.focus();
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editorContentRef.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch {
          // Focus básico garantizado
        }
      }
    }, 50);

    setSaveSuccessBanner(`"${escrito.tipo}" cargado en el Editor Notarial Activo.`);
    setTimeout(() => setSaveSuccessBanner(null), 3500);
  };

  // Duplicar documento en Firestore y almacenamiento local
  const handleDuplicarDocumento = async (escrito: Escrito) => {
    try {
      const user = auth?.currentUser;
      const nuevoTipo = `${escrito.tipo} (Copia)`;
      const nuevaCat = escrito.categoria || 'Contratos Privados';

      if (escrito.id.startsWith('temp-')) {
        const tempDocsString = localStorage.getItem('escritos_temporales');
        const tempDocs = tempDocsString ? JSON.parse(tempDocsString) : [];
        const newTempDoc = {
          texto: escrito.texto,
          tipo: nuevoTipo,
          categoria: nuevaCat,
          userId: user?.uid || 'temp',
          fechaCreacion: new Date().toISOString()
        };
        tempDocs.unshift(newTempDoc);
        localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
        setEscritos(prev => [
          {
            id: `temp-${Date.now()}`,
            ...newTempDoc,
            fechaCreacion: {
              toMillis: () => Date.now(),
              toDate: () => new Date()
            } as any
          },
          ...prev
        ]);
      } else {
        if (!workspaceId) {
          console.error("Operación abortada: Workspace no identificado.");
          return;
        }
        const creatorName = (currentUser as any)?.nombre || userProfile?.nombre || userProfile?.razonSocial || (currentUser as any)?.displayName || currentUser?.email?.split('@')[0] || (user as any)?.displayName || user?.email?.split('@')[0] || 'Usuario';
        const creatorRole = (currentUser as any)?.role || (currentUser as any)?.rol || userProfile?.rol || userProfile?.role || 'titular';
        const { id, ...dataToCopy } = escrito;
        await addDoc(collection(db, 'documentos_olga'), {
          ...dataToCopy,
          userId: workspaceId,            // El propietario legal de los datos (Titular)
          creator_id: user?.uid,          // Rastro de auditoría: Quién lo digitó
          createdBy: user?.uid,
          creator_name: creatorName,
          creator_role: creatorRole,
          tipo: nuevoTipo,
          createdAt: new Date().toISOString(),
          fechaCreacion: serverTimestamp()
        });
      }

      setSaveSuccessBanner(`¡"${nuevoTipo}" duplicado con éxito!`);
      setTimeout(() => setSaveSuccessBanner(null), 3500);
    } catch (err) {
      console.error("Error al duplicar escrito:", err);
      alert("Error al duplicar el escrito.");
    }
  };

  // Eliminar documento permanentemente
  const handleEliminarDocumento = async (escrito: Escrito) => {
    try {
      if (escrito.id.startsWith('temp-')) {
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          const tempDocs = JSON.parse(tempDocsString);
          const idx = parseInt(escrito.id.replace('temp-', ''), 10);
          tempDocs.splice(idx, 1);
          localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
          setEscritos(prev => prev.filter(item => item.id !== escrito.id));
        }
      } else {
        const docRef = doc(db, 'documentos_olga', escrito.id);
        await deleteDoc(docRef);
      }
      setDocToDelete(null);
      setSaveSuccessBanner(`"${escrito.tipo}" eliminado con éxito.`);
      setTimeout(() => setSaveSuccessBanner(null), 3500);
    } catch (err) {
      console.error("Fallo al borrar:", err);
      alert("No se pudo eliminar el documento.");
    }
  };

  const QUICK_AI_PROMPTS = [
    { label: 'Cláusula Penal y Mora', prompt: 'Redacta una cláusula penal de indemnización por mora automática del 2% mensual para contrato de compraventa o locación.' },
    { label: 'Pacto Comisorio Expreso', prompt: 'Redacta una cláusula de pacto comisorio expreso y resolución de pleno derecho por incumplimiento de pago de cuotas.' },
    { label: 'Rescisión Unilateral', prompt: 'Redacta una cláusula de rescisión unilateral con preaviso de 30 días y liquidación de expensas e impuestos.' },
    { label: 'Jurisdicción Asunción', prompt: 'Redacta una cláusula de jurisdicción y prórroga de competencia expresa ante los Juzgados Ordinarios de Asunción.' },
    { label: 'Poder Especial Bancario', prompt: 'Redacta facultades especiales para cobro de cheques, apertura de cuentas y transferencias bancarias en Paraguay.' }
  ];

  // Filtrado LOCAL sobre el estado de React (regla crítica: prohibido peticiones al escribir)
  const filteredEscritos = escritos.filter(escrito => {
    const matchCategory = activeCategory === 'Todos' || escrito.categoria === activeCategory;
    const matchSearch = !searchFilter.trim() || 
      escrito.tipo.toLowerCase().includes(searchFilter.toLowerCase()) || 
      escrito.texto.toLowerCase().includes(searchFilter.toLowerCase());
    return matchCategory && matchSearch;
  });

  const cleanText = editorText.replace(/<[^>]+>/g, ' ').trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = cleanText.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Flotante de Éxito Post-Guardado (Diseño Verde Enterprise) */}
      {mensajeExito && (
        <div className="fixed top-6 right-6 z-50 max-w-md bg-green-50 border border-green-200 text-green-800 px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-green-700">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-900 leading-tight">Documento guardado con éxito</p>
              <p className="text-[11px] text-green-700 font-medium leading-tight mt-0.5">{mensajeExito}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMensajeExito(null)}
            className="text-green-600 hover:text-green-900 p-1 rounded-lg hover:bg-green-100/60 transition-colors cursor-pointer"
            title="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de confirmación secundario al guardar */}
      {saveSuccessBanner && !mensajeExito && (
        <div className="bg-slate-900 text-white border-l-4 border-[#FF3131] p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-4 h-4 text-[#FF3131]" />
            <span>{saveSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessBanner(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODO DASHBOARD: VISIBLE ÚNICAMENTE CUANDO mostrarEditor ES FALSE        */}
      {/* ========================================================================= */}
      {!mostrarEditor && (
        <>
          {/* Cabecera Principal Unificada */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestión de Escritos y Notaría</h2>
                <span className="px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                  O.L.G.A.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Entorno ergonómico unificado: Redacción asistida con IA (izquierda), Editor Notarial Activo (derecha) y Gestión Documental estilo Google Drive (inferior).
              </p>
            </div>

            {/* Resumen de Estado y Acceso Directo a Drive */}
            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF3131]"></span>
                <span>{escritos.length} Documentos en Archivo</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('seccion-gestion-documental');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Ver Archivo Documental ↓</span>
              </button>
            </div>
          </div>

          {/* 1. PANEL SUPERIOR: DOS COLUMNAS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* ----------------------------------------------------------------------- */}
        {/* PANEL SUPERIOR - IZQUIERDA (lg:col-span-6): BANNER COMPACTO IA          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-inner shrink-0">
                  <Sparkles className="w-5 h-5 text-[#FF3131]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    REDACCIÓN ASISTIDA CON INTELIGENCIA ARTIFICIAL
                  </h3>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                    O.L.G.A. IA / ORÁCULO
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Solicita contratos, estipulaciones o cláusulas conforme a las leyes paraguayas y adjunta antecedentes.
            </p>

            {/* Aviso si ya hay un borrador generado esperando en memoria */}
            {aiDraftProposal && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-amber-800 animate-in fade-in">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0"></span>
                  <span>Borrador listo para revisión ({aiDraftProposal.trim().split(/\s+/).filter(Boolean).length} pal.)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="text-xs font-black text-slate-900 underline hover:text-[#FF3131] shrink-0 cursor-pointer"
                >
                  Abrir Borrador →
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer border border-slate-800 active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4 text-[#FF3131] group-hover:scale-110 transition-transform" />
              <span>GENERAR BORRADOR CON IA</span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* PANEL SUPERIOR - DERECHA (lg:col-span-6): SELECTOR DE PLANTILLAS        */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 border border-slate-200 shrink-0">
                  <FileText className="w-5 h-5 text-[#FF3131]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    PLANTILLA NOTARIAL / TIPO DE ESCRITO
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Seleccione un modelo para abrir el editor notarial
                  </span>
                </div>
              </div>

              {mostrarEditor && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-lg border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Editor Visible
                </span>
              )}
            </div>

            {/* SELECTOR PRINCIPAL DE PLANTILLA */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                Plantilla Notarial / Tipo de Escrito *
              </label>
              <select
                value={selectedPlantillaId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPlantillaId(val);
                  if (val && val.trim() !== '') {
                    setMostrarEditor(true);
                    handleSelectPlantilla(val);
                  }
                }}
                className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-2xl px-3.5 py-3 text-xs font-bold text-slate-900 outline-none transition-colors shadow-inner cursor-pointer"
              >
                <option value="" disabled>Seleccione un modelo para abrir el editor...</option>
                <option value="hoja_en_blanco">📄 Hoja en Blanco (Redacción Libre)</option>
                {PLANTILLAS_NOTARIALES.filter(p => p.id !== 'hoja_en_blanco').map((plantilla) => (
                  <option key={plantilla.id} value={plantilla.id}>
                    📜 {plantilla.nombre}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Al seleccionar una plantilla u Hoja en Blanco, se abrirá el editor con autocompletado inteligente de datos.
            </p>
          </div>

          {/* BOTÓN DESTACADO DE '+ NUEVO ESCRITO' */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleNuevoEscrito}
              className="flex-1 py-3.5 px-4 bg-[#FF3131] hover:bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ Nuevo Escrito</span>
            </button>

            {mostrarEditor && (
              <button
                type="button"
                onClick={() => {
                  setMostrarEditor(false);
                  setShowSplitScreen(false);
                  setSelectedPlantillaId('');
                }}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-colors border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                title="Ocultar editor notarial"
              >
                <ChevronUp className="w-4 h-4 text-slate-500" />
                <span>Ocultar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )}

      {/* ========================================================================= */}
      {/* 2. CUERPO CENTRAL: EDITOR NOTARIAL ACTIVO (MODO DE ENFOQUE TOTAL)         */}
      {/* ========================================================================= */}
      {mostrarEditor && (
        <div id="editor-notarial-activo-bloque" className="min-h-screen bg-slate-100 relative -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 animate-in fade-in duration-300">
          {/* CABECERA FLOTANTE FIJA (FIXED TOOLBAR ESTILO WORD) - SIEMPRE ACCESIBLE */}
          <div className="fixed top-0 left-0 w-full z-50 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 md:px-8 pt-3 pb-3 transition-all space-y-3">
            {/* Fila superior: Botón '⬅ Volver (ESC)', Título del editor y estadísticas */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarEditor(false);
                    setShowSplitScreen(false);
                    setSelectedPlantillaId('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs cursor-pointer active:scale-95 shrink-0"
                  title="Volver al dashboard principal de archivos (ESC)"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
                  <span>⬅ Volver (ESC)</span>
                </button>

                  <span className="uppercase tracking-widest text-slate-700 flex items-center gap-2 border-l border-slate-200 pl-3">
                    <Edit3 className="w-4 h-4 text-[#FF3131]" />
                    <span className="font-black text-slate-900 text-xs">
                      {previewMode ? 'MODO LECTURA / PREVISUALIZACIÓN' : 'EDITOR NOTARIAL ACTIVO'}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[10px]">
                  <span>{wordCount} palabras</span>
                  <span>•</span>
                  <span>{charCount} caracteres</span>
                  {activeEditingDoc && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-sans">
                        <span className="font-mono text-[10px] text-slate-400">
                          Ref. Soporte: {activeEditingDoc.correlativo || String(activeEditingDoc.id || '').slice(0, 3)} - {String(activeEditingDoc.id || '').slice(-6)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopiarCodigoSoporte(activeEditingDoc)}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          title="Copiar código estructurado para soporte técnico"
                        >
                          {copiedSupportId === activeEditingDoc.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 text-[9px]">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Clipboard className="w-3 h-3 text-slate-400" />
                              <span className="text-[9px]">Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

            {/* CAMPOS: TÍTULO DEL ESCRITO Y CARPETA DE ARCHIVO */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                  Título del Escrito *
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Ej. Contrato de Compraventa Inmueble..."
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                  Carpeta de Archivo *
                </label>
                <select
                  value={selectedCategoryForSave}
                  onChange={(e) => setSelectedCategoryForSave(e.target.value)}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                >
                  {sortedCarpetas.map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN RÁPIDA */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLimpiarEditor}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
                  title="Limpiar completamente el área de redacción (Hoja en Blanco)"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Hoja en Blanco</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                    previewMode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <Eye className="w-3 h-3 text-[#FF3131]" />
                  <span>{previewMode ? 'Editar' : 'Vista Previa'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopiarTexto}
                  disabled={!editorText}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
                  title="Copiar texto al portapapeles"
                >
                  {copiedFeedback ? (
                    <>
                      <CheckCheck className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenDocument(editorText, activeEditingDoc?.id, documentTitle, selectedCategoryForSave)}
                  disabled={!editorText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors border border-slate-800 shadow-sm cursor-pointer"
                  title="Abrir con membrete oficial e imprimir en PDF"
                >
                  <Printer className="w-3 h-3 text-[#FF3131]" />
                  <span>Membrete / Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSplitScreen(!showSplitScreen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                    showSplitScreen 
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner' 
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                  title="Dividir pantalla para rellenar Hoja de Seguridad CSJ"
                >
                  <ShieldCheck className="w-3 h-3"/>
                  <span>{showSplitScreen ? 'Cerrar Hoja CSJ' : 'Anexar Hoja CSJ'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleImprimirPDF}
                  disabled={!editorText.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                  title="Imprimir o Descargar como PDF con márgenes de hoja notarial"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>🖨️ Imprimir / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleGuardarEscrito}
                  disabled={isSavingDraft || !editorText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
                >
                  {isSavingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isSavingDraft ? 'Guardando...' : 'GUARDAR ESCRITO'}</span>
                </button>
              </div>
            </div>

            {/* BARRA DE HERRAMIENTAS (TOOLBAR MINIMALISTA TIPO WORD) - CONDICIONAL INTELIGENTE */}
            {mostrarBarraHerramientas && (
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-2.5 flex flex-wrap items-center gap-1.5 shadow-inner animate-in fade-in duration-200">
                {/* Formato de Texto: Negrita, Cursiva, Subrayado */}
                <div className="flex items-center gap-1 pr-2.5 border-r border-slate-200">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('bold')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.bold
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Negrita"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('italic')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.italic
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Cursiva"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('underline')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.underline
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Subrayado"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                </div>

                {/* Alineación: Izquierda, Centro, Derecha, Justificar */}
                <div className="flex items-center gap-1 px-2.5 border-r border-slate-200">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('justifyLeft')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.justifyLeft
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Alinear a la Izquierda"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('justifyCenter')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.justifyCenter
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Centrar"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('justifyRight')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.justifyRight
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Alinear a la Derecha"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('justifyFull')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.justifyFull
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Justificar"
                  >
                    <AlignJustify className="w-4 h-4" />
                  </button>
                </div>

                {/* Listas: Desordenada, Ordenada */}
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('insertUnorderedList')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.insertUnorderedList
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Lista con viñetas"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('insertOrderedList')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      activeFormats.insertOrderedList
                        ? 'bg-slate-200 text-indigo-600 shadow-inner font-bold'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white hover:shadow-xs'
                    }`}
                    title="Lista numerada"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                </div>

                <div className="ml-auto hidden sm:flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider pr-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Hoja de Protocolo Notarial (Oficio)</span>
                </div>
              </div>
            )}
          </div>

          {/* SIMULACIÓN DE HOJA DE PROTOCOLO NOTARIAL (MESA DE TRABAJO / ESCRITORIO NOTARIAL) */}
          <div className={`relative z-10 px-4 md:px-8 pb-8 transition-all ${mostrarBarraHerramientas ? 'pt-52 sm:pt-48' : 'pt-36 sm:pt-32'}`}>
            <div className={`flex flex-col ${showSplitScreen ? '2xl:flex-row' : ''} gap-6 items-start`}>
              
              {/* LADO IZQUIERDO: Editor Normal */}
              <div className={`w-full bg-slate-200/60 py-10 sm:py-14 px-4 sm:px-8 rounded-3xl border border-slate-300/80 overflow-x-auto flex justify-center shadow-inner ${showSplitScreen ? '2xl:w-1/2' : ''}`}>
                <style>{`
                  #editor-notarial-activo,
                  .editor-notarial-papel {
                    width: 100% !important;
                    max-width: 850px !important;
                    min-height: 1100px !important;
                    background-color: #ffffff !important;
                    color: #0f172a !important;
                    padding-top: 180px !important;
                    padding-bottom: 100px !important;
                    padding-left: 140px !important;
                    padding-right: 60px !important;
                    font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif !important;
                    font-size: 18px !important;
                    line-height: 1.75 !important;
                    text-align: justify !important;
                    box-sizing: border-box !important;
                  }
                  #editor-notarial-activo * {
                    color: inherit;
                    font-family: inherit;
                  }
                  #editor-notarial-activo p {
                    margin-top: 0;
                    margin-bottom: 1rem;
                    text-align: justify !important;
                    line-height: 1.75 !important;
                  }
                  #editor-notarial-activo ul,
                  .editor-notarial-papel ul {
                    list-style-type: disc !important;
                    padding-left: 2rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                  }
                  #editor-notarial-activo ol,
                  .editor-notarial-papel ol {
                    list-style-type: decimal !important;
                    padding-left: 2rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                  }
                  #editor-notarial-activo li,
                  .editor-notarial-papel li {
                    display: list-item !important;
                    margin-bottom: 0.25rem !important;
                    text-align: justify !important;
                  }
                `}</style>
                <div
                  ref={setEditorRef}
                  id="editor-notarial-activo"
                  contentEditable={!previewMode}
                  suppressContentEditableWarning={true}
                  onInput={(e) => {
                    setEditorText(e.currentTarget.innerHTML);
                  }}
                  onKeyUp={checkFormatStates}
                  onMouseUp={checkFormatStates}
                  onFocus={checkFormatStates}
                  style={{
                    width: '100%',
                    maxWidth: '850px',
                    minHeight: '1100px',
                    backgroundColor: '#ffffff',
                    paddingTop: '180px',
                    paddingBottom: '100px',
                    paddingLeft: '140px',
                    paddingRight: '60px',
                    fontSize: '18px',
                    lineHeight: '1.75',
                    textAlign: 'justify',
                    boxSizing: 'border-box'
                  }}
                  className={`w-full max-w-[850px] min-h-[1100px] bg-white shadow-2xl mx-auto ring-1 ring-slate-200 outline-none overflow-y-auto font-serif text-[18px] leading-relaxed text-justify text-slate-900 selection:bg-red-100 selection:text-red-900 transition-all editor-notarial-papel [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:list-decimal [&_ol]:pl-8 [&_li]:list-item ${
                    previewMode ? 'select-text cursor-default' : 'cursor-text focus:ring-slate-300'
                  }`}
                />
              </div>

              {/* LADO DERECHO: Editor Notarial Oficial (Hoja Verde) */}
              {showSplitScreen && (
                <div className="w-full 2xl:w-1/2 rounded-3xl overflow-hidden shadow-2xl border border-slate-300 animate-in slide-in-from-right-8 duration-300">
                  <EditorNotarialOficial onVolver={() => setShowSplitScreen(false)} />
                </div>
              )}

            </div>
          </div>

          {/* Aviso Notarial Mandatorio */}
          <div className="px-4 md:px-8 pb-6">
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 text-[11px] text-slate-600 font-medium shadow-xs">
              <AlertCircle className="w-4 h-4 text-[#FF3131] shrink-0" />
              <span>
                <strong>Aviso Legal Notarial:</strong> Todo documento generado en este sistema es un borrador avanzado que requiere la revisión, autorización y sello del Escribano Titular para poseer validez legal administrativa.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN INFERIOR DE ARCHIVOS Y CARPETAS (DASHBOARD DOCUMENTAL)         */}
      {/* ========================================================================= */}
      {!mostrarEditor && (
        <div id="seccion-gestion-documental" className="space-y-6 pt-4 border-t border-slate-200">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-[#FF3131]" />
                <h3 className="text-base font-black text-slate-900 tracking-tight">Archivo y Gestión Documental</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Expedientes, minutas, pagarés y contratos notariales clasificados por carpetas preestablecidas y personalizadas.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button 
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200 shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Administrar Carpetas</span>
              </button>
              <button
                type="button"
                onClick={handleNuevoEscrito}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#FF3131] hover:bg-red-600 rounded-xl transition-colors shadow-sm shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Escrito</span>
              </button>
            </div>
          </div>

          {/* Búsqueda y Selector de Carpetas estilo Google Drive */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            {/* Pestañas de carpetas preestablecidas y personalizadas */}
            <div className="flex flex-wrap items-center gap-2">
              {categorias.map(cat => {
                const count = cat === 'Todos' 
                  ? escritos.length 
                  : escritos.filter(e => e.categoria === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      activeCategory === cat ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/80 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Búsqueda local con .filter() */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por título o contenido..."
                className="w-full box-border pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl text-xs font-bold outline-none text-slate-800 transition-colors shadow-inner"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grilla de documentos en la carpeta activa */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-48 bg-white rounded-3xl border border-slate-200 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF3131]" />
            <span className="text-xs text-slate-500 font-bold">Cargando archivo notarial...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center justify-center border border-red-200">
            <span>{error}</span>
          </div>
        ) : filteredEscritos.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-3xl border border-slate-200 border-dashed">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">
              {searchFilter 
                ? `No se encontraron escritos que coincidan con "${searchFilter}".`
                : activeCategory === 'Todos' 
                  ? 'No hay escritos guardados en el archivo notarial.' 
                  : `No hay escritos guardados en la carpeta "${activeCategory}".`}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Redacta con IA o usa una plantilla en el Editor Superior y pulsa &quot;Guardar Escrito&quot; para archivarlo.
            </p>
            <button
              type="button"
              onClick={handleNuevoEscrito}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              Comenzar a Redactar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEscritos.map((escrito) => {
              let dateStr = 'Fecha reciente';
              if (escrito.createdAt) {
                dateStr = new Date(escrito.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else if (escrito.fechaCreacion && typeof escrito.fechaCreacion.toMillis === 'function') {
                dateStr = new Date(escrito.fechaCreacion.toMillis()).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              }

              return (
                <div 
                  key={escrito.id} 
                  onClick={() => handleEditarDocumento(escrito)}
                  className={`bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all flex flex-col justify-between p-6 relative group cursor-pointer ${
                    activeMenuId === escrito.id ? 'z-30' : 'z-0 hover:z-10'
                  }`}
                >
                  <div>
                    {/* Cabecera de la Tarjeta con Kebab Menu */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-5 h-5 text-[#FF3131]" />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate" title={escrito.tipo || 'Escrito'}>
                            {escrito.tipo || 'Escrito'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                            <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate">{dateStr}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-slate-200/70 shrink-0">
                          {escrito.categoria || 'Sin Categoría'}
                        </span>

                        {/* Menú Desplegable (Tres Puntos) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === escrito.id ? null : escrito.id);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Opciones del documento"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Menú Flotante Dropdown de Opciones */}
                          {activeMenuId === escrito.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 cursor-default" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }} 
                              />
                              <div 
                                className="absolute right-0 top-10 z-50 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150 text-xs font-bold"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    handleEditarDocumento(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Abrir en Editor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    handleDuplicarDocumento(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Duplicar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setMovingDoc(escrito);
                                    setTargetCategory(escrito.categoria || 'Sin Categoría');
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Mover a Carpeta</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    onOpenDocument(escrito.texto, escrito.id, escrito.tipo, escrito.categoria);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Imprimir / Membrete</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setDocToDelete(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-[#FF3131]" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fragmento de Texto en Gris Claro (no compite con la interfaz) */}
                    <div className="mt-3.5 mb-2">
                      <p className="text-xs text-slate-400 font-normal leading-relaxed line-clamp-3 select-none">
                        {escrito.texto}
                      </p>
                    </div>
                  </div>

                  {/* Pie de Tarjeta con Responsable / Creador */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {escrito.texto.trim().split(/\s+/).filter(Boolean).length} palabras
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1.5 overflow-hidden text-[10px]">
                        <span className="text-slate-400 font-normal shrink-0">Responsable:</span>
                        <span className="font-bold text-slate-700 truncate max-w-[110px]" title={escrito.creator_name || 'Titular'}>
                          {escrito.creator_name || 'Titular'}
                        </span>
                        {escrito.creator_role === 'operador' && (
                          <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            Operador
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[#FF3131] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] shrink-0">
                      <span>Abrir en Editor &rarr;</span>
                    </span>
                  </div>

                  {/* Código de Soporte Técnico (Fase 8) */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-slate-400 text-[10px]">
                      Ref. Soporte: {escrito.correlativo || String(escrito.id || '').slice(0, 3)} - {String(escrito.id || '').slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopiarCodigoSoporte(escrito);
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 transition-colors cursor-pointer"
                      title="Copiar código estructurado para soporte técnico"
                    >
                      {copiedSupportId === escrito.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-bold text-[9px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3 h-3" />
                          <span className="text-[9px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {docToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#FF3131] flex items-center justify-center border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">¿Eliminar documento?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Esta acción eliminará definitivamente el escrito <strong className="text-slate-900">&quot;{docToDelete.tipo}&quot;</strong> del archivo notarial. No se podrá recuperar.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleEliminarDocumento(docToDelete)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FF3131] hover:bg-red-600 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINISTRAR CARPETAS */}
      {isAdminModalOpen && currentUser && (
        <ModalAdministrarCarpetas
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          carpetasActuales={allCarpetasToAdmin}
          userId={(userProfile?.rol === 'operador' || userProfile?.role === 'operador') ? (userProfile?.tenant_id || userProfile?.tenantId || currentUser.uid) : currentUser.uid}
        />
      )}

      {/* MODAL MOVER DOCUMENTO DE CARPETA */}
      {movingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-sm overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Mover Documento</h3>
              <button
                type="button"
                onClick={() => setMovingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Elige la carpeta destino para <strong className="text-slate-900">{movingDoc.tipo}</strong>:
              </p>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full box-border bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-3 outline-none"
              >
                {categorias.filter(c => c !== 'Todos').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setMovingDoc(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (movingDoc.id.startsWith('temp-')) {
                      const tempDocsString = localStorage.getItem('escritos_temporales');
                      if (tempDocsString) {
                        const tempDocs = JSON.parse(tempDocsString);
                        const idx = parseInt(movingDoc.id.replace('temp-', ''), 10);
                        tempDocs[idx].categoria = targetCategory;
                        localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
                        setEscritos(prev => prev.map(item => item.id === movingDoc.id ? { ...item, categoria: targetCategory } : item));
                      }
                    } else {
                      const docRef = doc(db, 'documentos_olga', movingDoc.id);
                      await updateDoc(docRef, { categoria: targetCategory });
                    }
                    setMovingDoc(null);
                  } catch (err) {
                    console.error("Error al mover:", err);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Mover Escrito</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL / ENTORNO COMPLETO DE IA (ORÁCULO NOTARIAL) */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#FF3131]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      O.L.G.A. IA / ORÁCULO NOTARIAL
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-[#FF3131] border border-red-500/30">
                      Asistente Jurídico
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Redacción asistida con terminología y legislación notarial paraguaya.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Caja de Requerimiento Legal */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Requerimiento Legal / Instrucción Notarial
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ejemplo: 'Redactar una cláusula de resolución por incumplimiento con mora automática del 2% mensual para compraventa...', o 'Generar borrador de cesión de derechos sobre inmueble en Asunción...' "
                  rows={4}
                  className="w-full box-border p-3.5 bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-2xl text-xs font-medium text-slate-900 outline-none transition-colors resize-y leading-relaxed shadow-inner"
                />
              </div>

              {/* Sugerencias Rápidas */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Sugerencias notariales:</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_AI_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiPrompt(qp.prompt)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors text-left cursor-pointer"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjuntos */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileAttachment}
                multiple
                accept=".pdf,image/*,.doc,.docx,.txt"
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    title="Adjuntar títulos, antecedentes o fotos"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Adjuntar Archivos</span>
                  </button>

                  {aiAttachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[10px] font-bold"
                    >
                      <FileText className="w-3 h-3 text-[#FF3131]" />
                      <span className="max-w-[120px] truncate" title={att.name}>{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="text-slate-400 hover:text-slate-800 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleGenerarConIA}
                  disabled={isGeneratingAI || (!aiPrompt.trim() && aiAttachments.length === 0)}
                  className="flex items-center justify-center gap-2 px-5 py-2 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isGeneratingAI ? 'Redactando con IA...' : 'Generar Borrador'}</span>
                </button>
              </div>

              {/* Error si ocurre */}
              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-red-800">Aviso del Asistente:</p>
                      <p className="mt-0.5 text-red-600 font-medium">{aiError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    className="text-red-400 hover:text-red-700 p-0.5 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Caja de Revisión Previa del Borrador Generado */}
              {aiDraftProposal !== null && (
                <div className="bg-slate-50 border-2 border-slate-300 rounded-3xl p-5 space-y-3 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF3131] animate-ping"></span>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                        Revisión Previa del Borrador Generado
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                        Borrador Editable
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 font-bold">
                      {aiDraftProposal.trim().split(/\s+/).filter(Boolean).length} palabras
                    </div>
                  </div>

                  <textarea
                    value={aiDraftProposal}
                    onChange={(e) => setAiDraftProposal(e.target.value)}
                    rows={8}
                    className="w-full box-border p-3.5 bg-white border border-slate-200 focus:border-[#FF3131] rounded-2xl text-slate-900 font-mono text-xs leading-relaxed outline-none transition-colors resize-y shadow-inner"
                    placeholder="El borrador generado aparecerá aquí para su libre ajuste..."
                  />

                  {/* Botonera de Inserción */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(aiDraftProposal);
                          setCopiedFeedback(true);
                          setTimeout(() => setCopiedFeedback(false), 2000);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAiDraftProposal(null)}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Descartar</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {editorText.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleInsertarEnDocumento('reemplazar')}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                          title="Reemplaza todo el contenido del editor con este borrador"
                        >
                          <RotateCcw className="w-3 h-3 text-[#FF3131]" />
                          <span>Reemplazar Editor</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInsertarEnDocumento('anexar')}
                        className="px-5 py-2 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        title="Inserta de manera limpia y automática este texto en el Editor Notarial Activo"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                        <span>Enviar al Documento</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ASISTENTE FLOTANTE DE AUTOCOMPLETADO (AUTOFILL WIZARD)                  */}
      {/* ========================================================================= */}
      {mostrarEditor && condicionAutocompletado && currentBlankContext && (
        <aside
          role="region"
          aria-label="Asistente de Autocompletado Notarial"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] bg-white shadow-2xl rounded-3xl border border-slate-200/90 ring-1 ring-slate-100 p-4 sm:p-5 max-w-lg w-[92%] sm:w-[90%] animate-in fade-in slide-in-from-bottom-6 duration-300 transition-all backdrop-blur-sm"
        >
          {/* Cabecera del Wizard: Instrucción y Contador */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF3131] animate-pulse shrink-0"></span>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                {currentBlankContext.instruccion}
              </h4>

              {/* Botón de Ayuda (?) con Tooltip Notarial */}
              <div className="relative inline-block shrink-0">
                <button
                  type="button"
                  onMouseEnter={() => setMostrarTooltipAyuda(true)}
                  onMouseLeave={() => setMostrarTooltipAyuda(false)}
                  onClick={() => setMostrarTooltipAyuda(!mostrarTooltipAyuda)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ver explicación y ejemplos legales"
                  aria-label="Información de ayuda"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </button>

                {mostrarTooltipAyuda && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
                    <p className="font-extrabold text-[#FF3131] uppercase tracking-wider text-[9px] mb-1">
                      Guía Notarial de Llenado
                    </p>
                    <p className="text-slate-200 leading-relaxed font-normal">
                      {currentBlankContext.ayuda}
                    </p>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Contador de Espacios Pendientes */}
              <div className="px-2.5 py-1 bg-slate-100 rounded-xl text-[10px] font-mono font-black text-slate-600 border border-slate-200">
                {totalBlanks} {totalBlanks === 1 ? 'campo pendiente' : 'campos pendientes'}
              </div>

              {/* Botón Salir / Volver (ESC) */}
              <button
                type="button"
                onClick={() => {
                  setMostrarEditor(false);
                  setShowSplitScreen(false);
                  setSelectedPlantillaId('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Cerrar editor y volver al dashboard (ESC)"
                aria-label="Cerrar editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Formulario de Inserción Rápida con Enter */}
          <form onSubmit={handleAplicarAutofill} className="mt-3 flex items-center gap-2">
            {/* Botón '↩ Retroceder' (Deshacer) */}
            <button
              type="button"
              onClick={handleRetroceder}
              disabled={historialTextos.length === 0}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
              title="Retroceder al paso anterior (Deshacer última inserción)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Retroceder</span>
            </button>

            <input
              ref={autofillInputRef}
              type="text"
              autoFocus={true}
              value={autofillInput}
              onChange={(e) => setAutofillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (autofillInput.trim()) {
                    handleAplicarAutofill();
                  }
                }
              }}
              placeholder={currentBlankContext.placeholder}
              className="flex-1 box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition-all shadow-inner placeholder:text-slate-400 placeholder:font-normal"
            />

            <button
              type="submit"
              disabled={!autofillInput.trim()}
              className="py-2.5 px-4 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-[#FF3131] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Insertar valor y avanzar al siguiente espacio (Enter)"
            >
              <span>Completar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Pista de teclado */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
            <span>Presiona <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> para insertar y pasar al siguiente</span>
            <span>Espacios: <span className="font-mono text-slate-600">_______</span></span>
          </div>
        </aside>
      )}

      {supportCopiedToast && (
        <div className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#FF3131]" />
          <span>{supportCopiedToast}</span>
        </div>
      )}
    </div>
  );
};
