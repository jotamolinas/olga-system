import { db, auth } from './auth';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { Persona, Pagare, KnowledgeDoc } from '../types';

export const syncPersonaToFirestore = async (userId: string, persona: Persona) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'personas', persona.id);
  const cleanPersona = JSON.parse(JSON.stringify(persona));
  await setDoc(docRef, { ...cleanPersona, userId: auth.currentUser.uid });
};

export const fetchPersonasFromFirestore = async (userId: string): Promise<Persona[]> => {
  if (!auth?.currentUser?.uid) return [];
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const q = isAdmin 
    ? query(collection(db, 'personas'))
    : query(collection(db, 'personas'), where('userId', '==', auth.currentUser.uid));
  const snapshot = await getDocs(q);
  const personas: Persona[] = [];
  snapshot.forEach(doc => {
    const data = doc.data() as any;
    delete data.userId;
    personas.push({ ...data, id: doc.id } as Persona);
  });
  console.log("Personas recuperadas: ", personas);
  return personas;
};

export const deletePersonaFromFirestore = async (personaId: string) => {
  if (!auth?.currentUser?.uid) return;
  await deleteDoc(doc(db, 'personas', personaId));
};

export const syncPagareToFirestore = async (userId: string, pagare: Pagare) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'pagares', pagare.id);
  
  // Clean undefined values to prevent Firestore errors (JSON stringify strips undefined)
  const cleanPagare = JSON.parse(JSON.stringify(pagare));

  await setDoc(docRef, { ...cleanPagare, userId: auth.currentUser.uid });
};


export const updatePagareInFirestore = async (userId: string, pagare: Pagare) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'pagares', pagare.id);
  const cleanPagare = JSON.parse(JSON.stringify(pagare));
  
  // Usamos updateDoc para asegurar que solo se actualizan los campos provistos
  // sin sobrescribir ni borrar campos clave existentes como 'status' o 'creator_role'
  await updateDoc(docRef, { ...cleanPagare, userId: auth.currentUser.uid });
};

export const fetchPagaresFromFirestore = async (userId: string): Promise<Pagare[]> => {
  if (!auth?.currentUser?.uid) return [];
  
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const q = isAdmin 
    ? query(collection(db, 'pagares'))
    : query(collection(db, 'pagares'), where('userId', '==', auth.currentUser.uid));
    
  const snapshot = await getDocs(q);
  const pagares: Pagare[] = [];
  const uid = auth.currentUser.uid;
  const userEmail = auth.currentUser.email || 'no-email@example.com';
  
  snapshot.forEach(doc => {
    const data = doc.data() as any;
    if (isAdmin || data.userId === uid || data.creator_id === uid || data.email === userEmail || data.userEmail === userEmail) {
      delete data.userId;
      pagares.push({ ...data, id: doc.id } as Pagare);
    }
  });
  console.log("Pagarés recuperados: ", pagares);
  return pagares;
};

export const anularPagareFromFirestore = async (pagareId: string) => {
  if (!auth?.currentUser?.uid) return;
  await updateDoc(doc(db, 'pagares', pagareId), { status: 'anulado', anuladoAt: new Date().toISOString() });
};

export const syncKnowledgeDocToFirestore = async (userId: string, kDoc: KnowledgeDoc) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'knowledge_docs', kDoc.id);
  await setDoc(docRef, { ...kDoc, userId: auth.currentUser.uid });
};

export const fetchKnowledgeDocsFromFirestore = async (userId: string): Promise<KnowledgeDoc[]> => {
  if (!auth?.currentUser?.uid) return [];
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const q = isAdmin 
    ? query(collection(db, 'knowledge_docs'))
    : query(collection(db, 'knowledge_docs'), where('userId', '==', auth.currentUser.uid));
  const snapshot = await getDocs(q);
  const docs: KnowledgeDoc[] = [];
  snapshot.forEach(doc => {
    const data = doc.data() as any;
    delete data.userId;
    docs.push(data as KnowledgeDoc);
  });
  return docs;
};

export const deleteKnowledgeDocFromFirestore = async (kDocId: string) => {
  if (!auth?.currentUser?.uid) return;
  await deleteDoc(doc(db, 'knowledge_docs', kDocId));
};
export const guardarEscritoToFirestore = async (userId: string, texto: string, tipo: string = 'Escrito Generado') => {
  if (!auth.currentUser || !auth.currentUser.uid) return;
  console.log("Guardando con UID:", auth.currentUser.uid);
  const datosDelDocumento = {
    texto,
    tipo,
    userId: auth.currentUser.uid
  };
  const docRef = await addDoc(collection(db, 'documentos_olga'), { 
    ...datosDelDocumento, 
    createdAt: new Date().toISOString() 
  });
  return docRef.id;
};
