import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User, signInAnonymously, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDGxd8nQTXTRpmwTKAw9xLl9uiTZuRT2UM",
  authDomain: "nipponguay.firebaseapp.com",
  projectId: "nipponguay",
  storageBucket: "nipponguay.firebasestorage.app",
  messagingSenderId: "933976114072",
  appId: "1:933976114072:web:ee8106d228b40ad09961ed"
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

export const confirmPhoneCode = async (code: string): Promise<{ user: User } | null> => {
  try {
    const confirmationResult = (window as any).confirmationResult;
    if (!confirmationResult) throw new Error('No hay código pendiente de confirmación');
    
    const result = await confirmationResult.confirm(code);
    return { user: result.user };
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

export const registerNewSession = async (uid: string): Promise<string> => {
  const localSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('appSessionId', localSessionId);
  try {
    const { doc, setDoc } = await import('firebase/firestore');
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

export const emailSignIn = async (email: string, password: string): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const cleanEmail = (email || '').trim().toLowerCase();
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    if (result.user) {
      await registerNewSession(result.user.uid);
    }
    return { user: result.user };
  } catch (error) {
    console.error('Email sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignUp = async (email: string, password: string): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const cleanEmail = (email || '').trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (result.user) {
      const sessionId = await registerNewSession(result.user.uid);
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // SOLO si el usuario es NUEVO, inyecta la metadata inicial:
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email || cleanEmail,
          fecha_creacion: serverTimestamp(),
          planActual: 'trial',
          role: 'titular',
          rol: 'titular',
          estado_cuenta: 'activa',
          consultasUsadas: 0,
          escritosUsados: 0,
          usoIA: 0,
          activeSessionId: sessionId
        });
      } else {
        // Si el usuario ya existe, SOLO actualiza datos de sesión, NO toques roles ni planes.
        await setDoc(userRef, {
          activeSessionId: sessionId
        }, { merge: true });
      }
    }
    return { user: result.user };
  } catch (error) {
    console.error('Email sign up error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

