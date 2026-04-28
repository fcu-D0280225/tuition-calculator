import mysql from 'mysql2/promise'

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'user',
  password: process.env.MYSQL_PASSWORD || '!Sqluser2026',
  database: process.env.MYSQL_DATABASE || 'tuition_calculator',
  connectionLimit: 10,
  waitForConnections: true,
  dateStrings: true,
}

export const pool = mysql.createPool(config)

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      name        VARCHAR(128) NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_students_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      name        VARCHAR(128) NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teachers_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id          VARCHAR(64)    NOT NULL PRIMARY KEY,
      name        VARCHAR(128)   NOT NULL,
      hourly_rate DECIMAL(10,2)  NOT NULL DEFAULT 0,
      created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_courses_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add hourly_rate to existing courses table if missing
  // (MySQL does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'hourly_rate'`
  )
  if (cols.length === 0) {
    await pool.query(
      `ALTER TABLE courses ADD COLUMN hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0`
    )
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_records (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)    NOT NULL,
      course_id    VARCHAR(64)    NOT NULL,
      teacher_id   VARCHAR(64)    NOT NULL,
      hours        DECIMAL(5,2)   NOT NULL,
      lesson_date  DATE           NOT NULL,
      unit_price   DECIMAL(10,2)  NULL DEFAULT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      INDEX idx_lesson_date    (lesson_date),
      INDEX idx_lesson_student (student_id, lesson_date),
      INDEX idx_lesson_teacher (teacher_id, lesson_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add unit_price to existing lesson_records table if missing
  const [lrCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'unit_price'`
  )
  if (lrCols.length === 0) {
    await pool.query(
      `ALTER TABLE lesson_records ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL`
    )
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id          VARCHAR(64)    NOT NULL PRIMARY KEY,
      name        VARCHAR(128)   NOT NULL,
      unit_price  DECIMAL(10,2)  NOT NULL DEFAULT 0,
      created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_materials_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_records (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)    NOT NULL,
      material_id  VARCHAR(64)    NOT NULL,
      quantity     DECIMAL(8,2)   NOT NULL DEFAULT 1,
      record_date  DATE           NOT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      INDEX idx_mr_date    (record_date),
      INDEX idx_mr_student (student_id, record_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id               VARCHAR(64)    NOT NULL PRIMARY KEY,
      name             VARCHAR(128)   NOT NULL,
      weekdays         VARCHAR(15)    NOT NULL DEFAULT '',
      duration_months  TINYINT        NOT NULL DEFAULT 0,
      monthly_fee      DECIMAL(10,2)  NOT NULL DEFAULT 0,
      note             VARCHAR(256)   NOT NULL DEFAULT '',
      created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_groups_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_records (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      group_id     VARCHAR(64)   NOT NULL,
      student_id   VARCHAR(64)   NOT NULL,
      record_date  DATE          NOT NULL,
      note         VARCHAR(256)  NOT NULL DEFAULT '',
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id)   REFERENCES \`groups\`(id)  ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id)   ON DELETE CASCADE,
      INDEX idx_gr_date    (record_date),
      INDEX idx_gr_group   (group_id, record_date),
      INDEX idx_gr_student (student_id, record_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add student_id to existing group_records table if missing
  const [grCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_records' AND COLUMN_NAME = 'student_id'`
  )
  if (grCols.length === 0) {
    // Existing rows would lack a student → drop them; this table only landed in the previous schema bump.
    await pool.query(`DELETE FROM group_records`)
    await pool.query(`ALTER TABLE group_records ADD COLUMN student_id VARCHAR(64) NOT NULL AFTER group_id`)
    await pool.query(`ALTER TABLE group_records ADD CONSTRAINT fk_gr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE`)
    await pool.query(`ALTER TABLE group_records ADD INDEX idx_gr_student (student_id, record_date)`)
  }

  // Migration: add duration_months to existing groups table if missing
  const [gDurCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'duration_months'`
  )
  if (gDurCols.length === 0) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN duration_months TINYINT NOT NULL DEFAULT 0 AFTER weekdays`)
  }

  // Migration: add monthly_fee to existing groups table if missing
  const [gFeeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'monthly_fee'`
  )
  if (gFeeCols.length === 0) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER duration_months`)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS share_tokens (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      token       VARCHAR(64)  NOT NULL UNIQUE,
      student_id  VARCHAR(64)  NOT NULL,
      period_from DATE         NOT NULL,
      period_to   DATE         NOT NULL,
      expires_at  DATETIME     NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      INDEX idx_share_tokens_token (token)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function listStudents() {
  const [rows] = await pool.query(
    'SELECT id, name FROM students ORDER BY created_at DESC, id DESC'
  )
  return rows
}

export async function insertStudent({ id, name }) {
  await pool.query('INSERT INTO students (id, name) VALUES (?, ?)', [id, name])
}

export async function updateStudentName(id, name) {
  const [res] = await pool.query('UPDATE students SET name = ? WHERE id = ?', [name, id])
  return res.affectedRows > 0
}

export async function deleteStudent(id) {
  const [res] = await pool.query('DELETE FROM students WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export async function listTeachers() {
  const [rows] = await pool.query(
    'SELECT id, name FROM teachers ORDER BY created_at DESC, id DESC'
  )
  return rows
}

export async function insertTeacher({ id, name }) {
  await pool.query('INSERT INTO teachers (id, name) VALUES (?, ?)', [id, name])
}

export async function updateTeacherName(id, name) {
  const [res] = await pool.query('UPDATE teachers SET name = ? WHERE id = ?', [name, id])
  return res.affectedRows > 0
}

export async function deleteTeacher(id) {
  const [res] = await pool.query('DELETE FROM teachers WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Courses ───────────────────────────────────────────────────────────────────

export async function listCourses() {
  const [rows] = await pool.query(
    'SELECT id, name, hourly_rate FROM courses ORDER BY created_at DESC, id DESC'
  )
  return rows
}

export async function insertCourse({ id, name, hourlyRate }) {
  await pool.query('INSERT INTO courses (id, name, hourly_rate) VALUES (?, ?, ?)', [id, name, hourlyRate ?? 0])
}

export async function updateCourse(id, { name, hourlyRate }) {
  const sets = []
  const params = []
  if (name       !== undefined) { sets.push('name = ?');        params.push(name) }
  if (hourlyRate !== undefined) { sets.push('hourly_rate = ?'); params.push(hourlyRate) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteCourse(id) {
  const [res] = await pool.query('DELETE FROM courses WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Lesson Records ────────────────────────────────────────────────────────────

export async function listLessons({ from, to, studentId, teacherId, courseId } = {}) {
  const conditions = []
  const params = []

  if (from) { conditions.push('lr.lesson_date >= ?'); params.push(from) }
  if (to)   { conditions.push('lr.lesson_date <= ?'); params.push(to) }
  if (studentId) { conditions.push('lr.student_id = ?'); params.push(studentId) }
  if (teacherId) { conditions.push('lr.teacher_id = ?'); params.push(teacherId) }
  if (courseId)  { conditions.push('lr.course_id = ?');  params.push(courseId) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [rows] = await pool.query(
    `SELECT lr.id, lr.student_id, s.name AS student_name,
            lr.course_id, c.name AS course_name,
            lr.teacher_id, t.name AS teacher_name,
            lr.hours, lr.lesson_date, lr.unit_price, lr.note,
            c.hourly_rate AS course_hourly_rate
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id
     JOIN courses  c ON c.id = lr.course_id
     JOIN teachers t ON t.id = lr.teacher_id
     ${where}
     ORDER BY lr.lesson_date DESC, lr.created_at DESC`,
    params
  )
  return rows
}

export async function insertLesson({ id, studentId, courseId, teacherId, hours, lessonDate, unitPrice, note }) {
  await pool.query(
    `INSERT INTO lesson_records (id, student_id, course_id, teacher_id, hours, lesson_date, unit_price, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, courseId, teacherId, hours, lessonDate, unitPrice ?? null, note || '']
  )
}

export async function updateLesson(id, { studentId, courseId, teacherId, hours, lessonDate, unitPrice, note }) {
  const sets = []
  const params = []
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (courseId   !== undefined) { sets.push('course_id = ?');   params.push(courseId) }
  if (teacherId  !== undefined) { sets.push('teacher_id = ?');  params.push(teacherId) }
  if (hours      !== undefined) { sets.push('hours = ?');       params.push(hours) }
  if (lessonDate !== undefined) { sets.push('lesson_date = ?'); params.push(lessonDate) }
  if (unitPrice  !== undefined) { sets.push('unit_price = ?');  params.push(unitPrice) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE lesson_records SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteLesson(id) {
  const [res] = await pool.query('DELETE FROM lesson_records WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Settlement ────────────────────────────────────────────────────────────────

export async function settlementTuition(from, to) {
  // 逐筆取出，讓每筆紀錄的 unit_price 覆蓋優先於課程預設
  const [rows] = await pool.query(
    `SELECT
       lr.student_id,
       s.name                                        AS student_name,
       lr.course_id,
       c.name                                        AS course_name,
       lr.hours,
       COALESCE(lr.unit_price, c.hourly_rate)        AS unit_price
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id
     JOIN courses  c ON c.id = lr.course_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY s.name ASC, c.name ASC`,
    [from, to]
  )

  // 先依 student + course + unit_price 合算，再彙整
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: new Map(), total: 0 })
    }
    const student  = map.get(row.student_id)
    const key      = `${row.course_id}::${row.unit_price}`
    if (!student.courses.has(key)) {
      student.courses.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, unit_price: parseFloat(row.unit_price), amount: 0 })
    }
    const entry = student.courses.get(key)
    const h = parseFloat(row.hours)
    entry.total_hours = Math.round((entry.total_hours + h) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.unit_price)
    student.total += Math.round(h * entry.unit_price)
  }

  // 合併團課費（按出席月份數 × 月費）
  const [grRows] = await pool.query(
    `SELECT
       gr.student_id,
       s.name                                        AS student_name,
       gr.group_id,
       g.name                                        AS group_name,
       g.monthly_fee,
       COUNT(DISTINCT DATE_FORMAT(gr.record_date, '%Y-%m')) AS billable_months
     FROM group_records gr
     JOIN \`groups\`  g ON g.id = gr.group_id
     JOIN students   s ON s.id = gr.student_id
     WHERE gr.record_date >= ? AND gr.record_date <= ?
     GROUP BY gr.student_id, s.name, gr.group_id, g.name, g.monthly_fee
     ORDER BY s.name ASC, g.name ASC`,
    [from, to]
  )
  for (const row of grRows) {
    if (!map.has(row.student_id)) {
      // 只上團課、沒有家教課的學生也要出現在帳單
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: new Map(), total: 0 })
    }
    const student = map.get(row.student_id)
    if (!student.groups) student.groups = []
    const months     = parseInt(row.billable_months, 10)
    const monthlyFee = parseFloat(row.monthly_fee)
    const amount     = Math.round(months * monthlyFee)
    student.groups.push({ group_id: row.group_id, group_name: row.group_name, billable_months: months, monthly_fee: monthlyFee, amount })
    student.total += amount
  }

  // 合併教材費
  const [mrRows] = await pool.query(
    `SELECT
       mr.student_id,
       mr.material_id,
       m.name        AS material_name,
       m.unit_price,
       SUM(mr.quantity) AS total_qty
     FROM material_records mr
     JOIN materials m ON m.id = mr.material_id
     WHERE mr.record_date >= ? AND mr.record_date <= ?
     GROUP BY mr.student_id, mr.material_id, m.name, m.unit_price`,
    [from, to]
  )
  for (const row of mrRows) {
    if (!map.has(row.student_id)) continue // 只補既有學生（沒上課且沒上團課的教材費不列入）
    const student = map.get(row.student_id)
    if (!student.materials) student.materials = []
    const qty    = parseFloat(row.total_qty)
    const price  = parseFloat(row.unit_price)
    const amount = Math.round(qty * price)
    student.materials.push({ material_id: row.material_id, material_name: row.material_name, total_qty: qty, unit_price: price, amount })
    student.total += amount
  }

  return Array.from(map.values()).map(s => ({
    student_id: s.student_id,
    student_name: s.student_name,
    courses: Array.from(s.courses.values()),
    groups: s.groups || [],
    materials: s.materials || [],
    total: s.total,
  }))
}

export async function settlementSalary(from, to) {
  const [rows] = await pool.query(
    `SELECT
       lr.teacher_id,
       t.name                                        AS teacher_name,
       lr.course_id,
       c.name                                        AS course_name,
       lr.hours,
       COALESCE(lr.unit_price, c.hourly_rate)        AS hourly_rate
     FROM lesson_records lr
     JOIN teachers t ON t.id = lr.teacher_id
     JOIN courses  c ON c.id = lr.course_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY t.name ASC, c.name ASC`,
    [from, to]
  )

  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.teacher_id)) {
      map.set(row.teacher_id, { teacher_id: row.teacher_id, teacher_name: row.teacher_name, courses: new Map(), total: 0 })
    }
    const teacher = map.get(row.teacher_id)
    const key     = `${row.course_id}::${row.hourly_rate}`
    if (!teacher.courses.has(key)) {
      teacher.courses.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, hourly_rate: parseFloat(row.hourly_rate), amount: 0 })
    }
    const entry = teacher.courses.get(key)
    const h = parseFloat(row.hours)
    entry.total_hours = Math.round((entry.total_hours + h) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.hourly_rate)
    teacher.total += Math.round(h * entry.hourly_rate)
  }

  return Array.from(map.values()).map(t => ({
    teacher_id: t.teacher_id,
    teacher_name: t.teacher_name,
    courses: Array.from(t.courses.values()),
    total: t.total,
  }))
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function listMaterials() {
  const [rows] = await pool.query(
    'SELECT id, name, unit_price FROM materials ORDER BY created_at DESC, id DESC'
  )
  return rows
}

export async function insertMaterial({ id, name, unitPrice }) {
  await pool.query('INSERT INTO materials (id, name, unit_price) VALUES (?, ?, ?)', [id, name, unitPrice ?? 0])
}

export async function updateMaterial(id, { name, unitPrice }) {
  const sets = []; const params = []
  if (name      !== undefined) { sets.push('name = ?');       params.push(name) }
  if (unitPrice !== undefined) { sets.push('unit_price = ?'); params.push(unitPrice) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE materials SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteMaterial(id) {
  const [res] = await pool.query('DELETE FROM materials WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Material Records ──────────────────────────────────────────────────────────

export async function listMaterialRecords({ from, to, studentId } = {}) {
  const conditions = []; const params = []
  if (from)      { conditions.push('mr.record_date >= ?'); params.push(from) }
  if (to)        { conditions.push('mr.record_date <= ?'); params.push(to) }
  if (studentId) { conditions.push('mr.student_id = ?');   params.push(studentId) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await pool.query(
    `SELECT mr.id, mr.student_id, s.name AS student_name,
            mr.material_id, m.name AS material_name, m.unit_price,
            mr.quantity, mr.record_date, mr.note
     FROM material_records mr
     JOIN students  s ON s.id = mr.student_id
     JOIN materials m ON m.id = mr.material_id
     ${where}
     ORDER BY mr.record_date DESC, mr.created_at DESC`,
    params
  )
  return rows
}

export async function insertMaterialRecord({ id, studentId, materialId, quantity, recordDate, note }) {
  await pool.query(
    `INSERT INTO material_records (id, student_id, material_id, quantity, record_date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, studentId, materialId, quantity ?? 1, recordDate, note || '']
  )
}

export async function updateMaterialRecord(id, { studentId, materialId, quantity, recordDate, note }) {
  const sets = []; const params = []
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (materialId !== undefined) { sets.push('material_id = ?'); params.push(materialId) }
  if (quantity   !== undefined) { sets.push('quantity = ?');    params.push(quantity) }
  if (recordDate !== undefined) { sets.push('record_date = ?'); params.push(recordDate) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE material_records SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteMaterialRecord(id) {
  const [res] = await pool.query('DELETE FROM material_records WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Groups ───────────────────────────────────────────────────────────────────

export async function listGroups() {
  const [rows] = await pool.query(
    'SELECT id, name, weekdays, duration_months, monthly_fee, note FROM `groups` ORDER BY created_at DESC, id DESC'
  )
  return rows
}

export async function insertGroup({ id, name, weekdays, durationMonths, monthlyFee, note }) {
  await pool.query(
    'INSERT INTO `groups` (id, name, weekdays, duration_months, monthly_fee, note) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, weekdays || '', durationMonths ?? 0, monthlyFee ?? 0, note || '']
  )
}

export async function updateGroup(id, { name, weekdays, durationMonths, monthlyFee, note }) {
  const sets = []; const params = []
  if (name            !== undefined) { sets.push('name = ?');             params.push(name) }
  if (weekdays        !== undefined) { sets.push('weekdays = ?');         params.push(weekdays || '') }
  if (durationMonths  !== undefined) { sets.push('duration_months = ?');  params.push(durationMonths) }
  if (monthlyFee      !== undefined) { sets.push('monthly_fee = ?');      params.push(monthlyFee) }
  if (note            !== undefined) { sets.push('note = ?');             params.push(note || '') }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE \`groups\` SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteGroup(id) {
  const [res] = await pool.query('DELETE FROM `groups` WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Group Records ────────────────────────────────────────────────────────────

export async function listGroupRecords({ from, to, groupId, studentId } = {}) {
  const conditions = []; const params = []
  if (from)      { conditions.push('gr.record_date >= ?'); params.push(from) }
  if (to)        { conditions.push('gr.record_date <= ?'); params.push(to) }
  if (groupId)   { conditions.push('gr.group_id = ?');     params.push(groupId) }
  if (studentId) { conditions.push('gr.student_id = ?');   params.push(studentId) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await pool.query(
    `SELECT gr.id, gr.group_id, g.name AS group_name,
            gr.student_id, s.name AS student_name,
            gr.record_date, gr.note
     FROM group_records gr
     JOIN \`groups\`  g ON g.id = gr.group_id
     JOIN students   s ON s.id = gr.student_id
     ${where}
     ORDER BY gr.record_date DESC, gr.created_at DESC`,
    params
  )
  return rows
}

export async function insertGroupRecord({ id, groupId, studentId, recordDate, note }) {
  await pool.query(
    `INSERT INTO group_records (id, group_id, student_id, record_date, note)
     VALUES (?, ?, ?, ?, ?)`,
    [id, groupId, studentId, recordDate, note || '']
  )
}

export async function updateGroupRecord(id, { groupId, studentId, recordDate, note }) {
  const sets = []; const params = []
  if (groupId    !== undefined) { sets.push('group_id = ?');    params.push(groupId) }
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (recordDate !== undefined) { sets.push('record_date = ?'); params.push(recordDate) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note || '') }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE group_records SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteGroupRecord(id) {
  const [res] = await pool.query('DELETE FROM group_records WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Share Tokens ──────────────────────────────────────────────────────────────

export async function insertShareToken({ id, token, studentId, periodFrom, periodTo, expiresAt }) {
  await pool.query(
    `INSERT INTO share_tokens (id, token, student_id, period_from, period_to, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, token, studentId, periodFrom, periodTo, expiresAt]
  )
}

export async function getShareTokenByToken(token) {
  const [rows] = await pool.query(
    `SELECT st.id, st.token, st.student_id, s.name AS student_name,
            st.period_from, st.period_to, st.expires_at
     FROM share_tokens st
     JOIN students s ON s.id = st.student_id
     WHERE st.token = ?`,
    [token]
  )
  return rows[0] || null
}

export async function getStudentBill(studentId, from, to) {
  // 家教課
  const [lessonRows] = await pool.query(
    `SELECT lr.lesson_date, lr.hours, lr.unit_price, lr.note,
            c.id AS course_id, c.name AS course_name, c.hourly_rate,
            t.name AS teacher_name
     FROM lesson_records lr
     JOIN courses  c ON c.id = lr.course_id
     JOIN teachers t ON t.id = lr.teacher_id
     WHERE lr.student_id = ? AND lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY lr.lesson_date ASC`,
    [studentId, from, to]
  )

  const courseMap = new Map()
  let total = 0
  const lessons = lessonRows.map(row => {
    const unit = row.unit_price !== null ? parseFloat(row.unit_price) : parseFloat(row.hourly_rate)
    const hours = parseFloat(row.hours)
    const amount = Math.round(hours * unit)
    total += amount
    const key = `${row.course_id}::${unit}`
    if (!courseMap.has(key)) {
      courseMap.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, unit_price: unit, amount: 0 })
    }
    const entry = courseMap.get(key)
    entry.total_hours = Math.round((entry.total_hours + hours) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.unit_price)
    return {
      lesson_date: row.lesson_date,
      course_name: row.course_name,
      teacher_name: row.teacher_name,
      hours, unit_price: unit, amount,
      note: row.note,
    }
  })

  // 團課（鏡像 settlementTuition：按出席月份數 × 月費）
  const [groupRows] = await pool.query(
    `SELECT gr.group_id, g.name AS group_name, g.monthly_fee,
            COUNT(DISTINCT DATE_FORMAT(gr.record_date, '%Y-%m')) AS billable_months
     FROM group_records gr
     JOIN \`groups\` g ON g.id = gr.group_id
     WHERE gr.student_id = ? AND gr.record_date >= ? AND gr.record_date <= ?
     GROUP BY gr.group_id, g.name, g.monthly_fee
     ORDER BY g.name ASC`,
    [studentId, from, to]
  )
  const groups = groupRows.map(row => {
    const months = parseInt(row.billable_months, 10)
    const monthly = parseFloat(row.monthly_fee)
    const amount = Math.round(months * monthly)
    total += amount
    return { group_id: row.group_id, group_name: row.group_name, billable_months: months, monthly_fee: monthly, amount }
  })

  // 教材
  const [materialRows] = await pool.query(
    `SELECT mr.record_date, mr.quantity, mr.note,
            m.id AS material_id, m.name AS material_name, m.unit_price
     FROM material_records mr
     JOIN materials m ON m.id = mr.material_id
     WHERE mr.student_id = ? AND mr.record_date >= ? AND mr.record_date <= ?
     ORDER BY mr.record_date ASC`,
    [studentId, from, to]
  )
  const materialMap = new Map()
  for (const row of materialRows) {
    const qty = parseFloat(row.quantity)
    const price = parseFloat(row.unit_price)
    const amount = Math.round(qty * price)
    total += amount
    if (!materialMap.has(row.material_id)) {
      materialMap.set(row.material_id, { material_id: row.material_id, material_name: row.material_name, total_qty: 0, unit_price: price, amount: 0 })
    }
    const entry = materialMap.get(row.material_id)
    entry.total_qty = Math.round((entry.total_qty + qty) * 100) / 100
    entry.amount = Math.round(entry.total_qty * entry.unit_price)
  }

  return {
    courses: Array.from(courseMap.values()),
    groups,
    materials: Array.from(materialMap.values()),
    lessons,
    total,
  }
}
