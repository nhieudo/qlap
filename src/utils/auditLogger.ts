import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AuditAction, AuditModule } from '../types';

export interface LogAuditParams {
  userId: string;
  userName: string;
  action: AuditAction;
  module: AuditModule;
  entityType: string;
  entityId: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const auditCol = collection(db, 'auditLogs');
    await addDoc(auditCol, {
      ...params,
      timestamp: new Date().toISOString(),
      serverCreatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhật ký kiểm toán:', error);
  }
}
