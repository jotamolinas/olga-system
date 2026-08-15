import React, { useState, useRef } from 'react';
import { KnowledgeDoc } from '../types';
import { User } from 'firebase/auth';
import { syncKnowledgeDocToFirestore, deleteKnowledgeDocFromFirestore } from '../services/firestore';
import { storage } from '../services/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Database, Upload, FileText, Trash2, ShieldAlert, Cpu, HardDrive } from 'lucide-react';

interface KnowledgeBaseTabProps {
  docs: KnowledgeDoc[];
  setDocs: React.Dispatch<React.SetStateAction<KnowledgeDoc[]>>;
  currentUser: User;
  onOpenDocument?: (text: string) => void;
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({ docs, setDocs, currentUser, onOpenDocument }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const writeDocToBackend = async (newDoc: KnowledgeDoc) => {
    setDocs(prev => [...prev, newDoc]);
    if (currentUser) {
      await syncKnowledgeDocToFirestore(currentUser.uid, newDoc);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const textContent = event.target?.result as string;
      
      let storageUrl = '';
      try {
        const storageRef = ref(storage, `users/${currentUser.uid}/knowledge_docs/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        storageUrl = await getDownloadURL(storageRef);
      } catch(e) { console.error(e); }

      const newDoc: KnowledgeDoc = {
        id: 'doc-' + Date.now(),
        name: file.name,
        type: file.type || 'Documento',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        content: textContent || `[El archivo no es de texto plano. Nombre: ${file.name}]`,
        storageUrl
      };

      writeDocToBackend(newDoc);
      setIsUploading(false);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      setIsUploading(false);
      console.error("Error al leer el archivo.");
    };

    // Si es un archivo de texto, leemos el contenido real
    if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
      const readPdf = async () => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          // Importamos pdfjs dinámicamente
          const pdfjsLib = await import('pdfjs-dist');
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          }
          
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            text += pageText + '\n';
          }
          
          let storageUrl = '';
          try {
            const storageRef = ref(storage, `users/${currentUser.uid}/knowledge_docs/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            storageUrl = await getDownloadURL(storageRef);
          } catch(e) { console.error(e); }

          const newDoc: KnowledgeDoc = {
            id: 'doc-' + Date.now(),
            name: file.name,
            type: file.type || 'Documento PDF',
            size: file.size,
            uploadedAt: new Date().toISOString(),
            content: text.trim() || '[El PDF está vacío o es una imagen escaneada sin texto]',
            storageUrl
          };
          
          writeDocToBackend(newDoc);
        } catch (error) {
          console.error("Error procesando PDF:", error);
          console.error("Hubo un error al extraer el texto del PDF.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      readPdf();
    } else if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      // Para otros formatos (PDF, Word) en versión cliente, guardamos metadatos indicando que no se extrajo texto.
      setTimeout(async () => {
        let storageUrl = '';
        try {
          const storageRef = ref(storage, `users/${currentUser.uid}/knowledge_docs/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          storageUrl = await getDownloadURL(storageRef);
        } catch(e) { console.error(e); }

        const newDoc: KnowledgeDoc = {
          id: 'doc-' + Date.now(),
          name: file.name,
          type: file.type || 'Documento',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          content: `[Nombre del archivo: ${file.name}]. Nota: En esta versión local de demostración, no se puede extraer texto automáticamente de PDFs o documentos Word. Se sugiere copiar su contenido y subirlo en archivo de texto plano (.txt).`,
          storageUrl
        };

        writeDocToBackend(newDoc);
        setIsUploading(false);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1000);
    }
  };

  const handleDriveUpload = async () => {
    setIsUploading(true);
    try {
      const { getAccessToken } = await import('../services/auth');
      let token = await getAccessToken();
      if (!token) {
        throw new Error("No hay sesión de Google iniciada");
      }

      if (!token) {
        setIsUploading(false);
        return;
      }

      await new Promise<void>((resolve) => {
        if ((window as any).gapi) {
          (window as any).gapi.load('picker', () => resolve());
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          (window as any).gapi.load('picker', () => resolve());
        };
        document.body.appendChild(script);
      });

      const pickerOrigin = window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
        ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
        : window.location.origin;
      const view = new (window as any).google.picker.DocsView()
        .setIncludeFolders(true);
      
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setCallback(async (data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const file = data.docs[0];
            try {
              // Intenta descargar el contenido del archivo si es texto (descarga directa)
              const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              if (!res.ok) throw new Error('No se pudo descargar el archivo o es un formato de Google nativo');
              
              let content = '';
              if (file.mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
                const arrayBuffer = await res.arrayBuffer();
                const pdfjsLib = await import('pdfjs-dist');
                if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
                }
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  content += textContent.items.map((item: any) => item.str).join(' ') + '\n';
                }
              } else {
                content = await res.text();
              }
              
              const newDoc: KnowledgeDoc = {
                id: 'doc-drive-' + Date.now(),
                name: file.name,
                type: file.mimeType || 'Google Drive Document',
                size: file.sizeBytes || content.length,
                uploadedAt: new Date().toISOString(),
                content: content
              };
              writeDocToBackend(newDoc);
            } catch (err) {
              // Si falla (por ejemplo, Google Docs no permite exportar con ?alt=media, debe hacerse con exportMap)
              const newDoc: KnowledgeDoc = {
                id: 'doc-drive-' + Date.now(),
                name: file.name,
                type: file.mimeType || 'Google Drive Document',
                size: file.sizeBytes || 0,
                uploadedAt: new Date().toISOString(),
                content: `[Enlace a documento de Google Drive: ${file.name}]. Nota: No se pudo extraer texto porque puede requerir un formato de exportación, pero la IA lo considerará por el nombre y metadatos.`
              };
              writeDocToBackend(newDoc);
            }
          }
        })
        .setOrigin(pickerOrigin)
        .build();
        
      picker.setVisible(true);
    } catch (error) {
      console.error('Error with Google Drive:', error);
      console.error('Error connecting to Google Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeDoc = async (id: string) => {
    setDocs(docs.filter(d => d.id !== id));
    if (currentUser) {
      await deleteKnowledgeDocFromFirestore(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-3">
            <Database className="w-6 h-6 text-[#FF3131]" />
            Entrenamiento de IA (O.L.G.A.)
          </h2>
          <p className="text-xs text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Sube documentos físicos, PDFs, manuales o leyes para entrenar la Base de Conocimiento local de O.L.G.A. Los documentos subidos aquí actúan como memoria permanente y la IA basará sus respuestas contextuales utilizando esta información.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDriveUpload}
            disabled={isUploading}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl hover:bg-blue-700 hover:scale-105 transition-all text-xs font-bold uppercase tracking-wider"
          >
            <HardDrive className="w-4 h-4" />
            Google Drive
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-[#FF3131] hover:scale-105 transition-all text-xs font-bold uppercase tracking-wider"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
               <>
                <Upload className="w-4 h-4" />
                Entrenar Documento
              </>
            )}
          </button>
        </div>
        <input  
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.txt,.doc,.docx,image/*" 
          onChange={handleFileUpload}
        />
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm min-h-[400px]">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-500" />
          Memoria Activa
        </h3>
        
        {docs.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
            <Database className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-xs font-medium uppercase tracking-widest">Base de conocimiento vacía</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {docs.map(doc => (
              <div 
                key={doc.id} 
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between p-6"
                onClick={() => onOpenDocument && onOpenDocument(doc.content || '')}
              >
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-bold text-slate-800 text-base truncate" title={doc.name}>{doc.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">
                          {(doc.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/50">
                    <p className="text-xs text-slate-500 line-clamp-4 italic">
                      "{doc.content ? doc.content.substring(0, 200) : 'Sin contenido de texto extraído'}..."
                    </p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDoc(doc.id);
                    }}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-wider hover:text-red-500 transition-colors flex items-center gap-1"
                    title="Eliminar de la memoria"
                  >
                    <Trash2 className="w-3 h-3" /> ELIMINAR
                  </button>
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider group-hover:underline flex items-center gap-1">
                    Ver Detalles &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-start gap-3 bg-indigo-50 text-indigo-800 p-4 rounded-xl border border-indigo-100">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold uppercase tracking-wider">Aislamiento de Datos de Cliente</p>
            <p className="opacity-80">
              Los documentos subidos a la memoria de O.L.G.A. están encriptados y limitados al espacio de trabajo de su escribanía. Úselo para cargar la Ley de Maquila y Modelos Contractuales preferidos por su firma.
            </p>
          </div>
        </div>

        {/* System Prompt Copy Section */}
        <div className="mt-8">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            System Instruction Base (Para O.L.G.A.)
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Copia esta instrucción base y configúrala en el motor de IA para maximizar el potencial de O.L.G.A. como asistente redactora legal.
          </p>
          <div className="relative group">
            <textarea 
              readOnly 
              className="w-full box-border h-48 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl outline-none resize-none"
              defaultValue={`Eres O.L.G.A. (Organización, Legalización, Gestión y Administración), una Súper Asistente Legal, Notarial y Ejecutiva de élite.

TU ROL PRINCIPAL:
Eres una abogada y escribana experta, especializada en la redacción veloz y precisa de contratos privados, escrituras públicas, pagarés y documentos societarios.

USO DE BASE DE CONOCIMIENTO (LEYES Y DOCUMENTOS):
Deberás basar estrictamente todas tus opiniones, justificaciones y redacciones en las leyes, reglamentos y modelos contractuales que el usuario te proporcione a través del entrenamiento ("Documentos Entrenados"). Si el usuario sube la Ley de Maquila, el Código Civil o un formato específico de contrato, debes adoptar esos textos como tu fuente primaria de verdad.

TONO Y ESTILO:
- Ejecutivo, seguro, altamente técnico-jurídico y directo.
- No uses rodeos. Si te piden un contrato, redacta directamente las cláusulas con lenguaje notarial impecable.
- Protege siempre la seguridad jurídica de la escribanía y del cliente.

CAPACIDADES INTRÍNSECAS:
- Análisis veloz de pagarés, extrayendo partes, montos y acreedores.
- Redacción de cláusulas automáticas, de mora, intereses y penalidades según la jurisdicción estipulada.
- Capacidad de adaptar formatos pre-existentes a nuevas leyes subidas al sistema.`}
            />
            <button 
              onClick={(e) => {
                const text = (e.target as HTMLElement).previousElementSibling?.textContent || (e.target as HTMLElement).parentElement?.querySelector('textarea')?.value;
                if(text) navigator.clipboard.writeText(text);
                console.error("System Instruction copiado al portapapeles.");
              }}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all"
            >
              Copiar Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
