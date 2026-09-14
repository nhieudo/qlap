/**
 * Chuyển đổi số tiền thành chữ Tiếng Việt chuẩn hành chính tài chính kế toán
 * Đáp ứng đầy đủ quy tắc số học tiếng Việt từ 0 đến 999.999.999.999.999 VND
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Đọc cụm 3 chữ số
 * @param n Số từ 0 đến 999
 * @param readZeroHundred Bắt buộc đọc "không trăm" nếu không phải nhóm cao nhất
 * @param readZeroTen Bắt buộc đọc "lẻ" nếu hàng chục = 0 và hàng đơn vị > 0
 */
function readThreeDigitsGroup(n: number, readZeroHundred: boolean): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const unit = n % 10;

  const parts: string[] = [];

  // Hàng trăm
  if (hundred > 0 || readZeroHundred) {
    parts.push(`${DIGITS[hundred]} trăm`);
  }

  // Hàng chục
  if (ten > 1) {
    parts.push(`${DIGITS[ten]} mươi`);
  } else if (ten === 1) {
    parts.push('mười');
  } else if (ten === 0 && unit > 0 && (hundred > 0 || readZeroHundred)) {
    // Dùng "lẻ" thống nhất theo quy chuẩn
    parts.push('lẻ');
  }

  // Hàng đơn vị
  if (unit > 0) {
    if (unit === 1) {
      if (ten > 1) {
        parts.push('mốt');
      } else {
        parts.push(DIGITS[unit]);
      }
    } else if (unit === 5) {
      if (ten > 0) {
        parts.push('lăm');
      } else {
        parts.push(DIGITS[unit]);
      }
    } else {
      parts.push(DIGITS[unit]);
    }
  }

  return parts.join(' ');
}

export interface ConvertOptions {
  suffix?: string; // e.g. "chẵn" or ""
  includeCurrency?: boolean; // default true -> "đồng"
}

export function convertNumberToWords(
  amount: number | string | bigint,
  optionsOrSuffix?: boolean | string | ConvertOptions
): string {
  // Normalize options
  let suffix = 'chẵn';
  let includeCurrency = true;

  if (typeof optionsOrSuffix === 'boolean') {
    suffix = optionsOrSuffix ? 'chẵn' : '';
  } else if (typeof optionsOrSuffix === 'string') {
    suffix = optionsOrSuffix;
  } else if (optionsOrSuffix && typeof optionsOrSuffix === 'object') {
    if (optionsOrSuffix.suffix !== undefined) suffix = optionsOrSuffix.suffix;
    if (optionsOrSuffix.includeCurrency !== undefined) includeCurrency = optionsOrSuffix.includeCurrency;
  }

  let numStr = typeof amount === 'string'
    ? amount.replace(/[^0-9-]/g, '')
    : typeof amount === 'bigint'
    ? amount.toString()
    : Math.floor(Number(amount)).toString();

  if (!numStr || numStr === 'NaN') {
    numStr = '0';
  }

  const isNegative = numStr.startsWith('-');
  if (isNegative) {
    numStr = numStr.slice(1);
  }

  // Trim leading zeros
  numStr = numStr.replace(/^0+/, '');
  if (!numStr) {
    const zeroRes = includeCurrency ? (suffix ? `Không đồng ${suffix}.` : 'Không đồng.') : 'Không.';
    return zeroRes;
  }

  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  // Chia thành các nhóm 3 chữ số từ phải qua trái
  const groups: number[] = [];
  let remaining = numStr;
  while (remaining.length > 0) {
    const chunk = remaining.slice(-3);
    groups.push(parseInt(chunk, 10));
    remaining = remaining.slice(0, -3);
  }

  const parts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal > 0) {
      // Đọc "không trăm" nếu có các nhóm cao hơn phía trước
      const readZeroHundred = i < groups.length - 1;
      const groupWords = readThreeDigitsGroup(groupVal, readZeroHundred);
      const scale = scales[i % scales.length];
      if (scale) {
        parts.push(`${groupWords} ${scale}`);
      } else {
        parts.push(groupWords);
      }
    }
  }

  let words = parts.join(' ').trim().replace(/\s+/g, ' ');
  if (!words) {
    words = 'không';
  }

  // Tiền tố âm nếu có
  if (isNegative) {
    words = `âm ${words}`;
  }

  // Viết hoa chữ cái đầu tiên
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);

  let result = capitalized;
  if (includeCurrency) {
    result += ' đồng';
  }
  if (suffix && suffix.trim()) {
    result += ` ${suffix.trim()}`;
  }
  result += '.';

  return result;
}

/**
 * Định dạng tiền tệ VND (e.g. 145850000 -> "145.850.000 ₫")
 */
export function formatCurrencyVND(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.floor(amount)) + ' ₫';
}

/**
 * Định dạng ngày dd/MM/yyyy
 */
export function formatDateVN(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Định dạng ngày giờ dd/MM/yyyy HH:mm
 */
export function formatDateTimeVN(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
