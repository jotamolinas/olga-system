import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { FileText, Loader2, Calendar, ChevronRight, Trash2, Settings, MoreVertical, Copy, FolderInput, X, Check } from 'lucide-react';
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
  onOpenDocument: (text: string) => void;
}

export const EscritosTab: React.FC<EscritosTabProps> = ({ currentUser, userProfile, onOpenDocument }) => {
  const [escritos, setEscritos] = useState<Escrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<Escrito | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (!auth?.currentUser) { setLoading(false); return; }
    
    if (!currentUser) return;
    
    // Solo mostramos loading si es la primera vez que carga (escritos vacíos)
    if (escritos.length === 0) {
      setLoading(true);
    }
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'documentos_olga'), where('userId', '==', currentUser.uid)),
      (querySnapshot) => {
        const docs: Escrito[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let categoria = data.categoria || 'Sin Categoría';
          if (!data.categoria && data.tipo) {
             const lowerTipo = data.tipo.toLowerCase();
             if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
             else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
             else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
             else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
             else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
          }
          docs.push({ id: doc.id, ...data, categoria } as Escrito);
        });

        // Leer documentos temporales del localStorage
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          try {
            const tempDocs = JSON.parse(tempDocsString);
            tempDocs.forEach((tDoc: any, idx: number) => {
              if (tDoc.userId === currentUser.uid) {
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
            console.error("Error parsing temp docs", e);
          }
        }
        
        // Sort descending by date
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
          console.warn('Permisos denegados temporalmente al cargar escritos. Reintentar más tarde.', err);
          setError('No se pudieron cargar los documentos en este momento. Las reglas de acceso se están actualizando.');
        } else {
          console.error('Error fetching escritos:', err);
          setError('No se pudieron cargar los documentos. Verifica los permisos.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF3131]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-orange-50 text-orange-600 p-4 rounded-xl text-sm flex items-center justify-center border border-orange-100">
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  const filteredEscritos = escritos.filter(escrito => {
    if (activeCategory === 'Todos') return true;
    return escrito.categoria === activeCategory;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestión de Escritos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Archivos generados por el Oráculo y documentos guardados.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsAdminModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
            Administrar Carpetas
          </button>
        </div>
      </div>

      {filteredEscritos.length === 0 ? (
        <div className="text-center bg-slate-50 p-12 rounded-3xl border border-slate-100 border-dashed">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {activeCategory === 'Todos' 
              ? 'No tienes escritos guardados aún.' 
              : `No hay escritos en la categoría "${activeCategory}".`}
          </p>
          <p className="text-xs text-slate-400 mt-1">Genera uno consultando con O.L.G.A.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEscritos.map((escrito) => {
            let dateStr = 'Fecha desconocida';
            if (escrito.createdAt) {
               dateStr = new Date(escrito.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } else if (escrito.fechaCreacion && typeof escrito.fechaCreacion.toMillis === 'function') {
               dateStr = new Date(escrito.fechaCreacion.toMillis()).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            return (
              <div 
                key={escrito.id} 
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between p-6 relative"
                onClick={() => onOpenDocument(escrito.texto)}
              >
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1 overflow-hidden min-w-0">
                        <h3 className="font-bold text-slate-800 text-base truncate" title={escrito.tipo || 'Escrito'}>{escrito.tipo || 'Escrito'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1 truncate">
                          <Calendar className="w-3 h-3 shrink-0" /> <span className="truncate">{dateStr}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 relative">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-slate-200">
                        {escrito.categoria || 'Sin Categoría'}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === escrito.id ? null : escrito.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenuId === escrito.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in slide-in-from-top-2 origin-top-right">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              setMovingDoc(escrito);
                              setTargetCategory(escrito.categoria || 'Sin Categoría');
                            }}
                            className="w-full box-border text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                          >
                            <FolderInput className="w-4 h-4" /> Mover a...
                          </button>
                          
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              try {
                                if (escrito.id.startsWith('temp-')) {
                                  const tempDocsString = localStorage.getItem('escritos_temporales');
                                  if (tempDocsString) {
                                    const tempDocs = JSON.parse(tempDocsString);
                                    const newTempDoc = {
                                      ...tempDocs[parseInt(escrito.id.replace('temp-', ''), 10)],
                                      tipo: `${escrito.tipo} (Copia)`,
                                      fechaCreacion: new Date().toISOString()
                                    };
                                    tempDocs.push(newTempDoc);
                                    localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
                                    setEscritos(prev => [{ ...newTempDoc, id: `temp-${tempDocs.length - 1}` }, ...prev]);
                                  }
                                } else {
                                  const { id, ...dataToCopy } = escrito;
                                  await addDoc(collection(db, 'documentos_olga'), {
                                    ...dataToCopy,
                                    tipo: `${dataToCopy.tipo} (Copia)`,
                                    fechaCreacion: Timestamp.now()
                                  });
                                }
                              } catch (err) {
                                console.error("Error al duplicar:", err);
                              }
                            }}
                            className="w-full box-border text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                          >
                            <Copy className="w-4 h-4" /> Duplicar
                          </button>

                          <div className="h-px bg-slate-100 my-1"></div>

                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
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
                                try {
                                  const docRef = doc(db, 'documentos_olga', escrito.id);
                                  await deleteDoc(docRef);
                                } catch (err) {
                                  console.error("Fallo al borrar:", err);
                                }
                              }
                            }}
                            className="w-full box-border text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/50">
                    <p className="text-xs text-slate-500 line-clamp-4 italic">
                      "{escrito.texto.substring(0, 200)}..."
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider group-hover:underline flex items-center gap-1">
                    Ver Detalles &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {isAdminModalOpen && currentUser && (
        <ModalAdministrarCarpetas
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          carpetasActuales={allCarpetasToAdmin}
          userId={currentUser.uid}
        />
      )}

      {movingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full box-border max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Mover Documento</h2>
              <button
                onClick={() => setMovingDoc(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Elige la carpeta destino para <span className="font-bold text-slate-800">{movingDoc.tipo}</span>.
              </p>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none transition-all"
              >
                {categorias.filter(c => c !== 'Todos').map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setMovingDoc(null)}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
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
                className="px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Mover Escrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
