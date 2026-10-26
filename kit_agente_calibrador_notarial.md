# Kit Consolidado de Automatización: Calibración Milimétrica Hoja por Hoja (O.L.G.A)

Coloca este documento o extrae su estructura directamente en la raíz de tu proyecto O.L.G.A con la siguiente jerarquía:

```text
tu-proyecto-olga/
└── .agents/
    └── skills/
        └── calibrador-lienzo-notarial/
            ├── SKILL.md
            └── scripts/
                ├── verificar_hoja_0_mm.mjs
                ├── verificar_hoja_1_mm.mjs
                ├── verificar_hoja_2_mm.mjs
                └── verificar_hoja_3_mm.mjs
```

---

## 1. Archivo de Instrucción General (`.agents/skills/calibrador-lienzo-notarial/SKILL.md`)

```markdown
---
name: calibrador-lienzo-notarial
description: Calibra, alinea y verifica milimétricamente la posición de textos, márgenes y renglones de las 4 hojas del módulo Lienzo Notarial de O.L.G.A para impresión en papel de seguridad notarial (Paraguay).
---

# Habilidad: Calibrador Milimétrico de Hojas Notariales (O.L.G.A)

## Objetivo
Lograr que la impresión de cada hoja del módulo Lienzo Notarial coincida con precisión milimétrica (tolerancia máxima de ±0.25 mm) sobre el papel oficial de protocolo y legalización, ejecutando pruebas automatizadas hasta que el script validador retorne código de salida 0.

## Reglas Estrictas de Impresión Física
1. **Unidades físicas obligatorias**: Prohibido usar `px`, `rem`, `em` o `%` en bloques de impresión. Usa exclusivamente milímetros (`mm`) o puntos (`pt`).
2. **Márgenes de Página**: Cada `@page` debe configurarse estrictamente a `215.9mm 355.6mm` con `margin: 0mm !important`.
3. **Posicionamiento absoluto**: Cada campo flotante debe usar coordenadas físicas exactas (`top` y `left` en `mm`).
```

---

## 2. Scripts de Verificación Milimétrica (Hoja 0 a Hoja 3)

### Script 1: Hoja 0 (Grilla Principal del Anverso)
*Ruta: `.agents/skills/calibrador-lienzo-notarial/scripts/verificar_hoja_0_mm.mjs`*

```javascript
import { chromium } from 'playwright';
import fs from 'fs';

const PX_PER_MM = 96 / 25.4;
const TOLERANCIA_MM = 0.25;

const ESPECIFICACION_HOJA = {
  anchoHojaMm: 215.9,
  altoHojaMm: 355.6,
  zonasEsperadas: [
    {
      selector: '#notarial-cuerpo-texto',
      nombre: 'Grilla de 25 Renglones (Hoja 0)',
      topMm: 42.55,
      leftMm: 30.0,
      widthMm: 155.9,
      lineHeightMm: 8.47,
      maxLineas: 25
    }
  ]
};

async function verificarHoja0() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({
    width: Math.round(ESPECIFICACION_HOJA.anchoHojaMm * PX_PER_MM),
    height: Math.round(ESPECIFICACION_HOJA.altoHojaMm * PX_PER_MM)
  });

  const urlLienzo = process.env.OLGA_PRINT_URL || 'http://localhost:5173/lienzo-notarial/hoja-0';
  await page.goto(urlLienzo, { waitUntil: 'networkidle' });

  const errores = [];
  const zona = ESPECIFICACION_HOJA.zonasEsperadas[0];
  const elemento = await page.$(zona.selector);
  
  if (!elemento) {
    console.error(`❌ FALTA SELECTOR: No se encontró ${zona.selector}`);
    process.exit(1);
  }

  const medicion = await elemento.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return { topPx: rect.top, leftPx: rect.left, widthPx: rect.width, lineHeightPx: parseFloat(style.lineHeight) };
  });

  const topActualMm = medicion.topPx / PX_PER_MM;
  const leftActualMm = medicion.leftPx / PX_PER_MM;
  const lineHeightActualMm = medicion.lineHeightPx / PX_PER_MM;

  if (Math.abs(topActualMm - zona.topMm) > TOLERANCIA_MM) errores.push(`Top desfasado: actual=${topActualMm.toFixed(2)}mm, esperado=${zona.topMm}mm`);
  if (Math.abs(leftActualMm - zona.leftMm) > TOLERANCIA_MM) errores.push(`Left desfasado: actual=${leftActualMm.toFixed(2)}mm, esperado=${zona.leftMm}mm`);
  if (Math.abs(lineHeightActualMm - zona.lineHeightMm) > 0.05) errores.push(`Interlineado desfasado: actual=${lineHeightActualMm.toFixed(2)}mm`);

  fs.mkdirSync('pruebas_impresion', { recursive: true });
  await page.pdf({
    path: 'pruebas_impresion/prueba_hoja_0.pdf',
    width: `${ESPECIFICACION_HOJA.anchoHojaMm}mm`,
    height: `${ESPECIFICACION_HOJA.altoHojaMm}mm`,
    printBackground: true
  });
  await browser.close();

  if (errores.length > 0) {
    errores.forEach(e => console.error(' - ' + e));
    process.exit(1);
  } else {
    console.log('✅ Hoja 0 calibrada perfectamente.');
    process.exit(0);
  }
}
verificarHoja0();
```

