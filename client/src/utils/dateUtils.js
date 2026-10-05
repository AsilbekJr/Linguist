const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "29-sentabr" — brauzerlarning uz-UZ lokali to'liq emas, shuning uchun qo'lda */
export const formatUzDate = (value, { withYear = false } = {}) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}`;
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${base}, ${d.getFullYear()}` : base;
};
