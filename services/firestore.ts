import { db, auth } from './auth';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { Persona, Pagare, KnowledgeDoc, TipoPersona, TipoDocumento } from '../types';
import { depurarDuplicadosLista } from './personaDedup';

const sanitizePlainObject = (input: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.getPrototypeOf(val) === Object.prototype) {
      out[key] = sanitizePlainObject(val);
    } else {
      out[key] = val;
    }
  }
  return out;
};

export const normalizePersona = (raw: any, docId: string): Persona => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = String(src.id ?? docId ?? '').trim() || docId;
  const nombreBase = String(src.nombre ?? src.nombre_o_razon_social ?? '').trim();
  const apellido = String(src.apellido ?? '').trim();
  const nombreORazonSocial = String(
    src.nombre_o_razon_social ?? `${nombreBase} ${apellido}`.trim()
  ).trim();
  const nroDocumento = String(src.nro_documento ?? src.documento_numero ?? '').trim();
  const documentoNumero = String(src.documento_numero ?? src.nro_documento ?? '').trim();

  const rawTipo = String(src.tipo_persona ?? 'física').trim().toLowerCase();
  let tipoPersona: TipoPersona = 'física';
  if (rawTipo === 'jurídica' || rawTipo === 'juridica') {
    tipoPersona = 'jurídica';
  } else if (rawTipo === 'física' || rawTipo === 'fisica') {
    tipoPersona = 'física';
  } else if (nroDocumento.replace(/\D/g, '').startsWith('800')) {
    tipoPersona = 'jurídica';
  }

  const rawTipoDoc = String(src.tipo_documento ?? '').trim().toUpperCase();
  const tipoDocumento: TipoDocumento =
    rawTipoDoc === 'RUC' || rawTipoDoc === 'CI'
      ? (rawTipoDoc as TipoDocumento)
      : (nroDocumento.includes('-') || tipoPersona === 'jurídica' ? 'RUC' : 'CI');

  const ownedByWorkspace = String(
    src.ownedByWorkspace ?? src.userId ?? src.createdBy ?? src.creator_id ?? ''
  ).trim();
  const userId = String(
    src.userId ?? src.createdBy ?? src.ownedByWorkspace ?? src.creator_id ?? ''
  ).trim();

  const baseNormalized: Persona = {
    ...(sanitizePlainObject(src) as Partial<Persona>),
    id,
    nombre: nombreBase,
    apellido,
    nombre_o_razon_social: nombreORazonSocial,
    nro_documento: nroDocumento,
    documento_numero: documentoNumero,
    tipo_documento: tipoDocumento,
    tipo_persona: tipoPersona,
    domicilio: String(src.domicilio ?? src.direccion ?? '').trim(),
    email: String(src.email ?? '').trim(),
    telefono: String(src.telefono ?? '').trim(),
    notas_notariales: String(src.notas_notariales ?? ''),
    representante_id: src.representante_id ? String(src.representante_id) : '',
    representanteLegal:
      src.representanteLegal !== undefined && src.representanteLegal !== null
        ? String(src.representanteLegal)
        : (tipoPersona === 'física' ? 'No aplica' : (src.representante_id ? 'Asignado' : 'Sin Asignar')),
    responsable: src.responsable && src.responsable !== 'MONKEY BUSINESS IA' ? String(src.responsable) : null,
    ownedByWorkspace,
    userId,
    createdBy: String(src.createdBy ?? src.creator_id ?? userId ?? '').trim(),
    creator_id: String(src.creator_id ?? src.createdBy ?? userId ?? '').trim(),
    origen: src.origen ? String(src.origen) : 'MANUAL',
  };

  return baseNormalized;
};

