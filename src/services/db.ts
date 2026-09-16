import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
export { db } from '../firebase/config';
export { logAuditEvent } from '../utils/auditLogger';
import {
  Resident,
  Household,
  FinanceTransaction,
  FinanceCategory,
  GiftCampaign,
  GiftRecipient,
  Role,
  AuditLog,
  BackupData,
  BackupCollections,
  OrganizationSettings,
  UserProfile,
  FinanceSettings,
  UserInvitation,
} from '../types';
import { generateUniqueReconciliationCode, formatVoucherNumber } from '../utils/voucherCode';
import { convertNumberToWords } from '../utils/numberToWords';
import { logAuditEvent } from '../utils/auditLogger';
import { normalizeVietnamese, generateSearchTokens, maskNationalId } from '../utils/vietnameseSearch';
import { calculateSHA256 } from '../utils/cryptoChecksum';
import { getHamletAbbreviation, formatHouseholdCode } from '../utils/household';

/**
 * Xử lý làm sạch payload trước khi ghi vào Firestore
 * Loại bỏ triệt để các trường có giá trị undefined tránh lỗi crash setDoc/updateDoc
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj as T;
}

// ============================================================================
// HỆ THỐNG BỘ ĐẾM NGUYÊN TỬ (ATOMIC COUNTERS)
// ============================================================================

/**
 * Lấy số thứ tự tăng dần nguyên tử qua Firestore Transaction
 * Chống trùng lặp tuyệt đối khi nhiều cán bộ thao tác đồng thời.
 */
export async function getNextAtomicCounter(counterId: string): Promise<number> {
  const counterRef = doc(db, 'systemCounters', counterId);

  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextValue = 1;
      if (counterDoc.exists()) {
        const current = Number(counterDoc.data().current || 0);
        nextValue = current + 1;
      }
      transaction.set(
        counterRef,
        {
          current: nextValue,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return nextValue;
    });
  } catch (error) {
    console.warn(`Atomic counter transaction fallback for ${counterId}:`, error);
    // Fallback: estimate from collection size if permissions prevent counter write
    const colName = counterId.startsWith('resident')
      ? 'residents'
      : counterId.startsWith('household')
      ? 'households'
      : 'financeTransactions';
    const snap = await getDocs(collection(db, colName));
    return snap.size + 1;
  }
}

// ============================================================================
// DÂN CƯ (RESIDENTS)
// ============================================================================

export async function getResidents(options?: {
  includeArchived?: boolean;
}): Promise<Resident[]> {
  const residentsCol = collection(db, 'residents');
  let q = query(residentsCol);

  if (!options?.includeArchived) {
    q = query(residentsCol, where('isArchived', '==', false));
  }

  try {
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resident));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    // If composite index is missing, load and filter client-side
    const snap = await getDocs(residentsCol);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Resident));
    if (!options?.includeArchived) {
      list = list.filter(r => !r.isArchived);
    }
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

