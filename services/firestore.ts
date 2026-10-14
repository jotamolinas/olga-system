import { db, auth } from './auth';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { Persona, Pagare, KnowledgeDoc } from '../types';

export const syncPersonaToFirestore = async (userId: string, persona: Persona) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'personas', persona.id);
  const cleanPersona = JSON.parse(JSON.stringify(persona));
  const effectiveUserId = userId || auth.currentUser.uid;
  const user = auth.currentUser as any;
  await setDoc(docRef, { 
    ...cleanPersona, 
    userId: effectiveUserId, 
    creator_id: cleanPersona.creator_id || user.uid,
    createdBy: cleanPersona.createdBy || user.uid,
    creator_name: cleanPersona.creator_name || user.displayName || user.nombre || user.email?.split('@')[0] || 'Usuario',
    creator_role: cleanPersona.creator_role || user.role || user.rol || 'titular',
    fechaCreacion: cleanPersona.fechaCreacion || serverTimestamp() 
  }, { merge: true });
};

export const fetchPersonasFromFirestore = async (userId?: string): Promise<Persona[]> => {
  if (!auth?.currentUser?.uid) return [];
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const effectiveUserId = userId || auth.currentUser.uid;
  const q = isAdmin 
    ? query(collection(db, 'personas'))
    : query(collection(db, 'personas'), where('userId', '==', effectiveUserId));
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
  const effectiveUserId = userId || auth.currentUser.uid;
  const user = auth.currentUser as any;

  await setDoc(docRef, { 
    ...cleanPagare, 
    userId: effectiveUserId, 
    creator_id: cleanPagare.creator_id || user.uid,
    createdBy: cleanPagare.createdBy || user.uid,
    creator_name: cleanPagare.creator_name || user.displayName || user.nombre || user.email?.split('@')[0] || 'Usuario',
    creator_role: cleanPagare.creator_role || user.role || user.rol || 'titular',
    fechaCreacion: cleanPagare.fechaCreacion || serverTimestamp() 
  }, { merge: true });
};

export const updatePagareInFirestore = async (userId: string, pagare: Pagare) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'pagares', pagare.id);
  const cleanPagare = JSON.parse(JSON.stringify(pagare));
  const effectiveUserId = userId || auth.currentUser.uid;
  
  // Usamos updateDoc para asegurar que solo se actualizan los campos provistos
  await updateDoc(docRef, { ...cleanPagare, userId: effectiveUserId });
};

export const fetchPagaresFromFirestore = async (userId?: string): Promise<Pagare[]> => {
  if (!auth?.currentUser?.uid) return [];
  
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const effectiveUserId = userId || auth.currentUser.uid;
  const q = isAdmin 
    ? query(collection(db, 'pagares'))
    : query(collection(db, 'pagares'), where('userId', '==', effectiveUserId));
    
  const snapshot = await getDocs(q);
  const pagares: Pagare[] = [];
  const uid = auth.currentUser.uid;
  const userEmail = auth.currentUser.email || 'no-email@example.com';
  
  snapshot.forEach(doc => {
    const data = doc.data() as any;
    if (isAdmin || data.userId === effectiveUserId || data.userId === uid || data.creator_id === uid || data.createdBy === uid || data.email === userEmail || data.userEmail === userEmail) {
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
  const effectiveUserId = userId || auth.currentUser.uid;
  await setDoc(docRef, { ...kDoc, userId: effectiveUserId }, { merge: true });
};

export const fetchKnowledgeDocsFromFirestore = async (userId?: string): Promise<KnowledgeDoc[]> => {
  if (!auth?.currentUser?.uid) return [];
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const effectiveUserId = userId || auth.currentUser.uid;
  const q = isAdmin 
    ? query(collection(db, 'knowledge_docs'))
    : query(collection(db, 'knowledge_docs'), where('userId', '==', effectiveUserId));
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
  const effectiveUserId = userId || auth.currentUser.uid;
  console.log("Guardando escrito con Workspace/UserId:", effectiveUserId);
  const user = auth.currentUser as any;
  const datosDelDocumento = {
    texto,
    tipo,
    userId: effectiveUserId,
    creator_id: user.uid,
    createdBy: user.uid,
    creator_name: user.displayName || user.nombre || user.email?.split('@')[0] || 'Usuario',
    creator_role: user.role || user.rol || 'titular'
  };
  const docRef = await addDoc(collection(db, 'documentos_olga'), { 
    ...datosDelDocumento, 
    createdAt: new Date().toISOString(),
    fechaCreacion: serverTimestamp() 
  });
  return docRef.id;
};
