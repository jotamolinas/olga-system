import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, Timestamp, doc, deleteDoc, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { 
  FileText, Loader2, Calendar, Trash2, Settings, MoreVertical, 
  Copy, FolderInput, X, Check, Edit3, Plus, Printer, Save, 
  RotateCcw, Eye, Search, AlertCircle, FileCheck, Sparkles, 
  Paperclip, Send, ChevronDown, ChevronUp, CheckCheck
} from 'lucide-react';
import { redactarEscritoConIA } from '../services/gemini';
import { User } from 'firebase/auth';
import { ModalAdministrarCarpetas, Carpeta } from './ModalAdministrarCarpetas';

interface Escrito {
  id: string;
  texto: string;
  fechaCreacion?: Timestamp;
  createdAt?: string;
  tipo: string;
  userId: string;
  categoria?: string;
}

interface EscritosTabProps {
  currentUser: User | null;
  userProfile?: any;
  personas?: any[];
  onOpenDocument: (text: string) => void;
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

  // Datos de persona / cliente del Fichero
  const nombreVal = personaActiva ? ((personaActiva.apellido ? `${personaActiva.nombre} ${personaActiva.apellido}` : personaActiva.nombre) || '').trim().toUpperCase() : '';
  const docVal = personaActiva ? ((personaActiva.nro_documento ? (personaActiva.tipo_documento ? `${personaActiva.tipo_documento} Nº ${personaActiva.nro_documento}` : personaActiva.nro_documento) : '') || '').trim().toUpperCase() : '';
  const nacVal = personaActiva ? (personaActiva.nacionalidad || 'PARAGUAYA').toUpperCase() : '';
  const estCivilVal = personaActiva ? (personaActiva.estado_civil || personaActiva.estadoCivil || '').toUpperCase() : '';
  const profVal = personaActiva ? (personaActiva.profesion || personaActiva.ocupacion || '').toUpperCase() : '';
  const dirVal = personaActiva ? (personaActiva.domicilio || personaActiva.direccion || '').toUpperCase() : '';

  texto = texto.replace(/\{\{NOMBRE\}\}/g, nombreVal || '_______');
  texto = texto.replace(/\{\{DOCUMENTO\}\}/g, docVal || '_______');
  texto = texto.replace(/\{\{NACIONALIDAD\}\}/g, nacVal || 'PARAGUAYA');
  texto = texto.replace(/\{\{ESTADO_CIVIL\}\}/g, estCivilVal || '_______');
  texto = texto.replace(/\{\{PROFESION\}\}/g, profVal || '_______');
  texto = texto.replace(/\{\{DIRECCION\}\}/g, dirVal || '_______');

  return texto;
}