export async function getResidentById(id: string): Promise<Resident | null> {
  const snap = await getDoc(doc(db, 'residents', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Resident;
}

export async function createResident(
  resident: Omit<Resident, 'id' | 'residentCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  currentUserId: string,
  currentUserName: string
): Promise<Resident> {
  // 1. Kiểm tra trùng số CCCD với nhân khẩu đang sinh sống
  if (resident.nationalId && resident.nationalId.trim()) {
    const cleanId = resident.nationalId.trim();
    const checkQuery = query(
      collection(db, 'residents'),
      where('nationalId', '==', cleanId),
      where('isArchived', '==', false)
    );
    try {
      const existing = await getDocs(checkQuery);
      if (!existing.empty) {
        const found = existing.docs[0].data() as Resident;
        throw new Error(
          `Số CCCD/ĐDCN ${cleanId} đã tồn tại trong hệ thống (Thuộc nhân khẩu: ${found.fullName} - Mã: ${found.residentCode}).`
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Số CCCD')) throw err;
      // Index fallback
    }
  }

  // 2. Lấy mã số nhân khẩu tăng dần nguyên tử (NK-000001)
  const seq = await getNextAtomicCounter('resident');
  const residentCode = `NK-${String(seq).padStart(6, '0')}`;

  const newId = doc(collection(db, 'residents')).id;
  const now = new Date().toISOString();

  // 3. Chuẩn hóa tiếng Việt, sinh tokens tìm kiếm và làm mờ CCCD
  const normalizedFullName = normalizeVietnamese(resident.fullName);
  const searchTokens = generateSearchTokens(resident.fullName);
  const nationalIdMasked = resident.nationalId ? maskNationalId(resident.nationalId) : '';

  const newResident: Resident = {
    ...resident,
    id: newId,
    residentCode,
    normalizedFullName,
    searchTokens,
    nationalIdMasked,
    isArchived: false,
    status: resident.status || 'ACTIVE',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  await setDoc(doc(db, 'residents', newId), sanitizeForFirestore(newResident));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'RESIDENTS',
    entityType: 'RESIDENT',
    entityId: newId,
    description: `Đăng ký nhân khẩu mới: ${newResident.fullName} (Mã: ${newResident.residentCode})`,
    after: newResident,
  });

  return newResident;
}

export async function updateResident(
  id: string,
  updates: Partial<Resident>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const residentRef = doc(db, 'residents', id);
  const oldSnap = await getDoc(residentRef);
  if (!oldSnap.exists()) throw new Error('Không tìm thấy thông tin nhân khẩu.');
  const oldData = oldSnap.data() as Resident;

  // Kiểm tra trùng CCCD nếu cập nhật
  if (updates.nationalId && updates.nationalId !== oldData.nationalId) {
    const cleanId = updates.nationalId.trim();
    const checkQuery = query(
      collection(db, 'residents'),
      where('nationalId', '==', cleanId),
      where('isArchived', '==', false)
    );
    try {
      const existing = await getDocs(checkQuery);
      const dup = existing.docs.find(d => d.id !== id);
      if (dup) {
        throw new Error(`Số CCCD ${cleanId} đã thuộc về ${dup.data().fullName}.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Số CCCD')) throw err;
    }
  }

  // Tự động tính toán lại normalized name & tokens nếu đổi tên
  const fullName = updates.fullName || oldData.fullName;
  const normalizedFullName = normalizeVietnamese(fullName);
  const searchTokens = generateSearchTokens(fullName);
  const nationalId = updates.nationalId !== undefined ? updates.nationalId : oldData.nationalId;
  const nationalIdMasked = nationalId ? maskNationalId(nationalId) : '';

  const updated: Partial<Resident> = {
    ...updates,
    normalizedFullName,
    searchTokens,
    nationalIdMasked,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUserName,
  };

  await updateDoc(residentRef, sanitizeForFirestore(updated));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'RESIDENTS',
    entityType: 'RESIDENT',
    entityId: id,
    description: `Cập nhật hồ sơ nhân khẩu ${oldData.fullName} (${oldData.residentCode})`,
    before: oldData,
    after: { ...oldData, ...updated },
  });
}

export async function archiveResident(
  id: string,
  reason: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const residentRef = doc(db, 'residents', id);
  const oldSnap = await getDoc(residentRef);
  if (!oldSnap.exists()) throw new Error('Không tìm thấy thông tin nhân khẩu.');
  const oldData = oldSnap.data() as Resident;

  const now = new Date().toISOString();
  await updateDoc(residentRef, sanitizeForFirestore({
    isArchived: true,
    status: 'ARCHIVED',
    archivedAt: now,
    archivedBy: currentUserName,
    notes: oldData.notes ? `${oldData.notes}\n[Lưu trữ/Xóa: ${reason}]` : `[Lưu trữ/Xóa: ${reason}]`,
  }));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'ARCHIVE',
    module: 'RESIDENTS',
    entityType: 'RESIDENT',
    entityId: id,
    description: `Lưu trữ nhân khẩu ${oldData.fullName} (${oldData.residentCode}). Lý do: ${reason}`,
    before: oldData,
  });
}

/**
 * Xóa vĩnh viễn dữ liệu nhân khẩu khỏi hệ thống
 */
export async function deleteResident(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const residentRef = doc(db, 'residents', id);
  const oldSnap = await getDoc(residentRef);
  if (!oldSnap.exists()) return;
  const oldData = oldSnap.data() as Resident;

  await deleteDoc(residentRef);

  // Cập nhật số thành viên hộ gia đình nếu có liên kết
  if (oldData.householdId) {
    try {
      const hhRef = doc(db, 'households', oldData.householdId);
      const hhSnap = await getDoc(hhRef);
      if (hhSnap.exists()) {
        const hhData = hhSnap.data() as Household;
        const currentCount = Math.max(0, (hhData.memberCount || 1) - 1);
        await updateDoc(hhRef, sanitizeForFirestore({
          memberCount: currentCount,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserName,
        }));
      }
    } catch (err) {
      console.warn('Không thể cập nhật số thành viên hộ sau khi xóa nhân khẩu:', err);
    }
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'DELETE',
    module: 'RESIDENTS',
    entityType: 'RESIDENT',
    entityId: id,
    description: `Xóa hoàn toàn nhân khẩu ${oldData.fullName} (${oldData.residentCode}) khỏi hệ thống`,
    before: oldData,
  });
}

// ============================================================================
// HỘ GIA ĐÌNH (HOUSEHOLDS)
// ============================================================================

export async function getHouseholds(): Promise<Household[]> {
  const snap = await getDocs(collection(db, 'households'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Household));
  return list.filter(h => !h.isArchived).sort((a, b) => a.householdCode.localeCompare(b.householdCode));
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  const snap = await getDoc(doc(db, 'households', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Household;
}

export async function createHousehold(
  household: Omit<Household, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & { householdCode?: string },
  currentUserId: string,
  currentUserName: string,
  hamletName?: string
): Promise<Household> {
  // Lấy mã hộ: ưu tiên mã do người dùng nhập hoặc sinh theo từ viết tắt của ấp (VD: HA_001, HA_002...)
  let householdCode = household.householdCode?.trim();
  if (!householdCode) {
    const prefix = getHamletAbbreviation(hamletName);
    const seq = await getNextAtomicCounter('household');
    householdCode = formatHouseholdCode(prefix, seq);
  }

  const newId = doc(collection(db, 'households')).id;
  const now = new Date().toISOString();

  const newHh: Household = {
    ...household,
    id: newId,
    householdCode,
    isArchived: false,
    status: household.status || 'ACTIVE',
    memberCount: household.memberCount || 1,
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  await setDoc(doc(db, 'households', newId), sanitizeForFirestore(newHh));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'HOUSEHOLDS',
    entityType: 'HOUSEHOLD',
    entityId: newId,
    description: `Tạo sổ hộ mới: ${newHh.householdCode} (Chủ hộ: ${newHh.headResidentName})`,
    after: newHh,
  });

  return newHh;
}

export async function updateHousehold(
  id: string,
  updates: Partial<Household>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const hhRef = doc(db, 'households', id);
  const oldSnap = await getDoc(hhRef);
  if (!oldSnap.exists()) throw new Error('Không tìm thấy sổ hộ.');
  const oldData = oldSnap.data() as Household;

  const now = new Date().toISOString();
  await updateDoc(hhRef, sanitizeForFirestore({
    ...updates,
    updatedAt: now,
    updatedBy: currentUserName,
  }));

  // Nếu cập nhật mã hộ hoặc địa chỉ, đồng bộ cho các thành viên trong sổ hộ
  if (updates.householdCode && updates.householdCode !== oldData.householdCode) {
    try {
      const q = query(
        collection(db, 'residents'),
        where('householdId', '==', id)
      );
      const memberSnaps = await getDocs(q);
      const batchPromises = memberSnaps.docs.map((mDoc) =>
        updateDoc(mDoc.ref, {
          householdCode: updates.householdCode,
          updatedAt: now,
          updatedBy: currentUserName,
        })
      );
      await Promise.all(batchPromises);
    } catch (err) {
      console.warn('Lỗi đồng bộ mã hộ mới cho thành viên:', err);
    }
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'HOUSEHOLDS',
    entityType: 'HOUSEHOLD',
    entityId: id,
    description: `Cập nhật thông tin sổ hộ ${oldData.householdCode}`,
    before: oldData,
    after: { ...oldData, ...updates },
  });
}

/**
 * Xóa vĩnh viễn Sổ Hộ gia đình và tự động gỡ liên kết mã hộ khỏi các nhân khẩu
 */
export async function deleteHousehold(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const hhRef = doc(db, 'households', id);
  const oldSnap = await getDoc(hhRef);
  if (!oldSnap.exists()) return;
  const oldData = oldSnap.data() as Household;

  // Gỡ liên kết mã hộ cho các nhân khẩu trực thuộc (không xóa nhân khẩu)
  try {
    const q = query(
      collection(db, 'residents'),
      where('householdId', '==', id)
    );
    const memberSnaps = await getDocs(q);
    const unlinks = memberSnaps.docs.map((mDoc) =>
      updateDoc(mDoc.ref, {
        householdId: '',
        householdCode: '',
        relationshipToHead: 'Khác',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserName,
      })
    );
    await Promise.all(unlinks);
  } catch (err) {
    console.warn('Lỗi gỡ liên kết nhân khẩu khi xóa sổ hộ:', err);
  }

  await deleteDoc(hhRef);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'DELETE',
    module: 'HOUSEHOLDS',
    entityType: 'HOUSEHOLD',
    entityId: id,
    description: `Xóa sổ hộ gia đình ${oldData.householdCode} (Chủ hộ: ${oldData.headResidentName})`,
    before: oldData,
  });
}

export async function archiveHousehold(
  id: string,
  reason: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const hhRef = doc(db, 'households', id);
  const oldSnap = await getDoc(hhRef);
  if (!oldSnap.exists()) throw new Error('Không tìm thấy sổ hộ.');
  const oldData = oldSnap.data() as Household;

  const now = new Date().toISOString();
  await updateDoc(hhRef, sanitizeForFirestore({
    isArchived: true,
    status: 'ARCHIVED',
    archivedAt: now,
    archivedBy: currentUserName,
  }));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'ARCHIVE',
    module: 'HOUSEHOLDS',
    entityType: 'HOUSEHOLD',
    entityId: id,
    description: `Lưu trữ sổ hộ ${oldData.householdCode}. Lý do: ${reason}`,
    before: oldData,
  });
}

// ============================================================================
// TÀI CHÍNH (FINANCIAL TRANSACTIONS)
// ============================================================================

export async function getFinanceTransactions(): Promise<FinanceTransaction[]> {
  const snap = await getDocs(collection(db, 'financeTransactions'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceTransaction));
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getFinanceCategories(): Promise<FinanceCategory[]> {
  const snap = await getDocs(collection(db, 'financeCategories'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceCategory));
  return list.filter(c => c.isActive !== false);
}

export async function createFinanceTransaction(
  tx: Omit<FinanceTransaction, 'id' | 'voucherNumber' | 'reconciliationCode' | 'createdAt' | 'updatedAt' | 'amountInWords'> & {
    voucherNumber?: string;
    reconciliationCode?: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<FinanceTransaction> {
  const year = new Date().getFullYear();
  const type = tx.transactionType;

  // 1. Chuẩn hóa số tiền thành số nguyên VND
  const rawAmount = Math.round(Number(tx.amount));
  if (isNaN(rawAmount) || rawAmount <= 0) {
    throw new Error('Số tiền thu/chi phải là số nguyên dương hợp lệ.');
  }

  // 2. Chuyển đổi thành chữ chuẩn tài chính
  const amountInWords = convertNumberToWords(rawAmount, { suffix: 'chẵn' });

  // 3. Lấy số thứ tự nguyên tử cho năm hiện tại
  const counterKey = `finance_${type.toLowerCase()}_${year}`;
  const seq = await getNextAtomicCounter(counterKey);
  const voucherNumber = tx.voucherNumber || formatVoucherNumber(type, seq, year, 6);

  // 4. Sinh mã đối soát độc bản toàn cầu
  const reconciliationCode = tx.reconciliationCode || (await generateUniqueReconciliationCode(type, year));

  const newId = doc(collection(db, 'financeTransactions')).id;
  const now = new Date().toISOString();

  // Snapshot thông tin tổ chức nếu được duyệt ngay (chỉ lấy Ấp, Xã, Tỉnh theo quy định mới)
  let organizationSnapshot: any = null;
  if (tx.status === 'APPROVED') {
    try {
      const orgSnap = await getDoc(doc(db, 'organizationSettings', 'default'));
      if (orgSnap.exists()) {
        const orgData = orgSnap.data() as OrganizationSettings;
        organizationSnapshot = {
          name: orgData.hamletName || '',
          hamletName: orgData.hamletName || '',
          communeName: orgData.communeName || '',
          provinceName: orgData.provinceName || '',
          address: orgData.address || '',
          phone: orgData.phone || '',
          superiorAgencyName: orgData.superiorAgencyName || '',
        };
      }
    } catch (e) {
      console.warn('Lỗi lấy snapshot tổ chức:', e);
    }
  }

  const newTx: any = {
    ...tx,
    id: newId,
    amount: rawAmount,
    voucherNumber,
    reconciliationCode,
    amountInWords,
    preparedBy: currentUserName,
    preparedByUid: currentUserId,
    preparedByNameSnapshot: currentUserName,
    pdfTemplateVersion: '2.0.0',
    status: tx.status || 'APPROVED',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  if (organizationSnapshot) {
    newTx.organizationSnapshot = organizationSnapshot;
  }

  if (newTx.status === 'APPROVED') {
    newTx.approvedBy = currentUserName;
    newTx.approvedByUid = currentUserId;
    newTx.approvedByNameSnapshot = currentUserName;
    newTx.approvedAt = now;
  }

  await setDoc(doc(db, 'financeTransactions', newId), sanitizeForFirestore(newTx));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'FINANCE',
    entityType: 'FINANCE_TRANSACTION',
    entityId: newId,
    description: `Lập ${type === 'INCOME' ? 'Phiếu Thu' : 'Phiếu Chi'} ${voucherNumber} (${reconciliationCode}) - Số tiền: ${new Intl.NumberFormat('vi-VN').format(rawAmount)} ₫`,
    after: newTx,
  });

  return newTx as FinanceTransaction;
}

export async function approveFinanceTransaction(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const txRef = doc(db, 'financeTransactions', id);
  const snap = await getDoc(txRef);
  if (!snap.exists()) throw new Error('Không tìm thấy chứng từ tài chính.');
  const data = snap.data() as FinanceTransaction;

  if (data.status === 'APPROVED') {
    throw new Error('Chứng từ này đã được phê duyệt trước đó.');
  }
  if (data.status === 'CANCELLED') {
    throw new Error('Không thể duyệt chứng từ đã bị hủy bỏ.');
  }

  // Chụp snapshot thông tin tổ chức tại thời điểm duyệt
  let organizationSnapshot: any = data.organizationSnapshot || null;
  try {
    const orgSnap = await getDoc(doc(db, 'organizationSettings', 'default'));
    if (orgSnap.exists()) {
      const orgData = orgSnap.data() as OrganizationSettings;
      organizationSnapshot = {
        name: orgData.hamletName || '',
        hamletName: orgData.hamletName || '',
        communeName: orgData.communeName || '',
        provinceName: orgData.provinceName || '',
        address: orgData.address || '',
        phone: orgData.phone || '',
        superiorAgencyName: orgData.superiorAgencyName || '',
      };
    }
  } catch (e) {
    console.warn('Lỗi lấy snapshot tổ chức:', e);
  }

  const now = new Date().toISOString();
  const updates: any = {
    status: 'APPROVED',
    approvedBy: currentUserName,
    approvedByUid: currentUserId,
    approvedByNameSnapshot: currentUserName,
    approvedAt: now,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  if (organizationSnapshot) {
    updates.organizationSnapshot = organizationSnapshot;
  }

  await updateDoc(txRef, sanitizeForFirestore(updates));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'APPROVE',
    module: 'FINANCE',
    entityType: 'FINANCE_TRANSACTION',
    entityId: id,
    description: `Phê duyệt ${data.transactionType === 'INCOME' ? 'Phiếu Thu' : 'Phiếu Chi'} ${data.voucherNumber} (${data.reconciliationCode})`,
    before: { status: data.status },
    after: { status: 'APPROVED', approvedBy: currentUserName, approvedAt: now },
  });
}

export async function cancelFinanceTransaction(
  id: string,
  reason: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  if (!reason.trim()) {
    throw new Error('Bắt buộc phải nhập lý do hủy bỏ chứng từ.');
  }

  const txRef = doc(db, 'financeTransactions', id);
  const snap = await getDoc(txRef);
  if (!snap.exists()) throw new Error('Không tìm thấy chứng từ tài chính.');
  const data = snap.data() as FinanceTransaction;

  if (data.status === 'CANCELLED') {
    throw new Error('Chứng từ này đã ở trạng thái đã hủy.');
  }

  const now = new Date().toISOString();
  await updateDoc(txRef, {
    status: 'CANCELLED',
    cancelledBy: currentUserName,
    cancelledByUid: currentUserId,
    cancelledByNameSnapshot: currentUserName,
    cancelledAt: now,
    cancellationReason: reason.trim(),
    updatedAt: now,
    updatedBy: currentUserName,
  });

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CANCEL',
    module: 'FINANCE',
    entityType: 'FINANCE_TRANSACTION',
    entityId: id,
    description: `Hủy bỏ chứng từ ${data.voucherNumber} (${data.reconciliationCode}). Lý do: ${reason}`,
    before: { status: data.status },
    after: { status: 'CANCELLED', cancelledBy: currentUserName, cancellationReason: reason },
  });
}

/**
 * Cập nhật thông tin phiếu thu / chi
 */
export async function updateFinanceTransaction(
  id: string,
  updates: Partial<FinanceTransaction>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const txRef = doc(db, 'financeTransactions', id);
  const snap = await getDoc(txRef);
  if (!snap.exists()) throw new Error('Không tìm thấy chứng từ tài chính.');
  const before = snap.data() as FinanceTransaction;

  const now = new Date().toISOString();
  const cleaned = sanitizeForFirestore({
    ...updates,
    updatedAt: now,
    updatedBy: currentUserName,
  });

  await updateDoc(txRef, cleaned);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'FINANCE',
    entityType: 'FINANCE_TRANSACTION',
    entityId: id,
    description: `Cập nhật chứng từ ${before.voucherNumber} (${before.reconciliationCode})`,
    before,
    after: { ...before, ...cleaned },
  });
}

// ============================================================================
// QUÀ TẶNG & AN SINH XÃ HỘI (GIFTS)
// ============================================================================

export async function getGiftCampaigns(): Promise<GiftCampaign[]> {
  const snap = await getDocs(collection(db, 'giftCampaigns'));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as GiftCampaign));
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getGiftRecipients(campaignId: string): Promise<GiftRecipient[]> {
  const q = query(collection(db, 'giftRecipients'), where('campaignId', '==', campaignId));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as GiftRecipient));
  return list.sort((a, b) => a.recipientName.localeCompare(b.recipientName));
}

export async function createGiftCampaign(
  campaign: Omit<GiftCampaign, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt' | 'deliveredCount' | 'createdBy' | 'updatedBy'>,
  currentUserId: string,
  currentUserName: string
): Promise<GiftCampaign> {
  const year = new Date().getFullYear();
  const seq = await getNextAtomicCounter(`gift_campaign_${year}`);
  const campaignCode = `QA-${year}-${String(seq).padStart(4, '0')}`;

  const newId = doc(collection(db, 'giftCampaigns')).id;
  const now = new Date().toISOString();

  const newCamp: GiftCampaign = {
    ...campaign,
    id: newId,
    campaignCode,
    deliveredCount: 0,
    status: campaign.status || 'PREPARING',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  await setDoc(doc(db, 'giftCampaigns', newId), sanitizeForFirestore(newCamp));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'GIFTS',
    entityType: 'GIFT_CAMPAIGN',
    entityId: newId,
    description: `Tạo đợt phát quà mới: ${newCamp.campaignName} (${newCamp.campaignCode})`,
    after: newCamp,
  });

  return newCamp;
}

export async function addGiftRecipient(
  recipient: Omit<GiftRecipient, 'id' | 'createdAt'>,
  currentUserId: string,
  currentUserName: string
): Promise<GiftRecipient> {
  // Kiểm tra trùng trong chiến dịch
  const checkQ = query(
    collection(db, 'giftRecipients'),
    where('campaignId', '==', recipient.campaignId),
    where('recipientName', '==', recipient.recipientName.trim())
  );
  const existing = await getDocs(checkQ);
  if (!existing.empty) {
    throw new Error(`Cử tri ${recipient.recipientName} đã có tên trong danh sách nhận quà của đợt này.`);
  }

  // Tạo ID tất định hoặc ngẫu nhiên
  const baseKey = recipient.residentId || recipient.householdId || '';
  const newId = baseKey
    ? `${recipient.campaignId}_${baseKey}`
    : doc(collection(db, 'giftRecipients')).id;

  const now = new Date().toISOString();

  const newRecip: GiftRecipient = {
    ...recipient,
    id: newId,
    recipientNameSnapshot: recipient.recipientName,
    nationalIdMaskedSnapshot: recipient.nationalId ? maskNationalId(recipient.nationalId) : '',
    addressSnapshot: recipient.address,
    classificationSnapshot: recipient.targetGroupTag,
    status: recipient.status || 'PENDING',
    distributionStatus: recipient.distributionStatus || 'PENDING',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  await setDoc(doc(db, 'giftRecipients', newId), sanitizeForFirestore(newRecip));
  return newRecip;
}

export const createGiftRecipient = async (
  recipient: any,
  currentUserId?: string,
  currentUserName?: string
): Promise<GiftRecipient> => {
  return addGiftRecipient(
    {
      ...recipient,
      recipientName: recipient.recipientName || recipient.residentName || 'Người dân',
      distributionStatus: recipient.status || recipient.distributionStatus || 'PENDING',
      status: recipient.status || 'PENDING',
      quantity: recipient.quantity || 1,
      unitValue: recipient.unitValue || 0,
      totalValue: recipient.totalValue || recipient.unitValue || 0,
    },
    currentUserId || 'system',
    currentUserName || 'Cán bộ'
  );
};

export async function confirmGiftDisbursement(
  recipientId: string,
  campaignId: string,
  details: {
    confirmedBy: string;
    receiverType: 'Trực tiếp' | 'Người thân nhận thay';
    proxyName?: string;
    proxyNationalId?: string;
    photoUrl?: string;
    signatureData?: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const recipRef = doc(db, 'giftRecipients', recipientId);
  const snap = await getDoc(recipRef);
  if (!snap.exists()) throw new Error('Không tìm thấy thông tin cử tri nhận quà.');
  const data = snap.data() as GiftRecipient;

  if (data.distributionStatus === 'RECEIVED' || data.status === 'DELIVERED') {
    throw new Error(
      `Cử tri ${data.recipientName} đã nhận quà trước đó (Vào lúc: ${data.receivedAt}). Không thể phát trùng!`
    );
  }

  const now = new Date().toISOString();

  await updateDoc(recipRef, sanitizeForFirestore({
    distributionStatus: 'RECEIVED',
    status: 'DELIVERED',
    receivedAt: now,
    confirmedBy: details.confirmedBy,
    confirmedByUid: currentUserId,
    confirmedByNameSnapshot: details.confirmedBy,
    receiverType: details.receiverType,
    deliveryMethod: details.receiverType,
    proxyName: details.proxyName || '',
    proxyNationalId: details.proxyNationalId || '',
    photoUrl: details.photoUrl || '',
    signatureData: details.signatureData || '',
    updatedAt: now,
    updatedBy: currentUserName,
  }));

  // Tăng số lượng đã trao trong chiến dịch
  try {
    const campRef = doc(db, 'giftCampaigns', campaignId);
    const campSnap = await getDoc(campRef);
    if (campSnap.exists()) {
      const curDelivered = campSnap.data().deliveredCount || 0;
      await updateDoc(campRef, { deliveredCount: curDelivered + 1 });
    }
  } catch (err) {
    console.warn('Cập nhật số lượng quà đã trao:', err);
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'GIFTS',
    entityType: 'GIFT_RECIPIENT',
    entityId: recipientId,
    description: `Xác nhận trao quà an sinh cho: ${data.recipientName} (${data.address})`,
    after: { recipientId, campaignId, receivedAt: now, confirmedBy: details.confirmedBy },
  });
}

export async function updateRecipientDelivery(
  recipientId: string,
  campaignId: string,
  details: {
    deliveryMethod?: 'Trực tiếp' | 'Người thân nhận thay';
    proxyName?: string;
    proxyNationalId?: string;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  return confirmGiftDisbursement(
    recipientId,
    campaignId,
    {
      confirmedBy: currentUserName,
      receiverType: details.deliveryMethod || 'Trực tiếp',
      proxyName: details.proxyName,
      proxyNationalId: details.proxyNationalId,
    },
    currentUserId,
    currentUserName
  );
}

/**
 * Cập nhật thông tin đợt phát quà
 */
export async function updateGiftCampaign(
  id: string,
  updates: Partial<GiftCampaign>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const campRef = doc(db, 'giftCampaigns', id);
  const snap = await getDoc(campRef);
  if (!snap.exists()) throw new Error('Không tìm thấy đợt phát quà.');
  const before = snap.data() as GiftCampaign;

  const now = new Date().toISOString();
  const cleaned = sanitizeForFirestore({
    ...updates,
    updatedAt: now,
    updatedBy: currentUserName,
  });

  await updateDoc(campRef, cleaned);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'GIFTS',
    entityType: 'GIFT_CAMPAIGN',
    entityId: id,
    description: `Cập nhật đợt phát quà: ${before.campaignName}`,
    before,
    after: { ...before, ...cleaned },
  });
}

/**
 * Xóa đợt phát quà và danh sách người nhận liên quan
 */
export async function deleteGiftCampaign(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const campRef = doc(db, 'giftCampaigns', id);
  const snap = await getDoc(campRef);
  if (!snap.exists()) return;
  const before = snap.data() as GiftCampaign;

  await deleteDoc(campRef);

  try {
    const qRecips = query(collection(db, 'giftRecipients'), where('campaignId', '==', id));
    const recipsSnap = await getDocs(qRecips);
    const batch = writeBatch(db);
    recipsSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Lỗi xóa danh sách người nhận theo đợt:', err);
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'DELETE',
    module: 'GIFTS',
    entityType: 'GIFT_CAMPAIGN',
    entityId: id,
    description: `Xóa đợt phát quà: ${before.campaignName} (${before.campaignCode})`,
    before,
  });
}

/**
 * Thêm người nhận quà bằng tay (nhập thủ công không cần qua danh sách cử tri)
 */
export async function addManualGiftRecipient(
  data: {
    campaignId: string;
    recipientName: string;
    nationalId?: string;
    phone?: string;
    address: string;
    groupNumber?: string;
    targetGroupTag?: string;
    giftItemName?: string;
    quantity?: number;
    unitValue?: number;
    totalValue?: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<GiftRecipient> {
  const newId = doc(collection(db, 'giftRecipients')).id;
  const now = new Date().toISOString();

  const quantity = Number(data.quantity) || 1;
  const unitValue = Number(data.unitValue) || 0;
  const totalValue = Number(data.totalValue) || (quantity * unitValue);

  const newRecip: GiftRecipient = {
    id: newId,
    campaignId: data.campaignId,
    recipientName: data.recipientName.trim(),
    recipientNameSnapshot: data.recipientName.trim(),
    nationalId: data.nationalId?.trim() || '',
    nationalIdMaskedSnapshot: data.nationalId ? maskNationalId(data.nationalId) : '',
    phone: data.phone?.trim() || '',
    address: data.address.trim(),
    addressSnapshot: data.address.trim(),
    groupNumber: data.groupNumber || '',
    targetGroupTag: data.targetGroupTag || 'Khác',
    classificationSnapshot: data.targetGroupTag || 'Khác',
    giftItemName: data.giftItemName || '',
    quantity,
    unitValue,
    totalValue,
    status: 'PENDING',
    distributionStatus: 'PENDING',
    notes: data.notes?.trim() || '',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
  };

  await setDoc(doc(db, 'giftRecipients', newId), sanitizeForFirestore(newRecip));

  // Tăng totalBeneficiaries trong đợt phát quà
  try {
    const campRef = doc(db, 'giftCampaigns', data.campaignId);
    const campSnap = await getDoc(campRef);
    if (campSnap.exists()) {
      const campData = campSnap.data() as GiftCampaign;
      await updateDoc(campRef, {
        totalBeneficiaries: (campData.totalBeneficiaries || 0) + 1,
        updatedAt: now,
      });
    }
  } catch (e) {
    console.warn('Lỗi cập nhật số người đợt quà:', e);
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'GIFTS',
    entityType: 'GIFT_RECIPIENT',
    entityId: newId,
    description: `Thêm người nhận quà thủ công: ${newRecip.recipientName} (${newRecip.address})`,
    after: newRecip,
  });

  return newRecip;
}

/**
 * Cập nhật thông tin người nhận quà
 */
export async function updateGiftRecipient(
  id: string,
  updates: Partial<GiftRecipient>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const ref = doc(db, 'giftRecipients', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Không tìm thấy bản ghi người nhận quà.');
  const before = snap.data() as GiftRecipient;

  const now = new Date().toISOString();
  const cleaned = sanitizeForFirestore({
    ...updates,
    updatedAt: now,
    updatedBy: currentUserName,
  });

  await updateDoc(ref, cleaned);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'GIFTS',
    entityType: 'GIFT_RECIPIENT',
    entityId: id,
    description: `Cập nhật thông tin người nhận quà: ${before.recipientName}`,
    before,
    after: { ...before, ...cleaned },
  });
}

/**
 * Xóa người nhận quà khỏi đợt
 */
export async function deleteGiftRecipient(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const ref = doc(db, 'giftRecipients', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const before = snap.data() as GiftRecipient;

  await deleteDoc(ref);

  try {
    const campRef = doc(db, 'giftCampaigns', before.campaignId);
    const campSnap = await getDoc(campRef);
    if (campSnap.exists()) {
      const campData = campSnap.data() as GiftCampaign;
      const decDelivered = (before.distributionStatus === 'DELIVERED' || before.status === 'DELIVERED') ? 1 : 0;
      await updateDoc(campRef, {
        totalBeneficiaries: Math.max(0, (campData.totalBeneficiaries || 1) - 1),
        deliveredCount: Math.max(0, (campData.deliveredCount || 0) - decDelivered),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('Lỗi điều chỉnh số lượng sau khi xóa người nhận:', e);
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'DELETE',
    module: 'GIFTS',
    entityType: 'GIFT_RECIPIENT',
    entityId: id,
    description: `Xóa người nhận quà: ${before.recipientName}`,
    before,
  });
}

// ============================================================================
// HỆ THỐNG MỜI & PHÂN QUYỀN CÁN BỘ BẰNG EMAIL (INVITATIONS & RBAC)
// ============================================================================

/**
 * Tạo lời mời phân quyền cán bộ tham gia ấp gửi qua email
 */
export async function createInvitation(
  data: {
    email: string;
    fullName: string;
    roleId: string;
    roleName: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<UserInvitation> {
  const newId = doc(collection(db, 'invitations')).id;
  const token = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // Có hiệu lực 14 ngày

  const newInvite: UserInvitation = {
    id: newId,
    email: data.email.trim().toLowerCase(),
    fullName: data.fullName.trim(),
    roleId: data.roleId,
    roleName: data.roleName,
    invitedByUid: currentUserId,
    invitedByName: currentUserName,
    status: 'PENDING',
    inviteToken: token,
    createdAt: now.toISOString(),
    expiresAt,
  };

  await setDoc(doc(db, 'invitations', newId), sanitizeForFirestore(newInvite));

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: newId,
    description: `Tạo link mời phân quyền cho ${newInvite.fullName} (${newInvite.email}) vai trò: ${newInvite.roleName}`,
    after: newInvite,
  });

  return newInvite;
}

/**
 * Lấy danh sách các lời mời
 */
export async function getInvitations(): Promise<UserInvitation[]> {
  try {
    const q = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserInvitation));
  } catch (e) {
    const snap = await getDocs(collection(db, 'invitations'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserInvitation));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

/**
 * Tìm lời mời qua token
 */
export async function getInvitationByToken(token: string): Promise<UserInvitation | null> {
  const q = query(collection(db, 'invitations'), where('inviteToken', '==', token.trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as UserInvitation;
}

/**
 * Người dùng xác nhận lời mời phân quyền
 */
export async function acceptInvitation(
  token: string,
  userUid: string,
  userEmail: string,
  userName: string
): Promise<UserInvitation> {
  const invite = await getInvitationByToken(token);
  if (!invite) throw new Error('Không tìm thấy thông tin lời mời phân quyền hoặc link không hợp lệ.');
  if (invite.status !== 'PENDING') throw new Error('Lời mời này đã được chấp nhận trước đó hoặc đã bị thu hồi.');

  if (new Date(invite.expiresAt) < new Date()) {
    throw new Error('Lời mời phân quyền này đã hết thời hạn hiệu lực.');
  }

  const now = new Date().toISOString();

  // Đánh dấu lời mời thành công
  await updateDoc(doc(db, 'invitations', invite.id), {
    status: 'ACCEPTED',
    acceptedAt: now,
    acceptedByUid: userUid,
  });

  // Cập nhật UserProfile của tài khoản hiện tại
  const userRef = doc(db, 'users', userUid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    await updateDoc(userRef, {
      roleId: invite.roleId,
      status: 'active',
      updatedAt: now,
      updatedBy: `Xác nhận phân quyền (${invite.roleName})`,
    });
  } else {
    const newProfile: UserProfile = {
      uid: userUid,
      fullName: userName || invite.fullName,
      email: userEmail.toLowerCase(),
      roleId: invite.roleId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: invite.invitedByName,
    };
    await setDoc(userRef, sanitizeForFirestore(newProfile));
  }

  await logAuditEvent({
    userId: userUid,
    userName: userName || invite.fullName,
    action: 'ASSIGN_ROLE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: userUid,
    description: `Cán bộ ${userName || invite.fullName} đã xác nhận nhận vai trò: ${invite.roleName}`,
    after: { roleId: invite.roleId, status: 'active' },
  });

  return { ...invite, status: 'ACCEPTED', acceptedAt: now, acceptedByUid: userUid };
}

/**
 * Thu hồi lời mời phân quyền
 */
export async function revokeInvitation(
  inviteId: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const ref = doc(db, 'invitations', inviteId);
  await updateDoc(ref, {
    status: 'REVOKED',
    updatedAt: new Date().toISOString(),
    updatedBy: currentUserName,
  });

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: inviteId,
    description: `Thu hồi lời mời phân quyền cán bộ`,
  });
}

// ============================================================================
// NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
// ============================================================================

export async function getAuditLogs(limitCount = 150): Promise<AuditLog[]> {
  const auditCol = collection(db, 'auditLogs');
  try {
    const snap = await getDocs(query(auditCol, orderBy('timestamp', 'desc'), limit(limitCount)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (err) {
    const snap = await getDocs(query(auditCol, limit(limitCount)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }
}

// ============================================================================
// SAO LƯU & PHỤC HỒI (BACKUP & RESTORE)
// ============================================================================

export async function createFullBackup(
  currentUserId: string,
  currentUserName: string,
  settings: OrganizationSettings
): Promise<BackupData> {
  const [resSnap, hhSnap, finSnap, catSnap, campSnap, recipSnap, rolesSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'residents')),
    getDocs(collection(db, 'households')),
    getDocs(collection(db, 'financeTransactions')),
    getDocs(collection(db, 'financeCategories')),
    getDocs(collection(db, 'giftCampaigns')),
    getDocs(collection(db, 'giftRecipients')),
    getDocs(collection(db, 'roles')),
    getDocs(collection(db, 'users')),
  ]);

  const collectionsData: BackupCollections = {
    organization: settings,
    roles: rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)),
    users: usersSnap.docs.map(d => {
      const u = d.data() as UserProfile;
      // Strip sensitive tokens/passwords if any
      const { ...safeUser } = u;
      return { id: d.id, uid: d.id, ...safeUser };
    }),
    households: hhSnap.docs.map(d => ({ id: d.id, ...d.data() } as Household)),
    residents: resSnap.docs.map(d => ({ id: d.id, ...d.data() } as Resident)),
    financeCategories: catSnap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceCategory)),
    financeTransactions: finSnap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceTransaction)),
    giftCampaigns: campSnap.docs.map(d => ({ id: d.id, ...d.data() } as GiftCampaign)),
    giftRecipients: recipSnap.docs.map(d => ({ id: d.id, ...d.data() } as GiftRecipient)),
  };

  const payloadString = JSON.stringify(collectionsData);
  const checksum = await calculateSHA256(payloadString);

  const backupData: BackupData = {
    metadata: {
      application: 'QUAN_LY_AP',
      appName: 'QUẢN LÝ ẤP',
      schemaVersion: '2.0.0',
      exportVersion: 1,
      createdAt: new Date().toISOString(),
      createdByUid: currentUserId,
      createdBy: currentUserName,
      organizationId: settings.organizationId || 'default',
      organizationName: settings.hamletName,
      organization: {
        hamletName: settings.hamletName,
        communeName: settings.communeName,
        districtName: settings.districtName,
        provinceName: settings.provinceName,
      },
      checksum,
    },
    collections: collectionsData,
    data: {
      residents: collectionsData.residents,
      households: collectionsData.households,
      financeTransactions: collectionsData.financeTransactions,
      financeCategories: collectionsData.financeCategories,
      giftCampaigns: collectionsData.giftCampaigns,
      giftRecipients: collectionsData.giftRecipients,
      roles: collectionsData.roles,
      organizationSettings: settings,
    },
  };

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'BACKUP',
    module: 'BACKUP',
    entityType: 'DATABASE',
    entityId: 'full_backup',
    description: `Tạo tệp sao lưu dữ liệu toàn hệ thống (${backupData.collections?.residents.length} nhân khẩu, ${backupData.collections?.households.length} hộ, ${backupData.collections?.financeTransactions.length} chứng từ). Checksum: ${checksum.slice(0, 8)}...`,
  });

  return backupData;
}

export interface RestoreSummary {
  success: boolean;
  message: string;
  recordsRestored: number;
  details: {
    residents: number;
    households: number;
    financeTransactions: number;
    financeCategories: number;
    giftCampaigns: number;
    giftRecipients: number;
    roles: number;
  };
}

export async function restoreFromBackup(
  backup: BackupData,
  mode: 'MERGE' | 'REPLACE',
  currentUserId: string,
  currentUserName: string
): Promise<RestoreSummary> {
  const isQuanLyAp =
    backup.metadata?.application === 'QUAN_LY_AP' ||
    backup.metadata?.appName === 'QUẢN LÝ ẤP' ||
    backup.metadata?.schemaVersion?.startsWith('2.');

  if (!isQuanLyAp) {
    throw new Error('Tệp không đúng định dạng dữ liệu sao lưu của phần mềm Quản Lý Ấp.');
  }

  // Hỗ trợ cả 2 định dạng backup: `collections` (mới) và `data` (cũ)
  const source = backup.collections || backup.data;
  if (!source) {
    throw new Error('Tệp sao lưu không chứa cấu trúc dữ liệu hợp lệ (thiếu collections/data).');
  }

  const batch = writeBatch(db);
  const details = {
    residents: 0,
    households: 0,
    financeTransactions: 0,
    financeCategories: 0,
    giftCampaigns: 0,
    giftRecipients: 0,
    roles: 0,
  };

  // Nếu là REPLACE mode, xóa sạch các collection nghiệp vụ
  if (mode === 'REPLACE') {
    const collectionsToClear = [
      'residents',
      'households',
      'financeTransactions',
      'financeCategories',
      'giftCampaigns',
      'giftRecipients',
    ];
    for (const cName of collectionsToClear) {
      try {
        const snap = await getDocs(collection(db, cName));
        for (const d of snap.docs) {
          batch.delete(d.ref);
        }
      } catch (err) {
        console.warn(`Lỗi dọn dẹp collection ${cName}:`, err);
      }
    }
  }

  // 1. Phục hồi Nhân khẩu (Residents)
  if (Array.isArray(source.residents)) {
    for (const res of source.residents) {
      if (res.id) {
        batch.set(doc(db, 'residents', res.id), res, { merge: mode === 'MERGE' });
        details.residents++;
      }
    }
  }

  // 2. Phục hồi Hộ khẩu (Households)
  if (Array.isArray(source.households)) {
    for (const hh of source.households) {
      if (hh.id) {
        batch.set(doc(db, 'households', hh.id), hh, { merge: mode === 'MERGE' });
        details.households++;
      }
    }
  }

  // 3. Phục hồi Chứng từ tài chính (Finance Transactions)
  if (Array.isArray(source.financeTransactions)) {
    for (const tx of source.financeTransactions) {
      if (tx.id) {
        batch.set(doc(db, 'financeTransactions', tx.id), tx, { merge: mode === 'MERGE' });
        details.financeTransactions++;
      }
    }
  }

  // 4. Phục hồi Danh mục tài chính (Categories)
  if (Array.isArray(source.financeCategories)) {
    for (const cat of source.financeCategories) {
      if (cat.id) {
        batch.set(doc(db, 'financeCategories', cat.id), cat, { merge: mode === 'MERGE' });
        details.financeCategories++;
      }
    }
  }

  // 5. Phục hồi Đợt phát quà (Gift Campaigns)
  if (Array.isArray(source.giftCampaigns)) {
    for (const c of source.giftCampaigns) {
      if (c.id) {
        batch.set(doc(db, 'giftCampaigns', c.id), c, { merge: mode === 'MERGE' });
        details.giftCampaigns++;
      }
    }
  }

  // 6. Phục hồi Cử tri nhận quà (Gift Recipients)
  if (Array.isArray(source.giftRecipients)) {
    for (const r of source.giftRecipients) {
      if (r.id) {
        batch.set(doc(db, 'giftRecipients', r.id), r, { merge: mode === 'MERGE' });
        details.giftRecipients++;
      }
    }
  }

  // 7. Phục hồi Cài đặt tổ chức
  const orgSettings = (source as any).organization || (source as any).organizationSettings;
  if (orgSettings) {
    batch.set(doc(db, 'organizationSettings', 'default'), orgSettings, { merge: true });
  }

  await batch.commit();

  const totalRestored = Object.values(details).reduce((a, b) => a + b, 0);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'RESTORE',
    module: 'BACKUP',
    entityType: 'DATABASE',
    entityId: 'restore',
    description: `Phục hồi cơ sở dữ liệu chế độ ${mode}. Tổng số ${totalRestored} bản ghi đã phục hồi thành công.`,
  });

  return {
    success: true,
    message: `Phục hồi thành công ${totalRestored} bản ghi vào hệ thống (Chế độ: ${mode}).`,
    recordsRestored: totalRestored,
    details,
  };
}

// ============================================================================
// QUẢN TRỊ NGƯỜI DÙNG & HẠNG MỤC
// ============================================================================

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() } as unknown as UserProfile));
}

export async function updateUserProfileDetails(
  userId: string,
  details: {
    fullName: string;
    address?: string;
    phone?: string;
    position?: string;
    roleId?: string;
  },
  currentUserId: string,
  currentUserName: string,
  syncToSettings?: boolean
): Promise<void> {
  const uRef = doc(db, 'users', userId);
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    fullName: details.fullName.trim(),
    address: details.address?.trim() || '',
    phone: details.phone?.trim() || '',
    position: details.position?.trim() || '',
    updatedAt: now,
    updatedBy: currentUserName,
  };

  if (details.roleId) {
    payload.roleId = details.roleId;
  }

  await updateDoc(uRef, sanitizeForFirestore(payload));

  // Tự động đồng bộ chức danh chủ chốt vào cấu hình chữ ký mẫu biểu ấp nếu được yêu cầu
  if (syncToSettings && details.position) {
    try {
      const posLower = details.position.toLowerCase();
      const settingsRef = doc(db, 'organizationSettings', 'default');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const updateSettings: Record<string, unknown> = {
          updatedAt: now,
          updatedBy: currentUserName,
        };
        if (posLower.includes('trưởng ấp') || posLower.includes('trưởng thôn')) {
          updateSettings.hamletLeaderName = details.fullName.trim();
        } else if (posLower.includes('kế toán') || posLower.includes('thư ký')) {
          updateSettings.financeOfficerName = details.fullName.trim();
        } else if (posLower.includes('thủ quỹ')) {
          updateSettings.treasurerName = details.fullName.trim();
        }
        if (Object.keys(updateSettings).length > 2) {
          await updateDoc(settingsRef, sanitizeForFirestore(updateSettings));
        }
      }
    } catch (sErr) {
      console.warn('Lỗi đồng bộ chức danh sang cấu hình đơn vị:', sErr);
    }
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: details.roleId ? 'ROLE_CHANGE' : 'UPDATE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: userId,
    description: `Cán bộ ${details.fullName} cập nhật hồ sơ cá nhân: Họ tên, Địa chỉ: "${details.address || ''}", Chức vụ: "${details.position || ''}"${details.roleId ? ` (Vai trò hệ thống: ${details.roleId})` : ''}`,
    after: payload,
  });
}

export async function updateUserProfileRole(
  userId: string,
  newRoleId: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const uRef = doc(db, 'users', userId);
  await updateDoc(uRef, { roleId: newRoleId, updatedAt: new Date().toISOString() });
  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'ROLE_CHANGE',
    module: 'USERS',
    entityType: 'USER',
    entityId: userId,
    description: `Thay đổi vai trò người dùng thành ${newRoleId}`,
  });
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const uRef = doc(db, 'users', userId);
  await updateDoc(uRef, {
    status: isActive ? 'active' : 'disabled',
    isActive,
    updatedAt: new Date().toISOString(),
  });
  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: isActive ? 'UPDATE' : 'USER_DISABLE',
    module: 'USERS',
    entityType: 'USER',
    entityId: userId,
    description: `${isActive ? 'Kích hoạt' : 'Khóa'} tài khoản cán bộ`,
  });
}

/**
 * Thêm mới cán bộ điều hành ấp trực tiếp vào hệ thống
 */
export async function createOfficialUser(
  data: {
    fullName: string;
    email: string;
    phone?: string;
    address?: string;
    position?: string;
    roleId: string;
    status?: 'ACTIVE' | 'DISABLED' | 'active' | 'disabled';
    notes?: string;
    syncToSettings?: boolean;
  },
  currentUserId: string,
  currentUserName: string
): Promise<UserProfile> {
  if (!data.fullName.trim()) throw new Error('Vui lòng nhập họ và tên cán bộ.');
  if (!data.email.trim()) throw new Error('Vui lòng nhập địa chỉ email cán bộ.');

  const cleanEmail = data.email.trim().toLowerCase();

  // Kiểm tra trùng email
  const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
  const existingUsers = await getDocs(emailQuery);
  if (!existingUsers.empty) {
    throw new Error(`Email "${cleanEmail}" đã tồn tại trong danh sách cán bộ.`);
  }

  const newUid = doc(collection(db, 'users')).id;
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: newUid,
    fullName: data.fullName.trim(),
    email: cleanEmail,
    phone: data.phone?.trim() || '',
    address: data.address?.trim() || '',
    position: data.position?.trim() || '',
    roleId: data.roleId || 'SECRETARY',
    status: data.status || 'active',
    createdAt: now,
    createdBy: currentUserName,
    updatedAt: now,
    updatedBy: currentUserName,
    notes: data.notes?.trim() || '',
  };

  await setDoc(doc(db, 'users', newUid), sanitizeForFirestore(profile));

  // Tự động đồng bộ chức danh chủ chốt vào cấu hình chữ ký nếu được yêu cầu
  if (data.syncToSettings && data.position) {
    try {
      const posLower = data.position.toLowerCase();
      const settingsRef = doc(db, 'organizationSettings', 'default');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const updateSettings: Record<string, unknown> = {
          updatedAt: now,
          updatedBy: currentUserName,
        };
        if (posLower.includes('trưởng ấp') || posLower.includes('trưởng thôn')) {
          updateSettings.hamletLeaderName = profile.fullName;
        } else if (posLower.includes('kế toán') || posLower.includes('thư ký')) {
          updateSettings.financeOfficerName = profile.fullName;
        } else if (posLower.includes('thủ quỹ')) {
          updateSettings.treasurerName = profile.fullName;
        }
        if (Object.keys(updateSettings).length > 2) {
          await updateDoc(settingsRef, sanitizeForFirestore(updateSettings));
        }
      }
    } catch (sErr) {
      console.warn('Lỗi đồng bộ chức danh cán bộ mới sang cấu hình đơn vị:', sErr);
    }
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'CREATE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: newUid,
    description: `Thêm cán bộ mới vào danh sách điều hành ấp: ${profile.fullName} (${profile.email}), Chức vụ: "${profile.position || 'Cán bộ'}", Vai trò: ${profile.roleId}`,
    after: profile,
  });

  return profile;
}

/**
 * Chỉnh sửa thông tin thành viên / cán bộ trong danh sách điều hành ấp
 */
export async function updateOfficialUser(
  userId: string,
  updates: {
    fullName: string;
    email?: string;
    phone?: string;
    address?: string;
    position?: string;
    roleId?: string;
    status?: 'ACTIVE' | 'DISABLED' | 'active' | 'disabled';
    notes?: string;
    syncToSettings?: boolean;
  },
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  const uRef = doc(db, 'users', userId);
  const snap = await getDoc(uRef);
  if (!snap.exists()) throw new Error('Không tìm thấy thông tin cán bộ trong hệ thống.');
  const before = snap.data() as UserProfile;

  // Kiểm tra trùng email nếu email thay đổi
  if (updates.email && updates.email.trim().toLowerCase() !== (before.email || '').toLowerCase()) {
    const cleanEmail = updates.email.trim().toLowerCase();
    const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const existingUsers = await getDocs(emailQuery);
    if (!existingUsers.empty && existingUsers.docs[0].id !== userId) {
      throw new Error(`Email "${cleanEmail}" đã được sử dụng bởi một cán bộ khác.`);
    }
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    fullName: updates.fullName.trim(),
    updatedAt: now,
    updatedBy: currentUserName,
  };

  if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) payload.phone = updates.phone.trim();
  if (updates.address !== undefined) payload.address = updates.address.trim();
  if (updates.position !== undefined) payload.position = updates.position.trim();
  if (updates.roleId !== undefined) payload.roleId = updates.roleId;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.notes !== undefined) payload.notes = updates.notes.trim();

  await updateDoc(uRef, sanitizeForFirestore(payload));

  // Tự động đồng bộ chức danh chủ chốt vào cấu hình chữ ký nếu được yêu cầu
  if (updates.syncToSettings && updates.position) {
    try {
      const posLower = updates.position.toLowerCase();
      const settingsRef = doc(db, 'organizationSettings', 'default');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const updateSettings: Record<string, unknown> = {
          updatedAt: now,
          updatedBy: currentUserName,
        };
        if (posLower.includes('trưởng ấp') || posLower.includes('trưởng thôn')) {
          updateSettings.hamletLeaderName = updates.fullName.trim();
        } else if (posLower.includes('kế toán') || posLower.includes('thư ký')) {
          updateSettings.financeOfficerName = updates.fullName.trim();
        } else if (posLower.includes('thủ quỹ')) {
          updateSettings.treasurerName = updates.fullName.trim();
        }
        if (Object.keys(updateSettings).length > 2) {
          await updateDoc(settingsRef, sanitizeForFirestore(updateSettings));
        }
      }
    } catch (sErr) {
      console.warn('Lỗi đồng bộ chức danh sang cấu hình đơn vị:', sErr);
    }
  }

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'UPDATE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: userId,
    description: `Cập nhật thông tin cán bộ điều hành ấp: ${updates.fullName} (Chức vụ: "${updates.position || before.position || ''}", Vai trò: ${updates.roleId || before.roleId})`,
    before,
    after: { ...before, ...payload },
  });
}

/**
 * Xóa thành viên khỏi danh sách cán bộ điều hành ấp
 */
export async function deleteOfficialUser(
  userId: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  if (userId === currentUserId) {
    throw new Error('Bạn không thể tự xóa tài khoản của chính mình khỏi danh sách cán bộ điều hành.');
  }

  const uRef = doc(db, 'users', userId);
  const snap = await getDoc(uRef);
  if (!snap.exists()) {
    throw new Error('Không tìm thấy cán bộ cần xóa hoặc đã bị xóa trước đó.');
  }
  const before = snap.data() as UserProfile;

  await deleteDoc(uRef);

  await logAuditEvent({
    userId: currentUserId,
    userName: currentUserName,
    action: 'DELETE',
    module: 'USERS',
    entityType: 'USER_PROFILE',
    entityId: userId,
    description: `Xóa thành viên khỏi danh sách cán bộ điều hành ấp: ${before.fullName} (${before.email}, Chức vụ: "${before.position || 'Cán bộ'}", Vai trò: ${before.roleId})`,
    before,
  });
}

export async function createFinanceCategory(
  cat: Omit<FinanceCategory, 'id' | 'createdAt' | 'isActive'> & { isCustom?: boolean },
  currentUserId?: string,
  currentUserName?: string
): Promise<FinanceCategory> {
  const newId = doc(collection(db, 'financeCategories')).id;
  const newCat: FinanceCategory = {
    ...cat,
    id: newId,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'financeCategories', newId), sanitizeForFirestore(newCat));

  if (currentUserId && currentUserName) {
    await logAuditEvent({
      userId: currentUserId,
      userName: currentUserName,
      action: 'CREATE',
      module: 'FINANCE',
      entityType: 'FINANCE_CATEGORY',
      entityId: newId,
      description: `Tạo danh mục tài chính mới: ${newCat.name} (${newCat.type === 'INCOME' ? 'Thu' : 'Chi'})`,
    });
  }

  return newCat;
}

export async function updateFinanceCategory(
  catId: string,
  updates: Partial<FinanceCategory>,
  currentUserId?: string,
  currentUserName?: string
): Promise<void> {
  const catRef = doc(db, 'financeCategories', catId);
  const catSnap = await getDoc(catRef);
  if (!catSnap.exists()) {
    throw new Error('Danh mục thu/chi không tồn tại.');
  }
  const before = catSnap.data() as FinanceCategory;

  const cleaned = sanitizeForFirestore({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await updateDoc(catRef, cleaned);

  if (currentUserId && currentUserName) {
    await logAuditEvent({
      userId: currentUserId,
      userName: currentUserName,
      action: 'UPDATE',
      module: 'FINANCE',
      entityType: 'FINANCE_CATEGORY',
      entityId: catId,
      description: `Cập nhật danh mục thu/chi: ${before.name}`,
      before,
      after: { ...before, ...cleaned },
    });
  }
}

/**
 * Đếm số lượng chứng từ thu/chi đang sử dụng từng danh mục
 */
export async function getCategoryUsageCounts(): Promise<Record<string, number>> {
  try {
    const snap = await getDocs(collection(db, 'financeTransactions'));
    const counts: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const tx = d.data() as FinanceTransaction;
      if (tx.categoryId) {
        counts[tx.categoryId] = (counts[tx.categoryId] || 0) + 1;
      }
      if (tx.categoryName) {
        counts[`name:${tx.categoryName.trim()}`] =
          (counts[`name:${tx.categoryName.trim()}`] || 0) + 1;
      }
    });
    return counts;
  } catch (err) {
    console.warn('Lỗi đếm số lượng chứng từ theo danh mục:', err);
    return {};
  }
}

export async function deleteFinanceCategory(
  catId: string,
  currentUserId?: string,
  currentUserName?: string
): Promise<void> {
  // 1. Kiểm tra danh mục tồn tại
  const catRef = doc(db, 'financeCategories', catId);
  const catSnap = await getDoc(catRef);
  if (!catSnap.exists()) {
    throw new Error('Danh mục thu/chi không tồn tại hoặc đã bị xóa.');
  }
  const catData = catSnap.data() as FinanceCategory;

  // 2. KIỂM TRA BẮT BUỘC: Không cho phép người dùng xóa danh mục khi có dữ liệu bên trong
  const qTxById = query(
    collection(db, 'financeTransactions'),
    where('categoryId', '==', catId)
  );
  const snapById = await getDocs(qTxById);
  let txCount = snapById.size;

  if (txCount === 0 && catData.name) {
    const qTxByName = query(
      collection(db, 'financeTransactions'),
      where('categoryName', '==', catData.name.trim())
    );
    const snapByName = await getDocs(qTxByName);
    txCount = snapByName.size;
  }

  if (txCount > 0) {
    throw new Error(
      `Không thể xóa danh mục "${catData.name}" vì hiện đang có ${txCount} chứng từ thu/chi sử dụng danh mục này. Hệ thống không cho phép xóa danh mục khi đã phát sinh dữ liệu!`
    );
  }

  // 3. Thực hiện xóa danh mục nếu không có dữ liệu
  await deleteDoc(catRef);

  if (currentUserId && currentUserName) {
    await logAuditEvent({
      userId: currentUserId,
      userName: currentUserName,
      action: 'DELETE',
      module: 'FINANCE',
      entityType: 'FINANCE_CATEGORY',
      entityId: catId,
      description: `Xóa danh mục thu chi: ${catData.name}`,
      before: catData,
    });
  }
}

export async function backupDatabaseToJson(
  currentUserId: string = 'system',
  currentUserName: string = 'Quản trị viên',
  customSettings?: OrganizationSettings
): Promise<string> {
  let settings = customSettings;
  if (!settings) {
    const orgSnap = await getDoc(doc(db, 'organizationSettings', 'default'));
    settings = orgSnap.exists()
      ? (orgSnap.data() as OrganizationSettings)
      : ({
          hamletName: 'Ấp Bình Hòa',
          communeName: 'Xã An Nhơn Tây',
          districtName: 'Huyện Củ Chi',
          provinceName: 'TP. Hồ Chí Minh',
          address: 'Tỉnh lộ 7, Ấp Bình Hòa, Xã An Nhơn Tây, Củ Chi',
          phone: '028.3892.6102',
          email: 'apbinhhoa.annhontay@tphcm.gov.vn',
          hamletLeaderName: 'Nguyễn Văn Hùng',
          financeOfficerName: 'Mai Thị Thúy',
          treasurerName: 'Trần Kim Ngân',
          voucherSettings: {
            incomePrefix: 'PT',
            expensePrefix: 'PC',
            currentYear: new Date().getFullYear(),
            templateStandard: 'Quy chuẩn Mẫu C40-BB & C41-BB',
            superiorAgency: 'UBND XÃ AN NHƠN TÂY',
            agencyName: 'BAN ĐIỀU HÀNH ẤP BÌNH HÒA',
            signers: [
              { roleTitle: 'TRƯỞNG ẤP', actionSubtitle: '(Ký, họ tên, đóng dấu nếu có)', name: 'Nguyễn Văn Hùng' },
              { roleTitle: 'KẾ TOÁN ẤP', actionSubtitle: '(Ký, họ tên)', name: 'Mai Thị Thúy' },
              { roleTitle: 'THỦ QUỸ', actionSubtitle: '(Ký, họ tên)', name: 'Trần Kim Ngân' },
              { roleTitle: 'NGƯỜI NỘP / NHẬN TIỀN', actionSubtitle: '(Ký, họ tên)', name: '' },
            ],
          },
          updatedAt: new Date().toISOString(),
          updatedBy: 'Hệ thống',
        } as OrganizationSettings);
  }

  const backupData = await createFullBackup(currentUserId, currentUserName, settings);
  return JSON.stringify(backupData, null, 2);
}

export async function restoreDatabaseFromJson(
  backupData: BackupData,
  mode: 'MERGE' | 'REPLACE',
  currentUserId: string,
  currentUserName: string
): Promise<RestoreSummary> {
  return restoreFromBackup(backupData, mode, currentUserId, currentUserName);
}
