import mysql from 'mysql2/promise'

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'app_user',
  password: process.env.MYSQL_PASSWORD || 'AppUser@2026!',
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
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)   NOT NULL,
      course_id    VARCHAR(64)   NOT NULL,
      teacher_id   VARCHAR(64)   NOT NULL,
      hours        DECIMAL(5,2)  NOT NULL,
      lesson_date  DATE          NOT NULL,
      note         VARCHAR(256)  NOT NULL DEFAULT '',
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      INDEX idx_lesson_date    (lesson_date),
      INDEX idx_lesson_student (student_id, lesson_date),
      INDEX idx_lesson_teacher (teacher_id, lesson_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function listStudents() {
  const [rows] = await pool.query(
    'SELECT id, name FROM students ORDER BY created_at ASC, id ASC'
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
    'SELECT id, name FROM teachers ORDER BY created_at ASC, id ASC'
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
    'SELECT id, name, hourly_rate FROM courses ORDER BY created_at ASC, id ASC'
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
            lr.hours, lr.lesson_date, lr.note
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

export async function insertLesson({ id, studentId, courseId, teacherId, hours, lessonDate, note }) {
  await pool.query(
    `INSERT INTO lesson_records (id, student_id, course_id, teacher_id, hours, lesson_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, courseId, teacherId, hours, lessonDate, note || '']
  )
}

export async function updateLesson(id, { studentId, courseId, teacherId, hours, lessonDate, note }) {
  const sets = []
  const params = []
  if (studentId !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (courseId  !== undefined) { sets.push('course_id = ?');   params.push(courseId) }
  if (teacherId !== undefined) { sets.push('teacher_id = ?');  params.push(teacherId) }
  if (hours     !== undefined) { sets.push('hours = ?');       params.push(hours) }
  if (lessonDate !== undefined){ sets.push('lesson_date = ?'); params.push(lessonDate) }
  if (note      !== undefined) { sets.push('note = ?');        params.push(note) }
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
  const [rows] = await pool.query(
    `SELECT
       lr.student_id,
       s.name         AS student_name,
       lr.course_id,
       c.name         AS course_name,
       c.hourly_rate  AS unit_price,
       SUM(lr.hours)  AS total_hours
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id
     JOIN courses  c ON c.id = lr.course_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     GROUP BY lr.student_id, lr.course_id, s.name, c.name, c.hourly_rate
     ORDER BY s.name ASC, c.name ASC`,
    [from, to]
  )

  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: [], total: 0 })
    }
    const student = map.get(row.student_id)
    const totalHours = parseFloat(row.total_hours)
    const unitPrice  = parseFloat(row.unit_price)
    const amount     = Math.round(totalHours * unitPrice)
    student.courses.push({ course_id: row.course_id, course_name: row.course_name, total_hours: totalHours, unit_price: unitPrice, amount })
    student.total += amount
  }
  return Array.from(map.values())
}

export async function settlementSalary(from, to) {
  const [rows] = await pool.query(
    `SELECT
       lr.teacher_id,
       t.name         AS teacher_name,
       lr.course_id,
       c.name         AS course_name,
       c.hourly_rate,
       SUM(lr.hours)  AS total_hours
     FROM lesson_records lr
     JOIN teachers t ON t.id = lr.teacher_id
     JOIN courses  c ON c.id = lr.course_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     GROUP BY lr.teacher_id, lr.course_id, t.name, c.name, c.hourly_rate
     ORDER BY t.name ASC, c.name ASC`,
    [from, to]
  )

  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.teacher_id)) {
      map.set(row.teacher_id, { teacher_id: row.teacher_id, teacher_name: row.teacher_name, courses: [], total: 0 })
    }
    const teacher    = map.get(row.teacher_id)
    const totalHours = parseFloat(row.total_hours)
    const hourlyRate = parseFloat(row.hourly_rate)
    const amount     = Math.round(totalHours * hourlyRate)
    teacher.courses.push({ course_id: row.course_id, course_name: row.course_name, total_hours: totalHours, hourly_rate: hourlyRate, amount })
    teacher.total += amount
  }
  return Array.from(map.values())
}
