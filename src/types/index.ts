export type UserStatus = 'ACTIVE' | 'DISABLED' | 'active' | 'disabled';

export interface UserProfile {
  uid: string;
  organizationId?: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  position?: string;
  avatarUrl?: string;
  roleId: string;
  status: UserStatus;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  lastLoginAt?: string;
  lastPasswordChangeAt?: string;
  notes?: string;
}

export type PermissionCode =
  | 'residents.view'
  | 'residents.viewSensitive'
  | 'residents.create'
  | 'residents.update'
  | 'residents.archive'
  | 'residents.export'
  | 'households.view'
  | 'households.create'
  | 'households.update'
  | 'households.archive'
  | 'households.export'
  | 'finance.view'
  | 'finance.create'
  | 'finance.updateDraft'
  | 'finance.approve'
  | 'finance.cancel'
  | 'finance.export'
  | 'finance.viewSensitive'
  | 'gifts.view'
  | 'gifts.create'
  | 'gifts.update'
  | 'gifts.distribute'
  | 'gifts.lock'
  | 'gifts.export'
  | 'reports.view'
  | 'reports.viewResidents'
  | 'reports.viewFinance'
  | 'reports.viewGifts'
  | 'reports.export'
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'users.assignRole'
  | 'users.disable'
  | 'users.permissions'
  | 'roles.view'
  | 'roles.create'
  | 'roles.update'
  | 'settings.view'
  | 'settings.update'
  | 'backup.create'
  | 'backup.restore'
  | 'audit.view';

