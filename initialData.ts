import { Persona, GlobalConfig, Pagare } from './types';

// Dejamos las listas de personas y pagarés totalmente vacías para clientes nuevos
export const INITIAL_PERSONAS: Persona[] = [];
export const INITIAL_PAGARES: Pagare[] = [];

// Mantenemos solo la configuración técnica básica (monedas y frecuencias) 
// para que los formularios no den error antes de conectarse a Firebase
export const INITIAL_CONFIG: GlobalConfig = {
  escribania: {
    nombre: '',
    nro_registro: '',
    direccion: '',
    localidad: '',
    telefono: '',
    email: '',
    sitio_web: '',
    logoUrl: '' 
  },
  monedas: [
    { codigo: 'PYG', nombre: 'Guaraníes', simbolo: 'Gs.', activa: true, orden: 1 },
    { codigo: 'USD', nombre: 'Dólares Americanos', simbolo: 'USD', activa: true, orden: 2 },
    { codigo: 'BRL', nombre: 'Reales Brasileños', simbolo: 'R$', activa: true, orden: 3 }
  ],
  frecuencias: [
    { id: 'semanal', nombre: 'Semanal', intervalo_dias: 7, descripcion: 'Pagos cada 7 días', activa: true, orden: 1 },
    { id: 'quincenal', nombre: 'Quincenal', intervalo_dias: 15, descripcion: 'Pagos cada 15 días', activa: true, orden: 2 },
    { id: 'mensual', nombre: 'Mensual', intervalo_dias: 30, descripcion: 'Pagos cada 30 días (1 mes)', activa: true, orden: 3 },
    { id: 'semestral', nombre: 'Semestral', intervalo_dias: 180, descripcion: 'Pagos cada 180 días (6 meses)', activa: true, orden: 4 },
    { id: 'anual', nombre: 'Anual', intervalo_dias: 365, descripcion: 'Pagos cada 365 días (1 año)', activa: true, orden: 5 }
  ],
  anio_serie: new Date().getFullYear(),
  pdf: {
    mostrar_pie: true,
    contenido_pie: '' 
  }
};