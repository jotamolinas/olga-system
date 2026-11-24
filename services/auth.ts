import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User, signInAnonymously, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const envMeta = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: envMeta.VITE_FIREBASE_API_KEY || "AIzaSyDGxd8nQTXTRpmwTKAw9xLl9uiTZuRT2UM",
  authDomain: envMeta.VITE_FIREBASE_AUTH_DOMAIN || "nipponguay.firebaseapp.com",
  projectId: envMeta.VITE_FIREBASE_PROJECT_ID || "nipponguay",
  storageBucket: envMeta.VITE_FIREBASE_STORAGE_BUCKET || "nipponguay.firebasestorage.app",
  messagingSenderId: envMeta.VITE_FIREBASE_MESSAGING_SENDER_ID || "933976114072",
  appId: envMeta.VITE_FIREBASE_APP_ID || "1:933976114072:web:ee8106d228b40ad09961ed"
};



const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Asegurar persistencia local
setPersistence(auth, browserLocalPersistence).catch(console.error);


let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const setupRecaptcha = (containerId: string) => {
  if (!(window as any).recaptchaVerifier) {
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible'
    });
  }
  return (window as any).recaptchaVerifier;
};

export const signInWithPhone = async (phoneNumber: string, appVerifier: any) => {
  try {
    isSigningIn = true;
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    (window as any).confirmationResult = confirmationResult;
    return confirmationResult;
  } catch (error) {
    console.error('Error enviando SMS:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export interface EnsureUserDocOptions {
  provider?: 'email' | 'google' | 'telefono' | 'anonymous';
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  sessionId?: string;
}

const hasValidDateValue = (raw: any): boolean => {
  if (!raw) return false;
  try {
    if (typeof raw?.toDate === 'function') {
      return !isNaN(raw.toDate().getTime());
    }
    if (typeof raw?.toMillis === 'function') {
      return !isNaN(new Date(raw.toMillis()).getTime());
    }
    if (typeof raw?.seconds === 'number') {
      return Number.isFinite(raw.seconds);
    }
    const d = new Date(raw);
    return !isNaN(d.getTime());
  } catch {
    return false;
  }
};

export const ensureUserDocumentInFirestore = async (
  user: User,
  options: EnsureUserDocOptions = {}
): Promise<Record<string, any>> => {
  const userRef = doc(db, 'users', user.uid);
  let existing: Record<string, any> = {};

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existing = snap.data() || {};
    }
  } catch (err) {
    console.warn('No se pudo leer users/{uid} previo, intentando merge seguro:', err);
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const trialEndDate = new Date(nowMs + TRIAL_DURATION_MS);
  const trialEndTs = Timestamp.fromDate(trialEndDate);
  const trialEndIso = trialEndDate.toISOString();

  const cleanEmail = String(existing.email || user.email || options.email || '').trim().toLowerCase();
  const cleanPhone = String(
    existing.telefono ||
    existing.phoneNumber ||
    user.phoneNumber ||
    options.phoneNumber ||
    ''
  ).trim();
  const cleanNombre = String(
    existing.nombre ||
    user.displayName ||
    options.displayName ||
    (cleanEmail ? cleanEmail.split('@')[0] : '') ||
    cleanPhone ||
    'Mi Escribanía'
  ).trim();
  const cleanEscribania = String(
    existing.escribania ||
    existing.razonSocial ||
    existing.nombreInstitucion ||
    'Mi Escribanía'
  ).trim();

  const inferredProvider =
    options.provider ||
    (cleanPhone && !cleanEmail ? 'telefono' : cleanEmail ? 'email' : 'email');

  const payload: Record<string, any> = {
    uid: user.uid,
    identificador: existing.identificador || cleanEmail || cleanPhone || user.uid,
    proveedorAcceso: existing.proveedorAcceso || inferredProvider,
    role: existing.role || existing.rol || 'titular',
    rol: existing.rol || existing.role || 'titular',
    consultasUsadas: typeof existing.consultasUsadas === 'number' ? existing.consultasUsadas : 0,
    escritosUsados: typeof existing.escritosUsados === 'number' ? existing.escritosUsados : 0,
    usoIA: typeof existing.usoIA === 'number' ? existing.usoIA : 0,
  };

  if (cleanEmail) {
    payload.email = cleanEmail;
  } else if (existing.email === undefined) {
    payload.email = '';
  }

  if (cleanPhone) {
    payload.telefono = cleanPhone;
    payload.phoneNumber = cleanPhone;
  } else {
    if (existing.telefono === undefined) payload.telefono = '';
    if (existing.phoneNumber === undefined) payload.phoneNumber = '';
  }

  if (!existing.nombre) {
    payload.nombre = cleanNombre;
  }
  if (!existing.escribania) {
    payload.escribania = cleanEscribania;
  }

  if (!existing.fecha_creacion) {
    payload.fecha_creacion = user.metadata?.creationTime
      ? Timestamp.fromDate(new Date(user.metadata.creationTime))
      : serverTimestamp();
  }
  if (!existing.creadoEn) {
    payload.creadoEn = serverTimestamp();
  }
  if (!existing.fechaRegistro) {
    payload.fechaRegistro = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : nowIso;
  }

  const existingExpiration =
    existing.fecha_expiracion ||
    existing.trialEndsAt ||
    existing.fechaVencimiento ||
    existing.vencimientoPlan ||
    existing.fecha_vencimiento_plan;

  const hasAnyExpiration = hasValidDateValue(existingExpiration);

  if (!hasAnyExpiration) {
    payload.fecha_expiracion = trialEndTs;
    payload.trialEndsAt = trialEndTs;
    payload.fechaVencimiento = trialEndIso;
    payload.vencimientoPlan = trialEndIso;
    if (!existing.planActual) payload.planActual = 'trial';
    if (!existing.plan) payload.plan = 'trial';
    if (!existing.estadoSuscripcion) payload.estadoSuscripcion = 'trial';
    if (!existing.estado_cuenta) payload.estado_cuenta = 'activa';
  } else {
    if (!existing.fecha_expiracion && existingExpiration) {
      payload.fecha_expiracion = existingExpiration;
    }
    if (!existing.trialEndsAt && existingExpiration) {
      payload.trialEndsAt = existingExpiration;
    }
    if (!existing.fechaVencimiento && existingExpiration) {
      payload.fechaVencimiento = existingExpiration;
    }
    if (!existing.vencimientoPlan && existingExpiration) {
      payload.vencimientoPlan = existingExpiration;
    }
    if (!existing.planActual) payload.planActual = existing.plan || 'trial';
    if (!existing.estadoSuscripcion) {
      const planLow = String(existing.planActual || existing.plan || 'trial').toLowerCase();
      const pagoUp = String(existing.estadoPago || existing.estadoPlataforma || '').toUpperCase();
      payload.estadoSuscripcion =
        pagoUp === 'APROBADO' || (planLow !== 'trial' && planLow !== 'sin plan' && planLow !== 'ninguno' && planLow !== '')
          ? 'activo'
          : 'trial';
    }
    if (!existing.estado_cuenta) payload.estado_cuenta = 'activa';
  }

  if (options.sessionId) {
    payload.activeSessionId = options.sessionId;
  }

  await setDoc(userRef, payload, { merge: true });
  return { ...existing, ...payload };
};

export const confirmPhoneCode = async (code: string): Promise<{ user: User; userData?: Record<string, any> } | null> => {
  try {
    const confirmationResult = (window as any).confirmationResult;
    if (!confirmationResult) throw new Error('No hay código pendiente de confirmación');
    
    const result = await confirmationResult.confirm(code);
    let userData: Record<string, any> | undefined;
    if (result.user) {
      const sessionId = generateLocalSessionId();
      userData = await ensureUserDocumentInFirestore(result.user, {
        provider: 'telefono',
        phoneNumber: result.user.phoneNumber || '',
        sessionId,
      });
    }
    return { user: result.user, userData };
  } catch (error) {
    console.error('Error confirmando código SMS:', error);
    throw error;
  }
};



export const anonymousSignIn = async (): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const result = await signInAnonymously(auth);
    return { user: result.user };
  } catch (error: any) {
    console.error('Anonymous sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const generateLocalSessionId = (): string => {
  const localSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  try {
    localStorage.setItem('appSessionId', localSessionId);
  } catch (err) {
    console.warn('Advertencia guardando appSessionId en localStorage:', err);
  }
  return localSessionId;
};

export const registerNewSession = async (uid: string): Promise<string> => {
  const localSessionId = generateLocalSessionId();
  try {
    await setDoc(doc(db, 'users', uid), { activeSessionId: localSessionId }, { merge: true });
  } catch (err) {
    console.warn('Advertencia registrando activeSessionId en Firestore:', err);
  }
  return localSessionId;
};

export const logout = async () => {
  // Purgar rigurosamente tokens de sesión y estados locales remanentes (previene fugas de identidad visual y logos)
  try {
    localStorage.removeItem('appSessionId');
    localStorage.removeItem('olga_configuracion_institucional');
    localStorage.removeItem('olga_configuracion_v1');
    localStorage.removeItem('escritos_temporales');
    localStorage.removeItem('olga_escritos_redaccion_draft_texto');
    localStorage.removeItem('olga_escritos_redaccion_draft_titulo');
    localStorage.removeItem('olga_escritos_redaccion_draft_categoria');
    localStorage.removeItem('olga_draft_pagare');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('olga') || key.includes('config') || key.includes('logo') || key.includes('draft'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error purgando localStorage en logout:', e);
  }
  await auth.signOut();
  cachedAccessToken = null;
};

const EXPECTED_AUTH_USER_ERROR_CODES = new Set([
  'auth/email-already-in-use',
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/wrong-password-existing',
  'auth/user-not-found',
  'auth/weak-password',
  'auth/invalid-email',
  'auth/too-many-requests',
]);

export interface SmartEmailAuthResult {
  user: User;
  userData: Record<string, any>;
  isNewUser: boolean;
}

const createAuthError = (code: string, message: string): Error & { code: string } => {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
};

const ensureUserProfileSafe = async (user: User, cleanEmail: string): Promise<Record<string, any>> => {
  const sessionId = generateLocalSessionId();
  const fallbackProfile: Record<string, any> = {
    uid: user.uid,
    email: user.email || cleanEmail,
    planActual: 'trial',
    plan: 'trial',
    estadoSuscripcion: 'trial',
    estado_cuenta: 'activa',
    activeSessionId: sessionId,
  };

  const ensurePromise = ensureUserDocumentInFirestore(user, {
    provider: 'email',
    email: user.email || cleanEmail,
    sessionId,
  }).catch((err) => {
    console.warn('No se pudo sincronizar inmediatamente users/{uid}; continuará en segundo plano:', err);
    return fallbackProfile;
  });

  const timeoutPromise = new Promise<Record<string, any>>((resolve) => {
    setTimeout(() => resolve(fallbackProfile), 4500);
  });

  return Promise.race([ensurePromise, timeoutPromise]);
};

export const smartEmailAuth = async (
  email: string,
  password: string,
  preferMode: 'login' | 'register' = 'login'
): Promise<SmartEmailAuthResult> => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw createAuthError('auth/invalid-email', 'Por favor, ingresa un correo electrónico válido.');
  }
  if (cleanPassword.length < 6) {
    throw createAuthError('auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.');
  }

  try {
    isSigningIn = true;

    if (preferMode === 'login') {
      // Caso A: Usuario en "Iniciar Sesión"
      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        const userData = await ensureUserProfileSafe(result.user, cleanEmail);
        return { user: result.user, userData, isNewUser: false };
      } catch (signInErr: any) {
        const code = signInErr?.code || '';
        if (code === 'auth/wrong-password') {
          throw createAuthError(
            'auth/wrong-password-existing',
            'Este correo ya tiene una cuenta registrada, pero la contraseña no coincide. Intenta nuevamente o restablece tu contraseña abajo.'
          );
        }
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          try {
            const created = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
            const userData = await ensureUserProfileSafe(created.user, cleanEmail);
            return { user: created.user, userData, isNewUser: true };
          } catch (signUpErr: any) {
            if (signUpErr?.code === 'auth/email-already-in-use') {
              // Caso C: El correo ya existía y la contraseña ingresada no coincidió
              throw createAuthError(
                'auth/wrong-password-existing',
                'Este correo ya tiene una cuenta registrada, pero la contraseña no coincide. Intenta nuevamente o restablece tu contraseña abajo.'
              );
            }
            throw signUpErr;
          }
        }
        throw signInErr;
      }
    } else {
      // Caso B: Usuario en "Registrarse"
      try {
        const created = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        const userData = await ensureUserProfileSafe(created.user, cleanEmail);
        return { user: created.user, userData, isNewUser: true };
      } catch (signUpErr: any) {
        if (signUpErr?.code === 'auth/email-already-in-use') {
          try {
            const signedIn = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
            const userData = await ensureUserProfileSafe(signedIn.user, cleanEmail);
            return { user: signedIn.user, userData, isNewUser: false };
          } catch (fallbackSignInErr: any) {
            const fbCode = fallbackSignInErr?.code || '';
            if (fbCode === 'auth/wrong-password' || fbCode === 'auth/invalid-credential') {
              // Caso C: Correo existente con contraseña incorrecta
              throw createAuthError(
                'auth/wrong-password-existing',
                'Este correo ya tiene una cuenta registrada, pero la contraseña no coincide. Intenta nuevamente o restablece tu contraseña abajo.'
              );
            }
            throw fallbackSignInErr;
          }
        }
        throw signUpErr;
      }
    }
  } catch (error: any) {
    if (EXPECTED_AUTH_USER_ERROR_CODES.has(error?.code)) {
      console.warn('Smart email auth aviso:', error?.code);
    } else {
      console.error('Smart email auth error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignIn = async (email: string, password: string): Promise<SmartEmailAuthResult> => {
  return smartEmailAuth(email, password, 'login');
};

export const emailSignUp = async (email: string, password: string): Promise<SmartEmailAuthResult> => {
  return smartEmailAuth(email, password, 'register');
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error: any) {
    if (EXPECTED_AUTH_USER_ERROR_CODES.has(error?.code)) {
      console.warn('Password reset aviso:', error?.code);
    } else {
      console.error('Password reset error:', error);
    }
    throw error;
  }
};

