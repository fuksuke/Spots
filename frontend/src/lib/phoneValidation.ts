/**
 * 電話番号バリデーション＆整形ユーティリティ
 *
 * 日本の電話番号形式に対応:
 * - 携帯電話: 070/080/090-XXXX-XXXX (11桁)
 * - 固定電話: 0X-XXXX-XXXX または 0XX-XXX-XXXX (10桁)
 * - フリーダイヤル: 0120-XXX-XXX (10桁)
 */

/**
 * 電話番号から数字以外を除去
 */
export const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

/**
 * 電話番号を自動整形（ハイフン挿入）
 *
 * @param phone 電話番号（ハイフンあり/なし両対応）
 * @returns 整形された電話番号
 *
 * @example
 * formatPhoneNumber('09012345678') // => '090-1234-5678'
 * formatPhoneNumber('0312345678')  // => '03-1234-5678'
 * formatPhoneNumber('0120123456')  // => '0120-123-456'
 */
export const formatPhoneNumber = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);

  // 携帯電話: 090-1234-5678 (11桁)
  if (/^(070|080|090)/.test(normalized) && normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }

  // 固定電話 (10桁)
  if (normalized.length === 10) {
    // 東京03、大阪06など2桁市外局番
    if (/^(03|04|06)/.test(normalized)) {
      return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
    }
    // その他3桁市外局番: 011-123-4567
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  // フリーダイヤル: 0120-123-456 (10桁)
  if (/^0120/.test(normalized) && normalized.length === 10) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7)}`;
  }

  // 入力中や不正な形式の場合はそのまま返す（バリデーションは別関数で）
  return phone;
};

/**
 * 電話番号のバリデーション
 *
 * @param phone 電話番号
 * @returns エラーメッセージ、または null（エラーなし）
 *
 * @example
 * validatePhoneNumber('090-1234-5678') // => null
 * validatePhoneNumber('123456')        // => 'エラーメッセージ'
 */
export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone || !phone.trim()) {
    return null; // 空は許可（任意項目の場合）
  }

  const normalized = normalizePhoneNumber(phone);

  // 携帯電話（070/080/090 + 8桁 = 11桁）
  if (/^(070|080|090)\d{8}$/.test(normalized)) {
    return null;
  }

  // 固定電話（0 + 9桁 = 10桁）
  if (/^0[1-9]\d{8}$/.test(normalized)) {
    return null;
  }

  // フリーダイヤル（0120 + 6桁 = 10桁）
  if (/^0120\d{6}$/.test(normalized)) {
    return null;
  }

  return "電話番号は10桁（固定電話）または11桁（携帯電話）で入力してください";
};

/**
 * メールアドレスのバリデーション
 *
 * @param email メールアドレス
 * @returns エラーメッセージ、または null（エラーなし）
 */
export const validateEmail = (email: string): string | null => {
  if (!email || !email.trim()) {
    return null; // 空は許可（任意項目の場合）
  }

  // 簡易的なメールアドレス検証
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "有効なメールアドレスを入力してください";
  }

  return null;
};
