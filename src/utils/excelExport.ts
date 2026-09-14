import * as XLSX from 'xlsx';
import { Resident, GiftRecipient, FinanceTransaction } from '../types';
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
