import { useState, useEffect } from 'react';
import { db, auth } from '../services/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export const useTrialStatus = (user?: User | null) => {
  const [pruebaActiva, setPruebaActiva] = useState<boolean>(true);
  const [diasRestantes, setDiasRestantes] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);
  const [isTrialExpired, setIsTrialExpired] = useState<boolean>(false);
  const [isSoftBlocked, setIsSoftBlocked] = useState<boolean>(false);
  const [tienePlanPago, setTienePlanPago] = useState<boolean>(false);

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
        setIsSoftBlocked(false);
        setTienePlanPago(false);
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
            setIsSoftBlocked(false);
            setTienePlanPago(false);
            setLoading(false);
            return;
          }

          const fetchedUserData = userSnap.data();
          setUserData(fetchedUserData);

<<<<<<< HEAD
          const planStr = String(fetchedUserData.planActual || fetchedUserData.plan || '').toLowerCase().trim();
          const isOperador = fetchedUserData.rol === 'operador' || fetchedUserData.role === 'operador';
          const esAdmin = currentUser.email === 'jotamolinas@gmail.com' || isOperador || fetchedUserData.rol === 'admin' || fetchedUserData.role === 'admin' || fetchedUserData.rol === 'superadmin' || fetchedUserData.role === 'superadmin';
=======
          const planStr = String(fetchedUserData.planActual || fetchedUserData.plan || 'trial').toLowerCase();
          const roleStr = String(fetchedUserData.rol || fetchedUserData.role || '').toLowerCase();
          const isOperador = roleStr === 'operador' || roleStr === 'admin' || roleStr === 'superadmin';
          const isWhitelisted = currentUser.email === 'jotamolinas@gmail.com' || isOperador;
          const isApproved = String(fetchedUserData.estadoPlataforma || '').toUpperCase() === 'APROBADO' || String(fetchedUserData.estadoPago || '').toUpperCase() === 'APROBADO';
          const isPaidPlan = planStr.includes('basico') || planStr.includes('básico') || planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || isApproved;
>>>>>>> 50dc3a5c945db8fa19c9464414b358460fafd5d9

          // Verificación de Plan de Pago Real
          const esPlanPago = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('básico') || planStr.includes('basico') || planStr.includes('mensual');
          const estadoPagoStr = String(fetchedUserData.estadoPago || fetchedUserData.estadoPlataforma || '').toUpperCase().trim();
          const isPagoAprobado = estadoPagoStr === 'APROBADO' || estadoPagoStr === 'ACTIVO';

          // Verificación de vencimiento de suscripción
          let suscripcionVencida = false;
          const fechaVencimientoPlan = fetchedUserData.fecha_vencimiento_plan || fetchedUserData.fechaVencimientoPlan;
          if (fechaVencimientoPlan && !esAdmin) {
            const vDate = new Date(fechaVencimientoPlan);
            if (!isNaN(vDate.getTime()) && vDate.getTime() < Date.now()) {
              suscripcionVencida = true;
            }
          }

          if (esAdmin) {
            // Administradores y Operadores nunca están bloqueados
            setPruebaActiva(true);
            setDiasRestantes(9999);
            setIsTrialExpired(false);
            setIsSoftBlocked(false);
            setTienePlanPago(true);
            setLoading(false);
            return;
          }

          if (esPlanPago) {
            // ESCENARIO B: Usuario de Plan Pago
            // Cae en isSoftBlocked = true si su estado de pago está vencido, rechazado o no aprobado
            const pagoInvalidoOVencido = !isPagoAprobado || estadoPagoStr === 'RECHAZADO' || suscripcionVencida;

            setTienePlanPago(isPagoAprobado && !suscripcionVencida);
            setPruebaActiva(!pagoInvalidoOVencido);
            setDiasRestantes(pagoInvalidoOVencido ? 0 : 9999);
            setIsTrialExpired(false);
            setIsSoftBlocked(pagoInvalidoOVencido);
          } else {
            // ESCENARIO A: Usuario en Trial
            // Cae en isSoftBlocked = true si sus días se agotaron o superó su fecha_expiracion
            setTienePlanPago(false);

            let expirationDate: Date | null = null;
            const rawExp = fetchedUserData.fecha_expiracion;
            if (rawExp) {
              if (typeof rawExp.toDate === 'function') expirationDate = rawExp.toDate();
              else if (typeof rawExp.toMillis === 'function') expirationDate = new Date(rawExp.toMillis());
              else if (typeof rawExp.seconds === 'number') expirationDate = new Date(rawExp.seconds * 1000);
              else expirationDate = new Date(rawExp);
            }

            // Fallback: fecha_creacion + 5 días
            if (!expirationDate || isNaN(expirationDate.getTime())) {
              const rawDate = fetchedUserData.fecha_creacion || fetchedUserData.fechaCreacion || fetchedUserData.created_at || fetchedUserData.createdAt;
              let creationDate = new Date();
              if (rawDate) {
                if (typeof rawDate.toDate === 'function') creationDate = rawDate.toDate();
                else if (typeof rawDate.seconds === 'number') creationDate = new Date(rawDate.seconds * 1000);
                else creationDate = new Date(rawDate);
              }
              expirationDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000);
            }

            const now = new Date();
            const diffMsRemaining = expirationDate.getTime() - now.getTime();
            const diasRestantesCalculados = Math.max(0, Math.ceil(diffMsRemaining / (1000 * 60 * 60 * 24)));
            const trialExpirado = fetchedUserData.estado_cuenta === 'expirada' || now.getTime() > expirationDate.getTime() || diasRestantesCalculados <= 0;

            if (trialExpirado) {
              if (fetchedUserData.estado_cuenta !== 'expirada') {
                updateDoc(userRef, { estado_cuenta: 'expirada' }).catch(console.error);
              }
              setPruebaActiva(false);
              setDiasRestantes(0);
              setIsTrialExpired(true);
              setIsSoftBlocked(true);
            } else {
              setPruebaActiva(true);
              setDiasRestantes(diasRestantesCalculados);
              setIsTrialExpired(false);
              setIsSoftBlocked(false);
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
  }, []);

  return { pruebaActiva, diasRestantes, loading, userData, isTrialExpired, isSoftBlocked, tienePlanPago };
};
