import { useState, useEffect } from 'react';
import { db } from '../services/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';

export const useOlgaDocsCount = (user: User | null, workspaceId?: string) => {
  const [olgaDocsCount, setOlgaDocsCount] = useState<number>(0);

  useEffect(() => {
    const targetId = workspaceId || user?.uid;
    if (!targetId) {
      setOlgaDocsCount(0);
      return;
    }

    const q = query(
      collection(db, 'documentos_olga'),
      where('userId', '==', targetId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOlgaDocsCount(snapshot.size);
    }, (error) => {
      console.error("Error with olga docs snapshot:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, workspaceId]);

  return olgaDocsCount;
};
