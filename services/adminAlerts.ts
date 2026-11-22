import { auth } from './auth';

export type AdminAlertType = 'payment' | 'plan_request' | 'support';

export interface AdminAlertPayload {
  type: AdminAlertType;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  details: string;
  attachmentUrl?: string;
}

export const notifySuperAdminWhatsApp = (payload: AdminAlertPayload): void => {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => '');
      await fetch('/api/notifications/admin-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Silencioso: nunca debe interrumpir el flujo principal del cliente
    }
  })();
};
