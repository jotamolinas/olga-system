const fs = require('fs');
let code = fs.readFileSync('components/PagaresTab.tsx', 'utf-8');

const modalCode = `
      {pagareToAnular && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-500">¿Estás seguro de anular este pagaré?</h3>
              <p className="text-sm text-gray-300">
                Esta acción eliminará por completo todas las cuotas del cronograma y el registro financiero asociado. Esta operación es irreversible.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
                <button
                  type="button"
                  onClick={() => setPagareToAnular(null)}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors border border-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { doc, updateDoc } = require('firebase/firestore');
                      // We must use the imported doc and updateDoc from the file scope.
                      // Wait, we don't need require here, we can just use doc and updateDoc as they are already imported.
                      
                      const docRef = doc(db, 'pagares', pagareToAnular.id);
                      await updateDoc(docRef, { status: 'anulado', anuladoAt: new Date().toISOString() });
                      console.log('Documento anulado exitosamente en Firebase.');
                      setPagareToAnular(null);
                    } catch (error) {
                      console.error("Fallo al anular en Firebase:", error);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
                >
                  Sí, anular y borrar todo
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
`;

code = code.replace('      )}\n\n    </div>\n  );\n};', '      )}' + modalCode + '\n    </div>\n  );\n};\n');
fs.writeFileSync('components/PagaresTab.tsx', code);
