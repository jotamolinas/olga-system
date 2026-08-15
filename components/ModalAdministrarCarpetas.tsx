import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown, Edit2, Trash2, Save, Plus, Loader2 } from 'lucide-react';
import { db } from '../services/auth';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

export interface Carpeta {
  id: string;
  nombre: string;
  orden: number;
  predeterminada: boolean;
}

interface ModalAdministrarCarpetasProps {
  isOpen: boolean;
  onClose: () => void;
  carpetasActuales: Carpeta[];
  userId: string;
  onSaved?: () => void;
}

export const ModalAdministrarCarpetas: React.FC<ModalAdministrarCarpetasProps> = ({
  isOpen,
  onClose,
  carpetasActuales,
  userId,
  onSaved
}) => {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [nombresOriginales, setNombresOriginales] = useState<Record<string, string>>({});
  const [carpetasEliminadas, setCarpetasEliminadas] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  useEffect(() => {
    if (isOpen) {
      setCarpetas([...carpetasActuales].sort((a, b) => a.orden - b.orden));
      
      const originales: Record<string, string> = {};
      carpetasActuales.forEach(c => {
        originales[c.id] = c.nombre;
      });
      setNombresOriginales(originales);
      setCarpetasEliminadas([]);
      setEditingId(null);
      setEditValue('');
    }
  }, [isOpen, carpetasActuales]);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newCarpetas = [...carpetas];
    const temp = newCarpetas[index - 1];
    newCarpetas[index - 1] = newCarpetas[index];
    newCarpetas[index] = temp;
    newCarpetas.forEach((c, i) => c.orden = i + 1);
    setCarpetas(newCarpetas);
  };

  const handleMoveDown = (index: number) => {
    if (index === carpetas.length - 1) return;
    const newCarpetas = [...carpetas];
    const temp = newCarpetas[index + 1];
    newCarpetas[index + 1] = newCarpetas[index];
    newCarpetas[index] = temp;
    newCarpetas.forEach((c, i) => c.orden = i + 1);
    setCarpetas(newCarpetas);
  };

  const handleDelete = (id: string) => {
    const carpeta = carpetas.find(c => c.id === id);
    if (!carpeta || carpeta.predeterminada) return;
    
    setCarpetas(carpetas.filter(c => c.id !== id));
    if (nombresOriginales[id]) {
      setCarpetasEliminadas([...carpetasEliminadas, nombresOriginales[id]]);
    }
  };

  const startEdit = (carpeta: Carpeta) => {
    if (carpeta.predeterminada) return;
    setEditingId(carpeta.id);
    setEditValue(carpeta.nombre);
  };

  const saveEdit = () => {
    if (!editingId || !editValue.trim()) return;
    
    setCarpetas(carpetas.map(c => {
      if (c.id === editingId) {
        return { ...c, nombre: editValue.trim() };
      }
      return c;
    }));
    setEditingId(null);
  };

  const handleAdd = () => {
    const newCarpeta: Carpeta = {
      id: Date.now().toString(),
      nombre: 'Nueva Carpeta',
      orden: carpetas.length + 1,
      predeterminada: false
    };
    setCarpetas([...carpetas, newCarpeta]);
    setTimeout(() => {
        startEdit(newCarpeta);
    }, 50);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { carpetas });

      const batch = writeBatch(db);
      let operationsCount = 0;
      
      const q = query(collection(db, 'documentos_olga'), where('userId', '==', userId));
      const snapshot = await getDocs(q);

      for (const c of carpetas) {
        const originalName = nombresOriginales[c.id];
        if (originalName && originalName !== c.nombre) {
          snapshot.docs.forEach(d => {
            if (d.data().categoria === originalName) {
              batch.update(d.ref, { categoria: c.nombre });
              operationsCount++;
            }
          });
        }
      }

      carpetasEliminadas.forEach(eliminadaName => {
        snapshot.docs.forEach(d => {
          if (d.data().categoria === eliminadaName) {
            batch.update(d.ref, { categoria: 'Sin Categoría' });
            operationsCount++;
          }
        });
      });

      if (operationsCount > 0) {
        await batch.commit();
      }
      
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Error al guardar carpetas:", err);
      alert("Hubo un error al guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full box-border max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Administrar Carpetas</h2>
            <p className="text-xs text-slate-500 mt-1">Reordena, edita o elimina tus categorías</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {carpetas.map((carpeta, idx) => (
            <div key={carpeta.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl group">
              <div className="flex flex-col gap-1 shrink-0">
                <button 
                  onClick={() => handleMoveUp(idx)} 
                  disabled={idx === 0}
                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === carpetas.length - 1}
                  className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1">
                {editingId === carpeta.id ? (
                  <input 
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                    className="w-full box-border px-3 py-1.5 text-sm border-2 border-indigo-500 rounded-lg outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">{carpeta.nombre}</span>
                    {carpeta.predeterminada && (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Por defecto</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 transition-opacity">
                {!carpeta.predeterminada && editingId !== carpeta.id && (
                  <>
                    <button onClick={() => startEdit(carpeta)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 bg-blue-50 rounded-lg transition-colors" title="Renombrar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(carpeta.id)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 rounded-lg transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          
          <button 
            onClick={handleAdd}
            className="w-full box-border mt-4 py-3 border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all text-sm"
          >
            <Plus className="w-4 h-4" /> Agregar Nueva Carpeta
          </button>
        </div>

        <div className="p-5 border-t border-slate-100 shrink-0 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
