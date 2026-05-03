import mysql from 'mysql2/promise'

if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD) {
  throw new Error(
    '未設定 MYSQL_USER / MYSQL_PASSWORD。請複製 .env.example 為 .env 並填入正確值，或於啟動時 export 環境變數。'
  )
}

const config = {
  host:     process.env.MYSQL_HOST || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306', 10),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'tuition_calculator',
  connectionLimit: 10,
  waitForConnections: true,
  dateStrings: true,
}

export const pool = mysql.createPool(config)

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id            VARCHAR(64)  NOT NULL PRIMARY KEY,
      name          VARCHAR(128) NOT NULL,
      contact_name  VARCHAR(128) NOT NULL DEFAULT '',
      contact_phone VARCHAR(64)  NOT NULL DEFAULT '',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_students_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: 既有 students 表補上聯絡人 / 電話欄位
  const [stuContactCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
       AND COLUMN_NAME IN ('contact_name', 'contact_phone')`
  )
  const stuContactSet = new Set(stuContactCols.map(c => c.COLUMN_NAME))
  if (!stuContactSet.has('contact_name')) {
    await pool.query(`ALTER TABLE students ADD COLUMN contact_name VARCHAR(128) NOT NULL DEFAULT '' AFTER name`)
  }
  if (!stuContactSet.has('contact_phone')) {
    await pool.query(`ALTER TABLE students ADD COLUMN contact_phone VARCHAR(64) NOT NULL DEFAULT '' AFTER contact_name`)
  }

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

  // Migration: add teacher_hourly_rate to existing courses table if missing
  const [courseTeacherRateCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'teacher_hourly_rate'`
  )
  if (courseTeacherRateCols.length === 0) {
    await pool.query(
      `ALTER TABLE courses ADD COLUMN teacher_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0`
    )
  }

  // Migration: add teacher_unit_price (per-lesson teacher hourly rate override) to lesson_records
  const [lrTeacherPriceCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'teacher_unit_price'`
  )
  if (lrTeacherPriceCols.length === 0) {
    await pool.query(
      `ALTER TABLE lesson_records ADD COLUMN teacher_unit_price DECIMAL(10,2) NULL DEFAULT NULL`
    )
  }

  // Migration: add start_time (TIME) to lesson_records — 用於課表顯示
  const [lrStartTimeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'start_time'`
  )
  if (lrStartTimeCols.length === 0) {
    await pool.query(`ALTER TABLE lesson_records ADD COLUMN start_time TIME NULL DEFAULT NULL`)
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id    VARCHAR(64) NOT NULL,
      student_id  VARCHAR(64) NOT NULL,
      created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, student_id),
      FOREIGN KEY (group_id)   REFERENCES \`groups\`(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id)   ON DELETE CASCADE,
      INDEX idx_gm_student (student_id)
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

  // Migration: add start_time + duration_hours to groups — 課表顯示用
  const [gTimeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME IN ('start_time', 'duration_hours')`
  )
  const gTimeSet = new Set(gTimeCols.map(c => c.COLUMN_NAME))
  if (!gTimeSet.has('start_time')) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN start_time TIME NULL DEFAULT NULL`)
  }
  if (!gTimeSet.has('duration_hours')) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN duration_hours DECIMAL(4,2) NOT NULL DEFAULT 0`)
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

  // Migration: 加 courses.discount_multiplier（舊：每多一人乘 %）
  const [cDiscCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_multiplier'`
  )
  if (cDiscCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN discount_multiplier DECIMAL(6,4) NOT NULL DEFAULT 1.0000 AFTER hourly_rate`)
  }

  // Migration: 加 courses.discount_per_student（新：每多一人 -X 元，預設 0 不打折；只用於家教課）
  const [cDiscPerCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_per_student'`
  )
  if (cDiscPerCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN discount_per_student DECIMAL(10,2) NOT NULL DEFAULT 0`)
  }
  // Migration: 加 courses.default_teacher_id（預設老師，新增上課紀錄時自動帶入）
  const [cDefTeacherCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'default_teacher_id'`
  )
  if (cDefTeacherCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN default_teacher_id VARCHAR(64) NULL DEFAULT NULL`)
    await pool.query(`ALTER TABLE courses ADD CONSTRAINT fk_courses_default_teacher FOREIGN KEY (default_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
  }

  // Migration: 拿掉舊的 discount_multiplier 欄位（已改成 discount_per_student）
  const [cMultLeft] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_multiplier'`
  )
  if (cMultLeft.length > 0) {
    await pool.query(`ALTER TABLE courses DROP COLUMN discount_multiplier`)
  }

  // Migration: 加 courses.sort_order，可手動拖曳排序
  const [cSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'sort_order'`
  )
  if (cSortCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    // 把既有資料按 name ASC 給編號（每筆相差 10，方便日後手動插入）
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE courses SET sort_order = (@rn := @rn + 10) ORDER BY name ASC, id ASC`)
  }

  // Migration: 加 groups.sort_order
  const [gSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'sort_order'`
  )
  if (gSortCols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN sort_order INT NOT NULL DEFAULT 0')
    await pool.query(`SET @rn := 0`)
    await pool.query('UPDATE `groups` SET sort_order = (@rn := @rn + 10) ORDER BY monthly_fee DESC, id ASC')
  }

  // Migration: 加 teachers.contact_phone
  const [tPhoneCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'contact_phone'`
  )
  if (tPhoneCols.length === 0) {
    await pool.query(`ALTER TABLE teachers ADD COLUMN contact_phone VARCHAR(64) NOT NULL DEFAULT '' AFTER name`)
  }

  // Migration: 加 teachers.sort_order
  const [tSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'sort_order'`
  )
  if (tSortCols.length === 0) {
    await pool.query(`ALTER TABLE teachers ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE teachers SET sort_order = (@rn := @rn + 10) ORDER BY created_at DESC, id DESC`)
  }

  // Migration: 加 group_records.status / lesson_records.status
  // pending = 待點名 / attended = 已點名 / pre_enroll = 報名前自動補的（紫）
  for (const tbl of ['group_records', 'lesson_records']) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'attended'`)
    }
  }
  // 既有以 note='尚未開始開課' 標記的，回填到新欄位
  await pool.query(`UPDATE group_records SET status = 'pre_enroll' WHERE note = '尚未開始開課'`)

  // Migration: 加 group_records.teacher_id（記錄該次點名的老師）
  const [grtCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_records' AND COLUMN_NAME = 'teacher_id'`
  )
  if (grtCols.length === 0) {
    await pool.query(`ALTER TABLE group_records ADD COLUMN teacher_id VARCHAR(64) NULL DEFAULT NULL AFTER student_id`)
    await pool.query(`ALTER TABLE group_records ADD CONSTRAINT fk_gr_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
    await pool.query(`ALTER TABLE group_records ADD INDEX idx_gr_teacher (teacher_id, record_date)`)
  }

  // Migration: 加 groups.default_teacher_id（點名時自動帶入的老師）
  const [gDefTcols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'default_teacher_id'`
  )
  if (gDefTcols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN default_teacher_id VARCHAR(64) NULL DEFAULT NULL')
    await pool.query('ALTER TABLE `groups` ADD CONSTRAINT fk_groups_default_teacher FOREIGN KEY (default_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL')
  }

  // 雜項支出
  await pool.query(`
    CREATE TABLE IF NOT EXISTS misc_expenses (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      name         VARCHAR(128)   NOT NULL,
      amount       DECIMAL(10,2)  NOT NULL DEFAULT 0,
      expense_date DATE           NOT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_misc_date (expense_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: 加 students.sort_order
  const [sSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'sort_order'`
  )
  if (sSortCols.length === 0) {
    await pool.query(`ALTER TABLE students ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE students SET sort_order = (@rn := @rn + 10) ORDER BY created_at DESC, id DESC`)
  }
  // Migration: 早期版本曾經把 discount_multiplier 加在 groups 上，現在不用了，留欄位不影響但忽略


  // Migration: 把寫在 note 裡的純數字月費搬到 monthly_fee（適用早期資料）
  await pool.query(
    `UPDATE \`groups\`
        SET monthly_fee = CAST(note AS DECIMAL(10,2)),
            note = ''
      WHERE monthly_fee = 0
        AND note REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND CAST(note AS DECIMAL(10,2)) > 0`
  )
  // Migration: monthly_fee 已正確但 note 仍寫同樣數字的，清掉 note 避免重複顯示
  await pool.query(
    `UPDATE \`groups\`
        SET note = ''
      WHERE note REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND monthly_fee > 0
        AND CAST(note AS DECIMAL(10,2)) = monthly_fee`
  )

  // ── Student ↔ Course 報名表（家教課） ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_courses (
      student_id  VARCHAR(64) NOT NULL,
      course_id   VARCHAR(64) NOT NULL,
      created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      INDEX idx_sc_course (course_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  // 第一次建表時，從既有的 lesson_records 推回每位學生上過哪些課，避免舊資料失效
  const [scExist] = await pool.query('SELECT 1 FROM student_courses LIMIT 1')
  if (scExist.length === 0) {
    await pool.query(`
      INSERT IGNORE INTO student_courses (student_id, course_id)
      SELECT DISTINCT student_id, course_id FROM lesson_records
    `)
  }
  // 同樣補既有團課出席資料：若 group_members 為空但已有 group_records，從中推報名名單
  const [gmExist] = await pool.query('SELECT 1 FROM group_members LIMIT 1')
  if (gmExist.length === 0) {
    await pool.query(`
      INSERT IGNORE INTO group_members (group_id, student_id)
      SELECT DISTINCT group_id, student_id FROM group_records
    `)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS period_locks (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      period_from DATE         NOT NULL,
      period_to   DATE         NOT NULL,
      note        VARCHAR(256) NOT NULL DEFAULT '',
      locked_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lock_period (period_from, period_to)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_records (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)   NOT NULL,
      period_from  DATE          NOT NULL,
      period_to    DATE          NOT NULL,
      paid_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note         VARCHAR(256)  NOT NULL DEFAULT '',
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY uk_payment (student_id, period_from, period_to),
      INDEX idx_payment_period (period_from, period_to)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)   NOT NULL,
      course_id    VARCHAR(64)   NOT NULL,
      leave_date   DATE          NOT NULL,
      reason       VARCHAR(512)  NOT NULL,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      INDEX idx_leave_student (student_id, leave_date),
      INDEX idx_leave_date    (leave_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  // Migration: leave_requests 加 lesson_record_id（讓請假能精準綁到某一堂課，而非整天課程）
  const [lvRecCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'lesson_record_id'`
  )
  if (lvRecCols.length === 0) {
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN lesson_record_id VARCHAR(64) NULL`)
    await pool.query(`ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_lesson FOREIGN KEY (lesson_record_id) REFERENCES lesson_records(id) ON DELETE CASCADE`)
    await pool.query(`ALTER TABLE leave_requests ADD INDEX idx_leave_lesson (lesson_record_id)`)
  }

  // Migration: students/teachers 加 active 欄位（軟停用，取代真實刪除）
  for (const tbl of ['students', 'teachers']) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'active'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`)
      await pool.query(`ALTER TABLE \`${tbl}\` ADD INDEX idx_${tbl}_active (active)`)
    }
  }
}

