import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase';

export async function writeAuditLog(input: {
  adminId: string;
  action: string;
  targetUid?: string;
  details?: string;
}) {
  await addDoc(collection(getDb(), 'auditLogs'), {
    adminId: input.adminId,
    action: input.action,
    targetUid: input.targetUid ?? null,
    details: input.details ?? null,
    createdAt: serverTimestamp(),
  });
}
