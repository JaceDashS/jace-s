import { logInfo } from './logging';

export type AdminAuditEvent =
  | 'admin_login_succeeded'
  | 'admin_login_failed'
  | 'admin_logout'
  | 'admin_room_deleted';

export function logAdminAudit(
  event: AdminAuditEvent,
  context: { ip: string; roomCode?: string; result?: string }
): void {
  logInfo('[AdminAudit]', {
    event,
    ...context,
  });
}
