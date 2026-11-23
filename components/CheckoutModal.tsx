import React, { useState, useEffect } from 'react';
import { X, UploadCloud, CreditCard, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { db, storage, auth } from '../services/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { notifySuperAdminWhatsApp } from '../services/adminAlerts';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  planName: string;
  planPrice: string;
  currentUser: User | null;
  userData?: any;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, planName, planPrice, currentUser, userData }) => {
  const [activeTab, setActiveTab] = useState<'banco' | 'billetera' | 'boca'>('banco');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      setErrorMessage(null);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser || !auth.currentUser.uid || !currentUser) {
      setErrorMessage('Tu sesión no está activa. Vuelve a iniciar sesión e intenta enviar tu comprobante nuevamente.');
      return;
    }
    if (!file) {
      setErrorMessage('Por favor adjunta una foto o PDF del comprobante antes de enviar.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      // 1. Upload file to Storage
      const storageRef = ref(storage, `comprobantes/${currentUser.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const isAnual = planPrice.includes('año');
      const modalidadPago = isAnual ? 'Anual' : 'Mensual';
      const rawMonto = planPrice.replace(/[^0-9]/g, '');
      const parsedMonto = parseInt(rawMonto, 10);
      const montoAPagar = Number.isFinite(parsedMonto) ? parsedMonto : 0;

      // 2. Update User document in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        email: currentUser.email || '',
        planSolicitado: planName,
        modalidadPago,
        montoAPagar,
        estadoPago: 'PAGO_PENDIENTE_VERIFICACION',
        urlComprobante: downloadURL,
        fechaSolicitud: serverTimestamp()
      }, { merge: true });

      notifySuperAdminWhatsApp({
        type: 'payment',
        userName:
          userData?.nombreCompleto ||
          userData?.nombre ||
          userData?.razonSocial ||
          currentUser.displayName ||
          currentUser.email ||
          'Cliente',
        userEmail: currentUser.email || userData?.email || '',
        userPhone: userData?.telefono || currentUser.phoneNumber || '',
        details: `${planName} (${modalidadPago}) - Gs. ${Number.isFinite(montoAPagar) ? montoAPagar.toLocaleString('es-PY') : planPrice}`,
        attachmentUrl: downloadURL,
      });

      setFile(null);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error: any) {
      console.error("Error al enviar comprobante:", error);
      const code = String(error?.code || '');
      let userFriendlyError = 'No pudimos procesar tu comprobante. Verifica tu conexión e intenta nuevamente.';
      if (code.includes('storage/unauthorized') || code.includes('permission-denied')) {
        userFriendlyError = 'No se obtuvieron permisos para guardar el comprobante. Recarga la página o vuelve a iniciar sesión e intenta de nuevo.';
      } else if (code.includes('storage/')) {
        userFriendlyError = 'Ocurrió un problema al subir el archivo del comprobante. Verifica que sea una imagen o PDF válido e intenta de nuevo.';
      } else if (typeof error?.message === 'string' && error.message.trim()) {
        userFriendlyError = `No se pudo completar el envío: ${error.message}`;
      }
      setErrorMessage(userFriendlyError);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-x-hidden">
      <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-2xl flex flex-col relative animate-fade-in max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 pr-12 relative shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg sm:text-xl font-bold font-serif">Completar Suscripción</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Sigue las instrucciones para activar tu plan.</p>
        </div>

        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden flex-1 space-y-6">
          {/* 1. RESUMEN DEL PEDIDO */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Plan Seleccionado</p>
              <h3 className="text-base sm:text-xl font-black text-slate-800 break-words">
                Vas a pagar el {planName} ({planPrice.includes('año') ? 'Anual' : 'Mensual'})
              </h3>
            </div>
            <div className="sm:text-right shrink-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 mb-0.5 sm:mb-1">Total a Pagar</p>
              <h3 className="text-xl sm:text-2xl font-black text-blue-600 whitespace-nowrap">{planPrice.split(' /')[0]}</h3>
            </div>
          </div>

          {/* 2. PESTAÑAS DE MÉTODOS DE PAGO */}
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">MÉTODOS DE PAGO</h4>
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('banco')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'banco' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Transferencia Bancaria</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6">
              {activeTab === 'banco' && (
                <div className="space-y-3 text-sm">
                  <p className="font-bold text-slate-800 mb-2">Datos para Transferencia Bancaria:</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline">
                    <span className="text-slate-500">Banco:</span>
                    <span className="font-semibold text-slate-800 break-words">Banco Atlas</span>
                    
                    <span className="text-slate-500">Caja de Ahorro:</span>
                    <span className="font-semibold text-slate-800 font-mono break-all">1536212</span>
                    
                    <span className="text-slate-500">CI:</span>
                    <span className="font-semibold text-slate-800 font-mono break-all">2697547</span>

                    <span className="text-slate-500">Beneficiario:</span>
                    <span className="font-semibold text-slate-800 break-words">Federico Ritter Vela</span>
                    
                    <span className="text-slate-500">Alias:</span>
                    <span className="font-semibold text-slate-800 font-mono break-all">0983440021</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. ZONA DE CARGA DE COMPROBANTE */}
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">ADJUNTAR COMPROBANTE *</h4>
            
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 hover:bg-slate-50 transition-colors text-center group">
              <input  
                type="file" 
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full box-border h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                <div className={`p-3.5 sm:p-4 rounded-full ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'} group-hover:scale-110 transition-transform`}>
                  {file ? <CheckCircle className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                </div>
                {file ? (
                  <div className="max-w-full px-2">
                    <p className="text-sm font-bold text-slate-800 break-all">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-blue-600">Subir foto o PDF del comprobante</p>
                    <p className="text-xs text-slate-500 mt-1">Toca aquí para elegir archivo o arrástralo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visible Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-3.5 sm:p-4 flex items-start gap-2.5 text-xs sm:text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug break-words">{errorMessage}</span>
            </div>
          )}

          {/* 4. LÓGICA DE ENVÍO */}
          <div className="border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 
                ${!file 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : isUploading
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 cursor-pointer'
                }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  <span>Subiendo comprobante...</span>
                </>
              ) : (
                <span>Enviar Comprobante y Solicitar Activación</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