// ── Leave Requests ───────────────────────────────────────────────────────────

export async function insertLeaveRequest({ id, studentId, courseId, leaveDate, reason, lessonRecordId }) {
  await pool.query(
    'INSERT INTO leave_requests (id, student_id, course_id, leave_date, reason, lesson_record_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, studentId, courseId, leaveDate, reason, lessonRecordId || null]
  )
}

export async function listStudentLeaveRequests(studentId, { from, to } = {}) {
  const where = ['lr.student_id = ?']
  const params = [studentId]
  if (from) { where.push('lr.leave_date >= ?'); params.push(from) }
  if (to)   { where.push('lr.leave_date <= ?'); params.push(to) }
  const [rows] = await pool.query(
    `SELECT lr.id, lr.student_id, lr.course_id, lr.leave_date, lr.reason, lr.created_at, lr.lesson_record_id,
            c.name AS course_name
       FROM leave_requests lr
       JOIN courses c ON c.id = lr.course_id
      WHERE ${where.join(' AND ')}
      ORDER BY lr.leave_date DESC, lr.created_at DESC`,
    params
  )
  return rows
}

export async function deleteLeaveRequest(id) {
  const [r] = await pool.query('DELETE FROM leave_requests WHERE id = ?', [id])
  return r.affectedRows > 0
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function listStudents() {
  const [rows] = await pool.query(
    'SELECT id, name, contact_name, contact_phone, sort_order, active FROM students ORDER BY active DESC, sort_order ASC, created_at DESC, id DESC'
  )
  return rows
}

export async function reorderStudents(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = `UPDATE students SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (?)`
  await pool.query(sql, [...orderedIds, orderedIds])
}

export async function insertStudent({ id, name, contactName, contactPhone }) {
  await pool.query(
    'INSERT INTO students (id, name, contact_name, contact_phone) VALUES (?, ?, ?, ?)',
    [id, name, contactName || '', contactPhone || '']
  )
}

export async function updateStudent(id, { name, contactName, contactPhone }) {
  const sets = []
  const params = []
  if (name         !== undefined) { sets.push('name = ?');          params.push(name) }
  if (contactName  !== undefined) { sets.push('contact_name = ?');  params.push(contactName || '') }
  if (contactPhone !== undefined) { sets.push('contact_phone = ?'); params.push(contactPhone || '') }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function setStudentActive(id, active) {
  const [res] = await pool.query(
    'UPDATE students SET active = ? WHERE id = ?',
    [active ? 1 : 0, id]
  )
  return res.affectedRows > 0
}

export async function getStudentEnrollment(studentId) {
  const [courseRows] = await pool.query(
    'SELECT course_id FROM student_courses WHERE student_id = ?',
    [studentId]
  )
  const [groupRows] = await pool.query(
    'SELECT group_id FROM group_members WHERE student_id = ?',
    [studentId]
  )
  return {
    course_ids: courseRows.map(r => r.course_id),
    group_ids:  groupRows.map(r => r.group_id),
  }
}

export async function setStudentEnrollment(studentId, { courseIds, groupIds }) {
  if (Array.isArray(courseIds)) {
    const cleaned = Array.from(new Set(courseIds.filter(Boolean)))
    await pool.query('DELETE FROM student_courses WHERE student_id = ?', [studentId])
    if (cleaned.length) {
      await pool.query(
        'INSERT INTO student_courses (student_id, course_id) VALUES ?',
        [cleaned.map(cid => [studentId, cid])]
      )
    }
  }
  if (Array.isArray(groupIds)) {
    const cleaned = Array.from(new Set(groupIds.filter(Boolean)))
    // 抓既有 group_ids，找出本次「新增」的，用來自動補上課紀錄
    const [existRows] = await pool.query(
      'SELECT group_id FROM group_members WHERE student_id = ?',
      [studentId]
    )
    const existingSet = new Set(existRows.map(r => r.group_id))
    const newlyAdded = cleaned.filter(gid => !existingSet.has(gid))

    await pool.query('DELETE FROM group_members WHERE student_id = ?', [studentId])
    if (cleaned.length) {
      await pool.query(
        'INSERT INTO group_members (group_id, student_id) VALUES ?',
        [cleaned.map(gid => [gid, studentId])]
      )
    }

    for (const gid of newlyAdded) {
      try { await backfillGroupRecordsForStudent(gid, studentId) }
      catch (e) { console.error('[backfillGroupRecords] failed:', gid, studentId, e) }
    }
  }
}

// ── Period Locks ─────────────────────────────────────────────────────────────

export async function listPeriodLocks() {
  const [rows] = await pool.query(
    'SELECT id, period_from, period_to, note, locked_at FROM period_locks ORDER BY period_from DESC'
  )
  return rows
}

export async function insertPeriodLock({ id, periodFrom, periodTo, note }) {
  await pool.query(
    'INSERT INTO period_locks (id, period_from, period_to, note) VALUES (?, ?, ?, ?)',
    [id, periodFrom, periodTo, note || '']
  )
}

export async function deletePeriodLock(id) {
  const [res] = await pool.query('DELETE FROM period_locks WHERE id = ?', [id])
  return res.affectedRows > 0
}

// 檢查某日期是否落在任一鎖定區間中（含端點）
export async function isDateLocked(dateStr) {
  if (!dateStr) return false
  const [rows] = await pool.query(
    'SELECT 1 FROM period_locks WHERE ? BETWEEN period_from AND period_to LIMIT 1',
    [dateStr]
  )
  return rows.length > 0
}

// 檢查紀錄 id 對應的日期是否被鎖
export async function isLessonLocked(id) {
  const [rows] = await pool.query('SELECT lesson_date FROM lesson_records WHERE id = ?', [id])
  if (rows.length === 0) return false
  return isDateLocked(String(rows[0].lesson_date).slice(0, 10))
}

export async function isGroupRecordLocked(id) {
  const [rows] = await pool.query('SELECT record_date FROM group_records WHERE id = ?', [id])
  if (rows.length === 0) return false
  return isDateLocked(String(rows[0].record_date).slice(0, 10))
}

// ── Misc Expenses ────────────────────────────────────────────────────────────

export async function listMiscExpenses({ from, to } = {}) {
  const conds = []; const params = []
  if (from) { conds.push('expense_date >= ?'); params.push(from) }
  if (to)   { conds.push('expense_date <= ?'); params.push(to) }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
  const [rows] = await pool.query(
    `SELECT id, name, amount, expense_date, note FROM misc_expenses ${where} ORDER BY expense_date DESC, created_at DESC`,
    params
  )
  return rows.map(r => ({ ...r, amount: parseFloat(r.amount) }))
}

export async function insertMiscExpense({ id, name, amount, expenseDate, note }) {
  await pool.query(
    'INSERT INTO misc_expenses (id, name, amount, expense_date, note) VALUES (?, ?, ?, ?, ?)',
    [id, name, amount, expenseDate, note || '']
  )
}

export async function deleteMiscExpense(id) {
  const [res] = await pool.query('DELETE FROM misc_expenses WHERE id = ?', [id])
  return res.affectedRows > 0
}

// 計算當日（伺服器當地時區）YYYY-MM-DD
function todayLocalIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 學生新加入某團課時，把整個 duration_months 區間內所有上課日補成 group_records
// 若該團課已開過課（已有紀錄），起始日從該團課最早一筆紀錄開始；否則從當日開始
// 早於當日的紀錄會標註 note='尚未開始開課'，方便結算與點名時辨別
const PRE_ENROLL_NOTE = '尚未開始開課'

async function backfillGroupRecordsForStudent(groupId, studentId) {
  const [groupRows] = await pool.query(
    'SELECT weekdays, duration_months, default_teacher_id FROM `groups` WHERE id = ? LIMIT 1',
    [groupId]
  )
  const g = groupRows[0]
  if (!g) return
  const months = parseInt(g.duration_months, 10)
  if (!months || months <= 0) return
  const weekdaySet = new Set(
    String(g.weekdays || '')
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  )
  if (weekdaySet.size === 0) return

  const todayStr = todayLocalIso()
  // 起始日候選 1：該團課最早一筆既有紀錄
  const [earliestRows] = await pool.query(
    'SELECT MIN(record_date) AS first_date FROM group_records WHERE group_id = ?',
    [groupId]
  )
  const earliestExisting = earliestRows[0]?.first_date
    ? String(earliestRows[0].first_date).slice(0, 10)
    : null
  // 起始日候選 2：本週的週日（涵蓋本週已上過的課）
  const today = new Date(todayStr + 'T00:00:00')
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay())
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  // 取兩者最小，再保證 ≤ 今天
  const candidates = [todayStr, weekStartStr]
  if (earliestExisting) candidates.push(earliestExisting)
  const startStr = candidates.sort()[0]

  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(start)
  end.setMonth(end.getMonth() + months)

  const dates = []
  const cur = new Date(start)
  while (cur < end) {
    if (weekdaySet.has(cur.getDay())) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  if (dates.length === 0) return

  // 跳過該學生已有的紀錄日期
  const [existing] = await pool.query(
    'SELECT record_date FROM group_records WHERE group_id = ? AND student_id = ? AND record_date IN (?)',
    [groupId, studentId, dates]
  )
  const existingSet = new Set(existing.map(r => String(r.record_date).slice(0, 10)))
  const toInsert = dates.filter(d => !existingSet.has(d))
  if (toInsert.length === 0) return

  const teacherId = g.default_teacher_id || null
  const ts = Date.now()
  const rows = toInsert.map((d, i) => [
    `grr_${ts}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    groupId, studentId, teacherId, d, '',
    d < todayStr ? 'pre_enroll' : 'pending',
  ])
  await pool.query(
    'INSERT INTO group_records (id, group_id, student_id, teacher_id, record_date, note, status) VALUES ?',
    [rows]
  )
}

export async function listAllEnrollments() {
  const [courseRows] = await pool.query('SELECT student_id, course_id FROM student_courses')
  const [groupRows]  = await pool.query('SELECT student_id, group_id FROM group_members')
  return { courses: courseRows, groups: groupRows }
}

export async function listStudentCourses(studentId) {
  const [rows] = await pool.query(
    `SELECT lr.course_id, c.name AS course_name, lr.teacher_id, t.name AS teacher_name,
            MAX(lr.lesson_date) AS last_lesson_date
       FROM lesson_records lr
       JOIN courses  c ON c.id = lr.course_id
       JOIN teachers t ON t.id = lr.teacher_id
      WHERE lr.student_id = ?
      GROUP BY lr.course_id, c.name, lr.teacher_id, t.name
      ORDER BY last_lesson_date DESC, c.name ASC`,
    [studentId]
  )
  return rows
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export async function listTeachers() {
  const [rows] = await pool.query(
    'SELECT id, name, contact_phone, sort_order, active FROM teachers ORDER BY active DESC, sort_order ASC, created_at DESC, id DESC'
  )
  return rows
}

export async function reorderTeachers(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = `UPDATE teachers SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (?)`
  await pool.query(sql, [...orderedIds, orderedIds])
}

export async function insertTeacher({ id, name, contactPhone }) {
  await pool.query('INSERT INTO teachers (id, name, contact_phone) VALUES (?, ?, ?)', [id, name, contactPhone || ''])
}

export async function updateTeacher(id, { name, contactPhone }) {
  const sets = []; const params = []
  if (name         !== undefined) { sets.push('name = ?');          params.push(name) }
  if (contactPhone !== undefined) { sets.push('contact_phone = ?'); params.push(contactPhone || '') }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE teachers SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function updateTeacherName(id, name) {
  const [res] = await pool.query('UPDATE teachers SET name = ? WHERE id = ?', [name, id])
  return res.affectedRows > 0
}

export async function setTeacherActive(id, active) {
  const [res] = await pool.query(
    'UPDATE teachers SET active = ? WHERE id = ?',
    [active ? 1 : 0, id]
  )
  return res.affectedRows > 0
}

// ── Courses ───────────────────────────────────────────────────────────────────

export async function listCourses() {
  const [rows] = await pool.query(
    'SELECT id, name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id, sort_order FROM courses ORDER BY sort_order ASC, name ASC, id DESC'
  )
  return rows.map(r => ({ ...r, discount_per_student: parseFloat(r.discount_per_student) }))
}

export async function reorderCourses(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  // 一次更新：用 CASE WHEN 把每個 id 對應到它的新 sort_order（每筆相差 10）
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = `UPDATE courses SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (?)`
  await pool.query(sql, [...orderedIds, orderedIds])
}

export async function insertCourse({ id, name, hourlyRate, teacherHourlyRate, discountPerStudent, defaultTeacherId }) {
  await pool.query(
    'INSERT INTO courses (id, name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, hourlyRate ?? 0, teacherHourlyRate ?? 0, discountPerStudent ?? 0, defaultTeacherId || null]
  )
}

export async function updateCourse(id, { name, hourlyRate, teacherHourlyRate, discountPerStudent, defaultTeacherId }) {
  const sets = []
  const params = []
  if (name               !== undefined) { sets.push('name = ?');                 params.push(name) }
  if (hourlyRate         !== undefined) { sets.push('hourly_rate = ?');          params.push(hourlyRate) }
  if (teacherHourlyRate  !== undefined) { sets.push('teacher_hourly_rate = ?');  params.push(teacherHourlyRate) }
  if (discountPerStudent !== undefined) { sets.push('discount_per_student = ?'); params.push(discountPerStudent) }
  if (defaultTeacherId   !== undefined) { sets.push('default_teacher_id = ?');   params.push(defaultTeacherId || null) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteCourse(id) {
  const [res] = await pool.query('DELETE FROM courses WHERE id = ?', [id])
  return res.affectedRows > 0
}

function priceForLessonRecord(lr, sessionStudents) {
  if (lr.unit_price !== null && lr.unit_price !== undefined) return parseFloat(lr.unit_price)
  const key = `${lr.course_id}::${lr.lesson_date}::${lr.teacher_id}`
  const N = sessionStudents.get(key)?.size ?? 1
  const base = parseFloat(lr.course_hourly_rate ?? lr.hourly_rate ?? 0)
  const perStudent = parseFloat(lr.course_discount_per_student ?? 0)
  if (perStudent && perStudent > 0) return Math.max(0, Math.round(base - perStudent * Math.max(0, N - 1)))
  return base
}

async function loadGroupMemberCounts(groupIds) {
  const out = new Map()
  if (!groupIds.length) return out
  const [rows] = await pool.query(
    'SELECT group_id, COUNT(*) AS n FROM group_members WHERE group_id IN (?) GROUP BY group_id',
    [groupIds]
  )
  for (const r of rows) out.set(r.group_id, parseInt(r.n, 10))
  // 沒設報名名單的團課，fallback 用該期間實際出席人數推算（保守用 1）
  for (const id of groupIds) if (!out.has(id)) out.set(id, 1)
  return out
}

function buildSessionStudents(records) {
  const map = new Map()
  for (const lr of records) {
    const key = `${lr.course_id}::${lr.lesson_date}::${lr.teacher_id}`
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(lr.student_id)
  }
  return map
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
            lr.hours, lr.lesson_date, lr.start_time, lr.unit_price, lr.teacher_unit_price, lr.note, lr.status,
            c.hourly_rate         AS course_hourly_rate,
            c.teacher_hourly_rate AS course_teacher_hourly_rate,
            lv.id IS NOT NULL     AS is_on_leave,
            lv.id                 AS leave_request_id,
            lv.reason             AS leave_reason
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id
     JOIN courses  c ON c.id = lr.course_id
     JOIN teachers t ON t.id = lr.teacher_id
     LEFT JOIN leave_requests lv
       ON (lv.lesson_record_id = lr.id)
       OR (lv.lesson_record_id IS NULL
           AND lv.student_id = lr.student_id
           AND lv.course_id  = lr.course_id
           AND lv.leave_date = lr.lesson_date)
     ${where}
     ORDER BY lr.lesson_date DESC, lr.start_time ASC, lr.created_at DESC`,
    params
  )
  return rows.map(r => ({ ...r, is_on_leave: !!r.is_on_leave }))
}

export async function insertLesson({ id, studentId, courseId, teacherId, hours, lessonDate, startTime, unitPrice, teacherUnitPrice, note, status }) {
  await pool.query(
    `INSERT INTO lesson_records (id, student_id, course_id, teacher_id, hours, lesson_date, start_time, unit_price, teacher_unit_price, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, courseId, teacherId, hours, lessonDate, startTime || null, unitPrice ?? null, teacherUnitPrice ?? null, note || '', status || 'pending']
  )
}

export async function updateLesson(id, { studentId, courseId, teacherId, hours, lessonDate, startTime, unitPrice, teacherUnitPrice, note, status }) {
  const sets = []
  const params = []
  if (studentId        !== undefined) { sets.push('student_id = ?');         params.push(studentId) }
  if (courseId         !== undefined) { sets.push('course_id = ?');          params.push(courseId) }
  if (teacherId        !== undefined) { sets.push('teacher_id = ?');         params.push(teacherId) }
  if (hours            !== undefined) { sets.push('hours = ?');              params.push(hours) }
  if (lessonDate       !== undefined) { sets.push('lesson_date = ?');        params.push(lessonDate) }
  if (startTime        !== undefined) { sets.push('start_time = ?');         params.push(startTime || null) }
  if (unitPrice        !== undefined) { sets.push('unit_price = ?');         params.push(unitPrice) }
  if (teacherUnitPrice !== undefined) { sets.push('teacher_unit_price = ?'); params.push(teacherUnitPrice) }
  if (note             !== undefined) { sets.push('note = ?');               params.push(note) }
  if (status           !== undefined) { sets.push('status = ?');             params.push(status) }
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
  // 逐筆取出，讓每筆紀錄的 unit_price 覆蓋優先於課程預設；其次查 course_rates 對照表（依當日同課同師實際出席人數），最後 fallback course.hourly_rate
  const [rows] = await pool.query(
    `SELECT
       lr.student_id,
       s.name                                        AS student_name,
       lr.course_id,
       c.name                                        AS course_name,
       lr.teacher_id,
       lr.lesson_date,
       lr.hours,
       lr.unit_price,
       c.hourly_rate                                 AS course_hourly_rate,
       c.discount_per_student                        AS course_discount_per_student
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id
     JOIN courses  c ON c.id = lr.course_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY s.name ASC, c.name ASC`,
    [from, to]
  )

  const sessionStudents = buildSessionStudents(rows)

  // 先依 student + course + unit_price 合算，再彙整
  const map = new Map()
  for (const row of rows) {
    const unitPrice = priceForLessonRecord(row, sessionStudents)
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: new Map(), total: 0 })
    }
    const student  = map.get(row.student_id)
    const key      = `${row.course_id}::${unitPrice}`
    if (!student.courses.has(key)) {
      student.courses.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, unit_price: unitPrice, amount: 0 })
    }
    const entry = student.courses.get(key)
    const h = parseFloat(row.hours)
    entry.total_hours = Math.round((entry.total_hours + h) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.unit_price)
    student.total += Math.round(h * unitPrice)
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
       t.name                                                          AS teacher_name,
       lr.course_id,
       c.name                                                          AS course_name,
       lr.hours,
       COALESCE(lr.teacher_unit_price, c.teacher_hourly_rate)          AS hourly_rate
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
    'SELECT id, name, unit_price FROM materials ORDER BY unit_price DESC, id DESC'
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
    'SELECT id, name, weekdays, duration_months, monthly_fee, start_time, duration_hours, note, default_teacher_id, sort_order FROM `groups` ORDER BY sort_order ASC, monthly_fee DESC, id DESC'
  )
  return rows.map(r => ({ ...r, duration_hours: parseFloat(r.duration_hours) }))
}

export async function reorderGroups(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = 'UPDATE `groups` SET sort_order = CASE id ' + cases + ' ELSE sort_order END WHERE id IN (?)'
  await pool.query(sql, [...orderedIds, orderedIds])
}

export async function insertGroup({ id, name, weekdays, durationMonths, monthlyFee, startTime, durationHours, note, defaultTeacherId }) {
  await pool.query(
    'INSERT INTO `groups` (id, name, weekdays, duration_months, monthly_fee, start_time, duration_hours, note, default_teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, weekdays || '', durationMonths ?? 0, monthlyFee ?? 0, startTime || null, durationHours ?? 0, note || '', defaultTeacherId || null]
  )
}

export async function updateGroup(id, { name, weekdays, durationMonths, monthlyFee, startTime, durationHours, note, defaultTeacherId }) {
  const sets = []; const params = []
  if (name             !== undefined) { sets.push('name = ?');               params.push(name) }
  if (weekdays         !== undefined) { sets.push('weekdays = ?');           params.push(weekdays || '') }
  if (durationMonths   !== undefined) { sets.push('duration_months = ?');    params.push(durationMonths) }
  if (monthlyFee       !== undefined) { sets.push('monthly_fee = ?');        params.push(monthlyFee) }
  if (startTime        !== undefined) { sets.push('start_time = ?');         params.push(startTime || null) }
  if (durationHours    !== undefined) { sets.push('duration_hours = ?');     params.push(durationHours) }
  if (note             !== undefined) { sets.push('note = ?');               params.push(note || '') }
  if (defaultTeacherId !== undefined) { sets.push('default_teacher_id = ?'); params.push(defaultTeacherId || null) }
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

export async function listGroupRecords({ from, to, groupId, studentId, teacherId } = {}) {
  const conditions = []; const params = []
  if (from)      { conditions.push('gr.record_date >= ?'); params.push(from) }
  if (to)        { conditions.push('gr.record_date <= ?'); params.push(to) }
  if (groupId)   { conditions.push('gr.group_id = ?');     params.push(groupId) }
  if (studentId) { conditions.push('gr.student_id = ?');   params.push(studentId) }
  if (teacherId) { conditions.push('gr.teacher_id = ?');   params.push(teacherId) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await pool.query(
    `SELECT gr.id, gr.group_id, g.name AS group_name,
            gr.student_id, s.name AS student_name,
            gr.teacher_id, t.name AS teacher_name,
            gr.record_date, gr.note, gr.status,
            g.start_time AS group_start_time,
            g.duration_hours AS group_duration_hours
     FROM group_records gr
     JOIN \`groups\`  g ON g.id = gr.group_id
     JOIN students   s ON s.id = gr.student_id
     LEFT JOIN teachers t ON t.id = gr.teacher_id
     ${where}
     ORDER BY gr.record_date DESC, gr.created_at DESC`,
    params
  )
  return rows
}

export async function insertGroupRecord({ id, groupId, studentId, teacherId, recordDate, note, status }) {
  await pool.query(
    `INSERT INTO group_records (id, group_id, student_id, teacher_id, record_date, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, groupId, studentId, teacherId || null, recordDate, note || '', status || 'pending']
  )
}

export async function updateGroupRecord(id, { groupId, studentId, teacherId, recordDate, note, status }) {
  const sets = []; const params = []
  if (groupId    !== undefined) { sets.push('group_id = ?');    params.push(groupId) }
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (teacherId  !== undefined) { sets.push('teacher_id = ?');  params.push(teacherId || null) }
  if (recordDate !== undefined) { sets.push('record_date = ?'); params.push(recordDate) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note || '') }
  if (status     !== undefined) { sets.push('status = ?');      params.push(status) }
  if (!sets.length) return false
  params.push(id)
  const [res] = await pool.query(`UPDATE group_records SET ${sets.join(', ')} WHERE id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteGroupRecord(id) {
  const [res] = await pool.query('DELETE FROM group_records WHERE id = ?', [id])
  return res.affectedRows > 0
}

// ── Group Members（應到名單） ─────────────────────────────────────────────────

export async function listGroupMembers(groupId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.name
       FROM group_members gm
       JOIN students s ON s.id = gm.student_id
      WHERE gm.group_id = ?
      ORDER BY s.name ASC, s.id ASC`,
    [groupId]
  )
  return rows
}

export async function setGroupMembers(groupId, studentIds) {
  const cleaned = Array.from(new Set((studentIds || []).filter(Boolean)))
  const [existRows] = await pool.query(
    'SELECT student_id FROM group_members WHERE group_id = ?',
    [groupId]
  )
  const existingSet = new Set(existRows.map(r => r.student_id))
  const newlyAdded = cleaned.filter(sid => !existingSet.has(sid))

  await pool.query('DELETE FROM group_members WHERE group_id = ?', [groupId])
  if (cleaned.length) {
    const values = cleaned.map(sid => [groupId, sid])
    await pool.query('INSERT INTO group_members (group_id, student_id) VALUES ?', [values])
  }

  for (const sid of newlyAdded) {
    try { await backfillGroupRecordsForStudent(groupId, sid) }
    catch (e) { console.error('[backfillGroupRecords] failed:', groupId, sid, e) }
  }
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
  // 家教課：先抓區間內 *所有* lessons（不只該生）以計算「同日同課同師」實際人數
  const [allLessonRows] = await pool.query(
    `SELECT lr.student_id, lr.teacher_id, lr.lesson_date, lr.hours, lr.unit_price, lr.note,
            c.id AS course_id, c.name AS course_name, c.hourly_rate AS course_hourly_rate, c.discount_per_student AS course_discount_per_student,
            t.name AS teacher_name
     FROM lesson_records lr
     JOIN courses  c ON c.id = lr.course_id
     JOIN teachers t ON t.id = lr.teacher_id
     WHERE lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY lr.lesson_date ASC`,
    [from, to]
  )
  const sessionStudents = buildSessionStudents(allLessonRows)
  const lessonRows = allLessonRows.filter(r => r.student_id === studentId)

  const courseMap = new Map()
  let total = 0
  const lessons = lessonRows.map(row => {
    const unit = priceForLessonRecord(row, sessionStudents)
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

// ── Payment Records ───────────────────────────────────────────────────────────

export async function listPaymentRecords({ from, to } = {}) {
  const conditions = []; const params = []
  if (from) { conditions.push('pr.period_from >= ?'); params.push(from) }
  if (to)   { conditions.push('pr.period_to <= ?');   params.push(to) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const [rows] = await pool.query(
    `SELECT pr.id, pr.student_id, s.name AS student_name,
            pr.period_from, pr.period_to, pr.paid_at, pr.note
     FROM payment_records pr
     JOIN students s ON s.id = pr.student_id
     ${where}
     ORDER BY pr.paid_at DESC`,
    params
  )
  return rows
}

export async function insertPaymentRecord({ id, studentId, periodFrom, periodTo, note }) {
  await pool.query(
    `INSERT INTO payment_records (id, student_id, period_from, period_to, note)
     VALUES (?, ?, ?, ?, ?)`,
    [id, studentId, periodFrom, periodTo, note || '']
  )
}

export async function deletePaymentRecord(id) {
  const [res] = await pool.query('DELETE FROM payment_records WHERE id = ?', [id])
  return res.affectedRows > 0
}
