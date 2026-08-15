import { useState, useEffect } from 'react';
import { db, auth } from '../services/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';

export const useOlgaDocsCount = (user: User | null) => {
  const [olgaDocsCount, setOlgaDocsCount] = useState<number>(0);

  useEffect(() => {
    if (!user || !user.uid) {
      setOlgaDocsCount(0);
      return;
    }

    const q = query(
      collection(db, 'documentos_olga'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOlgaDocsCount(snapshot.size);
    }, (error) => {
      console.error("Error with olga docs snapshot:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return olgaDocsCount;
};