export const syncPersonaToFirestore = async (workspaceIdOrUserId: string, persona: Persona) => {
  if (!persona || !persona.id) {
    console.error("syncPersonaToFirestore: ID de persona ausente o inválido", persona);
    return;
  }
  const user = (auth?.currentUser || {}) as any;
  const uid = String(user?.uid || '').trim();
  const normalized = normalizePersona(persona, persona.id);
  const effectiveWorkspace = String(
    workspaceIdOrUserId || normalized.ownedByWorkspace || normalized.userId || uid
  ).trim();

  if (!effectiveWorkspace && !uid) {
    throw new Error('No hay sesión autenticada para guardar en directorio_personas.');
  }

  const nombreCompleto = normalized.nombre_o_razon_social || `${normalized.nombre} ${normalized.apellido || ''}`.trim();
  const cleanNormalized = sanitizePlainObject(normalized as Record<string, any>);

  const personaPayload: Record<string, any> = {
    ...cleanNormalized,
    id: normalized.id,
    nombre: normalized.nombre,
    apellido: normalized.apellido ?? '',
    nombre_o_razon_social: nombreCompleto,
    nro_documento: normalized.nro_documento,
    documento_numero: normalized.documento_numero || normalized.nro_documento,
    tipo_documento: normalized.tipo_documento,
    tipo_persona: normalized.tipo_persona,
    domicilio: normalized.domicilio ?? '',
    email: normalized.email ?? '',
    telefono: normalized.telefono ?? '',
    notas_notariales: normalized.notas_notariales ?? '',
    ownedByWorkspace: effectiveWorkspace || uid,
    userId: uid || effectiveWorkspace,
    createdBy: normalized.createdBy || uid || effectiveWorkspace,
    creator_id: normalized.creator_id || uid || effectiveWorkspace,
    creator_name: cleanNormalized.creator_name || user?.displayName || user?.nombre || user?.email?.split('@')[0] || 'Usuario',
    creator_role: cleanNormalized.creator_role || user?.role || user?.rol || 'titular',
    created_at: cleanNormalized.created_at || new Date().toISOString(),
    fechaCreacion: cleanNormalized.fechaCreacion || serverTimestamp(),
    fechaActualizacion: serverTimestamp()
  };

  await setDoc(doc(db, 'directorio_personas', normalized.id), personaPayload, { merge: true });
};

export const updatePersonaInFirestore = async (userId: string, persona: Persona) => {
  return syncPersonaToFirestore(userId, persona);
};

export const fetchPersonasFromFirestore = async (workspaceId?: string): Promise<Persona[]> => {
  const uid = String(auth?.currentUser?.uid || '').trim();
  const effectiveWorkspace = String(workspaceId || uid || '').trim();
  if (!uid && !effectiveWorkspace) return [];

  const isAdmin = auth?.currentUser?.email === 'jotamolinas@gmail.com';
  const mapaUnificado = new Map<string, Persona>();

  try {
    const colRef = collection(db, 'directorio_personas');
    const queries = isAdmin
      ? [getDocs(query(colRef))]
      : [
          getDocs(query(colRef, where('ownedByWorkspace', '==', effectiveWorkspace))),
          getDocs(query(colRef, where('userId', '==', effectiveWorkspace))),
          ...(uid && uid !== effectiveWorkspace
            ? [getDocs(query(colRef, where('userId', '==', uid)))]
            : []),
          ...(uid
            ? [
                getDocs(query(colRef, where('createdBy', '==', uid))),
                getDocs(query(colRef, where('creator_id', '==', uid)))
              ]
            : [])
        ];

    const snapshots = await Promise.allSettled(queries);

    snapshots.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        res.value.forEach((docSnap) => {
          const normalized = normalizePersona(docSnap.data(), docSnap.id);
          if (!mapaUnificado.has(docSnap.id)) {
            mapaUnificado.set(docSnap.id, normalized);
          }
        });
      }
    });

    const { listaLimpia } = depurarDuplicadosLista(Array.from(mapaUnificado.values()));
    return listaLimpia.map((p) => normalizePersona(p, p.id));
  } catch (err) {
    console.error("Error en fetchPersonasFromFirestore:", err);
    return [];
  }
};

export const deletePersonaFromFirestore = async (personaId: string) => {
  if (!personaId) return;
  await deleteDoc(doc(db, 'directorio_personas', personaId));
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
