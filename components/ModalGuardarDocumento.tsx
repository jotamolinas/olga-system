import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/auth';

interface ModalGuardarDocumentoProps {
  onClose: () => void;
  onConfirm: (categoria: string) => void;
  userCarpetas?: { id: string, nombre: string, orden: number, predeterminada: boolean }[];
}

export const ModalGuardarDocumento: React.FC<ModalGuardarDocumentoProps> = ({ onClose, onConfirm, userCarpetas }) => {
  const [categorias, setCategorias] = useState<string[]>(['Compraventa', 'Pagarés', 'Alquiler', 'Contratos Privados', 'Traspasos']);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(categorias[0]);
  const [nuevaCarpetaNombre, setNuevaCarpetaNombre] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchCategorias = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        let sortedNames: string[] = [];
        
        if (userCarpetas && userCarpetas.length > 0) {
          sortedNames = [...userCarpetas].sort((a, b) => a.orden - b.orden).map(c => c.nombre);
        } else {
           sortedNames = ['Compraventa', 'Pagarés', 'Alquiler', 'Contratos Privados', 'Traspasos'];
        }

        const q = query(
          collection(db, 'documentos_olga'),
          where('userId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const cats = new Set<string>();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.categoria) {
            cats.add(data.categoria);
          }
        });
        
        const merged = Array.from(new Set([...sortedNames, ...Array.from(cats)]));
        setCategorias(merged);
        setCarpetaSeleccionada(merged[0]);
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategorias();
  }, [userCarpetas]);

  const handleConfirm = () => {
    if (carpetaSeleccionada === 'nueva') {
      onConfirm(nuevaCarpetaNombre.trim() || 'Sin Categoría');
    } else {
      onConfirm(carpetaSeleccionada);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full box-border max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Guardar Documento</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">¿En qué carpeta deseas organizar este escrito?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              Seleccionar Carpeta {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            </label>
            <select
              value={carpetaSeleccionada}
              onChange={(e) => setCarpetaSeleccionada(e.target.value)}
              disabled={loading}
              className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none transition-all disabled:opacity-50"
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="nueva">+ Crear nueva carpeta...</option>
            </select>
          </div>

          {carpetaSeleccionada === 'nueva' && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">Nombre de la nueva carpeta</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Plus className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  type="text"
                  value={nuevaCarpetaNombre}
                  onChange={(e) => setNuevaCarpetaNombre(e.target.value)}
                  placeholder="Ej: Acuerdos Comerciales"
                  autoFocus
                  className="w-full box-border pl-10 bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (carpetaSeleccionada === 'nueva' && !nuevaCarpetaNombre.trim())}
            className="px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar Guardado
          </button>
        </div>
      </div>
    </div>
  );
};
