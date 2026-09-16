import * as XLSX from 'xlsx';
import {
  Resident,
  GiftRecipient,
  FinanceTransaction,
  Household,
  FinanceCategory,
  GiftCampaign,
  OrganizationSettings,
} from '../types';
import { formatDateVN } from './numberToWords';

/**
 * Xuất danh sách dân cư ra file Excel .xlsx
 */
export function exportResidentsToExcel(residents: Resident[], filename = 'Danh_sach_dan_cu_Ap_Binh_Hoa.xlsx') {
  const data = residents.map((r, index) => ({
    'STT': index + 1,
    'Mã nhân khẩu': r.residentCode,
    'Mã hộ': r.householdCode || '',
    'Họ và tên': r.fullName,
    'Ngày sinh': formatDateVN(r.dateOfBirth),
    'Giới tính': r.gender,
    'Số CCCD': r.nationalId,
    'Điện thoại': r.phone || '',
    'Quan hệ chủ hộ': r.relationshipToHead || '',
    'Tổ dân cư': r.groupNumber,
    'Địa chỉ': r.address,
    'Tình trạng cư trú': r.residenceStatus,
    'Hộ nghèo': r.isPoorHousehold ? 'Có' : 'Không',
    'Hộ cận nghèo': r.isNearPoorHousehold ? 'Có' : 'Không',
    'Chính sách/Người có công': r.isPolicyBeneficiary ? 'Có' : 'Không',
    'Người cao tuổi (≥60)': r.isElderly ? 'Có' : 'Không',
    'Trẻ em (<16)': r.isChild ? 'Có' : 'Không',
    'Người khuyết tật': r.isDisabled ? 'Có' : 'Không',
    'Ghi chú': r.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 15 }, // Mã NK
    { wch: 12 }, // Mã hộ
    { wch: 25 }, // Họ tên
    { wch: 12 }, // Ngày sinh
    { wch: 10 }, // Giới tính
    { wch: 16 }, // CCCD
    { wch: 14 }, // Điện thoại
    { wch: 16 }, // Quan hệ
    { wch: 10 }, // Tổ
    { wch: 30 }, // Địa chỉ
    { wch: 14 }, // Tình trạng
    { wch: 10 }, // Nghèo
    { wch: 12 }, // Cận nghèo
    { wch: 16 }, // Chính sách
    { wch: 14 }, // Cao tuổi
    { wch: 12 }, // Trẻ em
    { wch: 14 }, // Khuyết tật
    { wch: 20 }, // Ghi chú
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Dân Cư');
  XLSX.writeFile(workbook, filename);
}

/**
 * Xuất danh sách cấp phát quà ra file Excel .xlsx chuẩn biểu mẫu hành chính
 * STT, Mã hộ, Mã nhân khẩu, Họ và tên, CCCD, Địa chỉ, Đối tượng, Tên đợt, Loại quà, Số lượng, Giá trị, Trạng thái, Ngày nhận
 */
export function exportGiftRecipientsToExcel(
  recipients: GiftRecipient[],
  campaignName: string,
  filename = 'Danh_sach_phat_qua.xlsx'
) {
  const data = recipients.map((r, index) => ({
    'STT': index + 1,
    'Mã hộ': r.householdCode || '',
    'Mã nhân khẩu': r.residentId || '',
    'Họ và tên': r.recipientName,
    'CCCD': r.nationalId || '',
    'Địa chỉ': r.address,
    'Đối tượng': r.targetGroupTag || 'Diện thụ hưởng',
    'Tên đợt': campaignName,
    'Loại quà': 'Túi quà an sinh',
    'Số lượng': r.quantity,
    'Giá trị (VNĐ)': r.totalValue, // Numeric cell for financial aggregation
    'Trạng thái': r.distributionStatus === 'RECEIVED' ? 'Đã nhận' : 'Chưa nhận',
    'Ngày nhận': r.receivedAt ? formatDateVN(r.receivedAt) : '',
    'Người ký/nhận thay': r.receiverType === 'Người thân nhận thay' ? `Ủy quyền: ${r.proxyName || ''}` : 'Trực tiếp',
    'Cán bộ đối soát': r.confirmedBy || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Mã hộ
    { wch: 14 }, // Mã NK
    { wch: 25 }, // Họ và tên
    { wch: 16 }, // CCCD
    { wch: 30 }, // Địa chỉ
    { wch: 18 }, // Đối tượng
    { wch: 30 }, // Tên đợt
    { wch: 18 }, // Loại quà
    { wch: 10 }, // Số lượng
    { wch: 16 }, // Giá trị
    { wch: 14 }, // Trạng thái
    { wch: 14 }, // Ngày nhận
    { wch: 22 }, // Ký nhận
    { wch: 20 }, // Cán bộ
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DS Ký Nhận Quà');
  const safeFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeFilename);
}

/**
 * Xuất sổ quỹ tài chính (Phiếu thu & Phiếu chi)
 */
export function exportFinanceToExcel(
  transactions: FinanceTransaction[],
  filename = 'So_quy_tai_chinh_Ap.xlsx'
) {
  const data = transactions.map((t, index) => ({
    'STT': index + 1,
    'Số chứng từ': t.voucherNumber,
    'Mã đối soát': t.reconciliationCode,
    'Loại chứng từ': t.transactionType === 'INCOME' ? 'Phiếu Thu' : 'Phiếu Chi',
    'Ngày chứng từ': formatDateVN(t.transactionDate),
    'Họ tên người nộp/nhận': t.personName,
    'Địa chỉ': t.address,
    'Tổ dân cư': t.groupNumber || '',
    'Hạng mục quỹ': t.categoryName,
    'Nội dung / Diễn giải': t.description,
    'Số tiền Thu (VNĐ)': t.transactionType === 'INCOME' ? t.amount : 0,
    'Số tiền Chi (VNĐ)': t.transactionType === 'EXPENSE' ? t.amount : 0,
    'Hình thức': t.paymentMethod,
    'Trạng thái': t.status === 'APPROVED' ? 'Đã duyệt' : t.status === 'DRAFT' ? 'Bản nháp' : 'Đã hủy',
    'Người lập': t.preparedBy,
    'Người duyệt': t.approvedBy || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // Số chứng từ
    { wch: 20 }, // Mã đối soát
    { wch: 14 }, // Loại
    { wch: 14 }, // Ngày
    { wch: 24 }, // Họ tên
    { wch: 28 }, // Địa chỉ
    { wch: 10 }, // Tổ
    { wch: 26 }, // Hạng mục
    { wch: 35 }, // Diễn giải
    { wch: 18 }, // Thu
    { wch: 18 }, // Chi
    { wch: 18 }, // Hình thức
    { wch: 12 }, // Trạng thái
    { wch: 18 }, // Người lập
    { wch: 18 }, // Người duyệt
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sổ Quỹ Tiền Mặt');
  XLSX.writeFile(workbook, filename);
}

/**
 * Xuất danh sách sổ hộ gia đình ra file Excel .xlsx
 */
export function exportHouseholdsToExcel(
  households: Household[],
  filename = 'Danh_sach_so_ho_gia_dinh.xlsx'
) {
  const data = households.map((h, index) => ({
    'STT': index + 1,
    'Mã hộ gia đình': h.householdCode,
    'Họ tên chủ hộ': h.headResidentName,
    'Điện thoại': h.phone || '',
    'Tổ dân cư': h.groupNumber || '',
    'Địa chỉ': h.address,
    'Phân loại hộ': h.classification || 'Bình thường',
    'Số lượng thành viên': h.memberCount || 0,
    'Ghi chú': h.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 25 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 32 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sổ Hộ Gia Đình');
  XLSX.writeFile(workbook, filename);
}

export interface ComprehensiveReportData {
  residents: Resident[];
  households: Household[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  campaigns: GiftCampaign[];
  settings?: OrganizationSettings;
}

/**
 * Xuất báo cáo tổng hợp từ trước đến nay (All-in-One Multi-sheet Excel)
 */
export function exportComprehensiveAllTimeReportToExcel(
  data: ComprehensiveReportData,
  filename?: string
) {
  const { residents, households, transactions, categories, campaigns, settings } = data;
  const hamlet = settings?.hamletName || 'Ấp Bình Hòa';
  const commune = settings?.communeName || 'Xã An Nhơn Tây';

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const outFilename =
    filename ||
    `Bao_cao_tong_hop_toan_bo_${hamlet.replace(/\s+/g, '_')}_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.xlsx`;

  const workbook = XLSX.utils.book_new();

  // 1. SHEET TỔNG HỢP TOÀN BỘ (Executive Summary)
  const approvedTx = transactions.filter((t) => t.status === 'APPROVED');
  const totalIncome = approvedTx
    .filter((t) => t.transactionType === 'INCOME')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = approvedTx
    .filter((t) => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  const totalPop = residents.length;
  const poorCount = residents.filter((r) => r.isPoorHousehold).length;
  const nearPoorCount = residents.filter((r) => r.isNearPoorHousehold).length;
  const policyCount = residents.filter((r) => r.isPolicyBeneficiary).length;
  const elderlyCount = residents.filter((r) => r.isElderly).length;
  const childCount = residents.filter((r) => r.isChild).length;
  const disabledCount = residents.filter((r) => r.isDisabled).length;

  const totalGifts = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
  const totalGiftBudget = campaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);

  const summarySheetData = [
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': 'ĐƠN VỊ HÀNH CHÍNH', 'GIÁ TRỊ': `${hamlet}, ${commune}`, 'ĐƠN VỊ TÍNH': 'Ấp/Khu phố', 'GHI CHÚ': `Thời điểm xuất: ${dateStr}` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': 'PHÂN HỆ 1: DÂN CƯ & HỘ KHẨU', 'GIÁ TRỊ': '', 'ĐƠN VỊ TÍNH': '', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.1. Tổng số nhân khẩu', 'GIÁ TRỊ': totalPop, 'ĐƠN VỊ TÍNH': 'Người', 'GHI CHÚ': `Nam: ${residents.filter(r => r.gender === 'Nam').length}, Nữ: ${residents.filter(r => r.gender === 'Nữ').length}` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.2. Tổng số sổ hộ gia đình', 'GIÁ TRỊ': households.length, 'ĐƠN VỊ TÍNH': 'Hộ', 'GHI CHÚ': 'Có mã quản lý sổ hộ điện tử' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.3. Số hộ nghèo', 'GIÁ TRỊ': households.filter(h => h.classification === 'Hộ nghèo').length, 'ĐƠN VỊ TÍNH': 'Hộ', 'GHI CHÚ': `${poorCount} nhân khẩu thuộc hộ nghèo` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.4. Số hộ cận nghèo', 'GIÁ TRỊ': households.filter(h => h.classification === 'Cận nghèo').length, 'ĐƠN VỊ TÍNH': 'Hộ', 'GHI CHÚ': `${nearPoorCount} nhân khẩu thuộc hộ cận nghèo` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.5. Gia đình chính sách / Có công', 'GIÁ TRỊ': households.filter(h => h.classification === 'Gia đình chính sách').length, 'ĐƠN VỊ TÍNH': 'Hộ', 'GHI CHÚ': `${policyCount} nhân khẩu diện chính sách` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.6. Người cao tuổi (≥60 tuổi)', 'GIÁ TRỊ': elderlyCount, 'ĐƠN VỊ TÍNH': 'Người', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.7. Trẻ em (<16 tuổi)', 'GIÁ TRỊ': childCount, 'ĐƠN VỊ TÍNH': 'Người', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '1.8. Người khuyết tật', 'GIÁ TRỊ': disabledCount, 'ĐƠN VỊ TÍNH': 'Người', 'GHI CHÚ': 'Được hưởng bảo trợ xã hội' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': 'PHÂN HỆ 2: TÀI CHÍNH & NGÂN SÁCH ẤP', 'GIÁ TRỊ': '', 'ĐƠN VỊ TÍNH': '', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '2.1. Tổng số thu lũy kế (Từ trước đến nay)', 'GIÁ TRỊ': totalIncome, 'ĐƠN VỊ TÍNH': 'VNĐ', 'GHI CHÚ': `${approvedTx.filter(t => t.transactionType === 'INCOME').length} chứng từ thu đã duyệt` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '2.2. Tổng số chi lũy kế (Từ trước đến nay)', 'GIÁ TRỊ': totalExpense, 'ĐƠN VỊ TÍNH': 'VNĐ', 'GHI CHÚ': `${approvedTx.filter(t => t.transactionType === 'EXPENSE').length} chứng từ chi đã duyệt` },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '2.3. Tồn quỹ tiền mặt thực tế hiện tại', 'GIÁ TRỊ': balance, 'ĐƠN VỊ TÍNH': 'VNĐ', 'GHI CHÚ': 'Số dư chênh lệch thu - chi' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '2.4. Tổng số chứng từ bản nháp chờ duyệt', 'GIÁ TRỊ': transactions.filter(t => t.status === 'DRAFT').length, 'ĐƠN VỊ TÍNH': 'Chứng từ', 'GHI CHÚ': 'Cần phê duyệt hoàn tất' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': 'PHÂN HỆ 3: AN SINH XÃ HỘI & PHÁT QUÀ', 'GIÁ TRỊ': '', 'ĐƠN VỊ TÍNH': '', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '3.1. Tổng số đợt phát quà an sinh đã triển khai', 'GIÁ TRỊ': campaigns.length, 'ĐƠN VỊ TÍNH': 'Đợt', 'GHI CHÚ': '' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '3.2. Tổng số suất quà đã trao tận tay cử tri', 'GIÁ TRỊ': totalGifts, 'ĐƠN VỊ TÍNH': 'Suất', 'GHI CHÚ': 'Có chữ ký hoặc xác nhận nhận thay' },
    { 'CHỈ SỐ THỐNG KÊ TOÀN DIỆN': '3.3. Tổng kinh phí an sinh xã hội đã giải ngân', 'GIÁ TRỊ': totalGiftBudget, 'ĐƠN VỊ TÍNH': 'VNĐ', 'GHI CHÚ': 'Nguồn vận động tài trợ & quỹ ấp' },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 26 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Tổng Hợp Toàn Bộ');

  // 2. SHEET SỔ QUỸ THU CHI LŨY KẾ
  let runningBalance = 0;
  const sortedTx = [...approvedTx].sort((a, b) =>
    (a.transactionDate || '').localeCompare(b.transactionDate || '')
  );
  const txSheetData = sortedTx.map((t, idx) => {
    const isInc = t.transactionType === 'INCOME';
    const incAmount = isInc ? t.amount : 0;
    const expAmount = !isInc ? t.amount : 0;
    runningBalance += incAmount - expAmount;

    return {
      'STT': idx + 1,
      'Số chứng từ': t.voucherNumber,
      'Mã đối soát': t.reconciliationCode,
      'Loại': isInc ? 'Phiếu Thu' : 'Phiếu Chi',
      'Ngày chứng từ': formatDateVN(t.transactionDate),
      'Họ tên người nộp/nhận': t.personName,
      'Địa chỉ': t.address,
      'Tổ dân cư': t.groupNumber || '',
      'Hạng mục quỹ': t.categoryName,
      'Nội dung diễn giải': t.description,
      'Số tiền Thu (VNĐ)': incAmount,
      'Số tiền Chi (VNĐ)': expAmount,
      'Số dư lũy kế (VNĐ)': runningBalance,
      'Hình thức': t.paymentMethod || 'Tiền mặt',
      'Người lập': t.preparedBy,
      'Người duyệt': t.approvedBy || '',
    };
  });

  const wsTx = XLSX.utils.json_to_sheet(txSheetData);
  wsTx['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 10 },
    { wch: 24 },
    { wch: 35 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsTx, 'Sổ Quỹ Lũy Kế');

  // 3. SHEET THU CHI THEO HẠNG MỤC QUỸ
  const catMap = new Map<string, { income: number; expense: number; txCount: number }>();
  approvedTx.forEach((tx) => {
    const cName = tx.categoryName || 'Khoản thu chi chung';
    if (!catMap.has(cName)) {
      catMap.set(cName, { income: 0, expense: 0, txCount: 0 });
    }
    const cur = catMap.get(cName)!;
    cur.txCount++;
    if (tx.transactionType === 'INCOME') cur.income += tx.amount;
    else cur.expense += tx.amount;
  });

  const catSheetData = Array.from(catMap.entries()).map(([cName, stats], idx) => ({
    'STT': idx + 1,
    'Hạng mục quỹ thu chi': cName,
    'Tổng thu (VNĐ)': stats.income,
    'Tổng chi (VNĐ)': stats.expense,
    'Chênh lệch Net (VNĐ)': stats.income - stats.expense,
    'Số chứng từ phát sinh': stats.txCount,
  }));

  const wsCat = XLSX.utils.json_to_sheet(catSheetData);
  wsCat['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCat, 'Thu Chi Theo Quỹ');

  // 4. SHEET DÂN CƯ TOÀN BỘ
  const residentSheetData = residents.map((r, idx) => ({
    'STT': idx + 1,
    'Mã nhân khẩu': r.residentCode,
    'Mã hộ': r.householdCode || '',
    'Họ và tên': r.fullName,
    'Ngày sinh': formatDateVN(r.dateOfBirth),
    'Giới tính': r.gender,
    'Số CCCD': r.nationalId,
    'Điện thoại': r.phone || '',
    'Quan hệ chủ hộ': r.relationshipToHead || '',
    'Tổ dân cư': r.groupNumber,
    'Địa chỉ': r.address,
    'Hộ nghèo': r.isPoorHousehold ? 'X' : '',
    'Cận nghèo': r.isNearPoorHousehold ? 'X' : '',
    'Chính sách': r.isPolicyBeneficiary ? 'X' : '',
    'Cao tuổi': r.isElderly ? 'X' : '',
    'Trẻ em': r.isChild ? 'X' : '',
    'Khuyết tật': r.isDisabled ? 'X' : '',
  }));
  const wsRes = XLSX.utils.json_to_sheet(residentSheetData);
  wsRes['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsRes, 'Danh Sách Dân Cư');

  // 5. SHEET SỔ HỘ GIA ĐÌNH
  const hhSheetData = households.map((h, idx) => ({
    'STT': idx + 1,
    'Mã hộ gia đình': h.householdCode,
    'Họ tên chủ hộ': h.headResidentName,
    'Điện thoại': h.phone || '',
    'Tổ dân cư': h.groupNumber || '',
    'Địa chỉ cư trú': h.address,
    'Phân loại hộ': h.classification || 'Bình thường',
    'Số nhân khẩu': h.memberCount || 0,
    'Ghi chú sổ hộ': h.notes || '',
  }));
  const wsHh = XLSX.utils.json_to_sheet(hhSheetData);
  wsHh['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsHh, 'Sổ Hộ Gia Đình');

  // 6. SHEET CÁC ĐỢT PHÁT QUÀ AN SINH
  const campSheetData = campaigns.map((c, idx) => ({
    'STT': idx + 1,
    'Mã đợt': c.campaignCode,
    'Tên chiến dịch quà tặng': c.campaignName,
    'Ngày phát quà': formatDateVN(c.distributionDate),
    'Đối tượng hưởng': (c.targetGroups || []).join(', ') || 'Diện thụ hưởng',
    'Nhà tài trợ': c.sponsor || '',
    'Tổng ngân sách (VNĐ)': c.totalBudget || 0,
    'Tổng suất quà': c.totalQuantity || c.totalBeneficiaries || 0,
    'Đã trao tận tay': c.deliveredCount || 0,
    'Trạng thái':
      c.status === 'COMPLETED'
        ? 'Hoàn tất'
        : c.status === 'ACTIVE' || c.status === 'DISTRIBUTING'
        ? 'Đang phát'
        : 'Kế hoạch',
  }));
  const wsCamp = XLSX.utils.json_to_sheet(campSheetData);
  wsCamp['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCamp, 'An Sinh & Quà Tặng');

  // Ghi file Excel
  XLSX.writeFile(workbook, outFilename);
}
