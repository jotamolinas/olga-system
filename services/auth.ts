import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, signInAnonymously, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// @ts-ignore
import firebaseConfigRaw from '../firebase-applet-config.json';

const firebaseConfig = {
  ...firebaseConfigRaw
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, (firebaseConfig as any).firestoreDatabaseId);
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

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const emailSignIn = async (email: string, password: string): Promise<{ user: User } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithEmailAndPassword(auth, email, password);
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
    const result = await createUserWithEmailAndPassword(auth, email, password);
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
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

