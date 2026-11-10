/**
 * ISO 날짜 문자열을 안전하게 Date 객체로 파싱합니다.
 * 타임존 표기(Z 또는 +09:00 등)가 누락된 경우에도 UTC 기준으로 올바르게 처리합니다.
 */
export const parseIsoDate = (dateStr?: string | null): Date => {
  if (!dateStr) return new Date();
  let s = dateStr.trim();
  if (s.includes('T') && !s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s += 'Z';
  }
  return new Date(s);
};

/**
 * <input type="datetime-local"> 입력창에 맞게 로컬 시간 기준 YYYY-MM-DDTHH:mm 형식으로 변환합니다.
 */
export const toLocalInputFormat = (dateInput: string | Date): string => {
  const d = typeof dateInput === 'string' ? parseIsoDate(dateInput) : dateInput;
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * 사용자 친화적인 날짜 포맷 (M/D HH:mm)으로 변환합니다.
 */
export const formatDisplayDate = (dateStr: string): string => {
  try {
    const d = parseIsoDate(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
};
