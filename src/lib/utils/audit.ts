import { createClient } from '@/lib/supabase/server';

export interface AuditLogPayload {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Log an audit trail entry for administrative or system actions.
 */
export async function logAuditAction(payload: AuditLogPayload): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      actor_user_id: payload.actor_user_id,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id || null,
      metadata: payload.metadata || null,
    });
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
}
