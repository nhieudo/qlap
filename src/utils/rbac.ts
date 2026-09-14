import { Role, PermissionCode } from '../types';

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  category: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Dân cư
  { code: 'residents.view', name: 'Xem danh sách & hồ sơ nhân khẩu', category: 'Dân cư' },
  { code: 'residents.viewSensitive', name: 'Xem dữ liệu nhạy cảm (Số CCCD đầy đủ)', category: 'Dân cư' },
  { code: 'residents.create', name: 'Đăng ký thêm nhân khẩu mới', category: 'Dân cư' },
  { code: 'residents.update', name: 'Sửa thông tin nhân khẩu', category: 'Dân cư' },
  { code: 'residents.archive', name: 'Lưu trữ / Xóa nhân khẩu', category: 'Dân cư' },
  { code: 'residents.export', name: 'Xuất danh sách nhân khẩu ra Excel/PDF', category: 'Dân cư' },

  // Hộ khẩu
  { code: 'households.view', name: 'Xem danh sách & thành viên hộ', category: 'Hộ khẩu' },
  { code: 'households.create', name: 'Tạo sổ hộ mới', category: 'Hộ khẩu' },
  { code: 'households.update', name: 'Cập nhật hộ / Chuyển chủ hộ / Chuyển khẩu', category: 'Hộ khẩu' },
  { code: 'households.archive', name: 'Lưu trữ sổ hộ', category: 'Hộ khẩu' },
  { code: 'households.export', name: 'Xuất danh sách sổ hộ ra Excel', category: 'Hộ khẩu' },

  // Tài chính
  { code: 'finance.view', name: 'Xem sổ quỹ thu chi', category: 'Tài chính' },
  { code: 'finance.create', name: 'Lập phiếu thu / phiếu chi mới', category: 'Tài chính' },
  { code: 'finance.updateDraft', name: 'Chỉnh sửa chứng từ bản nháp', category: 'Tài chính' },
  { code: 'finance.approve', name: 'Phê duyệt chứng từ thu / chi', category: 'Tài chính' },
  { code: 'finance.cancel', name: 'Hủy chứng từ (kèm lý do giải trình)', category: 'Tài chính' },
  { code: 'finance.export', name: 'Xuất sổ quỹ tiền mặt & in phiếu A4', category: 'Tài chính' },
  { code: 'finance.viewSensitive', name: 'Xem số dư chi tiết & báo cáo mật', category: 'Tài chính' },

  // Quà tặng an sinh
  { code: 'gifts.view', name: 'Xem các đợt phát quà an sinh', category: 'An sinh & Quà tặng' },
  { code: 'gifts.create', name: 'Tạo đợt phát quà mới', category: 'An sinh & Quà tặng' },
  { code: 'gifts.update', name: 'Cập nhật danh sách cử tri nhận quà', category: 'An sinh & Quà tặng' },
  { code: 'gifts.distribute', name: 'Xác nhận cấp phát & lấy chữ ký', category: 'An sinh & Quà tặng' },
  { code: 'gifts.lock', name: 'Khóa đợt phát quà sau khi hoàn tất', category: 'An sinh & Quà tặng' },
  { code: 'gifts.export', name: 'Xuất danh sách ký nhận nộp Xã', category: 'An sinh & Quà tặng' },

  // Báo cáo
  { code: 'reports.view', name: 'Xem các báo cáo tổng quan', category: 'Báo cáo' },
  { code: 'reports.viewResidents', name: 'Xem báo cáo thống kê dân cư', category: 'Báo cáo' },
  { code: 'reports.viewFinance', name: 'Xem báo cáo thu chi tài chính', category: 'Báo cáo' },
  { code: 'reports.viewGifts', name: 'Xem báo cáo phân bổ quà tặng', category: 'Báo cáo' },
  { code: 'reports.export', name: 'Xuất tệp báo cáo tổng hợp', category: 'Báo cáo' },

  // Người dùng & Phân quyền
  { code: 'users.view', name: 'Xem danh sách cán bộ ấp', category: 'Quản trị cán bộ' },
  { code: 'users.create', name: 'Thêm tài khoản cán bộ', category: 'Quản trị cán bộ' },
  { code: 'users.update', name: 'Chỉnh sửa tài khoản cán bộ', category: 'Quản trị cán bộ' },
  { code: 'users.assignRole', name: 'Phân quyền / Đổi vai trò cán bộ', category: 'Quản trị cán bộ' },
  { code: 'users.disable', name: 'Khóa / Vô hiệu hóa tài khoản', category: 'Quản trị cán bộ' },
  { code: 'users.permissions', name: 'Cấu hình ma trận phân quyền RBAC', category: 'Quản trị cán bộ' },

  // Vai trò (Roles)
  { code: 'roles.view', name: 'Xem danh sách vai trò hệ thống', category: 'Quản trị cán bộ' },
  { code: 'roles.create', name: 'Tạo vai trò tùy chỉnh mới', category: 'Quản trị cán bộ' },
  { code: 'roles.update', name: 'Cập nhật quyền hạn vai trò', category: 'Quản trị cán bộ' },

  // Cài đặt hệ thống
  { code: 'settings.view', name: 'Xem thông tin cơ sở & thiết lập', category: 'Cài đặt' },
  { code: 'settings.update', name: 'Cập nhật thông tin hành chính & mẫu biểu', category: 'Cài đặt' },

  // Sao lưu & Phục hồi
  { code: 'backup.create', name: 'Tải tệp sao lưu toàn hệ thống (JSON)', category: 'Sao lưu & Phục hồi' },
  { code: 'backup.restore', name: 'Phục hồi cơ sở dữ liệu từ tệp sao lưu', category: 'Sao lưu & Phục hồi' },

  // Nhật ký kiểm toán
  { code: 'audit.view', name: 'Xem nhật ký hoạt động & biến động', category: 'Nhật ký' },
];

