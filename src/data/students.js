/** 新增學生／課程時使用的空白課程列 */
export function createEmptyCourse(subject = '英文') {
  return {
    subject,
    ind1: 0,
    ind2: 0,
    grp34: 0,
    ind_special: 0,
    ind_other: 0,
    team: 0,
    book_fee: 0,
    hours: 0,
    subtotal: 0,
    invoice_include: true,
  }
}

// 課程類型說明:
//   ind1: 個人課 (1人)
//   ind2: 2人課
//   grp34: 3-4人課
//   ind_special: 特殊個人課 (如 徐氏班 500/堂)
//   ind_other: 其他個人課 (如 國中英文 900/堂)
//   team: 團班 (固定月費/期費，非依堂數計算)
//   book_fee: 書錢/教材費

// 計算每一科課程的單堂費用明細 (用於顯示)
export function getCourseBreakdown(course) {
  const lines = [];
  if (course.ind1 > 0) lines.push({ label: `個人課 × ${course.ind1} 堂`, amount: 0, hours: course.ind1, type: 'ind1' });
  if (course.ind2 > 0) lines.push({ label: `2人課 × ${course.ind2} 堂`, amount: 0, hours: course.ind2, type: 'ind2' });
  if (course.grp34 > 0) lines.push({ label: `3-4人課 × ${course.grp34} 堂`, amount: 0, hours: course.grp34, type: 'grp34' });
  if (course.ind_special > 0) lines.push({ label: `特殊個人課 × ${course.ind_special} 堂`, amount: 0, hours: course.ind_special, type: 'ind_special' });
  if (course.ind_other > 0) lines.push({ label: `其他個人課 × ${course.ind_other} 堂`, amount: 0, hours: course.ind_other, type: 'ind_other' });
  if (course.team > 0) lines.push({ label: '團班費', amount: course.team, hours: 0, type: 'team' });
  if (course.book_fee > 0) lines.push({ label: '書錢/教材費', amount: course.book_fee, hours: 0, type: 'book_fee' });
  return lines;
}
