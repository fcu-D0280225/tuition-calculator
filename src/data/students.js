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

// 補習班學費資料（從收費表.xls 明細工作表匯入）
// 課程類型說明:
//   ind1: 個人課 (1人)
//   ind2: 2人課
//   grp34: 3-4人課
//   ind_special: 特殊個人課 (如 徐氏班 500/堂)
//   ind_other: 其他個人課 (如 國中英文 900/堂)
//   team: 團班 (固定月費/期費，非依堂數計算)
//   book_fee: 書錢/教材費

export const INITIAL_STUDENTS = [
  { name: "毛景平", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 5, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 5, subtotal: 3000 }] },
  { name: "王亦學", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "江丞翔", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 3.5, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 3.5, subtotal: 2100 }] },
  { name: "吳乃穎", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "吳旻峻", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 4, team: 0, book_fee: 0, hours: 4, subtotal: 3000 }] },
  { name: "吳綺容", courses: [
    { subject: "英文", ind1: 20, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 700, hours: 20, subtotal: 18700 },
    { subject: "數學", ind1: 21, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 21, subtotal: 14700 }
  ]},
  { name: "李宇右", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 8, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 3200 }] },
  { name: "李昀芯", courses: [{ subject: "數學", ind1: 10, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 1800, book_fee: 0, hours: 10, subtotal: 8800 }] },
  { name: "李昀叡", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4000 }] },
  { name: "李明珅", courses: [{ subject: "英文", ind1: 4.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4.5, subtotal: 3150 }] },
  { name: "李浚丞", courses: [{ subject: "英文", ind1: 15.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 15.5, subtotal: 10850 }] },
  { name: "李祐霆", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4800 }] },
  { name: "林子評", courses: [{ subject: "英文", ind1: 0, ind2: 12, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 12, subtotal: 7600 }] },
  { name: "林子齊", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 8, team: 0, book_fee: 0, hours: 8, subtotal: 7200 }] },
  { name: "林心惟/心恬", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 6, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 5400 }] },
  { name: "林妍芯", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "林依璇", courses: [
    { subject: "英文", ind1: 0, ind2: 9, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 9, subtotal: 7200 },
    { subject: "數學", ind1: 13.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 13.5, subtotal: 9450 }
  ]},
  { name: "林孟緹", courses: [{ subject: "英文", ind1: 0, ind2: 9, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 9, subtotal: 7200 }] },
  { name: "林旻學", courses: [{ subject: "英文", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 600, hours: 8, subtotal: 6200 }] },
  { name: "林芯如", courses: [{ subject: "英文", ind1: 4, ind2: 2, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 3200 }] },
  { name: "林芯妤", courses: [{ subject: "數學", ind1: 14, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 14, subtotal: 9800 }] },
  { name: "林品叡", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4800 }] },
  { name: "林宥勳", courses: [{ subject: "英文", ind1: 1, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 1, subtotal: 700 }] },
  { name: "林昱辰", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "林柏澄", courses: [{ subject: "英文", ind1: 10, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 10, subtotal: 8000 }] },
  { name: "林恩羽", courses: [{ subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 6, subtotal: 4600 }] },
  { name: "林軒頡", courses: [{ subject: "英文", ind1: 0, ind2: 12, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 12, subtotal: 7600 }] },
  { name: "林婉柔", courses: [{ subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4200 }] },
  { name: "侯茗瑋", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3200, book_fee: 0, hours: 0, subtotal: 3200 }] },
  { name: "施佾程", courses: [{ subject: "英文", ind1: 4.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4.5, subtotal: 3150 }] },
  { name: "施采彤", courses: [{ subject: "英文", ind1: 2, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 800, hours: 2, subtotal: 2200 }] },
  { name: "柯昱安", courses: [{ subject: "英文", ind1: 5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 5, subtotal: 4000 }] },
  { name: "洪玥甯", courses: [{ subject: "英文", ind1: 12, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 12, subtotal: 8800 }] },
  { name: "紀丞聿", courses: [{ subject: "數學", ind1: 23, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 23, subtotal: 16100 }] },
  { name: "徐子堯", courses: [{ subject: "數學", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 5600 }] },
  { name: "徐小柔", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 17, ind_other: 0, team: 0, book_fee: 0, hours: 17, subtotal: 8500 }] },
  { name: "徐尚恩", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 23, ind_other: 0, team: 0, book_fee: 400, hours: 23, subtotal: 11900 }] },
  { name: "徐尚霖", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 23, ind_other: 0, team: 0, book_fee: 400, hours: 23, subtotal: 11900 }] },
  { name: "徐睿彤", courses: [{ subject: "英文", ind1: 12, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 12, subtotal: 10000 }] },
  { name: "高彥程", courses: [{ subject: "英文", ind1: 5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 5, subtotal: 4000 }] },
  { name: "張芷璇", courses: [{ subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4200 }] },
  { name: "張芸昕", courses: [{ subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4800 }] },
  { name: "張家語", courses: [{ subject: "英文", ind1: 8, ind2: 4, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 12, subtotal: 8400 }] },
  { name: "莊馥蔓", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3200, book_fee: 0, hours: 0, subtotal: 3200 }] },
  { name: "許佩旂", courses: [{ subject: "英文", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 6400 }] },
  { name: "許晉誠", courses: [
    { subject: "英文", ind1: 0, ind2: 0, grp34: 10, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 10, subtotal: 9600 },
    { subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 7200, book_fee: 0, hours: 0, subtotal: 7200 }
  ]},
  { name: "許皓丞", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 0, subtotal: 0 }] },
  { name: "陳可璇", courses: [{ subject: "英文", ind1: 12, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 12, subtotal: 10800 }] },
  { name: "陳可霏", courses: [{ subject: "英文", ind1: 7.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 7.5, subtotal: 5250 }] },
  { name: "陳永曦", courses: [{ subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 2800 }] },
  { name: "陳宇翰", courses: [{ subject: "英文", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 5600 }] },
  { name: "陳妍睿", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 6, ind_special: 0, ind_other: 0, team: 0, book_fee: 1200, hours: 6, subtotal: 4800 }] },
  { name: "陳芊華", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 2, team: 0, book_fee: 0, hours: 2, subtotal: 1800 }] },
  { name: "陳欣宜", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 2500, book_fee: 0, hours: 0, subtotal: 2500 }] },
  { name: "陳泓均", courses: [{ subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 600, hours: 6, subtotal: 4200 }] },
  { name: "陳芸熙", courses: [{ subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 4, subtotal: 4000 }] },
  { name: "陳品妤", courses: [{ subject: "數學", ind1: 7.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 7.5, subtotal: 5250 }] },
  { name: "陳彥廷", courses: [{ subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 2800 }] },
  { name: "陳枷羽", courses: [{ subject: "英文", ind1: 10, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 200, hours: 10, subtotal: 7200 }] },
  { name: "陳苡安", courses: [{ subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 6, subtotal: 4600 }] },
  { name: "陳韶雨", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 10, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 10, subtotal: 6000 }] },
  { name: "陳韻琬", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4800 }] },
  { name: "曾子芸", courses: [
    { subject: "英文", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4800 },
    { subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }
  ]},
  { name: "曾宇辰", courses: [{ subject: "英文", ind1: 3, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 3, subtotal: 2100 }] },
  { name: "曾雨喬", courses: [{ subject: "英文", ind1: 4.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 1600, hours: 4.5, subtotal: 3150 }] },
  { name: "曾琇豫", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 8, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 4800 }] },
  { name: "游綸晏", courses: [{ subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4200 }] },
  { name: "黃子芢", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 4, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 4000 }] },
  { name: "黃亘弘", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 7, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 7, subtotal: 3500 }] },
  { name: "黃孟歆", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 8, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 3200 }] },
  { name: "黃怜潔", courses: [
    { subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4800 },
    { subject: "數學", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 2800 }
  ]},
  { name: "黃采妍", courses: [{ subject: "英文", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 6400 }] },
  { name: "黃尉宸", courses: [{ subject: "英文", ind1: 1.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 1.5, subtotal: 1050 }] },
  { name: "黃康宇", courses: [{ subject: "英文", ind1: 10, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 10, subtotal: 9000 }] },
  { name: "黃博浩", courses: [
    { subject: "英文", ind1: 20, ind2: 4, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 24, subtotal: 17200 },
    { subject: "數學", ind1: 13.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 13.5, subtotal: 9450 }
  ]},
  { name: "黃靖恩", courses: [{ subject: "數學", ind1: 6.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6.5, subtotal: 4550 }] },
  { name: "黃德霖", courses: [{ subject: "英文", ind1: 0, ind2: 17.5, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 17.5, subtotal: 14000 }] },
  { name: "黃瀞瑩", courses: [{ subject: "數學", ind1: 15.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 15.5, subtotal: 10850 }] },
  { name: "詹舒聿", courses: [{ subject: "英文", ind1: 10, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 10, subtotal: 7000 }] },
  { name: "鄒定均", courses: [{ subject: "英文", ind1: 7.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 7.5, subtotal: 5250 }] },
  { name: "鄒東蕎", courses: [{ subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 6, subtotal: 7800 }] },
  { name: "廖英娜", courses: [{ subject: "英文", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4800 }] },
  { name: "廖唯硯", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "劉宇婕", courses: [{ subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 3600 }] },
  { name: "劉秉鈞", courses: [
    { subject: "英文", ind1: 4.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4.5, subtotal: 3150 },
    { subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4200 }
  ]},
  { name: "劉亮妤", courses: [{ subject: "英文", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 7200 }] },
  { name: "劉品銳", courses: [{ subject: "數學", ind1: 0, ind2: 0, grp34: 0, ind_special: 8, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 3200 }] },
  { name: "蔡尚樺", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "蔡尚穎", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "蔡懷嫻", courses: [
    { subject: "英文", ind1: 0, ind2: 0, grp34: 16, ind_special: 0, ind_other: 0, team: 0, book_fee: 400, hours: 16, subtotal: 10000 },
    { subject: "數學", ind1: 14, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 14, subtotal: 9800 }
  ]},
  { name: "蔣宜庭", courses: [{ subject: "英文", ind1: 0, ind2: 6, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4800 }] },
  { name: "鄭恩昊", courses: [{ subject: "英文", ind1: 0, ind2: 9, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 9, subtotal: 7200 }] },
  { name: "鄭豊熏", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 6, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 3600 }] },
  { name: "蕭瑜誱", courses: [{ subject: "英文", ind1: 4.5, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 800, hours: 4.5, subtotal: 3950 }] },
  { name: "賴席寬", courses: [
    { subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 500, hours: 4, subtotal: 3700 },
    { subject: "數學", ind1: 8, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 8, subtotal: 5600 }
  ]},
  { name: "賴晞之", courses: [
    { subject: "英文", ind1: 4, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 4, subtotal: 3200 },
    { subject: "數學", ind1: 6, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 4200 }
  ]},
  { name: "賴楷翔", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
  { name: "賴裕棠", courses: [
    { subject: "英文", ind1: 0, ind2: 0, grp34: 12, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 12, subtotal: 7200 },
    { subject: "數學", ind1: 9, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 9, subtotal: 6300 }
  ]},
  { name: "賴穎芯", courses: [{ subject: "英文", ind1: 3, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 3, subtotal: 2400 }] },
  { name: "簡士翔", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 6, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 3600 }] },
  { name: "簡子期", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 6, ind_other: 0, team: 0, book_fee: 0, hours: 6, subtotal: 3600 }] },
  { name: "羅堤芮", courses: [{ subject: "英文", ind1: 3, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 0, book_fee: 0, hours: 3, subtotal: 2100 }] },
  { name: "蘇耀辰", courses: [{ subject: "英文", ind1: 0, ind2: 0, grp34: 0, ind_special: 0, ind_other: 0, team: 3600, book_fee: 0, hours: 0, subtotal: 3600 }] },
];

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