export function createPermissionsMap(codes: PermissionCode[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  PERMISSION_DEFINITIONS.forEach(def => {
    map[def.code] = codes.includes(def.code);
  });
  return map;
}

const adminPermissions = PERMISSION_DEFINITIONS.map(p => p.code);

// Thư ký: Có quyền thêm/sửa/xóa giao dịch tài chính; các quyền khác chỉ xem (dân cư, quà, báo cáo); không có quyền admin
const secretaryPermissions: PermissionCode[] = [
  'finance.view',
  'finance.create',
  'finance.updateDraft',
  'finance.approve',
  'finance.cancel',
  'finance.export',
  'finance.viewSensitive',
  'residents.view',
  'households.view',
  'gifts.view',
  'reports.view',
  'reports.viewResidents',
  'reports.viewFinance',
  'reports.viewGifts',
  'reports.export',
  'settings.view',
];

// Người xem: Chỉ có quyền xem thông tin chung/cá nhân, KHÔNG có quyền xem dữ liệu dân cư, nhật ký hoạt động và chỉnh sửa phân quyền
const viewerPermissions: PermissionCode[] = [
  'settings.view',
];

export const ADMIN_ROLE_IDS = [
  'ADMIN',
  'PARTY_SECRETARY',
  'HAMLET_LEADER',
  'FRONT_COMMITTEE_LEADER',
];

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'PARTY_SECRETARY',
    code: 'PARTY_SECRETARY',
    name: 'Bí thư Chi bộ',
    description: 'Lãnh đạo toàn diện chi bộ, toàn quyền quản trị và điều hành cấp cơ sở (Admin).',
    isSystem: true,
    isSystemRole: true,
    permissions: adminPermissions,
    permissionsMap: createPermissionsMap(adminPermissions),
  },
  {
    id: 'HAMLET_LEADER',
    code: 'HAMLET_LEADER',
    name: 'Trưởng ấp',
    description: 'Chỉ huy Ban điều hành ấp, duyệt chứng từ, quản lý toàn diện (Admin).',
    isSystem: true,
    isSystemRole: true,
    permissions: adminPermissions,
    permissionsMap: createPermissionsMap(adminPermissions),
  },
  {
    id: 'FRONT_COMMITTEE_LEADER',
    code: 'FRONT_COMMITTEE_LEADER',
    name: 'Trưởng Ban CT Mặt trận',
    description: 'Trưởng ban Công tác Mặt trận, giám sát dân chủ và toàn quyền quản trị (Admin).',
    isSystem: true,
    isSystemRole: true,
    permissions: adminPermissions,
    permissionsMap: createPermissionsMap(adminPermissions),
  },
  {
    id: 'SECRETARY',
    code: 'SECRETARY',
    name: 'Thư ký',
    description: 'Toàn quyền lập, sửa, xóa, duyệt giao dịch tài chính thu/chi; các phần khác chỉ xem.',
    isSystem: true,
    isSystemRole: true,
    permissions: secretaryPermissions,
    permissionsMap: createPermissionsMap(secretaryPermissions),
  },
  {
    id: 'VIEWER',
    code: 'VIEWER',
    name: 'Người xem',
    description: 'Chỉ có quyền xem thông tin cá nhân và cài đặt đơn vị; không được xem dữ liệu dân cư hay nhật ký.',
    isSystem: true,
    isSystemRole: true,
    permissions: viewerPermissions,
    permissionsMap: createPermissionsMap(viewerPermissions),
  },
  {
    id: 'ADMIN',
    code: 'ADMIN',
    name: 'Quản trị viên Hệ thống',
    description: 'Quản trị kỹ thuật, toàn quyền phân quyền, cấu hình và sao lưu phục hồi hệ thống.',
    isSystem: true,
    isSystemRole: true,
    permissions: adminPermissions,
    permissionsMap: createPermissionsMap(adminPermissions),
  },
];

