/**
 * Tiện ích chuẩn hóa chuỗi tiếng Việt và sinh Search Tokens
 * Tuân thủ quy chuẩn tra cứu không dấu, có dấu và cụm từ
 */

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

/**
 * Sinh searchTokens[] cho Firestore phục vụ tìm kiếm:
 * Ví dụ: "Nguyễn Văn Minh"
 * Tokens: ["nguyen", "van", "minh", "nguyen van", "van minh", "nguyen van minh"]
 */
export function generateSearchTokens(fullName: string): string[] {
  if (!fullName) return [];
  const normalized = normalizeVietnamese(fullName);
  const words = normalized.split(/\s+/).filter(Boolean);

  const tokens = new Set<string>();

  // Thêm từng từ đơn
  words.forEach(w => tokens.add(w));

  // Thêm các cụm 2 từ liền kề
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]} ${words[i + 1]}`);
  }

  // Thêm chuỗi chuẩn hóa toàn vẹn
  if (words.length > 2) {
    tokens.add(words.join(' '));
  }

  // Thêm các biến thể có dấu gốc
  const rawWords = fullName.toLowerCase().split(/\s+/).filter(Boolean);
  rawWords.forEach(w => tokens.add(w));

  return Array.from(tokens);
}

/**
 * Che giấu thông tin Số Định Danh Cá Nhân / CCCD (Section I)
 * Ví dụ: 079123456789 -> 079123******
 */
export function maskNationalId(nationalId: string | undefined | null): string {
  if (!nationalId) return '';
  const clean = nationalId.trim();
  if (clean.length <= 6) return clean;
  const visible = clean.slice(0, 6);
  const maskedLength = clean.length - 6;
  return `${visible}${'*'.repeat(maskedLength)}`;
}

/**
 * Kiểm tra tính hợp lệ của số CCCD/CMND
 */
export function isValidNationalId(nationalId: string): boolean {
  if (!nationalId) return false;
  const clean = nationalId.trim();
  return /^[0-9]{9}$|^[0-9]{12}$/.test(clean);
}
