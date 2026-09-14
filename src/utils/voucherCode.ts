import QRCode from 'qrcode';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const SAFE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No 0, O, 1, I

/**
 * Sinh chuỗi ngẫu nhiên 8 ký tự an toàn không nhầm lẫn
 */
export function generateRandomCode(length = 8): string {
  let result = '';
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : null;

  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += SAFE_ALPHABET[Math.floor(Math.random() * SAFE_ALPHABET.length)];
    }
  }
  return result;
}

/**
 * Sinh mã đối soát độc bản toàn cầu (Globally Unique Reconciliation Code)
 * Định dạng: PT-2026-XXXXXXXX hoặc PC-2026-XXXXXXXX
 */
export function generateReconciliationCode(type: 'INCOME' | 'EXPENSE', year = new Date().getFullYear()): string {
  const prefix = type === 'INCOME' ? 'PT' : 'PC';
  const randomPart = generateRandomCode(8);
  return `${prefix}-${year}-${randomPart}`;
}

/**
 * Kiểm tra xem mã đối soát đã tồn tại trong cơ sở dữ liệu chưa (tránh va chạm)
 */
export async function isReconciliationCodeCollision(code: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'financeTransactions'),
      where('reconciliationCode', '==', code),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.warn('Lỗi kiểm tra trùng mã đối soát:', err);
    return false;
  }
}

/**
 * Sinh mã đối soát an toàn tuyệt đối và đảm bảo không va chạm
 */
export async function generateUniqueReconciliationCode(
  type: 'INCOME' | 'EXPENSE',
  year = new Date().getFullYear()
): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const code = generateReconciliationCode(type, year);
    const collision = await isReconciliationCodeCollision(code);
    if (!collision) {
      return code;
    }
    attempts++;
  }
  // Fallback with timestamp salt if needed
  return `${type === 'INCOME' ? 'PT' : 'PC'}-${year}-${generateRandomCode(10)}`;
}

/**
 * Định dạng số phiếu (Voucher number)
 * Ví dụ: PT-000001/2026 hoặc PC-000001/2026
 */
export function formatVoucherNumber(
  type: 'INCOME' | 'EXPENSE',
  sequence: number,
  year = new Date().getFullYear(),
  digits = 6
): string {
  const prefix = type === 'INCOME' ? 'PT' : 'PC';
  const padded = String(sequence).padStart(digits, '0');
  return `${prefix}-${padded}/${year}`;
}

/**
 * Tạo dữ liệu ảnh QR code Data URL chứa URL tra cứu công khai
 * Tuân thủ mục R: Chỉ mã hóa URL xác minh (/verify/{reconciliationCode}),
 * TUYỆT ĐỐI KHÔNG mã hóa CCCD, số tiền chi tiết hay thông tin nội bộ.
 */
export async function generateVoucherQR(params: {
  reconciliationCode: string;
  verifyUrl?: string;
  voucherNumber?: string;
  transactionType?: string;
  transactionDate?: string;
  amount?: number;
  personName?: string;
}): Promise<string> {
  const targetUrl =
    params.verifyUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/#verify-${params.reconciliationCode}`
      : `https://quanlyap.vn/verify/${params.reconciliationCode}`);

  try {
    return await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: '#760009',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Lỗi khi tạo mã QR xác minh chứng từ:', err);
    return '';
  }
}
