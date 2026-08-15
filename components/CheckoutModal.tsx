import React, { useState, useEffect } from 'react';
import { X, UploadCloud, CreditCard, Smartphone, Store, CheckCircle, Loader2 } from 'lucide-react';
import { db, storage, auth } from '../services/auth';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  planName: string;
  planPrice: string;
  currentUser: User | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, planName, planPrice, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'banco' | 'billetera' | 'boca'>('banco');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
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
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser || !auth.currentUser.uid) return;
    if (!file || !currentUser) return;

    setIsUploading(true);
    try {
      // 1. Upload file to Storage
      const storageRef = ref(storage, `comprobantes/${currentUser.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const isAnual = planPrice.includes('año');
      const modalidadPago = isAnual ? 'Anual' : 'Mensual';
      const rawMonto = planPrice.replace(/[^0-9]/g, '');
      const montoAPagar = parseInt(rawMonto, 10);

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

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Error al enviar comprobante:", error);
      console.error("Hubo un error al procesar el comprobante. Por favor, intenta de nuevo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-2xl flex flex-col relative animate-fade-in max-h-[95vh] overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold font-serif">Completar Suscripción</h2>
          <p className="text-slate-400 text-sm mt-1">Sigue las instrucciones para activar tu plan.</p>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh]">
          {/* 1. RESUMEN DEL PEDIDO */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-8 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Plan Seleccionado</p>
                <h3 className="text-xl font-black text-slate-800">Vas a pagar el {planName} ({planPrice.includes('año') ? 'Anual' : 'Mensual'})</h3>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500 mb-1">Total a Pagar</p>
                <h3 className="text-2xl font-black text-blue-600">{planPrice.split(' /')[0]}</h3>
              </div>
            </div>

            {/* 2. PESTAÑAS DE MÉTODOS DE PAGO */}
            <div className="mb-8">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">MÉTODOS DE PAGO</h4>
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setActiveTab('banco')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'banco' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Transferencia</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                {activeTab === 'banco' && (
                  <div className="space-y-3 text-sm">
                    <p className="font-bold text-slate-800 mb-2">Datos para Transferencia Bancaria:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-slate-500">Banco:</span>
                      <span className="font-semibold text-slate-800">Ueno</span>
                      
                      <span className="text-slate-500">Titular:</span>
                      <span className="font-semibold text-slate-800">Juan Alberto Molinas Ihara</span>
                      
                      <span className="text-slate-500">Alias:</span>
                      <span className="font-semibold text-slate-800 font-mono">2173790</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. ZONA DE CARGA DE COMPROBANTE */}
            <div className="mb-8">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">ADJUNTAR COMPROBANTE *</h4>
              
              <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:bg-slate-50 transition-colors text-center group">
                <input  
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full box-border h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                  <div className={`p-4 rounded-full ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'} group-hover:scale-110 transition-transform`}>
                    {file ? <CheckCircle className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-bold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-blue-600">Subir foto o PDF del comprobante</p>
                      <p className="text-xs text-slate-500 mt-1">Arrastra tu archivo aquí o haz clic para buscar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. LÓGICA DE ENVÍO */}
            <div className="border-t border-slate-100 pt-6">
              <button
                onClick={handleSubmit}
                disabled={!file || isUploading}
                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 
                  ${!file 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : isUploading
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                  }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Subiendo comprobante...
                  </>
                ) : (
                  'Enviar Comprobante y Solicitar Activación'
                )}
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};
