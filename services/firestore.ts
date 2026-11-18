import { db, auth } from './auth';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { Persona, Pagare, KnowledgeDoc } from '../types';
import { depurarDuplicadosLista } from './personaDedup';

export const syncPersonaToFirestore = async (userId: string, persona: Persona) => {
  if (!persona || !persona.id) {
    console.error("syncPersonaToFirestore: ID de persona ausente o inválido", persona);
    return;
  }
  const cleanPersona = JSON.parse(JSON.stringify(persona));
  const effectiveUserId = userId || auth?.currentUser?.uid;
  const user = (auth?.currentUser || {}) as any;
  const personaPayload = {
    ...cleanPersona, 
    id: persona.id,
    userId: effectiveUserId,
    ownedByWorkspace: effectiveUserId,
    creator_id: cleanPersona.creator_id || user.uid,
    createdBy: cleanPersona.createdBy || user.uid,
    creator_name: cleanPersona.creator_name || user.displayName || user.nombre || user.email?.split('@')[0] || 'Usuario',
    creator_role: cleanPersona.creator_role || user.role || user.rol || 'titular',
    created_at: cleanPersona.created_at || new Date().toISOString(),
    fechaCreacion: cleanPersona.fechaCreacion || serverTimestamp(),
    fechaActualizacion: serverTimestamp()
  };

  const promises = [
    setDoc(doc(db, 'personas', persona.id), personaPayload, { merge: true }),
    setDoc(doc(db, 'directorio_personas', persona.id), personaPayload, { merge: true })
  ];
  if (effectiveUserId) {
    promises.push(setDoc(doc(db, 'users', effectiveUserId, 'fichero_personas', persona.id), personaPayload, { merge: true }));
  }
  await Promise.allSettled(promises);
};

export const updatePersonaInFirestore = async (userId: string, persona: Persona) => {
  return syncPersonaToFirestore(userId, persona);
};

export const fetchPersonasFromFirestore = async (userId?: string): Promise<Persona[]> => {
  const effectiveUserId = userId || auth?.currentUser?.uid;
  const uid = auth?.currentUser?.uid || userId;
  if (!uid && !effectiveUserId) return [];

  const targetId = effectiveUserId || uid;
  const isAdmin = auth?.currentUser?.email === 'jotamolinas@gmail.com';
  const todasPersonas: Persona[] = [];

  try {
    const promises = [
      isAdmin ? getDocs(query(collection(db, 'directorio_personas'))) : getDocs(query(collection(db, 'directorio_personas'), where('userId', '==', targetId))),
      isAdmin ? getDocs(query(collection(db, 'personas'))) : getDocs(query(collection(db, 'personas'), where('userId', '==', targetId))),
      getDocs(collection(db, 'users', targetId, 'fichero_personas'))
    ];

    if (uid && uid !== targetId) {
      promises.push(getDocs(query(collection(db, 'directorio_personas'), where('userId', '==', uid))));
      promises.push(getDocs(query(collection(db, 'personas'), where('userId', '==', uid))));
      promises.push(getDocs(collection(db, 'users', uid, 'fichero_personas')));
    }

    const snapshots = await Promise.allSettled(promises);

    snapshots.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        res.value.forEach(docSnap => {
          const data = docSnap.data() as any;
          const pId = docSnap.id;
          if (isAdmin || !data.userId || data.userId === targetId || data.userId === uid || data.ownedByWorkspace === targetId || data.creator_id === uid || data.createdBy === uid) {
            todasPersonas.push({ ...data, id: pId, userId: data.userId || targetId } as Persona);
          }
        });
      }
    });

    const { listaLimpia } = depurarDuplicadosLista(todasPersonas);

    // Auto-reparación silenciosa en segundo plano
    for (const p of listaLimpia) {
      if (p.id) {
        const cleanP = JSON.parse(JSON.stringify(p));
        setDoc(doc(db, 'directorio_personas', p.id), {
          ...cleanP,
          userId: p.userId || targetId,
          fechaActualizacion: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }

    return listaLimpia;
  } catch (err) {
    console.error("Error en fetchPersonasFromFirestore:", err);
    return [];
  }
};

export const deletePersonaFromFirestore = async (personaId: string, userId?: string) => {
  const effectiveUserId = userId || auth?.currentUser?.uid;
  const promises = [
    deleteDoc(doc(db, 'personas', personaId)),
    deleteDoc(doc(db, 'directorio_personas', personaId))
  ];
  if (effectiveUserId) {
    promises.push(deleteDoc(doc(db, 'users', effectiveUserId, 'fichero_personas', personaId)));
  }
  await Promise.allSettled(promises);
};

export const syncPagareToFirestore = async (userId: string, pagare: Pagare) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'pagares', pagare.id);
  
  const cleanPagare = JSON.parse(JSON.stringify(pagare));
  const effectiveUserId = userId || auth?.currentUser?.uid;
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
  const effectiveUserId = userId || auth?.currentUser?.uid;
  
  await setDoc(docRef, { ...cleanPagare, userId: effectiveUserId }, { merge: true });
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
  return pagares;
};

export const anularPagareFromFirestore = async (pagareId: string) => {
  if (!auth?.currentUser?.uid) return;
  await updateDoc(doc(db, 'pagares', pagareId), { status: 'anulado', anuladoAt: new Date().toISOString() });
};

export const syncKnowledgeDocToFirestore = async (userId: string, kDoc: KnowledgeDoc) => {
  if (!auth?.currentUser?.uid) return;
  const docRef = doc(db, 'knowledge_docs', kDoc.id);
  const effectiveUserId = userId || auth?.currentUser?.uid;
  await setDoc(docRef, { ...kDoc, userId: effectiveUserId }, { merge: true });
};

export const fetchKnowledgeDocsFromFirestore = async (userId?: string): Promise<KnowledgeDoc[]> => {
  if (!auth?.currentUser?.uid) return [];
  const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
  const effectiveUserId = userId || auth?.currentUser?.uid;
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
