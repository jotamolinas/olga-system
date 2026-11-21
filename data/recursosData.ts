export type RecursoCategory =
  | 'Escribanías'
  | 'Playas de Vehículos'
  | 'Inmobiliarias y Bienes Raíces'
  | 'Abogados'
  | 'Contadores y DNIT'
  | 'Empresas y Sociedades';

export interface RecursoSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface RecursoArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  category: RecursoCategory;
  audiences: string[];
  publishedAt: string;
  readTime: string;
  excerpt: string;
  keywords: string[];
  sections: RecursoSection[];
  olgaSolution: {
    title: string;
    description: string;
    ctaLabel: string;
  };
}

export const RECURSO_CATEGORIES: RecursoCategory[] = [
  'Escribanías',
  'Playas de Vehículos',
  'Inmobiliarias y Bienes Raíces',
  'Abogados',
  'Contadores y DNIT',
  'Empresas y Sociedades',
];

export const RECURSOS_ARTICLES: RecursoArticle[] = [
  {
    slug: 'pagare-a-la-orden-paraguay',
    title: 'Pagaré a la Orden en Paraguay: Requisitos Legales para Fuerza Ejecutiva',
    metaTitle: 'Pagaré a la Orden en Paraguay: Requisitos Legales | OLGA Legal Tech',
    metaDescription:
      'Guía práctica sobre los requisitos legales del pagaré a la orden en Paraguay, cláusula sin protesto, vencimientos y fuerza ejecutiva.',
    category: 'Abogados',
    audiences: ['Escribanías', 'Abogados', 'Playas de Vehículos', 'Empresas'],
    publishedAt: '2026-11-20',
    readTime: '6 min lectura',
    excerpt:
      'Qué cláusulas y datos exige el Código Civil paraguayo para que un pagaré conserve fuerza ejecutiva y evite excepciones formales en juicio.',
    keywords: [
      'pagaré a la orden paraguay',
      'requisitos legales pagaré paraguay',
      'pagaré con fuerza ejecutiva',
      'cláusula sin protesto paraguay',
      'OLGA Legal Tech pagarés',
    ],
    sections: [
      {
        heading: 'Qué convierte a un pagaré en título ejecutivo válido en Paraguay',
        paragraphs: [
          'En Paraguay, el pagaré a la orden se rige por las disposiciones del Código Civil Paraguayo sobre títulos de crédito y por el Código Procesal Civil en lo relativo a la vía ejecutiva. Para que el acreedor pueda iniciar un juicio ejecutivo rápido sin tener que probar primero el origen de la deuda en un juicio ordinario, el documento debe reunir requisitos formales estrictos.',
          'Cualquier omisión en la denominación del título, en la promesa pura y simple de pagar una suma determinada o en la identificación clara del deudor y acreedor puede dar lugar a una excepción de inhabilidad de título.',
        ],
        bullets: [
          'Denominación expresa de "Pagaré a la Orden" inserta en el texto del documento.',
          'Promesa pura y simple de pagar una suma determinada de dinero (en guaraníes o moneda extranjera), expresada en números y letras coincidentes.',
          'Indicación exacta del vencimiento (a fecha fija, a la vista, a cierto plazo desde la fecha) y lugar de pago.',
          'Nombre completo, documento de identidad (C.I. o RUC) y domicilio real/especial del librador o deudor.',
          'Fecha y lugar de emisión del pagaré, junto con la firma autógrafa del librador.',
        ],
      },
      {
        heading: 'Importancia de la cláusula "Sin Protesto" y del domicilio especial',
        paragraphs: [
          'Incluir la cláusula "sin protesto" (dispensa de protesto por falta de pago) evita trámites notariales previos costosos y agiliza la ejecución judicial apenas ocurre la mora del deudor.',
          'Asimismo, consignar la fijación de domicilio especial y el sometimiento a la jurisdicción de los juzgados correspondientes previene incidentes de nulidad de notificación al momento de intimar de pago.',
        ],
      },
      {
        heading: 'Errores frecuentes al emitir pagarés en Excel o Word',
        paragraphs: [
          'Muchas empresas, playas de vehículos e inmobiliarias redactan pagarés editando plantillas antiguas de Word. En la práctica diaria, ese método genera discrepancias entre el monto en cifras y el monto en letras, fechas de vencimiento mal calculadas en ventas en cuotas o errores en el número de cédula.',
          'Cuando un documento tiene enmiendas sin salvar o inconsistencias entre números y letras, el riesgo procesal recae íntegramente sobre el acreedor.',
        ],
        bullets: [
          'Diferencias entre el capital numérico y su redacción literal en guaraníes.',
          'Falta de aclaración sobre intereses moratorios o punitorios pactados.',
          'Omisión de datos completos del codeudor o garante solidario.',
          'Pérdida de trazabilidad al no contar con un registro ordenado de vencimientos.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Emite pagarés a la orden sin errores formales con OLGA Legal Tech',
      description:
        'OLGA Legal Tech (O.L.G.A.) convierte automáticamente los montos a letras en guaraníes o dólares, valida C.I. y RUC de tu fichero de clientes, incluye cláusulas ejecutivas conforme al derecho paraguayo y centraliza tus vencimientos en un solo panel.',
      ctaLabel: 'Generar pagarés en OLGA Legal Tech',
    },
  },
  {
    slug: 'arancel-notarial-ley-879-81',
    title: 'Arancel Notarial Ley 879/81 en Paraguay: Cálculo de Honorarios, Tasas e IVA',
    metaTitle: 'Arancel Notarial Ley 879/81 Paraguay | OLGA Legal Tech',
    metaDescription:
      'Cómo calcular presupuestos notariales en Paraguay según la Ley 879/81: honorarios mínimos, tasas registrales, IVA y gastos administrativos.',
    category: 'Escribanías',
    audiences: ['Escribanías', 'Contadores', 'Inmobiliarias'],
    publishedAt: '2026-11-20',
    readTime: '6 min lectura',
    excerpt:
      'Desglose claro de cómo aplicar las escalas arancelarias de la Ley 879/81 para cotizar transferencias de inmuebles, vehículos, hipotecas y sociedades.',
    keywords: [
      'ley 879/81 arancel notarial paraguay',
      'cálculo presupuestos escribanía paraguay',
      'honorarios escribano paraguay',
      'presupuesto transferencia inmueble paraguay',
    ],
    sections: [
      {
        heading: 'Marco legal del Arancel Notarial en Paraguay',
        paragraphs: [
          'El ejercicio de la función notarial en la República del Paraguay se encuentra regulado por el Código de Organización Judicial (Ley N° 879/81) y sus disposiciones arancelarias aplicables. Cotizar con precisión una escritura pública exige distinguir claramente qué corresponde a honorarios profesionales del escribano y qué corresponde a tasas judiciales, registrales, municipales y tributos.',
          'Entregar un presupuesto desordenado o aproximado al cliente genera fricciones comerciales y compromete la rentabilidad de la escribanía.',
        ],
      },
      {
        heading: 'Componentes que integran un presupuesto notarial completo',
        paragraphs: [
          'Un presupuesto profesional transparente para una compraventa de inmueble, hipoteca, transferencia de automotor o constitución societaria debe detallar por separado cada concepto:',
        ],
        bullets: [
          'Honorarios Notariales según escala porcentual o monto fijo de la Ley 879/81 de acuerdo con la cuantía del acto.',
          'IVA (10%) aplicado sobre los honorarios notariales gravados.',
          'Tasas de Dirección General de los Registros Públicos (DGRP) y Dirección del Registro del Automotor, según corresponda.',
          'Tasas Judiciales, certificados de condiciones de dominio, anotaciones personales y libre de deuda municipal.',
          'Gastos de papel sellado, fojas de seguridad notarial de la CSJ y gestoría administrativa.',
        ],
      },
      {
        heading: 'Por qué automatizar tus presupuestos notariales',
        paragraphs: [
          'Calcular manualmente escalas, mínimos legales, porcentajes de IVA y tasas en cada consulta telefónica consume tiempo valioso del escribano y de sus auxiliares. Automatizar la liquidación permite emitir un presupuesto formal con membrete en segundos, manteniendo criterios uniformes en todo el equipo.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Calcula presupuestos bajo Ley 879/81 en segundos',
      description:
        'El módulo de Presupuestos y Facturación Notarial de OLGA Legal Tech (O.L.G.A.) desglosa honorarios mínimos, IVA y gastos registrales para inmuebles, rodados, poderes y sociedades con impresión directa con tu membrete.',
      ctaLabel: 'Probar calculadora notarial en OLGA',
    },
  },
  {
    slug: 'fojas-seguridad-csj-calibracion',
    title: 'Fojas de Seguridad Notarial CSJ (216 × 330 mm): Cómo Imprimir Sin Desfasajes',
    metaTitle: 'Fojas de Seguridad CSJ 216x330 mm | OLGA Legal Tech',
    metaDescription:
      'Guía técnica para imprimir en fojas de seguridad notarial de la Corte Suprema de Justicia de Paraguay (Hoja 0, 1, 2 y 3) con precisión milimétrica.',
    category: 'Escribanías',
    audiences: ['Escribanías', 'Notarías'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Medidas oficiales de las fojas de la Corte Suprema de Justicia de Paraguay y cómo evitar perder papel notarial al imprimir Certificación, Concuerda y Protocolo.',
    keywords: [
      'hojas de seguridad notarial csj',
      'imprimir protocolo notarial paraguay',
      'certificación de firmas hoja 0 hoja 1',
      'concuerda notarial hoja 2 paraguay',
      'medidas papel notarial 216x330',
    ],
    sections: [
      {
        heading: 'El problema diario de imprimir sobre papel notarial físico',
        paragraphs: [
          'Las fojas de seguridad notarial emitidas por la Corte Suprema de Justicia (CSJ) tienen un formato específico de 216 mm × 330 mm (Oficio largo paraguayo) con escudos, códigos, numeración y áreas reservadas en el encabezado y márgenes.',
          'Cuando una escribanía redacta en procesadores de texto genéricos como Word, un simple cambio de impresora, de fuente o de margen en pulgadas suele desfasar todo el texto varios milímetros, pisando el membrete de seguridad e inutilizando una foja valorada.',
        ],
      },
      {
        heading: 'Estructura y usos de cada hoja notarial en Paraguay',
        paragraphs: [
          'Cada tipo de actuación notarial exige respetar márgenes superiores, izquierdos y derechos exactos tanto en anverso como en reverso:',
        ],
        bullets: [
          'Certificación de Firmas (Hoja 0 y Hoja 1): espacios exactos para individualización de comparecientes, número de documento, fecha, sellos y rúbrica notarial.',
          'Concuerda Notarial (Hoja 2): formato estricto para testimonios por exhibición y copias fieles de matrices.',
          'Legalización y Protocolo (Hoja 3): alineación milimétrica de escrituras matrices en anverso y reverso sin invadir los bordes de seguridad.',
        ],
      },
      {
        heading: 'Buenas prácticas de calibración antes de imprimir',
        paragraphs: [
          'Siempre configura la bandeja de tu impresora láser o de inyección en tamaño personalizado 216 × 330 mm, desactiva cualquier opción de "ajustar a página" o "reducir para ajustar" en el cuadro de diálogo de impresión del navegador y utiliza un lienzo diseñado específicamente en milímetros.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Lienzo Notarial Milimétrico homologado para fojas CSJ',
      description:
        'OLGA Legal Tech (O.L.G.A.) incluye coordenadas calibradas en milímetros reales para Hoja 0, Hoja 1, Hoja 2 y Hoja 3 con vista previa 1:1 en pantalla y ajuste de anverso y reverso.',
      ctaLabel: 'Ver Lienzo Notarial en OLGA',
    },
  },
  {
    slug: 'playas-vehiculos-pagares-compraventa',
    title: 'Playas de Vehículos en Paraguay: Cómo Blindar Ventas Financiadas con Pagarés',
    metaTitle: 'Software para Playas de Vehículos Paraguay | OLGA Legal Tech',
    metaDescription:
      'Cómo proteger ventas de autos financiados en Paraguay con contratos de compraventa, certificación de firmas y pagarés a la orden sin vicios formales.',
    category: 'Playas de Vehículos',
    audiences: ['Playas de Vehículos', 'Concesionarias', 'Escribanías'],
    publishedAt: '2026-11-20',
    readTime: '6 min lectura',
    excerpt:
      'Checklist legal y operativo para playas de autos y concesionarias en Paraguay: documentación del vehículo, contratos privados y pagarés por cuotas.',
    keywords: [
      'software para playas de vehículos paraguay',
      'pagarés para venta de autos paraguay',
      'contrato compraventa vehículo paraguay',
      'financiación propia playa de autos',
    ],
    sections: [
      {
        heading: 'Los riesgos de la financiación propia en playas de autos',
        paragraphs: [
          'En el rubro automotor paraguayo, gran parte de las operaciones se cierra con entrega inicial y saldo financiado en cuotas propias de 12 a 36 meses. Si el respaldo documental se limita a recibos simples o pagarés mal llenados a mano, recuperar el saldo impago en vía judicial se vuelve lento y costoso.',
          'Blindar la operación desde el día de entrega del rodado protege el capital de la concesionaria y agiliza la gestión de cobranza.',
        ],
      },
      {
        heading: 'Documentación indispensable en cada operación financiada',
        paragraphs: [
          'Antes de entregar las llaves de un vehículo financiado, toda playa o concesionaria debería estandarizar cuatro piezas documentales:',
        ],
        bullets: [
          'Contrato privado de compraventa de automotor con identificación completa de chasis, motor, chapa/registro y condición de reserva o pacto de pago.',
          'Pagarés a la orden por el saldo financiado (único o seriados por cuotas) con cláusula sin protesto y datos verificados del comprador y codeudor.',
          'Ficha del cliente con copia de C.I. vigente, verificación de RUC / Dígito Verificador y domicilio real confirmado.',
          'Certificación de firmas ante Escribano Público para dar fecha cierta y autenticidad a la firma de las partes.',
        ],
      },
      {
        heading: 'Cómo acelerar el cierre de ventas sin errores de tipeo',
        paragraphs: [
          'Cuando un comprador llega a la playa para retirar el vehículo, esperar horas por la redacción manual de contratos y pagarés puede enfriar la venta. Centralizar los datos del cliente en un fichero único permite emitir el contrato y los pagarés en minutos, listos para imprimir y firmar.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Emití contratos y pagarés de tu playa de autos en 2 minutos',
      description:
        'Con OLGA Legal Tech (O.L.G.A.), cargas al comprador una sola vez en el Fichero de Personas y generas el contrato de compraventa junto con los pagarés ejecutivos de todas sus cuotas, con control de vencimientos.',
      ctaLabel: 'Usar OLGA en tu Playa de Vehículos',
    },
  },
  {
    slug: 'inmobiliarias-loteadoras-pagares-lotes',
    title: 'Inmobiliarias y Loteadoras en Paraguay: Contratos, Cuotas y Pagarés Ejecutivos',
    metaTitle: 'Software para Inmobiliarias y Loteadoras Paraguay | OLGA Legal Tech',
    metaDescription:
      'Organiza boletos de compraventa de lotes, planes de cuotas y pagarés a la orden en inmobiliarias y loteadoras de Paraguay.',
    category: 'Inmobiliarias y Bienes Raíces',
    audiences: ['Inmobiliarias', 'Loteadoras', 'Bienes Raíces'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Cómo estructurar jurídicamente la venta de terrenos en cuotas, reservas inmobiliarias y cobros respaldados por pagarés ejecutivos en Paraguay.',
    keywords: [
      'software inmobiliarias paraguay',
      'pagarés para loteadoras paraguay',
      'boleto compraventa inmueble paraguay',
      'gestión cuotas lotes terrenos paraguay',
    ],
    sections: [
      {
        heading: 'Seguridad documental en ventas de lotes e inmuebles a plazo',
        paragraphs: [
          'Las loteadoras, desarrolladoras e inmobiliarias en Paraguay administran decenas o cientos de contratos activos con financiación a largo plazo. Mantener ordenada la relación entre el boleto de compraventa, la identificación catastral (Finca/Matrícula y Padrón o Cuenta Corriente Catastral) y los títulos de crédito de respaldo es esencial para evitar conflictos.',
        ],
      },
      {
        heading: 'Claves para documentar cuotas inmobiliarias con respaldo',
        paragraphs: [
          'Una gestión inmobiliaria ordenada combina instrumentos contractuales claros con seguimiento de vencimientos:',
        ],
        bullets: [
          'Individualización exacta del inmueble: distrito, finca/matrícula, manzana, lote, superficie y linderos.',
          'Condiciones claras de mora, reajuste o caducidad de plazos en el boleto privado de compraventa.',
          'Emisión prolija de pagarés a la orden vinculados al contrato, sin discrepancias de fechas ni importes.',
          'Fichero unificado de compradores y garantes con validación de C.I. y RUC.',
        ],
      },
      {
        heading: 'Coordinación fluida con la escribanía interviniente',
        paragraphs: [
          'Cuando llega el momento de escriturar la transferencia definitiva ante escribano público, contar con presupuestos estimados bajo la Ley 879/81 y con toda la documentación de los compradores ordenada ahorra semanas de gestiones.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Gestiona boletos, pagarés y clientes inmobiliarios en un solo lugar',
      description:
        'OLGA Legal Tech (O.L.G.A.) permite a inmobiliarias y bienes raíces generar contratos, emitir pagarés a la orden para cuotas de lotes, validar C.I./RUC y estimar gastos de escrituración.',
      ctaLabel: 'Explorar planes para Inmobiliarias',
    },
  },
  {
    slug: 'constitucion-empresas-sa-srl-eas-paraguay',
    title: 'Constitución de Empresas en Paraguay: Diferencias entre S.A., S.R.L. y E.A.S.',
    metaTitle: 'Constitución de S.A., S.R.L. y E.A.S. en Paraguay | OLGA Legal Tech',
    metaDescription:
      'Comparativa práctica de S.A., S.R.L. y E.A.S. en Paraguay: socios, capital, escritura pública, SUACE y documentación necesaria.',
    category: 'Empresas y Sociedades',
    audiences: ['Empresas', 'Escribanías', 'Contadores', 'Abogados'],
    publishedAt: '2026-11-20',
    readTime: '7 min lectura',
    excerpt:
      'Guía comparativa para elegir y preparar la documentación de constitución societaria en Paraguay entre Sociedad Anónima, S.R.L. y Empresa por Acciones Simplificada.',
    keywords: [
      'constitución de empresas paraguay',
      'diferencia SA SRL EAS paraguay',
      'constituir sociedad anónima paraguay',
      'requisitos SRL escribanía paraguay',
    ],
    sections: [
      {
        heading: 'Cómo elegir la figura societaria adecuada en Paraguay',
        paragraphs: [
          'Al asesorar a emprendedores o inversionistas en Paraguay, escribanos, abogados y contadores suelen evaluar tres vehículos principales: la Sociedad Anónima (S.A.), la Sociedad de Responsabilidad Limitada (S.R.L.) y la Empresa por Acciones Simplificada (E.A.S., creada por la Ley N° 6480/20).',
          'Cada estructura tiene reglas distintas en cuanto a cantidad de socios, formalidad de estatutos, cesión de participaciones y agilidad de apertura ante el SUACE y la DNIT.',
        ],
      },
      {
        heading: 'Comparativa rápida: E.A.S. vs. S.R.L. vs. S.A.',
        paragraphs: [
          'Antes de redactar el estatuto social o la escritura constitutiva, ten en cuenta estas diferencias esenciales:',
        ],
        bullets: [
          'E.A.S. (Empresa por Acciones Simplificada): admite socio único (1 persona física o jurídica), trámite simplificado por plataforma oficial y gran flexibilidad estatutaria.',
          'S.R.L. (Sociedad de Responsabilidad Limitada): requiere mínimo 2 socios y máximo 25; el capital se divide en cuotas sociales cuya cesión exige modificación de estatuto e inscripción registral.',
          'S.A. (Sociedad Anónima): requiere mínimo 2 accionistas, se constituye obligatoriamente por escritura pública ante Escribano Público, posee acciones nominativas y directorio/sindicatura.',
        ],
      },
      {
        heading: 'Documentación previa que debe reunir el escribano o gestor',
        paragraphs: [
          'Para evitar observaciones de la Abogacía del Tesoro o de los Registros Públicos, conviene recopilar previamente los datos completos de todos los socios o accionistas (nombre completo, nacionalidad, estado civil, profesión, C.I. o pasaporte, RUC si posee, domicilio real), el objeto social preciso, la denominación verificada y el porcentaje de integración de capital.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Prepara estatutos y presupuestos societarios más rápido',
      description:
        'OLGA Legal Tech (O.L.G.A.) incluye módulos para preparar borradores de constitución de S.A., S.R.L. y E.A.S., validar los datos de los socios en tu fichero y calcular el presupuesto notarial correspondiente.',
      ctaLabel: 'Ver herramientas societarias en OLGA',
    },
  },
  {
    slug: 'juicio-ejecutivo-pagare-paraguay-abogados',
    title: 'Juicio Ejecutivo por Pagarés Impagos en Paraguay: Errores Formales que Evitar',
    metaTitle: 'Juicio Ejecutivo por Pagarés en Paraguay | OLGA Legal Tech',
    metaDescription:
      'Checklist para estudios jurídicos y abogados en Paraguay antes de iniciar un juicio ejecutivo basado en pagarés a la orden.',
    category: 'Abogados',
    audiences: ['Abogados', 'Estudios Jurídicos', 'Empresas'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Revisión procesal previa para abogados que reciben pagarés de clientes comerciales, financieras o concesionarias en Paraguay.',
    keywords: [
      'juicio ejecutivo pagaré paraguay',
      'excepción inhabilidad de título paraguay',
      'cobro judicial pagarés paraguay',
      'software para abogados paraguay',
    ],
    sections: [
      {
        heading: 'Por qué fracasan algunas ejecuciones de pagarés en tribunales',
        paragraphs: [
          'Muchos estudios jurídicos reciben de sus clientes comerciales pagarés firmados meses atrás con fallas de redacción que recién saltan cuando el demandado opone excepciones en el juicio ejecutivo.',
          'Una auditoría formal previa del título ahorra costas judiciales y permite definir si corresponde acción ejecutiva directa o preparación de acción ejecutiva (reconocimiento judicial de firma).',
        ],
      },
      {
        heading: 'Puntos críticos de revisión jurídica antes de demandar',
        paragraphs: [
          'Al auditar un pagaré en Paraguay conviene verificar sistemáticamente los siguientes aspectos:',
        ],
        bullets: [
          'Coincidencia exacta entre firma, aclaración y número de cédula del librador.',
          'Verificación de la fecha de vencimiento para descartar prescripción cambiaria (cuatro años desde el vencimiento según el Código Civil paraguayo, según corresponda).',
          'Correcta expresión del monto en guaraníes o moneda extranjera sin tachaduras ni enmiendas no salvadas.',
          'Identificación de codeudores o avalistas solidarios y verificación de personería si firmó un representante de S.A. o S.R.L.',
        ],
      },
      {
        heading: 'Asesorar al cliente desde la emisión del documento',
        paragraphs: [
          'Los estudios jurídicos que proveen a sus clientes empresas estándares digitales de emisión evitan recibir documentos defectuosos. Estandarizar la emisión desde el origen mejora drásticamente la tasa de recupero extrajudicial y judicial.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Oráculo Legal IA y auditoría de documentos para estudios jurídicos',
      description:
        'OLGA Legal Tech (O.L.G.A.) combina emisión estandarizada de pagarés sin vicios formales, acuerdos extrajudiciales y el Oráculo Legal IA para consultas normativas paraguayas.',
      ctaLabel: 'Conocer OLGA para Estudios Jurídicos',
    },
  },
  {
    slug: 'ruc-digito-verificador-sifen-dnit-paraguay',
    title: 'Validación de RUC, Dígito Verificador (DV) y Preparación SIFEN / DNIT en Paraguay',
    metaTitle: 'Validación de RUC, DV y SIFEN DNIT Paraguay | OLGA Legal Tech',
    metaDescription:
      'Por qué es clave validar el RUC y Dígito Verificador (DV) ante la DNIT en escribanías, estudios contables y empresas de Paraguay.',
    category: 'Contadores y DNIT',
    audiences: ['Contadores', 'Empresas', 'Escribanías'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Cómo evitar rechazos de comprobantes electrónicos SIFEN y errores tributarios validando automáticamente RUC, C.I. y desglose de IVA (10% / 5%).',
    keywords: [
      'calcular dígito verificador RUC paraguay',
      'validación RUC DNIT paraguay',
      'facturación electrónica SIFEN paraguay',
      'software para contadores paraguay',
    ],
    sections: [
      {
        heading: 'El impacto de un RUC mal cargado en la facturación y en escrituras',
        paragraphs: [
          'Con la consolidación de la Dirección Nacional de Ingresos Tributarios (DNIT) y la expansión obligatoria del Sistema Integrado de Facturación Electrónica Nacional (SIFEN), un solo dígito mal tipeado en el RUC o en el Dígito Verificador (DV) provoca rechazos de documentos electrónicos, rectificaciones contables y demoras en el cierre mensual.',
          'En escribanías y estudios jurídicos, un error en el identificador tributario de un otorgante también afecta certificados, liquidaciones y declaraciones informativas.',
        ],
      },
      {
        heading: 'Cómo funciona el Dígito Verificador y el control preventivo',
        paragraphs: [
          'En Paraguay, el Dígito Verificador del RUC se calcula aplicando el algoritmo Módulo 11 oficial sobre el número base (generalmente el número de cédula en personas físicas o la serie 800XXXXX en personas jurídicas).',
        ],
        bullets: [
          'Calcula automáticamente el DV antes de guardar un cliente nuevo en tu base.',
          'Separa correctamente tasas exentas, IVA 5% e IVA 10% en presupuestos y liquidaciones.',
          'Mantén un directorio único de personas físicas y jurídicas compartido entre el equipo administrativo, notarial y contable.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Directorio de Personas con validación automática de RUC y DV',
      description:
        'OLGA Legal Tech (O.L.G.A.) calcula y verifica el Dígito Verificador al instante en tu Fichero de Personas y desglosa el IVA oficial en presupuestos preparados para fluir con tu gestión ante la DNIT y SIFEN.',
      ctaLabel: 'Probar validación RUC/DV en OLGA',
    },
  },
  {
    slug: 'seprelad-escribanias-debida-diligencia-paraguay',
    title: 'Cumplimiento SEPRELAD en Escribanías de Paraguay: Debida Diligencia y Registros',
    metaTitle: 'SEPRELAD para Escribanías en Paraguay | OLGA Legal Tech',
    metaDescription:
      'Pautas clave de prevención de lavado de activos (SEPRELAD) para escribanías y notarías públicas en Paraguay: debida diligencia y legajos.',
    category: 'Escribanías',
    audiences: ['Escribanías', 'Notarías', 'Abogados'],
    publishedAt: '2026-11-20',
    readTime: '6 min lectura',
    excerpt:
      'Qué exige la normativa de la SEPRELAD a los Escribanos Públicos como sujetos obligados en Paraguay y cómo organizar tus legajos sin papeles sueltos.',
    keywords: [
      'SEPRELAD escribanías paraguay',
      'debida diligencia escribano paraguay',
      'sujeto obligado notario SEPRELAD',
      'formulario KYC escribanía paraguay',
    ],
    sections: [
      {
        heading: 'El rol del Escribano Público como Sujeto Obligado ante la SEPRELAD',
        paragraphs: [
          'En Paraguay, los Escribanos y Notarios Públicos son sujetos obligados bajo las resoluciones de la Secretaría de Prevención de Lavado de Dinero o Bienes (SEPRELAD) cuando intervienen en operaciones inmobiliarias, constitución o modificación de sociedades, administración de fondos o actos patrimoniales relevantes.',
          'Cumplir con las políticas de Conozca a su Cliente (KYC) y Debida Diligencia evita sanciones administrativas en inspecciones y resguarda la responsabilidad profesional del titular del registro.',
        ],
      },
      {
        heading: 'Qué debe contener un legajo de Debida Diligencia ordenado',
        paragraphs: [
          'Tener la información dispersa en chats de WhatsApp o carpetas físicas sin índice dificulta responder a una auditoría. Toda escribanía debería estandarizar:',
        ],
        bullets: [
          'Identificación verificada de otorgantes (personas físicas y beneficiarios finales de personas jurídicas).',
          'Declaración de origen lícito de los fondos y perfil transaccional acorde al acto.',
          'Verificación de condición de Persona Expuesta Políticamente (PEP) cuando corresponda.',
          'Conservación ordenada, trazable y con registro de auditoría (Audit Logs) por el plazo legal vigente.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Módulo SEPRELAD y Audit Logs integrados en tu escribanía',
      description:
        'En los planes Empresa y Full, OLGA Legal Tech (O.L.G.A.) integra herramientas dedicadas de cumplimiento SEPRELAD junto con el historial de auditoría notarial y el Fichero de Personas unificado.',
      ctaLabel: 'Ver módulo SEPRELAD en OLGA',
    },
  },
  {
    slug: 'alquiler-inmuebles-garantias-paraguay',
    title: 'Contratos de Alquiler en Paraguay: Cláusulas Clave, Garantías y Pagarés de Respaldo',
    metaTitle: 'Contratos de Alquiler y Garantías Paraguay | OLGA Legal Tech',
    metaDescription:
      'Cómo redactar contratos de locación de inmuebles en Paraguay protegiendo al propietario e inmobiliaria con garantías y pagarés ejecutivos.',
    category: 'Inmobiliarias y Bienes Raíces',
    audiences: ['Inmobiliarias', 'Bienes Raíces', 'Abogados', 'Escribanías'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Recomendaciones prácticas para inmobiliarias y propietarios en Paraguay: plazos, inventario, codeudores solidarios y ejecución de alquileres impagos.',
    keywords: [
      'contrato de alquiler paraguay modelo',
      'garantía alquiler paraguay',
      'pagaré alquiler inmueble paraguay',
      'inmobiliarias bienes raíces paraguay',
    ],
    sections: [
      {
        heading: 'Cómo prevenir conflictos habituales en locaciones comerciales y residenciales',
        paragraphs: [
          'En el sector de bienes raíces en Paraguay, los conflictos más frecuentes entre locadores e inquilinos surgen por contratos ambiguos sobre servicios públicos (ANDE, ESSAP), reparaciones locativas, subarrendamientos no autorizados y devolución del depósito de garantía.',
        ],
      },
      {
        heading: 'Cláusulas esenciales que todo contrato de alquiler debería precisar',
        bullets: [
          'Objeto, destino exclusivo (vivienda o comercio), plazo determinado y canon mensual en moneda pactada.',
          'Individualización de codeudor solidario o fiador principal pagador, o garantía documental adicional.',
          'Inventario de entrega firmado por ambas partes detallando estado de pintura, aberturas, aires acondicionados e instalaciones.',
          'Procedimiento de mora, multa diaria por retención indebida tras el vencimiento y facultad de rescisión por falta de pago.',
        ],
        paragraphs: [
          'Contar con pagarés debidamente emitidos o acuerdos de pago documentados facilita la recuperación de cánones atrasados o daños comprobados sin dilaciones.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Plantillas legales de locación y pagarés para tu inmobiliaria',
      description:
        'OLGA Legal Tech (O.L.G.A.) pone a disposición de inmobiliarias y abogados plantillas editables de contratos de alquiler, gestión de escritos y emisión rápida de pagarés vinculados al fichero de inquilinos y garantes.',
      ctaLabel: 'Gestionar contratos en OLGA',
    },
  },
  {
    slug: 'certificacion-firmas-concuerda-protocolo-paraguay',
    title: 'Certificación de Firmas, Concuerda y Legalización Notarial en Paraguay: Guía Práctica',
    metaTitle: 'Certificación de Firmas y Concuerda Paraguay | OLGA Legal Tech',
    metaDescription:
      'Diferencias entre Certificación de Firmas, Concuerda por exhibición y Legalización en escribanías de Paraguay y qué hoja CSJ usar en cada caso.',
    category: 'Escribanías',
    audiences: ['Escribanías', 'Empresas', 'Playas de Vehículos'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Resumen claro sobre cuándo corresponde certificación de firmas, cuándo se emite un concuerda notarial y cómo redactarlos en segundos.',
    keywords: [
      'certificación de firmas escribano paraguay',
      'qué es concuerda notarial paraguay',
      'legalización notarial paraguay',
      'software notarial paraguay',
    ],
    sections: [
      {
        heading: 'Distinción práctica entre los actos notariales extraprotocolares y protocolares',
        paragraphs: [
          'Para auxiliares de escribanía, gestores y empresas que tramitan documentos a diario, distinguir con precisión qué actuación corresponde agiliza el trabajo en mostrador y evita rehacer impresiones.',
        ],
        bullets: [
          'Certificación de Firmas: el escribano da fe de que las firmas estampadas en un documento privado (contratos de vehículos, autorizaciones, pagarés, formularios) pertenecen a los comparecientes identificados ante él en la fecha indicada.',
          'Concuerda (Copia Autenticada): acredita que una copia fotostática o impresa coincide fielmente con su documento original exhibido en el acto.',
          'Protocolo y Testimonios: actuaciones matrices incorporadas al protocolo notarial (escrituras públicas de transferencia, poderes, hipotecas, estatutos) y sus respectivos testimonios.',
        ],
      },
      {
        heading: 'Estandarización de textos canónicos en la escribanía',
        paragraphs: [
          'Utilizar plantillas validadas con los datos pre-cargados desde el fichero de comparecientes reduce drásticamente el tiempo de redacción de certificaciones múltiples y elimina errores de tipeo en nombres, estados civiles o números de cédula.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Redacción asistida e impresión directa por tipo de foja',
      description:
        'En OLGA Legal Tech (O.L.G.A.) seleccionas al compareciente de tu Fichero de Personas, eliges Hoja 0, 1, 2 o 3 y generas la actuación lista para imprimir sin perder formato.',
      ctaLabel: 'Abrir Lienzo Notarial en OLGA',
    },
  },
  {
    slug: 'cartera-creditos-cuentas-por-cobrar-empresas',
    title: 'Control de Cartera de Créditos y Cuentas por Cobrar en Empresas de Paraguay',
    metaTitle: 'Control de Cartera y Pagarés para Empresas | OLGA Legal Tech',
    metaDescription:
      'Cómo ordenar cuentas por cobrar, alertas de vencimientos y pagarés en comercios, cooperativas, financieras y empresas de Paraguay.',
    category: 'Empresas y Sociedades',
    audiences: ['Empresas', 'Contadores', 'Financieras'],
    publishedAt: '2026-11-20',
    readTime: '5 min lectura',
    excerpt:
      'Metodología práctica para dejar atrás las planillas dispersas y controlar documentos por cobrar, vencimientos próximos y morosidad en tiempo real.',
    keywords: [
      'control de cuentas por cobrar paraguay',
      'gestión de pagarés empresas paraguay',
      'software cobranzas paraguay',
      'cartera de créditos pymes paraguay',
    ],
    sections: [
      {
        heading: 'El costo oculto de controlar pagarés en carpetas y planillas sueltas',
        paragraphs: [
          'En muchas empresas comerciales, casas de electrodomésticos, financieras y concesionarias, los pagarés firmados se archivan en biblioratos y se anotan en planillas locales que nadie actualiza a tiempo. Cuando un vencimiento pasa inadvertido o un documento físico se extravía, la empresa pierde liquidez y capacidad de cobro oportuno.',
        ],
      },
      {
        heading: 'Pilares para una cartera de cobros sana y auditable',
        bullets: [
          'Numeración correlativa y serie anual automática para cada pagaré emitido.',
          'Alertas tempranas de vencimientos próximos para gestión preventiva por WhatsApp o llamada antes de la mora.',
          'Estado actualizado de cada documento (Vigente, Cobrado, Notificado, Anulado) vinculado al historial del cliente.',
          'Respaldo seguro en la nube con acceso controlado por usuario dentro de la misma empresa.',
        ],
        paragraphs: [
          'Centralizar emisión y seguimiento en una misma herramienta reduce horas administrativas cada semana y aporta visibilidad inmediata a gerencia y contabilidad.',
        ],
      },
    ],
    olgaSolution: {
      title: 'Digitaliza tus pagarés y alertas de vencimiento en OLGA Legal Tech',
      description:
        'OLGA Legal Tech (O.L.G.A.) incluye tablero de control, campana de notificaciones de vencimientos notariales y comerciales, y fichero aislado por empresa en la nube.',
      ctaLabel: 'Comenzar con OLGA Legal Tech',
    },
  },
];

export const getRecursoBySlug = (slug: string): RecursoArticle | undefined =>
  RECURSOS_ARTICLES.find((article) => article.slug === slug);
