import { pool, initSchema, listStudents, insertStudent } from './db.js'

/**
 * 一次性 seed：把補習班原始名冊寫入 DB。
 * 表內已有資料則跳過（以 DB 為單一真相，不覆蓋）。
 */
const INITIAL_ROSTER_NAMES = [
  '毛景平', '王亦學', '江丞翔', '吳乃穎', '吳旻峻', '吳綺容', '李宇右', '李昀芯',
  '李昀叡', '李明珅', '李浚丞', '李祐霆', '林子評', '林子齊', '林心惟/心恬', '林妍芯',
  '林依璇', '林孟緹', '林旻學', '林芯如', '林芯妤', '林品叡', '林宥勳', '林昱辰',
  '林柏澄', '林恩羽', '林軒頡', '林婉柔', '侯茗瑋', '施佾程', '施采彤', '柯昱安',
  '洪玥甯', '紀丞聿', '徐子堯', '徐小柔', '徐尚恩', '徐尚霖', '徐睿彤', '高彥程',
  '張芷璇', '張芸昕', '張家語', '莊馥蔓', '許佩旂', '許晉誠', '許皓丞', '陳可璇',
  '陳可霏', '陳永曦', '陳宇翰', '陳妍睿', '陳芊華', '陳欣宜', '陳泓均', '陳芸熙',
  '陳品妤', '陳彥廷', '陳枷羽', '陳苡安', '陳韶雨', '陳韻琬', '曾子芸', '曾宇辰',
  '曾雨喬', '曾琇豫', '游綸晏', '黃子芢', '黃亘弘', '黃孟歆', '黃怜潔', '黃采妍',
  '黃尉宸', '黃康宇', '黃博浩', '黃靖恩', '黃德霖', '黃瀞瑩', '詹舒聿', '鄒定均',
  '鄒東蕎', '廖英娜', '廖唯硯', '劉宇婕', '劉秉鈞', '劉亮妤', '劉品銳', '蔡尚樺',
  '蔡尚穎', '蔡懷嫻', '蔣宜庭', '鄭恩昊', '鄭豊熏', '蕭瑜誱', '賴席寬', '賴晞之',
  '賴楷翔', '賴裕棠', '賴穎芯', '簡士翔', '簡子期', '羅堤芮', '蘇耀辰',
]

function createRosterId(i) {
  return `sr_${Date.now()}_${i.toString(36)}`
}

async function main() {
  await initSchema()
  const existing = await listStudents()
  if (existing.length > 0) {
    console.log(`[seed] students table already has ${existing.length} rows — skip`)
    await pool.end()
    return
  }

  const seen = new Set()
  const names = []
  for (const raw of INITIAL_ROSTER_NAMES) {
    const n = typeof raw === 'string' ? raw.trim() : ''
    if (!n || seen.has(n)) continue
    seen.add(n)
    names.push(n)
  }

  for (let i = 0; i < names.length; i++) {
    await insertStudent({ id: createRosterId(i), name: names[i] })
  }
  console.log(`[seed] inserted ${names.length} students`)
  await pool.end()
}

main().catch(err => {
  console.error('[seed] failed', err)
  process.exit(1)
})
