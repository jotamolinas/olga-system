import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Persona, TipoPersona, TipoDocumento } from '../types';
import { Plus, Search, Trash2, Edit2, User, Landmark, Phone, Mail, MapPin, Check, AlertCircle, Sparkles, X, ChevronDown } from 'lucide-react';

interface PersonasTabProps {
  personas: Persona[];
  onAddPersona: (persona: Persona) => boolean; // Returns true if success, false if duplicate
  onUpdatePersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  isAdmin: boolean;
  initialEditingId?: string | null;
  onClose?: () => void;
}

export const PersonasTab: React.FC<PersonasTabProps> = ({
  personas,
  onAddPersona,
  onUpdatePersona,
  onDeletePersona,
  isAdmin,
  initialEditingId = null,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);

  useEffect(() => {
    if (initialEditingId && personas) {
      const p = personas.find(c => c.id === initialEditingId);
      if (p) {
        handleStartEdit(p);
      }
    }
  }, [initialEditingId, personas]);
  
  // Form State
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>('física');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('CI');
  const [nroDocumento, setNroDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [representanteId, setRepresentanteId] = useState('');

  // Error/Success messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtered physical persons for representing legal entities
  const personasFisicas = personas.filter(p => p.tipo_persona === 'física');

  // Combobox & Modal State
  const [comboboxSearch, setComboboxSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNewRepModalOpen, setIsNewRepModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // New Rep state
  const [newRepNombre, setNewRepNombre] = useState('');
  const [newRepApellido, setNewRepApellido] = useState('');
  const [newRepTipoDoc, setNewRepTipoDoc] = useState<TipoDocumento>('CI');
  const [newRepNroDoc, setNewRepNroDoc] = useState('');
  const [newRepError, setNewRepError] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewRepModalOpen) {
        setIsNewRepModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNewRepModalOpen]);

  const handleCreateNewRep = () => {
    if(!newRepNombre.trim() || !newRepApellido.trim() || !newRepNroDoc.trim()){
      setNewRepError("Complete todos los campos obligatorios.");
      return;
    }
    const newRep: Persona = {
      id: 'p-' + Date.now(),
      tipo_persona: 'física',
      nombre: newRepNombre.trim(),
      apellido: newRepApellido.trim(),
      tipo_documento: newRepTipoDoc,
      nro_documento: newRepNroDoc.trim(),
      telefono: '',
      email: '',
      domicilio: ''
    };
    const success = onAddPersona(newRep);
    if(success){
      setRepresentanteId(newRep.id);
      setComboboxSearch(`${newRep.nombre} ${newRep.apellido}`);
      setIsNewRepModalOpen(false);
      setNewRepNombre('');
      setNewRepApellido('');
      setNewRepNroDoc('');
      setNewRepError('');
    } else {
      setNewRepError("Ya existe una persona con ese documento.");
    }
  };

  const formatCI = (val: string) => {
    const clean = val.replace(/[^\d-]/g, '');
    const parts = clean.split('-');
    let formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (parts.length > 1) {
      formatted += '-' + parts.slice(1).join('');
    }
    return formatted;
  };

  const resetForm = () => {
    setNombre('');
    setApellido('');
    setNroDocumento('');
    setTelefono('');
    setEmail('');
    setDomicilio('');
    setRepresentanteId('');
    setComboboxSearch('');
    setErrorMsg('');
  };

  const lastSubmitTime = useRef<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSubmitTime.current < 500) return;
    lastSubmitTime.current = now;

    if (editingId) {
      handleSaveEdit();
    } else {
      handleCreate();
    }
  };

  const handleCreate = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!nombre.trim()) {
      setErrorMsg('El nombre o razón social es obligatorio.');
      return;
    }

    if (tipoPersona === 'física' && !apellido.trim()) {
      setErrorMsg('El apellido es obligatorio para personas físicas.');
      return;
    }

    if (!nroDocumento.trim()) {
      setErrorMsg('El número de documento es obligatorio.');
      return;
    }

    if (tipoPersona === 'jurídica' && !representanteId) {
      setErrorMsg('Es obligatorio vincular un representante legal para personas jurídicas.');
      return;
    }

    const newPersona: Persona = {
      id: 'p-' + Date.now(),
      tipo_persona: tipoPersona,
      nombre: nombre.trim(),
      apellido: tipoPersona === 'física' ? apellido.trim() : undefined,
      tipo_documento: tipoDocumento,
      nro_documento: nroDocumento.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      domicilio: domicilio.trim(),
      representante_id: tipoPersona === 'jurídica' ? representanteId : undefined,
    };

    const success = onAddPersona(newPersona);
    if (success) {
      setSuccessMsg(`Persona "${newPersona.nombre} ${newPersona.apellido || ''}" registrada con éxito.`);
      resetForm();
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg('Error: Ya existe una persona con el mismo número de documento en el sistema.');
    }
  };

  function handleStartEdit(p: Persona) {
    setEditingId(p.id);
    setTipoPersona(p.tipo_persona);
    setNombre(p.nombre || '');
    setApellido(p.apellido || '');
    setTipoDocumento(p.tipo_documento || 'CI');
    setNroDocumento(formatCI(p.nro_documento || ''));
    setTelefono(p.telefono || '');
    setEmail(p.email || '');
    setDomicilio(p.domicilio || '');
    setRepresentanteId(p.representante_id || '');
    if (p.representante_id) {
       const rep = personas.find(r => r.id === p.representante_id);
       if (rep) {
         setComboboxSearch(`${rep.nombre} ${rep.apellido || ''}`.trim());
       } else {
         setComboboxSearch('');
       }
    } else {
       setComboboxSearch('');
    }
    setErrorMsg('');
    setSuccessMsg('');
    
    // Scroll smoothly to the form panel area
    const formPanel = document.getElementById('personas-tab-panel');
    if (formPanel) {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSaveEdit = () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!nombre.trim()) {
      setErrorMsg('El nombre o razón social es obligatorio.');
      return;
    }
    if (tipoPersona === 'física' && !apellido.trim()) {
      setErrorMsg('El apellido es obligatorio para personas físicas.');
      return;
    }
    if (!nroDocumento.trim()) {
      setErrorMsg('El documento es obligatorio.');
      return;
    }
    if (tipoPersona === 'jurídica' && !representanteId) {
      setErrorMsg('El representante legal es obligatorio.');
      return;
    }

    // Check duplicate document with a different ID
    const duplicate = personas.find(c => c.nro_documento.trim().toLowerCase() === nroDocumento.trim().toLowerCase() && c.id !== editingId);
    if (duplicate) {
      setErrorMsg('Error: El número de documento ya está registrado por otra persona.');
      return;
    }

    if (editingId) {
      const updated: Persona = {
        id: editingId,
        tipo_persona: tipoPersona,
        nombre: nombre.trim(),
        apellido: tipoPersona === 'física' ? apellido.trim() : undefined,
        tipo_documento: tipoDocumento,
        nro_documento: nroDocumento.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        domicilio: domicilio.trim(),
        representante_id: tipoPersona === 'jurídica' ? representanteId : undefined
      };

      onUpdatePersona(updated);
      if (onClose) {
        onClose();
      } else {
        setEditingId(null);
      }
      resetForm();
      setSuccessMsg('Registro actualizado correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const filteredPersonas = personas.filter(p => {
    const fullSearch = `${p.nombre} ${p.apellido || ''} ${p.nro_documento} ${p.email}`.toLowerCase();
    return fullSearch.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 animate-message" id="personas-tab-panel">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-3xl font-bold font-serif tracking-tight text-slate-800">Directorio de Personas</h2>
          <p className="text-slate-500 text-sm mt-1">
            Fichero único de intervinientes (física/jurídica) utilizables como Acreedores, Deudores, Co-deudores y Representantes.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FF3131]/5 border border-[#FF3131]/20 text-[#FF3131] rounded-full text-xs font-bold leading-none w-fit">
          <Sparkles className="w-4 h-4" />
          <span>Base de Datos Unificada de Firmas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Registration Form Panel */}
        <div className="xl:col-span-1 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-md h-fit space-y-6">
          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-50 pb-4">
            {editingId ? 'Editar Persona' : 'Registrar Nueva Persona'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo Persona */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Tipo de Persona</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!!editingId} // No cambiar tipo en edición para mantener integridad de relaciones
                  onClick={() => { setTipoPersona('física'); setTipoDocumento('CI'); }}
                  className={`py-2 p-3 text-xs font-bold uppercase rounded-xl border flex items-center justify-center gap-2 transition-all ${tipoPersona === 'física' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <User className="w-3.5 h-3.5" />
                  Física
                </button>
                <button
                  type="button"
                  disabled={!!editingId}
                  onClick={() => { setTipoPersona('jurídica'); setTipoDocumento('RUC'); }}
                  className={`py-2 p-3 text-xs font-bold uppercase rounded-xl border flex items-center justify-center gap-2 transition-all ${tipoPersona === 'jurídica' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  Jurídica
                </button>
              </div>
            </div>

            {/* Name input */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">
                {tipoPersona === 'física' ? 'Nombre(s)' : 'Razón Social'} <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                value={nombre || ''}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={tipoPersona === 'física' ? 'Ingrese los nombres' : 'Ingrese la razón social'}
                className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-red-100"
              />
            </div>

            {/* Apellido (solo física) */}
            {tipoPersona === 'física' && (
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Apellido(s) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={apellido || ''}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Ingrese los apellidos"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-red-100"
                />
              </div>
            )}

            {/* Documento */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Documento</label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-2 py-2.5 text-sm font-bold tracking-tight outline-none"
                >
                  <option value="CI">C.I.</option>
                  <option value="RUC">R.U.C.</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Número <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={nroDocumento || ''}
                  onChange={(e) => setNroDocumento(formatCI(e.target.value))}
                  placeholder="Ej. 1294857 o 800123-4"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-red-100"
                />
              </div>
            </div>

            {/* Representante legal (solo jurídica) */}
            {tipoPersona === 'jurídica' && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative">
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Representante Legal (Física) <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative flex items-center w-full box-border">
                    <input  
                      type="text" 
                      value={comboboxSearch || ''}
                      onChange={(e) => {
                        setComboboxSearch(e.target.value);
                        setRepresentanteId(''); // Clear selection if user types
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Buscar o escribir nombre..."
                      className="w-full box-border pl-9 pr-10 py-2.5 bg-white border border-slate-200 focus:border-[#FF3131] rounded-xl text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-red-100"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                    <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="absolute right-3 p-1 text-slate-400 hover:text-slate-600">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {isDropdownOpen && (
                    <div className="absolute top-full mt-2 w-full box-border bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto overflow-x-hidden">
                      {personasFisicas.filter(p => `${p.nombre} ${p.apellido} ${p.nro_documento}`.toLowerCase().includes(comboboxSearch.toLowerCase())).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${representanteId === p.id ? 'bg-indigo-50/50' : ''}`}
                          onClick={() => {
                            setRepresentanteId(p.id);
                            setComboboxSearch(`${p.nombre} ${p.apellido || ''}`);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-bold text-slate-800">{p.nombre} {p.apellido}</div>
                          <div className="text-xs text-slate-500">{p.tipo_documento}: {p.nro_documento}</div>
                        </button>
                      ))}
                      
                      {personasFisicas.filter(p => `${p.nombre} ${p.apellido} ${p.nro_documento}`.toLowerCase().includes(comboboxSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 text-center italic border-b border-slate-50">
                          No se encontraron personas físicas
                        </div>
                      )}
                      
                      <div className="p-2 sticky bottom-0 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100">
                        <button
                          type="button"
                          className="w-full box-border py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setNewRepNombre(comboboxSearch);
                            setIsNewRepModalOpen(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Crear {comboboxSearch ? `"${comboboxSearch}"` : 'Nueva persona'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                  Regla jurídica obligatoria: Toda persona jurídica requiere de una persona física firmante.
                </p>
              </div>
            )}

            {/* Teléfono y Email */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Teléfono</label>
                <input 
                  type="text"
                  value={telefono || ''}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej. +595991200300"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-sm font-medium outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Email</label>
                <input 
                  type="email"
                  value={email || ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej. mail@domain.com"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-sm font-medium outline-none"
                />
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Domicilio Habitual / Oficina</label>
              <textarea
                value={domicilio || ''}
                onChange={(e) => setDomicilio(e.target.value)}
                placeholder="Ej. Calle Estrella 1459, Asunción"
                rows={2}
                className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-sm font-medium outline-none resize-none"
              />
            </div>

            {/* Error alerts */}
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl border border-red-100 flex items-start gap-2.5 text-xs font-bold leading-normal animate-pulse">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success alerts */}
            {successMsg && (
              <div className="bg-green-50 text-green-700 p-3.5 rounded-xl border border-green-100 flex items-center gap-2.5 text-xs font-bold">
                <Check className="w-4.5 h-4.5 text-green-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {editingId ? (
                <>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#FF3131] text-white rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-red-600 transition-colors shadow-md"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      if (onClose) {
                        onClose();
                      } else {
                        setEditingId(null); 
                      }
                      resetForm(); 
                    }}
                    className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-slate-200 transition-colors"
                  >
                    Copiar / Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="w-full box-border py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Persona
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Directory List Panel */}
        <div className="xl:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-md flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-slate-800">
              Registros guardados ({filteredPersonas.length})
            </h3>
            
            {/* Search Input */}
            <div className="relative w-full box-border sm:w-72">
              <input 
                type="text"
                placeholder="Buscar por nombre, RUC, CI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full box-border bg-slate-100/70 border border-slate-200/50 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-600 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-[#FF3131]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="flex-grow overflow-x-auto">
            {filteredPersonas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="font-bold text-sm">No se encontraron personas creadas.</p>
                <p className="text-xs text-slate-400 mt-1">Intente refinar la búsqueda o registre una nueva entidad</p>
              </div>
            ) : (
              <table className="w-full box-border text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-4">Interviniente</th>
                    <th className="py-4 px-4">Clasificación / Doc</th>
                    <th className="py-4 px-4">Contacto</th>
                    <th className="py-4 px-4">Representante Autorizado</th>
                    <th className="py-4 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium">
                  {filteredPersonas.map((p) => {
                    const deudorTitle = p.tipo_persona === 'física' ? `${p.nombre} ${p.apellido || ''}` : p.nombre;
                    const representative = p.tipo_persona === 'jurídica' && p.representante_id
                      ? personas.find(rep => rep.id === p.representante_id)
                      : null;

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => handleStartEdit(p)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {deudorTitle}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider w-fit mb-1 ${p.tipo_persona === 'física' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {p.tipo_persona}
                            </span>
                            <span className="text-slate-500 font-mono font-bold leading-none">
                              {p.tipo_documento}: {p.nro_documento}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col space-y-1 text-slate-500 text-[11px] leading-snug">
                            {p.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400 shrink-0" /> {p.telefono}</span>}
                            {p.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400 shrink-0" /> {p.email}</span>}
                            {p.domicilio && <span className="flex items-center gap-1 max-w-[200px] truncate"><MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {p.domicilio}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {p.tipo_persona === 'jurídica' ? (
                            representative ? (
                              <div className="text-slate-700">
                                <div>{representative.nombre} {representative.apellido}</div>
                                <div className="text-[10px] text-slate-400 font-mono font-bold leading-none mt-0.5">{representative.tipo_documento}: {representative.nro_documento}</div>
                              </div>
                            ) : (
                              <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">
                                ¡FALTA REPRESENTANTE!
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">No aplica (Física)</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }}
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                              title="Editar registro"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDeletePersona(p.id); }}
                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {isNewRepModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full box-border max-w-lg flex flex-col overflow-hidden animate-slide-up border border-slate-100 relative max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-700 border border-slate-100">
                   <User className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold font-serif text-slate-800">Alta Rápida</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Representante Legal (Física)</p>
                 </div>
              </div>
              <button type="button" onClick={() => setIsNewRepModalOpen(false)} className="p-3 bg-white hover:bg-slate-100 text-slate-500 rounded-2xl transition-colors shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto flex-grow bg-white">
              <div className="space-y-4">
                {newRepError && (
                  <div className="bg-red-50 text-red-600 p-3.5 rounded-xl border border-red-100 flex items-start gap-2.5 text-xs font-bold leading-normal">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                    <span>{newRepError}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Nombre <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={newRepNombre}
                      onChange={(e) => setNewRepNombre(e.target.value)}
                      placeholder="Ej. Juan"
                      className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none disabled:opacity-50 disabled:bg-slate-100 transition-all focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Apellido <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={newRepApellido}
                      onChange={(e) => setNewRepApellido(e.target.value)}
                      placeholder="Ej. Pérez"
                      className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none disabled:opacity-50 disabled:bg-slate-100 transition-all focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Tipo <span className="text-red-500">*</span></label>
                    <select
                      value={newRepTipoDoc}
                      onChange={(e) => setNewRepTipoDoc(e.target.value as TipoDocumento)}
                      className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-2 py-2.5 text-sm font-medium outline-none disabled:opacity-50 disabled:bg-slate-100 transition-all focus:ring-4 focus:ring-red-100"
                    >
                      <option value="CI">CI</option>
                      <option value="PASAPORTE">PASAPORTE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Nro Documento <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={newRepNroDoc}
                      onChange={(e) => setNewRepNroDoc(formatCI(e.target.value))}
                      placeholder="Ej. 1294857"
                      className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none disabled:opacity-50 disabled:bg-slate-100 transition-all focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-400 italic leading-snug bg-slate-50 p-3 rounded-xl border border-slate-100">La nueva persona física quedará registrada y se asignará automáticamente como representante legal de esta persona jurídica.</p>
              </div>
            </div>
            <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                 type="button"
                 onClick={() => setIsNewRepModalOpen(false)}
                 className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-slate-50 transition-colors"
                >
                Cancelar
              </button>
              <button 
                 type="button"
                 onClick={handleCreateNewRep}
                 className="px-6 py-3 bg-slate-900 text-white border border-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                 <Plus className="w-4 h-4"/>
                 Guardar Persona
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('main-content-viewport') || document.body
      )}
    </div>
  );
};
