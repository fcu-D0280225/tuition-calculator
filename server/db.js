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
    CREATE TABLE IF NOT EXISTS app_state (
      state_key   VARCHAR(64) NOT NULL PRIMARY KEY,
      value       JSON        NOT NULL,
      updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
}

export async function getAppState(key) {
  const [rows] = await pool.query(
    'SELECT value FROM app_state WHERE state_key = ?',
    [key]
  )
  if (!rows.length) return null
  const raw = rows[0].value
  if (raw === null || raw === undefined) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function setAppState(key, value) {
  const json = JSON.stringify(value)
  await pool.query(
    `INSERT INTO app_state (state_key, value) VALUES (?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE value = CAST(? AS JSON)`,
    [key, json, json]
  )
}

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
