import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/auth'; 

export const useWorkspace = (currentUser: any, userProfile?: any) => {
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  
  const role = currentUser?.role || currentUser?.rol || userProfile?.role || userProfile?.rol;
  const rawTenantId = currentUser?.tenant_id || currentUser?.tenantId || userProfile?.tenant_id || userProfile?.tenantId;
  const tenantId = rawTenantId ? String(rawTenantId).trim() : '';
  const isOperador = role === 'operador';

  const workspaceId = (isOperador && tenantId) ? tenantId : (currentUser?.uid || userProfile?.uid);

  const userDisplayName = String(
    currentUser?.razonSocial ||
    userProfile?.razonSocial ||
    currentUser?.nombreInstitucion ||
    userProfile?.nombreInstitucion ||
    userProfile?.escribania ||
    currentUser?.nombre ||
    ''
  ).trim();

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
          const isAbogadoWs = String(data?.tipoPerfil || userProfile?.tipoPerfil || '').toLowerCase() === 'abogado';
          const resolvedName = String(
            data.razonSocial ||
            data.nombreInstitucion ||
            data.escribania ||
            data.nombre ||
            ''
          ).trim();
          setWorkspaceName(resolvedName || (isAbogadoWs ? 'Estudio Jurídico' : 'Mi Escribanía'));
        }
      } catch (error) {
        console.error("Error UI:", error);
      }
    };

    if (isOperador && tenantId) {
      fetchWorkspaceProfile();
    } else if (currentUser || userProfile) {
      const isAbogadoWs = String(userProfile?.tipoPerfil || currentUser?.tipoPerfil || '').toLowerCase() === 'abogado';
      const ownName = userDisplayName || (isAbogadoWs ? 'Estudio Jurídico' : 'Mi Escribanía');
      setWorkspaceName(ownName);
      setWorkspaceData(userProfile || currentUser);
    }

    return () => { isMounted = false; };
  }, [workspaceId, isOperador, tenantId, userDisplayName, userProfile, currentUser]);

  return { workspaceId, workspaceName, workspaceData };
};