export function hasPermission(
  userPermissions: PermissionCode[] | Record<string, boolean> | undefined,
  requiredPermission: PermissionCode
): boolean {
  if (!userPermissions) return false;
  if (Array.isArray(userPermissions)) {
    return userPermissions.includes(requiredPermission);
  }
  return !!userPermissions[requiredPermission];
}

export interface GrassrootsPosition {
  title: string;
  defaultRoleId: string;
  description: string;
  category: string;
}

export const GRASSROOTS_POSITIONS: GrassrootsPosition[] = [
  {
    title: 'Bí thư Chi bộ',
    defaultRoleId: 'PARTY_SECRETARY',
    description: 'Lãnh đạo toàn diện Chi bộ ấp, toàn quyền quản trị và chỉ đạo điều hành cơ sở',
    category: 'Cấp ủy & Lãnh đạo',
  },
  {
    title: 'Phó Bí thư Chi bộ',
    defaultRoleId: 'PARTY_SECRETARY',
    description: 'Phụ trách công tác Đảng và phối hợp chỉ đạo toàn diện ban cán sự ấp',
    category: 'Cấp ủy & Lãnh đạo',
  },
  {
    title: 'Trưởng ấp',
    defaultRoleId: 'HAMLET_LEADER',
    description: 'Chỉ huy Ban điều hành ấp, đại diện pháp lý cơ sở, phê duyệt thu/chi và hồ sơ',
    category: 'Ban Điều hành Ấp',
  },
  {
    title: 'Phó Trưởng ấp',
    defaultRoleId: 'HAMLET_LEADER',
    description: 'Phó Ban điều hành ấp, phụ trách quản lý dân cư, địa bàn và các phong trào',
    category: 'Ban Điều hành Ấp',
  },
  {
    title: 'Trưởng Ban Công tác Mặt trận',
    defaultRoleId: 'FRONT_COMMITTEE_LEADER',
    description: 'Trưởng ban CTMT ấp, giám sát dân chủ, an sinh xã hội và phong trào đoàn kết',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Thư ký / Kế toán ấp',
    defaultRoleId: 'SECRETARY',
    description: 'Thực hiện sổ sách, lập phiếu thu, phiếu chi, quản lý các quỹ an sinh tài chính',
    category: 'Tài chính & Nghiệp vụ',
  },
  {
    title: 'Thủ quỹ ấp',
    defaultRoleId: 'SECRETARY',
    description: 'Giữ quỹ tiền mặt, xuất nhập quỹ theo chứng từ thu chi đã được phê duyệt',
    category: 'Tài chính & Nghiệp vụ',
  },
  {
    title: 'Công an viên phụ trách ấp',
    defaultRoleId: 'HAMLET_LEADER',
    description: 'Phụ trách an ninh trật tự, quản lý cư trú, tạm trú, tạm vắng nhân khẩu',
    category: 'An ninh & Trật tự',
  },
  {
    title: 'Thôn đội trưởng / Dân quân ấp',
    defaultRoleId: 'SECRETARY',
    description: 'Quân sự địa phương, hỗ trợ trật tự cơ sở và điều động dân quân cơ sở',
    category: 'An ninh & Trật tự',
  },
  {
    title: 'Chi hội trưởng Phụ nữ',
    defaultRoleId: 'SECRETARY',
    description: 'Phụ trách công tác phụ nữ, an sinh gia đình và các đợt phát quà cứu trợ',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Bí thư Chi đoàn Thanh niên',
    defaultRoleId: 'SECRETARY',
    description: 'Phụ trách phong trào đoàn thanh niên, chuyển đổi số và hoạt động cộng đồng',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Chi hội trưởng Nông dân',
    defaultRoleId: 'SECRETARY',
    description: 'Phụ trách công tác nông dân, sản xuất nông nghiệp và đời sống hội viên',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Chi hội trưởng Cựu chiến binh',
    defaultRoleId: 'SECRETARY',
    description: 'Phụ trách phong trào cựu chiến binh và các hoạt động đền ơn đáp nghĩa',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Chi hội trưởng Người cao tuổi',
    defaultRoleId: 'SECRETARY',
    description: 'Phụ trách công tác hội viên người cao tuổi, trợ cấp và chăm lo người già',
    category: 'Mặt trận & Đoàn thể',
  },
  {
    title: 'Tổ trưởng Tổ nhân dân tự quản',
    defaultRoleId: 'SECRETARY',
    description: 'Quản lý nắm bắt trực tiếp hộ khẩu và đời sống cư dân thuộc địa bàn tổ',
    category: 'Tổ dân cư',
  },
  {
    title: 'Cán bộ Y tế / Dân số ấp',
    defaultRoleId: 'VIEWER',
    description: 'Chăm sóc y tế cơ sở ban đầu, quản lý thông tin dân số và kế hoạch hóa gia đình',
    category: 'Y tế & Xã hội',
  },
  {
    title: 'Quản trị viên Hệ thống',
    defaultRoleId: 'ADMIN',
    description: 'Quản trị kỹ thuật, toàn quyền phân quyền người dùng và sao lưu cơ sở dữ liệu',
    category: 'Quản trị Kỹ thuật',
  },
  {
    title: 'Cán bộ giám sát / Người xem',
    defaultRoleId: 'VIEWER',
    description: 'Quyền xem cơ bản thông tin công khai và cá nhân; không chỉnh sửa dữ liệu nhạy cảm',
    category: 'Khác',
  },
];

export function getDefaultRoleIdForPosition(position: string): string {
  if (!position) return 'VIEWER';
  const posClean = position.trim().toLowerCase();
  
  if (posClean.includes('bí thư')) return 'PARTY_SECRETARY';
  if (posClean.includes('trưởng ấp') || posClean.includes('trưởng thôn') || posClean.includes('phó trưởng ấp')) return 'HAMLET_LEADER';
  if (posClean.includes('mặt trận')) return 'FRONT_COMMITTEE_LEADER';
  if (posClean.includes('kế toán') || posClean.includes('thư ký') || posClean.includes('thủ quỹ')) return 'SECRETARY';
  if (posClean.includes('công an')) return 'HAMLET_LEADER';
  if (posClean.includes('quản trị') || posClean.includes('admin')) return 'ADMIN';
  if (posClean.includes('hội') || posClean.includes('chi đoàn') || posClean.includes('tổ trưởng') || posClean.includes('dân quân')) return 'SECRETARY';
  
  const exact = GRASSROOTS_POSITIONS.find((p) => p.title.toLowerCase() === posClean);
  if (exact) return exact.defaultRoleId;
  
  return 'SECRETARY';
}