export function construirConstitucionSA(
  numSocios: number = 2,
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

  const incisosLetras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const partesComparecientes: string[] = [];

  for (let i = 1; i <= numSocios; i++) {
    const isFirst = i === 1;
    const isLast = i === numSocios;
    const prefijo = isFirst ? 'por una parte' : (isLast ? 'y por la otra' : 'por otra parte');

    let nombre = `{{SOCIO_${i}}}`;
    let doc = `{{DOCUMENTO_${i}}}`;
    let nac = `{{NACIONALIDAD_${i}}}`;
    let estCivil = `{{ESTADO_CIVIL_${i}}}`;
    let prof = `{{PROFESION_${i}}}`;
    let dir = `{{DIRECCION_${i}}}`;

    if (isFirst && personaActiva) {
      nombre = (personaActiva.apellido ? `${personaActiva.nombre} ${personaActiva.apellido}` : personaActiva.nombre).toUpperCase();
      doc = (personaActiva.nro_documento ? `${personaActiva.tipo_documento || 'CI'} Nº ${personaActiva.nro_documento}` : '_______').toUpperCase();
      nac = (personaActiva.nacionalidad || 'PARAGUAYA').toUpperCase();
      estCivil = (personaActiva.estado_civil || personaActiva.estadoCivil || '_______').toUpperCase();
      prof = (personaActiva.profesion || personaActiva.ocupacion || '_______').toUpperCase();
      dir = (personaActiva.domicilio || personaActiva.direccion || '_______').toUpperCase();
    }

    partesComparecientes.push(`${prefijo}, Don/Doña ${nombre}, de nacionalidad ${nac}, mayor de edad, estado civil ${estCivil}, profesión ${prof}, domiciliado/a en ${dir}, titular de la Cédula de Identidad Civil Nº ${doc}`);
  }

  const parrafoComparecientes = `comparecen ante mí: ${partesComparecientes.join('; ')}; personas hábiles y civilmente capaces para este acto, a quienes doy fe de conocer, y dicen:`;

  const lineasSuscripcion: string[] = [];
  for (let i = 1; i <= numSocios; i++) {
    const letra = incisosLetras[i - 1] || `${i}`;
    let socioNombre = `{{SOCIO_${i}}}`;
    if (i === 1 && personaActiva) {
      socioNombre = (personaActiva.apellido ? `${personaActiva.nombre} ${personaActiva.apellido}` : personaActiva.nombre).toUpperCase();
    }
    lineasSuscripcion.push(`   ${letra}) ${socioNombre} suscribe _______ acciones ordinarias, representativas de GUARANÍES _______ (Gs. _______);`);
  }

  const articuloQuinto = `ARTÍCULO 5º (EMISIÓN Y SUSCRIPCIÓN): El Capital Social inicial queda totalmente emitido, suscripto e integrado por los comparecientes en las siguientes proporciones:
${lineasSuscripcion.join('\n')}
totalizando el cien por ciento (100%) del capital emitido y suscripto en este acto de constitución.`;

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
ARTÍCULO 6º: La dirección y administración de la sociedad estará a cargo de un Directorio compuesto por un (1) Presidente y Directores Titulares y Suplentes, elegidos por la Asamblea General Ordinaria por el período de un ejercicio comercial.

CAPÍTULO IV: DE LA FISCALIZACIÓN:
ARTÍCULO 7º: La fiscalización de la gestión social estará a cargo de un Síndico Titular y un Síndico Suplente designados anualmente por la Asamblea.

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

CAPÍTULO III: DE LA ADMINISTRACIÓN Y REPRESENTACIÓN:
ARTÍCULO 5º: La dirección y administración de la sociedad estará a cargo de un Directorio compuesto por un (1) Presidente y Directores Titulares y Suplentes, elegidos por la Asamblea General Ordinaria por el período de un ejercicio comercial.

CAPÍTULO IV: DE LA FISCALIZACIÓN:
ARTÍCULO 6º: La fiscalización de la gestión social estará a cargo de un Síndico Titular y un Síndico Suplente designados anualmente por la Asamblea.

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
  // Modo de navegación: Redacción activa vs Archivo de Documentos
  const [activeSubTab, setActiveSubTab] = useState<'redaccion' | 'archivo'>('redaccion');

  // Visibilidad condicional del Editor Notarial (Oculto por defecto según directriz UI/UX)
  const [mostrarEditor, setMostrarEditor] = useState<boolean>(false);

  // Estado del Redactor de Escritos
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>('');
  const [editorText, setEditorText] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('Escrito en Blanco');
  const [selectedCategoryForSave, setSelectedCategoryForSave] = useState<string>('Contratos Privados');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  // Estados del Banner de Redacción con IA
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiAttachments, setAiAttachments] = useState<{ name: string; mimeType: string; data: string; size: number }[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiDraftProposal, setAiDraftProposal] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBannerCollapsed, setAiBannerCollapsed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Sincronización en tiempo real de Firestore con prevención de fuga de memoria (array de deps [])
  useEffect(() => {
    const user = auth?.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'documentos_olga'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docs: Escrito[] = [];
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
          docs.push({ id: d.id, ...data, categoria } as Escrito);
        });

        // Leer documentos temporales del localStorage
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          try {
            const tempDocs = JSON.parse(tempDocsString);
            tempDocs.forEach((tDoc: any, idx: number) => {
              if (tDoc.userId === user.uid) {
                let categoria = tDoc.categoria || 'Sin Categoría';
                if (!tDoc.categoria && tDoc.tipo) {
                  const lowerTipo = tDoc.tipo.toLowerCase();
                  if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
                  else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
                  else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
                  else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
                  else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
                }
                docs.push({
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
            });
          } catch (e) {
            console.error('Error parsing temp docs', e);
          }
        }

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

    return () => unsubscribe();
  }, []);

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
  // Al seleccionar cualquier plantilla (o Hoja en Blanco), se despliega el Editor Notarial Activo.
  const handleSelectPlantilla = (plantillaId: string) => {
    if (!plantillaId) return;
    setMostrarEditor(true);
    setSelectedPlantillaId(plantillaId);

    const found = PLANTILLAS_NOTARIALES.find(p => p.id === plantillaId);
    if (!found || plantillaId === 'hoja_en_blanco') {
      // Limpieza total del editor
      setEditorText('');
      setDocumentTitle('Escrito en Blanco');
      setSelectedCategoryForSave('Contratos Privados');
    } else if (plantillaId === 'constitucion_sa') {
      const personaActiva = getPersonaActiva();
      const textoConstruido = construirConstitucionSA(2, personaActiva);
      setEditorText(textoConstruido);
      setDocumentTitle('Constitución de S.A.');
      setSelectedCategoryForSave('Contratos Privados');
    } else {
      const personaActiva = getPersonaActiva();
      const textoProcesado = procesarAutofillPlantilla(found.contenido, personaActiva);
      setEditorText(textoProcesado);
      setDocumentTitle(found.nombre);
      setSelectedCategoryForSave(found.categoriaSugerida);
    }

    setTimeout(() => {
      if (editorTextareaRef.current) {
        editorTextareaRef.current.focus();
        editorTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Botón explícito para '+ Nuevo Escrito' (despliega el editor en hoja limpia)
  const handleNuevoEscrito = () => {
    setSelectedPlantillaId('hoja_en_blanco');
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
    setMostrarEditor(true);
    setTimeout(() => {
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
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
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

      const nuevoDocData = {
        texto: editorText,
        tipo: tipoDoc,
        userId: user.uid,
        categoria: cat,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'documentos_olga'), nuevoDocData);

      // Guardado como respaldo local
      try {
        const rawTemp = localStorage.getItem('escritos_temporales');
        const list = rawTemp ? JSON.parse(rawTemp) : [];
        list.push({
          texto: editorText,
          tipo: tipoDoc,
          userId: user.uid,
          categoria: cat,
          fechaCreacion: new Date().toISOString()
        });
        localStorage.setItem('escritos_temporales', JSON.stringify(list));
      } catch (err) {
        console.warn('Error guardando copia local temporal:', err);
      }

      setSaveSuccessBanner(`¡"${tipoDoc}" guardado exitosamente en la carpeta ${cat}!`);
      setTimeout(() => setSaveSuccessBanner(null), 4000);
    } catch (err) {
      console.error('Error al guardar documento:', err);
      alert('Ocurrió un error al guardar. Verifica tu conexión.');
    } finally {
      setIsSavingDraft(false);
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

    // Persistencia local inmediata y segura
    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, nuevoTexto);
    } catch (err) {
      console.warn('Error guardando en localStorage:', err);
    }

    // Scroll suave y enfoque automático en el Editor Notarial Activo
    setTimeout(() => {
      if (editorTextareaRef.current) {
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
    setMostrarEditor(true);
    setEditorText(escrito.texto);
    setDocumentTitle(escrito.tipo.replace(' (Guardado Local)', ''));
    setSelectedCategoryForSave(escrito.categoria || 'Contratos Privados');
    setPreviewMode(false);

    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, escrito.texto);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TITULO, escrito.tipo.replace(' (Guardado Local)', ''));
      localStorage.setItem(LOCAL_STORAGE_DRAFT_CATEGORIA, escrito.categoria || 'Contratos Privados');
    } catch (e) {
      console.warn('Error sincronizando borrador local:', e);
    }

    setTimeout(() => {
      if (editorTextareaRef.current) {
        editorTextareaRef.current.focus();
        editorTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);

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
        const { id, ...dataToCopy } = escrito;
        await addDoc(collection(db, 'documentos_olga'), {
          ...dataToCopy,
          tipo: nuevoTipo,
          createdAt: new Date().toISOString()
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

  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;
  const charCount = editorText.length;

  return (
    <div className="space-y-8">
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

      {/* Banner de confirmación al guardar */}
      {saveSuccessBanner && (
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
      {/* 1. PANEL SUPERIOR: DOS COLUMNAS (SIEMPRE VISIBLE)                          */}
      {/* ========================================================================= */}
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
                onChange={(e) => handleSelectPlantilla(e.target.value)}
                className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-2xl px-3.5 py-3 text-xs font-bold text-slate-900 outline-none transition-colors shadow-inner cursor-pointer"
              >
                <option value="">-- Seleccione una Plantilla Notarial --</option>
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
                onClick={() => setMostrarEditor(false)}
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

      {/* ========================================================================= */}
      {/* 2. CUERPO CENTRAL: EDITOR NOTARIAL ACTIVO (CONDICIONAL: mostrarEditor)    */}
      {/* ========================================================================= */}
      {mostrarEditor && (
        <div id="editor-notarial-activo-bloque" className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Cabecera del Editor con Título, Carpeta y Acciones */}
          <div className="space-y-4 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span className="uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#FF3131]" />
                <span className="font-black text-slate-900 text-xs">
                  {previewMode ? 'MODO LECTURA / PREVISUALIZACIÓN' : 'EDITOR NOTARIAL ACTIVO'}
                </span>
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px]">
                <span>{wordCount} palabras</span>
                <span>•</span>
                <span>{charCount} caracteres</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setMostrarEditor(false)}
                  className="font-sans font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer hover:underline"
                  title="Ocultar editor notarial"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Ocultar Editor</span>
                </button>
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
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
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
                  onClick={() => onOpenDocument(editorText)}
                  disabled={!editorText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors border border-slate-800 shadow-sm cursor-pointer"
                  title="Abrir con membrete oficial e imprimir en PDF"
                >
                  <Printer className="w-3 h-3 text-[#FF3131]" />
                  <span>Membrete / Imprimir</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleGuardarEscrito}
                disabled={isSavingDraft || !editorText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer ml-auto"
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

          {/* Área de Texto o Previsualización */}
          {previewMode ? (
            <div className="w-full box-border min-h-[460px] p-6 bg-slate-50 border border-slate-200 rounded-2xl whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-sm select-text">
              {editorText || <span className="italic text-slate-400">El escrito está completamente vacío.</span>}
            </div>
          ) : (
            <textarea
              ref={editorTextareaRef}
              id="editor-notarial-activo"
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="Comience a redactar libremente, use una plantilla o pulse 'GENERAR BORRADOR CON IA' para asistencia jurídica..."
              rows={19}
              className="w-full box-border p-5 bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-2xl text-slate-800 font-mono text-xs leading-relaxed outline-none transition-colors resize-y shadow-inner"
            />
          )}

          {/* Aviso Notarial Mandatorio */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
            <AlertCircle className="w-4 h-4 text-[#FF3131] shrink-0" />
            <span>
              <strong>Aviso Legal Notarial:</strong> Todo documento generado en este sistema es un borrador avanzado que requiere la revisión, autorización y sello del Escribano Titular para poseer validez legal administrativa.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN INFERIOR DE ARCHIVOS Y CARPETAS (ESTILO GOOGLE DRIVE)          */}
      {/* ========================================================================= */}
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
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-6 relative group"
                >
                  <div className="flex flex-col gap-3.5 mb-4">
                    {/* Cabecera de la Tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                          <FileText className="w-5 h-5 text-[#FF3131]" />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate" title={escrito.tipo || 'Escrito'}>
                            {escrito.tipo || 'Escrito'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 truncate">
                            <Calendar className="w-3 h-3 shrink-0" /> <span className="truncate">{dateStr}</span>
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-slate-200 shrink-0">
                        {escrito.categoria || 'Sin Categoría'}
                      </span>
                    </div>

                    {/* Previsualización del Contenido */}
                    <div 
                      onClick={() => handleEditarDocumento(escrito)}
                      className="bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                      title="Haz clic para cargar en el Editor Notarial Activo"
                    >
                      <p className="text-xs text-slate-600 line-clamp-3 font-mono leading-relaxed select-none">
                        {escrito.texto}
                      </p>
                    </div>

                    {/* BARRA DE BOTONES OPERATIVOS OBLIGATORIOS (Editar, Duplicar, Mover, Eliminar) */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {/* BOTÓN EDITAR */}
                      <button
                        type="button"
                        onClick={() => handleEditarDocumento(escrito)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold transition-colors border border-slate-200 cursor-pointer"
                        title="Cargar documento en el Editor Notarial Activo"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-700" />
                        <span>Editar</span>
                      </button>

                      {/* BOTÓN DUPLICAR */}
                      <button
                        type="button"
                        onClick={() => handleDuplicarDocumento(escrito)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold transition-colors border border-slate-200 cursor-pointer"
                        title="Crear una copia exacta de este documento"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-700" />
                        <span>Duplicar</span>
                      </button>

                      {/* BOTÓN MOVER */}
                      <button
                        type="button"
                        onClick={() => {
                          setMovingDoc(escrito);
                          setTargetCategory(escrito.categoria || 'Sin Categoría');
                        }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold transition-colors border border-slate-200 cursor-pointer"
                        title="Mover documento a otra carpeta"
                      >
                        <FolderInput className="w-3.5 h-3.5 text-slate-700" />
                        <span>Mover</span>
                      </button>

                      {/* BOTÓN ELIMINAR */}
                      <button
                        type="button"
                        onClick={() => setDocToDelete(escrito)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-bold transition-colors border border-red-200 cursor-pointer"
                        title="Eliminar este documento del archivo"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#FF3131]" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Pie de tarjeta con opciones adicionales */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => onOpenDocument(escrito.texto)}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#FF3131]" />
                      <span>Imprimir / Exportar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditarDocumento(escrito)}
                      className="text-[#FF3131] hover:underline flex items-center gap-1 font-black cursor-pointer"
                    >
                      <span>Abrir en Editor &rarr;</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
          userId={currentUser.uid}
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
    </div>
  );
};