export interface Role {
  id: string;
  name: string;
  code?: string;
  description: string;
  isSystem?: boolean;
  isSystemRole?: boolean;
  permissions: PermissionCode[];
  permissionsMap?: Record<string, boolean>;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ResidenceStatus =
  | 'Thường trú'
  | 'Tạm trú'
  | 'Tạm vắng'
  | 'PERMANENT'
  | 'TEMPORARY'
  | 'TEMPORARILY_ABSENT'
  | 'MOVED_AWAY'
  | 'DECEASED'
  | 'STAY'
  | 'ABSENT';

export interface ResidentClassification {
  isPoorHousehold: boolean;
  isNearPoorHousehold: boolean;
  isPolicyBeneficiary: boolean;
  isElderly: boolean;
  isChild: boolean;
  isDisabled: boolean;
  isSocialAssistanceRecipient: boolean;
}

export interface Resident {
  id: string;
  organizationId?: string;
  residentCode: string; // e.g. NK-000001
  fullName: string;
  normalizedFullName?: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'Nam' | 'Nữ' | 'Khác' | 'MALE' | 'FEMALE' | 'OTHER';
  nationalId: string; // 12-digit CCCD
  nationalIdMasked?: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  phone?: string;
  householdId?: string;
  householdCode?: string;
  relationshipToHead?: string;
  relationshipWithHead?: string;
  groupNumber: string; // e.g. "Tổ 2"
  address: string;
  residenceStatus: ResidenceStatus;
  arrivalDate?: string;
  departureDate?: string;
  searchTokens?: string[];
  // Classifications
  isPoorHousehold?: boolean;
  isNearPoorHousehold?: boolean;
  isPolicyBeneficiary?: boolean;
  isElderly?: boolean;
  isChild?: boolean;
  isDisabled?: boolean;
  isSocialAssistanceRecipient?: boolean;
  classification?: ResidentClassification;
  customTags?: string[];
  notes?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}

export interface Household {
  id: string;
  organizationId?: string;
  householdCode: string; // e.g. HG-000001 / BH-0142
  headResidentId?: string;
  headResidentName: string;
  address: string;
  groupNumber: string;
  phone?: string;
  classification: 'Bình thường' | 'Hộ nghèo' | 'Cận nghèo' | 'Gia đình chính sách' | 'NORMAL' | 'POOR' | 'NEAR_POOR' | 'POLICY_FAMILY' | 'OTHER';
  customTags?: string[];
  notes?: string;
  memberCount?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export interface OrganizationSnapshot {
  name?: string;
  hamletName: string;
  communeName: string;
  districtName: string;
  provinceName: string;
  address: string;
  phone?: string;
  superiorAgencyName?: string;
}

export interface FinanceTransaction {
  id: string;
  organizationId?: string;
  transactionId?: string;
  voucherNumber: string; // e.g. PT-000001/2026 or PC-000001/2026
  voucherSequence?: number;
  voucherYear?: number;
  transactionType: TransactionType;
  transactionDate: string; // YYYY-MM-DD
  personName: string;
  address: string;
  groupNumber?: string;
  householdCode?: string;
  description: string;
  amount: number; // Integer VND
  amountInWords: string;
  categoryId: string;
  categoryName?: string;
  categoryNameSnapshot?: string;
  paymentMethod?: 'Tiền mặt tại Ấp' | 'Chuyển khoản QR';
  attachedDocumentCount?: number;
  attachedDocumentDescription?: string;
  attachments?: string[];
  preparedBy?: string;
  preparedByUid?: string;
  preparedByNameSnapshot?: string;
  approvedBy?: string;
  approvedByUid?: string;
  approvedByNameSnapshot?: string;
  approvedAt?: string;
  cancelledBy?: string;
  cancelledByUid?: string;
  cancelledByNameSnapshot?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  reconciliationCode: string; // e.g. PT-2026-8F3K7M2Q
  verificationHash?: string;
  organizationSnapshot?: OrganizationSnapshot;
  pdfTemplateVersion?: string;
  status: TransactionStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: TransactionType;
  suggestedAmount?: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export type CampaignStatus =
  | 'PREPARING'
  | 'DISTRIBUTING'
  | 'COMPLETED'
  | 'LOCKED'
  | 'DRAFT'
  | 'ACTIVE'
  | 'CANCELLED';

export interface GiftCampaign {
  id: string;
  campaignCode: string; // e.g. PQ-2025-01
  campaignName: string;
  distributionDate: string;
  sponsor: string;
  description?: string;
  giftType: string;
  giftValue?: number; // in VND
  unitValue?: number;
  totalBudget?: number;
  totalQuantity: number;
  totalBeneficiaries?: number;
  targetGroups?: string[]; // e.g. ['poor', 'near-poor', 'elderly', 'policy']
  targetCriteria?: string[];
  status: CampaignStatus;
  deliveredCount?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type DistributionStatus = 'PENDING' | 'RECEIVED' | 'DELIVERED';

export interface GiftRecipient {
  id: string;
  organizationId?: string;
  campaignId: string;
  campaignCode?: string;
  residentId?: string;
  residentName?: string;
  recipientNameSnapshot?: string;
  nationalIdMaskedSnapshot?: string;
  addressSnapshot?: string;
  classificationSnapshot?: string;
  householdId?: string;
  householdCode?: string;
  recipientName: string;
  nationalId?: string;
  address: string;
  groupNumber: string;
  targetGroupTag?: string; // e.g. 'Hộ nghèo', 'Cận nghèo'
  giftItemName?: string;
  quantity?: number;
  unitValue?: number;
  totalValue?: number;
  distributionStatus?: DistributionStatus;
  status?: 'PENDING' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED';
  phone?: string;
  isProxyAllowed?: boolean;
  receivedAt?: string;
  confirmedBy?: string;
  confirmedByUid?: string;
  confirmedByNameSnapshot?: string;
  receiverType?: 'Trực tiếp' | 'Người thân nhận thay';
  deliveryMethod?: 'Trực tiếp' | 'Người thân nhận thay';
  proxyName?: string;
  proxyNationalId?: string;
  photoUrl?: string;
  signatureData?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SignerConfig {
  roleTitle: string; // e.g. "TRƯỞNG ẤP"
  actionSubtitle: string; // e.g. "(Ký, duyệt)"
  name: string;
}

export interface VoucherSettings {
  incomePrefix: string; // "PT"
  expensePrefix: string; // "PC"
  currentYear: number; // 2026
  templateStandard: string; // "Quy chuẩn Mẫu C40-BB"
  superiorAgency: string; // "UBND XÃ AN NHƠN TÂY"
  agencyName: string; // "BAN ĐIỀU HÀNH ẤP BÌNH HÒA"
  footerNote?: string;
  signers: SignerConfig[];
}

export interface OrganizationSettings {
  id?: string;
  organizationId?: string;
  hamletName: string; // "Ấp Bình Hòa"
  communeName: string; // "Xã An Nhơn Tây"
  districtName?: string; // Tùy chọn (đã lược bỏ cấp huyện theo chuẩn mới)
  provinceName: string; // "TP. Hồ Chí Minh"
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  superiorAgencyName?: string;
  hamletLeaderName: string; // "Nguyễn Văn Hùng"
  financeOfficerName: string; // "Mai Thị Thúy"
  treasurerName: string; // "Trần Kim Ngân"
  locale?: string; // "vi-VN"
  currency?: string; // "VND"
  timezone?: string; // "Asia/Ho_Chi_Minh"
  voucherSettings: VoucherSettings;
  customClassificationTags?: string[];
  createdAt?: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface UserInvitation {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  invitedByUid: string;
  invitedByName: string;
  status: InvitationStatus;
  inviteToken: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface FinanceSettings {
  organizationId: string;
  incomePrefix: string; // "PT"
  expensePrefix: string; // "PC"
  voucherSequenceDigits: number; // 6
  showQRCode: boolean;
  showReconciliationCode: boolean;
  showAttachedDocuments: boolean;
  amountWordsSuffix: string; // "chẵn"
  pdfTemplateVersion: string;
  formNumberIncome: string; // "Mẫu C40-BB"
  formNumberExpense: string; // "Mẫu C41-BB"
  signatureColumns: number;
  signatureTitles: string[];
}

export interface SystemCounter {
  current: number;
  year?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'APPROVE'
  | 'CANCEL'
  | 'EXPORT'
  | 'EXPORT_PDF'
  | 'EXPORT_EXCEL'
  | 'BACKUP'
  | 'RESTORE'
  | 'ROLE_CHANGE'
  | 'ASSIGN_ROLE'
  | 'USER_DISABLE'
  | 'SETTINGS_CHANGE'
  | 'GIFT_RECEIVED'
  | 'GIFT_CANCELLED';

export type AuditModule =
  | 'AUTH'
  | 'RESIDENTS'
  | 'HOUSEHOLDS'
  | 'FINANCE'
  | 'GIFTS'
  | 'USERS'
  | 'ROLES'
  | 'SETTINGS'
  | 'BACKUP';

export interface AuditLog {
  id: string;
  organizationId?: string;
  timestamp: string;
  userId: string;
  userName: string;
  userNameSnapshot?: string;
  action: AuditAction;
  module: AuditModule;
  entityType: string;
  entityId: string;
  summary?: string;
  description: string;
  changedFields?: string[];
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export interface BackupMetadata {
  application: string; // "QUAN_LY_AP"
  appName?: string;
  schemaVersion: string; // "2.0.0"
  exportVersion: number;
  createdAt: string;
  createdByUid: string;
  createdBy?: string;
  organizationId?: string;
  organizationName?: string;
  organization?: {
    hamletName: string;
    communeName: string;
    districtName: string;
    provinceName: string;
  };
  checksum?: string;
}

export interface BackupCollections {
  organization?: Partial<OrganizationSettings>;
  roles: Role[];
  users: UserProfile[];
  households: Household[];
  residents: Resident[];
  financeCategories: FinanceCategory[];
  financeTransactions: FinanceTransaction[];
  giftCampaigns: GiftCampaign[];
  giftRecipients: GiftRecipient[];
  financeSettings?: Partial<FinanceSettings>;
  systemSettings?: Record<string, unknown>;
}

export interface BackupData {
  metadata: BackupMetadata;
  collections?: BackupCollections;
  data?: {
    residents: Resident[];
    households: Household[];
    financeTransactions: FinanceTransaction[];
    financeCategories: FinanceCategory[];
    giftCampaigns: GiftCampaign[];
    giftRecipients: GiftRecipient[];
    roles: Role[];
    organizationSettings: OrganizationSettings;
  };
}
