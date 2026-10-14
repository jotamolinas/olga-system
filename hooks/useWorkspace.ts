import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/auth'; 

export const useWorkspace = (currentUser: any, userProfile?: any) => {
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  
  // ID Maestro inmutable por render
  const role = currentUser?.role || currentUser?.rol || userProfile?.role || userProfile?.rol;
  const tenantId = currentUser?.tenant_id || currentUser?.tenantId || userProfile?.tenant_id || userProfile?.tenantId;
  const isOperador = role === 'operador';

  const workspaceId = isOperador ? tenantId : (currentUser?.uid || userProfile?.uid);

  const userDisplayName = currentUser?.razonSocial || userProfile?.razonSocial || currentUser?.nombreInstitucion || userProfile?.nombreInstitucion || currentUser?.nombre;

  useEffect(() => {
    let isMounted = true; 

    const fetchWorkspaceProfile = async () => {
      if (!workspaceId) return;
      try {
        const docRef = doc(db, 'users', workspaceId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && isMounted) {
          const data = docSnap.data();
          setWorkspaceData(data);
          setWorkspaceName(data.razonSocial || data.nombreInstitucion || data.nombre || "Escribanía Titular");
        }
      } catch (error) {
        console.error("Error UI:", error);
      }
    };

    if (isOperador) {
      fetchWorkspaceProfile();
    } else if (currentUser || userProfile) {
      const ownName = userDisplayName || "Mi Escribanía";
      setWorkspaceName(ownName);
      setWorkspaceData(userProfile || currentUser);
    }

    return () => { isMounted = false; };
  }, [workspaceId, isOperador, userDisplayName]);

  return { workspaceId, workspaceName, workspaceData };
};
