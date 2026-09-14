import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { db, logAuditEvent, getNextAtomicCounter, sanitizeForFirestore } from '../services/db';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Resident, ResidenceStatus } from '../types';

interface ImportResidentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableGroups: string[];
}

interface ParsedResidentRow {
  fullName: string;
  nationalId: string;
  dateOfBirth?: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  phone?: string;
  address: string;
  groupNumber: string;
  residenceStatus: ResidenceStatus;
  notes?: string;
  classificationTag?: string;
  isValid: boolean;
  error?: string;
}

export function ImportResidentsModal({
  isOpen,
  onClose,
  onSuccess,
  availableGroups,
}: ImportResidentsModalProps) {
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedResidentRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [defaultGroup, setDefaultGroup] = useState<string>('');

  if (!isOpen) return null;

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Họ và tên (*)': 'Nguyễn Văn An',
        'Số CCCD/CMND': '079085001234',
        'Ngày sinh (YYYY-MM-DD)': '1985-05-20',
        'Giới tính (Nam/Nữ)': 'Nam',
        'Số điện thoại': '0908123456',
        'Địa chỉ / Số nhà (*)': 'Số 12, Đường Bình Hòa',
        'Tổ dân cư (*)': 'Tổ 1',
        'Loại cư trú (Thường trú/Tạm trú/Lưu trú)': 'Thường trú',
        'Diện chính sách/Hộ nghèo': 'Hộ nghèo',
        'Ghi chú': 'Chủ hộ',
      },
      {
        'Họ và tên (*)': 'Trần Thị Bích',
        'Số CCCD/CMND': '079188002345',
        'Ngày sinh (YYYY-MM-DD)': '1988-11-14',
        'Giới tính (Nam/Nữ)': 'Nữ',
        'Số điện thoại': '0918765432',
        'Địa chỉ / Số nhà (*)': 'Số 15/2, Đường Cây Bài',
        'Tổ dân cư (*)': 'Tổ 3',
        'Loại cư trú (Thường trú/Tạm trú/Lưu trú)': 'Thường trú',
        'Diện chính sách/Hộ nghèo': '',
        'Ghi chú': '',
      },
      {
        'Họ và tên (*)': 'Lê Minh Tuấn',
        'Số CCCD/CMND': '',
        'Ngày sinh (YYYY-MM-DD)': '2010-02-18',
        'Giới tính (Nam/Nữ)': 'Nam',
        'Số điện thoại': '',
        'Địa chỉ / Số nhà (*)': 'Số 28, Hương Lộ 2',
        'Tổ dân cư (*)': 'Tổ Tự Quản 2',
        'Loại cư trú (Thường trú/Tạm trú/Lưu trú)': 'Tạm trú',
        'Diện chính sách/Hộ nghèo': 'Trẻ em',
        'Ghi chú': 'Học sinh',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Nhan_Khau');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Nhan_Khau_Ap.xlsx');
  };

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawJson || rawJson.length === 0) {
          setErrorMsg('Tệp tải lên không có dữ liệu.');
          return;
        }

        const rows: ParsedResidentRow[] = rawJson.map((item, index) => {
          const fullName = String(
            item['Họ và tên (*)'] || item['Họ và tên'] || item['Họ tên'] || item['fullName'] || ''
          ).trim();
          const address = String(
            item['Địa chỉ / Số nhà (*)'] || item['Địa chỉ'] || item['Số nhà'] || item['address'] || ''
          ).trim();
          let groupNumber = String(
            item['Tổ dân cư (*)'] || item['Tổ dân cư'] || item['Tổ'] || item['groupNumber'] || defaultGroup || 'Tổ 1'
          ).trim();
          const nationalId = String(item['Số CCCD/CMND'] || item['CCCD'] || item['CMND'] || item['nationalId'] || '').trim();
          const dateOfBirth = String(item['Ngày sinh (YYYY-MM-DD)'] || item['Ngày sinh'] || item['dateOfBirth'] || '').trim();
          const rawGender = String(item['Giới tính (Nam/Nữ)'] || item['Giới tính'] || item['gender'] || 'Nam').trim();
          const gender = rawGender.toLowerCase().includes('nữ') ? 'Nữ' : rawGender.toLowerCase().includes('khác') ? 'Khác' : 'Nam';
          const phone = String(item['Số điện thoại'] || item['SĐT'] || item['phone'] || '').trim();

          let residenceStatus: ResidenceStatus = 'PERMANENT';
          const rawStatus = String(item['Loại cư trú (Thường trú/Tạm trú/Lưu trú)'] || item['Loại cư trú'] || '').toLowerCase();
          if (rawStatus.includes('tạm')) residenceStatus = 'TEMPORARY';
          else if (rawStatus.includes('lưu')) residenceStatus = 'STAY';
          else if (rawStatus.includes('vắng')) residenceStatus = 'ABSENT';

          const classificationTag = String(item['Diện chính sách/Hộ nghèo'] || item['Diện'] || '').trim();
          const notes = String(item['Ghi chú'] || item['notes'] || '').trim();

          let isValid = true;
          let error = '';

          if (!fullName) {
            isValid = false;
            error = 'Thiếu họ và tên';
          } else if (!address) {
            isValid = false;
            error = 'Thiếu địa chỉ / số nhà';
          }

          return {
            fullName,
            nationalId,
            dateOfBirth,
            gender,
            phone,
            address,
            groupNumber,
            residenceStatus,
            classificationTag,
            notes,
            isValid,
            error,
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng tệp.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Execute Batch Import
  const handleImportSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('Không có dòng dữ liệu hợp lệ nào để nhập.');
      return;
    }

    setImporting(true);
    setErrorMsg(null);

    try {
      const year = new Date().getFullYear();
      let startSeq = await getNextAtomicCounter(`resident_${year}`);
      const now = new Date().toISOString();
      const currentUserId = user?.uid || 'system';
      const currentUserName = userProfile?.fullName || 'Cán bộ';

      const batch = writeBatch(db);

      validRows.forEach((row, i) => {
        const residentCode = `NK-${year}-${String(startSeq + i).padStart(5, '0')}`;
        const newRef = doc(collection(db, 'residents'));

        const newResident: Partial<Resident> = {
          id: newRef.id,
          residentCode,
          fullName: row.fullName,
          nationalId: row.nationalId,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          phone: row.phone,
          address: row.address,
          groupNumber: row.groupNumber || defaultGroup || 'Tổ 1',
          residenceStatus: row.residenceStatus,
          status: 'ACTIVE',
          relationshipWithHead: 'Thành viên',
          notes: row.notes,
          classification: {
            isPoorHousehold: row.classificationTag?.toLowerCase().includes('nghèo') || false,
            isNearPoorHousehold: row.classificationTag?.toLowerCase().includes('cận nghèo') || false,
            isPolicyBeneficiary: row.classificationTag?.toLowerCase().includes('chính sách') || false,
            isElderly: row.classificationTag?.toLowerCase().includes('cao tuổi') || false,
            isChild: row.classificationTag?.toLowerCase().includes('trẻ') || false,
            isDisabled: row.classificationTag?.toLowerCase().includes('khuyết tật') || false,
            isSocialAssistanceRecipient: false,
          },
          createdAt: now,
          createdBy: currentUserName,
          updatedAt: now,
          updatedBy: currentUserName,
        };

        batch.set(newRef, sanitizeForFirestore(newResident));
      });

      await batch.commit();

      await logAuditEvent({
        userId: currentUserId,
        userName: currentUserName,
        action: 'CREATE',
        module: 'RESIDENTS',
        entityType: 'RESIDENT',
        entityId: 'batch_import',
        description: `Nhập danh sách ${validRows.length} nhân khẩu từ file Excel: ${fileName || 'tập tin'}`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi khi nhập dữ liệu vào hệ thống.');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-surface-container-lowest max-w-3xl w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-surface-container px-6 py-4 border-b border-surface-container-high flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-2xl">upload_file</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Nhập Danh Sách Nhân Khẩu Từ File Mẫu</h3>
              <p className="text-[11px] text-on-surface-variant">
                Hỗ trợ định dạng Excel (.xlsx, .xls) và CSV theo mẫu chuẩn của Ấp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Action Row: Download Template & File Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-container border border-surface-container-high">
            <div>
              <div className="font-bold text-on-surface text-sm">Bước 1: Tải tệp Excel mẫu</div>
              <div className="text-[11px] text-on-surface-variant">
                Điền danh sách nhân khẩu theo đúng các cột trong mẫu đã định sẵn
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              type="button"
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-base text-emerald-700">file_download</span>
              <span>Tải file Excel mẫu</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container border border-surface-container-high space-y-3">
            <div className="font-bold text-on-surface text-sm">Bước 2: Chọn tệp tải lên</div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">folder_open</span>
                <span>{fileName ? 'Chọn tệp khác' : 'Chọn tệp từ máy tính (.xlsx, .csv)'}</span>
              </button>

              {fileName && (
                <div className="text-xs font-mono font-semibold text-primary bg-primary-fixed/30 px-3 py-1.5 rounded-lg truncate max-w-xs">
                  {fileName}
                </div>
              )}
            </div>

            {/* Default Group setting */}
            <div className="pt-2 border-t border-surface-container-highest flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-on-surface-variant font-medium">
                Tổ dân cư mặc định (nếu trong file để trống):
              </span>
              <input
                type="text"
                list="groupSuggestions"
                value={defaultGroup}
                onChange={(e) => setDefaultGroup(e.target.value)}
                placeholder="VD: Tổ 1, Tổ 2, Tổ Tự Quản..."
                className="px-3 py-1 rounded-xl border border-surface-container-highest bg-surface text-xs font-semibold text-primary max-w-xs"
              />
              <datalist id="groupSuggestions">
                {availableGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-100 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-on-surface">
                  Xem trước dữ liệu ({parsedRows.length} nhân khẩu):
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-700 font-semibold">
                    ✓ Hợp lệ: {validCount}
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-red-600 font-semibold">
                      ✕ Thiếu thông tin: {invalidCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-surface-container-high rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-surface-container sticky top-0 border-b border-surface-container-high">
                    <tr>
                      <th className="p-2.5 font-bold text-on-surface">Họ và tên</th>
                      <th className="p-2.5 font-bold text-on-surface">CCCD/CMND</th>
                      <th className="p-2.5 font-bold text-on-surface">Số nhà / Địa chỉ</th>
                      <th className="p-2.5 font-bold text-on-surface">Tổ dân cư</th>
                      <th className="p-2.5 font-bold text-on-surface">Cư trú</th>
                      <th className="p-2.5 font-bold text-on-surface">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className={r.isValid ? 'hover:bg-surface-container-low' : 'bg-red-50'}>
                        <td className="p-2 font-semibold text-on-surface">{r.fullName}</td>
                        <td className="p-2 font-mono text-slate-600">{r.nationalId || '-'}</td>
                        <td className="p-2 text-slate-700 truncate max-w-[160px]">{r.address}</td>
                        <td className="p-2 font-medium text-primary">{r.groupNumber}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 text-[10px]">
                            {r.residenceStatus === 'PERMANENT' ? 'Thường trú' : 'Tạm trú'}
                          </span>
                        </td>
                        <td className="p-2">
                          {r.isValid ? (
                            <span className="text-emerald-700 font-bold">✓ Hợp lệ</span>
                          ) : (
                            <span className="text-red-600 font-semibold">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-surface-container px-6 py-3.5 border-t border-surface-container-high flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={importing || validCount === 0}
            onClick={handleImportSubmit}
            className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang ghi vào CSDL...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Nhập {validCount} nhân khẩu vào hệ thống</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
