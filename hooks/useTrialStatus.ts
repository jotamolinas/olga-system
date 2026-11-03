import { useState, useEffect } from 'react';
import { db, auth } from '../services/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export const useTrialStatus = (user?: User | null) => {
  const [pruebaActiva, setPruebaActiva] = useState<boolean>(true);
  const [diasRestantes, setDiasRestantes] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);
  const [isTrialExpired, setIsTrialExpired] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribeUserSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeUserSnapshot) {
        unsubscribeUserSnapshot();
        unsubscribeUserSnapshot = null;
      }

      if (!currentUser) {
        setUserData(null);
        setPruebaActiva(true);
        setDiasRestantes(5);
        setIsTrialExpired(false);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeUserSnapshot = onSnapshot(userRef, (userSnap) => {
          if (!userSnap.exists()) {
            setUserData(null);
            setPruebaActiva(true);
            setDiasRestantes(5);
            setIsTrialExpired(false);
            setLoading(false);
            return;
          }

          const fetchedUserData = userSnap.data();
          setUserData(fetchedUserData);

          const planStr = String(fetchedUserData.planActual || fetchedUserData.plan || 'trial').toLowerCase();
          const isOperador = fetchedUserData.rol === 'operador' || fetchedUserData.role === 'operador';
          const isWhitelisted = currentUser.email === 'jotamolinas@gmail.com' || isOperador;
          const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || fetchedUserData.estadoPlataforma === 'Aprobado';

          if (isWhitelisted || isPaidPlan) {
            setPruebaActiva(true);
            setDiasRestantes(9999);
            setIsTrialExpired(false);
          } else {
            // Cálculo de expiración basado en fecha_expiracion (o fallback fecha_creacion + 5 días)
            let expirationDate: Date | null = null;
            const rawExp = fetchedUserData.fecha_expiracion;
            if (rawExp) {
              if (typeof rawExp.toDate === 'function') {
                expirationDate = rawExp.toDate();
              } else if (typeof rawExp.toMillis === 'function') {
                expirationDate = new Date(rawExp.toMillis());
              } else if (typeof rawExp.seconds === 'number') {
                expirationDate = new Date(rawExp.seconds * 1000);
              } else {
                expirationDate = new Date(rawExp);
              }
            }

            // Fallback de Seguridad: Si no tiene fecha_expiracion, calcular fecha_creacion + 5 días
            if (!expirationDate || isNaN(expirationDate.getTime())) {
              const rawDate = fetchedUserData.fecha_creacion || fetchedUserData.fechaCreacion || fetchedUserData.created_at || fetchedUserData.createdAt;
              let creationDate = new Date();
              if (rawDate) {
                if (typeof rawDate.toDate === 'function') {
                  creationDate = rawDate.toDate();
                } else if (rawDate.seconds) {
                  creationDate = new Date(rawDate.seconds * 1000);
                } else {
                  creationDate = new Date(rawDate);
                }
              }
              expirationDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000);
            }

            const now = new Date();
            const diffMsRemaining = expirationDate.getTime() - now.getTime();
            const diasRestantesCalculados = Math.max(0, Math.ceil(diffMsRemaining / (1000 * 60 * 60 * 24)));
            const expired = fetchedUserData.estado_cuenta === 'expirada' || now.getTime() > expirationDate.getTime() || diasRestantesCalculados <= 0;

            if (expired) {
              setPruebaActiva(false);
              setDiasRestantes(0);
              setIsTrialExpired(true);
            } else {
              setPruebaActiva(true);
              setDiasRestantes(diasRestantesCalculados);
              setIsTrialExpired(false);
            }
          }
          setLoading(false);
        }, (error: any) => {
          if (error.code !== 'permission-denied') {
            console.error("Error en snapshot de prueba gratuita:", error);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error("Error configurando listener de estado de prueba:", err);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeUserSnapshot) {
        unsubscribeUserSnapshot();
      }
      unsubscribeAuth();
    };
  }, []); // Array de dependencias vacío [] para prevención estricta de fugas de memoria

  return { pruebaActiva, diasRestantes, loading, userData, isTrialExpired };
};
