import { useState, useEffect } from 'react';
import { db, auth } from '../services/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const parseAnyDate = (raw: any): Date | null => {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.toMillis === 'function') return new Date(raw.toMillis());
  if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const useTrialStatus = (user?: User | null, externalProfile?: any) => {
  const [pruebaActiva, setPruebaActiva] = useState<boolean>(false);
  const [diasRestantes, setDiasRestantes] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);
  const [isTrialExpired, setIsTrialExpired] = useState<boolean>(false);
  const [isSoftBlocked, setIsSoftBlocked] = useState<boolean>(false);
  const [tienePlanPago, setTienePlanPago] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribeUserSnapshot: (() => void) | null = null;

    const evaluateProfile = (fetchedUserData: any, email?: string | null) => {
      setUserData(fetchedUserData);

      const roleStr = String(fetchedUserData?.rol || fetchedUserData?.role || '').toLowerCase().trim();
      const isOperador = roleStr === 'operador';
      const esAdmin = email === 'jotamolinas@gmail.com' || isOperador || roleStr === 'admin' || roleStr === 'superadmin';

      if (esAdmin) {
        setPruebaActiva(true);
        setDiasRestantes(9999);
        setIsTrialExpired(false);
        setIsSoftBlocked(false);
        setTienePlanPago(true);
        setLoading(false);
        return;
      }

      const estadoPagoStr = String(fetchedUserData?.estadoPago || fetchedUserData?.estadoPlataforma || '').toUpperCase().trim();
      const planStr = String(fetchedUserData?.planActual || fetchedUserData?.plan || 'trial').toLowerCase().trim();

      const esPlanDePago =
        (estadoPagoStr === 'APROBADO' || planStr.includes('basico') || planStr.includes('básico') || planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full')) &&
        planStr !== 'trial' &&
        planStr !== 'sin plan' &&
        planStr !== 'ninguno';

      setTienePlanPago(esPlanDePago);

      // Si es plan de pago, rige fecha_vencimiento_plan (con respaldo en aliases).
      // Si es trial, evaluamos fecha_expiracion / trialEndsAt / fechaVencimiento / vencimientoPlan
      // y como respaldo seguro fecha_creacion / creadoEn / fechaRegistro + 5 días.
      let limiteDate = esPlanDePago
        ? (
            parseAnyDate(fetchedUserData?.fecha_vencimiento_plan) ||
            parseAnyDate(fetchedUserData?.vencimientoPlan) ||
            parseAnyDate(fetchedUserData?.fechaVencimiento) ||
            parseAnyDate(fetchedUserData?.fecha_expiracion) ||
            parseAnyDate(fetchedUserData?.trialEndsAt)
          )
        : (
            parseAnyDate(fetchedUserData?.fecha_expiracion) ||
            parseAnyDate(fetchedUserData?.trialEndsAt) ||
            parseAnyDate(fetchedUserData?.fechaVencimiento) ||
            parseAnyDate(fetchedUserData?.vencimientoPlan) ||
            parseAnyDate(fetchedUserData?.fecha_vencimiento_plan)
          );

      if (!limiteDate && !esPlanDePago) {
        const creationDate =
          parseAnyDate(fetchedUserData?.fecha_creacion) ||
          parseAnyDate(fetchedUserData?.fechaCreacion) ||
          parseAnyDate(fetchedUserData?.creadoEn) ||
          parseAnyDate(fetchedUserData?.fechaRegistro) ||
          parseAnyDate(fetchedUserData?.createdAt) ||
          parseAnyDate(fetchedUserData?.created_at);

        if (creationDate) {
          limiteDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000);
        } else if (fetchedUserData && typeof fetchedUserData === 'object') {
          // Si el perfil recién fue creado con serverTimestamp() aún pendiente de resolver,
          // no bloquear al usuario en el primer minuto.
          limiteDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        }
      }

      const ahora = new Date();
      const haExpirado = limiteDate
        ? ahora.getTime() > limiteDate.getTime()
        : String(fetchedUserData?.estado_cuenta || '').toLowerCase() === 'expirada';

      const diasRestantesVal = haExpirado || !limiteDate
        ? 0
        : Math.max(1, Math.ceil((limiteDate.getTime() - ahora.getTime()) / (1000 * 3600 * 24)));

      setIsSoftBlocked(haExpirado);
      setIsTrialExpired(haExpirado);
      setPruebaActiva(!haExpirado);
      setDiasRestantes(diasRestantesVal);
      setLoading(false);
    };

    if (externalProfile) {
      evaluateProfile(externalProfile, user?.email);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeUserSnapshot) {
        unsubscribeUserSnapshot();
        unsubscribeUserSnapshot = null;
      }

      if (!currentUser) {
        setUserData(null);
        setPruebaActiva(false);
        setDiasRestantes(0);
        setIsTrialExpired(true);
        setIsSoftBlocked(true);
        setTienePlanPago(false);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      unsubscribeUserSnapshot = onSnapshot(userRef, (userSnap) => {
        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }
        evaluateProfile(userSnap.data(), currentUser.email);
      });
    });

    return () => {
      if (unsubscribeUserSnapshot) unsubscribeUserSnapshot();
      unsubscribeAuth();
    };
  }, [user, externalProfile]);

  return { pruebaActiva, diasRestantes, loading, userData, isTrialExpired, isSoftBlocked, tienePlanPago };
};