### Script 2: Hoja 1 (Legalización)
*Ruta: `.agents/skills/calibrador-lienzo-notarial/scripts/verificar_hoja_1_mm.mjs`*

```javascript
import { chromium } from 'playwright';
import fs from 'fs';

const PX_PER_MM = 96 / 25.4;
const TOLERANCIA_MM = 0.25;

const ESPECIFICACION_HOJA = {
  anchoHojaMm: 215.9,
  altoHojaMm: 355.6,
  zonasEsperadas: [
    { selector: '#notaria-titular', nombre: 'Nombre del Notario Titular', topMm: 52.0, leftMm: 45.0 },
    { selector: '#numero-registro', nombre: 'Número de Registro Notarial', topMm: 62.5, leftMm: 30.0 },
    { selector: '#fecha-emision-leg', nombre: 'Fecha y Código de Legalización', topMm: 71.0, leftMm: 30.0 },
    { selector: '#mes-anio-legalizacion', nombre: 'Mes y Año en Letras', topMm: 94.5, leftMm: 58.0 }
  ]
};

async function verificarHoja1() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: Math.round(215.9 * PX_PER_MM), height: Math.round(355.6 * PX_PER_MM) });

  const urlLienzo = process.env.OLGA_PRINT_URL || 'http://localhost:5173/lienzo-notarial/hoja-1';
  await page.goto(urlLienzo, { waitUntil: 'networkidle' });
  const errores = [];

  for (const zona of ESPECIFICACION_HOJA.zonasEsperadas) {
    const el = await page.$(zona.selector);
    if (!el) { errores.push(`Falta selector ${zona.selector} (${zona.nombre})`); continue; }
    const rect = await el.evaluate(e => e.getBoundingClientRect());
    const topActual = rect.top / PX_PER_MM;
    const leftActual = rect.left / PX_PER_MM;

    if (Math.abs(topActual - zona.topMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Top desfasado: actual=${topActual.toFixed(2)}mm, esperado=${zona.topMm}mm`);
    }
    if (Math.abs(leftActual - zona.leftMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Left desfasado: actual=${leftActual.toFixed(2)}mm, esperado=${zona.leftMm}mm`);
    }
  }

  fs.mkdirSync('pruebas_impresion', { recursive: true });
  await page.pdf({ path: 'pruebas_impresion/prueba_hoja_1.pdf', width: '215.9mm', height: '355.6mm', printBackground: true });
  await browser.close();

  if (errores.length > 0) { errores.forEach(e => console.error(e)); process.exit(1); }
  else { console.log('✅ Hoja 1 (Legalización) calibrada perfectamente.'); process.exit(0); }
}
verificarHoja1();
```

### Script 3: Hoja 2 (Certificación de Firmas - Parte A)
*Ruta: `.agents/skills/calibrador-lienzo-notarial/scripts/verificar_hoja_2_mm.mjs`*

```javascript
import { chromium } from 'playwright';
import fs from 'fs';

const PX_PER_MM = 96 / 25.4;
const TOLERANCIA_MM = 0.25;

const ESPECIFICACION_HOJA = {
  anchoHojaMm: 215.9,
  altoHojaMm: 355.6,
  zonasEsperadas: [
    { selector: '#registro-notaria-cf', nombre: 'Número de Registro (1.292)', topMm: 45.0, leftMm: 35.0 },
    { selector: '#objeto-acto-cf', nombre: 'Objeto del Acto (Compraventa / Vehículo)', topMm: 68.0, leftMm: 30.0 },
    { selector: '#compareciente-nombre-1', nombre: 'Nombre del Compareciente 1', topMm: 74.5, leftMm: 36.0 },
    { selector: '#compareciente-cedula-1', nombre: 'Cédula del Compareciente 1', topMm: 74.5, leftMm: 153.0 },
    { selector: '#compareciente-nombre-2', nombre: 'Nombre del Compareciente 2', topMm: 86.0, leftMm: 36.0 },
    { selector: '#compareciente-cedula-2', nombre: 'Cédula del Compareciente 2', topMm: 86.0, leftMm: 153.0 }
  ]
};

async function verificarHoja2() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: Math.round(215.9 * PX_PER_MM), height: Math.round(355.6 * PX_PER_MM) });

  const urlLienzo = process.env.OLGA_PRINT_URL || 'http://localhost:5173/lienzo-notarial/hoja-2';
  await page.goto(urlLienzo, { waitUntil: 'networkidle' });
  const errores = [];

  for (const zona of ESPECIFICACION_HOJA.zonasEsperadas) {
    const el = await page.$(zona.selector);
    if (!el) { errores.push(`Falta selector ${zona.selector} (${zona.nombre})`); continue; }
    const rect = await el.evaluate(e => e.getBoundingClientRect());
    const topActual = rect.top / PX_PER_MM;
    const leftActual = rect.left / PX_PER_MM;

    if (Math.abs(topActual - zona.topMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Top desfasado: actual=${topActual.toFixed(2)}mm, esperado=${zona.topMm}mm`);
    }
    if (Math.abs(leftActual - zona.leftMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Left desfasado: actual=${leftActual.toFixed(2)}mm, esperado=${zona.leftMm}mm`);
    }
  }

  fs.mkdirSync('pruebas_impresion', { recursive: true });
  await page.pdf({ path: 'pruebas_impresion/prueba_hoja_2.pdf', width: '215.9mm', height: '355.6mm', printBackground: true });
  await browser.close();

  if (errores.length > 0) { errores.forEach(e => console.error(e)); process.exit(1); }
  else { console.log('✅ Hoja 2 (Certificación de Firmas) calibrada perfectamente.'); process.exit(0); }
}
verificarHoja2();
```

### Script 4: Hoja 3 (Cierre y Fecha de Certificación)
*Ruta: `.agents/skills/calibrador-lienzo-notarial/scripts/verificar_hoja_3_mm.mjs`*

```javascript
import { chromium } from 'playwright';
import fs from 'fs';

const PX_PER_MM = 96 / 25.4;
const TOLERANCIA_MM = 0.25;

const ESPECIFICACION_HOJA = {
  anchoHojaMm: 215.9,
  altoHojaMm: 355.6,
  zonasEsperadas: [
    { selector: '#anio-letras-cierre', nombre: 'Año en Letras', topMm: 254.0, leftMm: 63.5 },
    { selector: '#hora-certificacion', nombre: 'Hora de Certificación', topMm: 265.0, leftMm: 82.0 },
    { selector: '#dia-certificacion', nombre: 'Día de Certificación', topMm: 265.0, leftMm: 122.0 },
    { selector: '#mes-certificacion', nombre: 'Mes de Certificación', topMm: 265.0, leftMm: 145.0 }
  ]
};

async function verificarHoja3() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: Math.round(215.9 * PX_PER_MM), height: Math.round(355.6 * PX_PER_MM) });

  const urlLienzo = process.env.OLGA_PRINT_URL || 'http://localhost:5173/lienzo-notarial/hoja-3';
  await page.goto(urlLienzo, { waitUntil: 'networkidle' });
  const errores = [];

  for (const zona of ESPECIFICACION_HOJA.zonasEsperadas) {
    const el = await page.$(zona.selector);
    if (!el) { errores.push(`Falta selector ${zona.selector} (${zona.nombre})`); continue; }
    const rect = await el.evaluate(e => e.getBoundingClientRect());
    const topActual = rect.top / PX_PER_MM;
    const leftActual = rect.left / PX_PER_MM;

    if (Math.abs(topActual - zona.topMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Top desfasado: actual=${topActual.toFixed(2)}mm, esperado=${zona.topMm}mm`);
    }
    if (Math.abs(leftActual - zona.leftMm) > TOLERANCIA_MM) {
      errores.push(`[${zona.nombre}] Left desfasado: actual=${leftActual.toFixed(2)}mm, esperado=${zona.leftMm}mm`);
    }
  }

  fs.mkdirSync('pruebas_impresion', { recursive: true });
  await page.pdf({ path: 'pruebas_impresion/prueba_hoja_3.pdf', width: '215.9mm', height: '355.6mm', printBackground: true });
  await browser.close();

  if (errores.length > 0) { errores.forEach(e => console.error(e)); process.exit(1); }
  else { console.log('✅ Hoja 3 (Cierre) calibrada perfectamente.'); process.exit(0); }
}
verificarHoja3();