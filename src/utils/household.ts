/**
 * Tiện ích quản lý Sổ Hộ Gia đình và tạo mã hộ theo viết tắt của Ấp
 * Ví dụ: Ấp Hưng An -> HA_001, HA_002...
 */

/**
 * Trích xuất tiền tố viết tắt từ tên ấp/thôn
 * Ví dụ:
 * - "Ấp Hưng An" => "HA"
 * - "Hưng An" => "HA"
 * - "Ấp Bình Hòa" => "BH"
 * - "Ấp 1" => "A1"
 * - "Ấp Tân Lập" => "TL"
 */
export function getHamletAbbreviation(hamletName?: string): string {
  if (!hamletName || !hamletName.trim()) {
    return 'HA';
  }

  let text = hamletName.trim();

  // Loại bỏ các tiền tố hành chính phổ biến ở đầu (Ấp, Thôn, Khu phố, Khóm, Bản, Làng, Tổ)
  const prefixMatch = text.match(/^(ấp|thôn|khu phố|khóm|bản|làng|tổ)\s+/i);
  let hasAdminPrefix = false;
  if (prefixMatch) {
    hasAdminPrefix = true;
    text = text.substring(prefixMatch[0].length).trim();
  }

  // Nếu sau khi bỏ tiền tố chỉ còn số (ví dụ "1", "2")
  if (/^\d+$/.test(text)) {
    return hasAdminPrefix ? `A${text}` : `A${text}`;
  }

  // Tách thành các từ
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'HA';

  // Lấy ký tự đầu của từng từ và chuyển sang chữ hoa không dấu chuẩn
  const abbr = words
    .map((w) => {
      // Loại bỏ dấu tiếng Việt để lấy chữ cái ASCII
      const norm = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'D');
      return norm.charAt(0).toUpperCase();
    })
    .join('');

  return abbr || 'HA';
}

/**
 * Định dạng mã hộ gia đình chuẩn: {TIỀN_TỐ}_{SỐ_THỨ_TỰ}
 * Ví dụ: HA_001, HA_002, BH_015
 */
export function formatHouseholdCode(prefix: string, seq: number): string {
  const cleanPrefix = (prefix || 'HA').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const paddedSeq = String(seq).padStart(3, '0');
  return `${cleanPrefix}_${paddedSeq}`;
}

/**
 * Gợi ý mã hộ kế tiếp dựa trên danh sách mã hộ đã có và tên ấp
 * Ví dụ: Nếu đã có HA_001, HA_002 thì gợi ý tiếp theo là HA_003
 */
export function suggestNextHouseholdCode(
  existingHouseholds: Array<{ householdCode?: string }>,
  hamletName?: string
): string {
  const prefix = getHamletAbbreviation(hamletName);
  const regex = new RegExp(`^${prefix}[_\\-](\\d+)$`, 'i');

  let maxSeq = 0;
  for (const h of existingHouseholds) {
    if (!h.householdCode) continue;
    const match = h.householdCode.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  // Nếu chưa có mã nào theo format này, nhưng đã có tổng số hộ:
  if (maxSeq === 0) {
    const totalCount = existingHouseholds.length;
    return formatHouseholdCode(prefix, totalCount + 1);
  }

  return formatHouseholdCode(prefix, maxSeq + 1);
}
