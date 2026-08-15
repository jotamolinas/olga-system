import { useState, useEffect } from 'react';
import { db, auth } from '../services/auth';
import { doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';

export const useTrialStatus = (user: User | null) => {
  const [pruebaActiva, setPruebaActiva] = useState<boolean>(true);
  const [diasRestantes, setDiasRestantes] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!auth?.currentUser?.uid) return;
    let isMounted = true;
    let unsubscribe: () => void;

    if (!user) {
      setLoading(false);
      setUserData(null);
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      
      unsubscribe = onSnapshot(userRef, async (userSnap) => {
        if (!userSnap.exists()) {
          if (isMounted) {
            setUserData(null);
            setLoading(false);
          }
        } else {
          const fetchedUserData = userSnap.data();
          if (isMounted) setUserData(fetchedUserData);
          
          if (fetchedUserData.estadoPlataforma === 'Aprobado') {
            if (isMounted) {
              setPruebaActiva(true);
              setDiasRestantes(9999); // Indefinite
            }
          } else {
            let creationDate = new Date();
            if (fetchedUserData.fechaCreacion) {
              creationDate = fetchedUserData.fechaCreacion.toDate ? fetchedUserData.fechaCreacion.toDate() : new Date(fetchedUserData.fechaCreacion);
            }
            const endDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days limit
            const now = new Date();
            const diffTime = endDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (isMounted) {
              if (diffDays <= 0) {
                setPruebaActiva(false);
                setDiasRestantes(0);
              } else {
                setPruebaActiva(true);
                setDiasRestantes(diffDays);
              }
            }
          }
          if (isMounted) setLoading(false);
        }
      }, (error: any) => {
        if (error.code === 'permission-denied') {
          console.warn("Snapshot permission denied, likely logging out or rules propagating.");
        } else {
          console.error("Error with user snapshot:", error);
        }
        if (isMounted) setLoading(false);
      });
    } catch (error) {
      console.error("Error setting up trial status listener:", error);
      if (isMounted) setLoading(false);
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return { pruebaActiva, diasRestantes, loading, userData };
};
