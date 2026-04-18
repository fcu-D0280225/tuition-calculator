import express from 'express'
import {
  initSchema,
  // students
  listStudents, insertStudent, updateStudentName, deleteStudent,
  // teachers
  listTeachers, insertTeacher, updateTeacherName, deleteTeacher,
  // courses
  listCourses, insertCourse, updateCourseName, deleteCourse,
  // student prices
  listStudentPrices, upsertStudentPrice, deleteStudentPrice,
  // teacher rates
  listTeacherRates, upsertTeacherRate, deleteTeacherRate,
  // lessons
  listLessons, insertLesson, updateLesson, deleteLesson,
  // settlement
  settlementTuition, settlementSalary,
} from './db.js'

const PORT = parseInt(process.env.PORT || '3100', 10)

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

await initSchema()

const app = express()
app.use(express.json({ limit: '2mb' }))

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Students ──────────────────────────────────────────────────────────────────

app.get('/api/students', async (_req, res) => {
  try { res.json(await listStudents()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/students', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = genId('sr')
  try { await insertStudent({ id, name }); res.status(201).json({ id, name }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/students/:id', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateStudentName(req.params.id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, name })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/students/:id', async (req, res) => {
  try {
    const ok = await deleteStudent(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Student prices ────────────────────────────────────────────────────────────

app.get('/api/students/:studentId/prices', async (req, res) => {
  try { res.json(await listStudentPrices(req.params.studentId)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/students/:studentId/prices/:courseId', async (req, res) => {
  const unitPrice = parseFloat(req.body?.unit_price)
  if (isNaN(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'invalid_unit_price' })
  const id = genId('scp')
  try {
    await upsertStudentPrice({ id, studentId: req.params.studentId, courseId: req.params.courseId, unitPrice })
    res.json({ student_id: req.params.studentId, course_id: req.params.courseId, unit_price: unitPrice })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/students/:studentId/prices/:courseId', async (req, res) => {
  try {
    const ok = await deleteStudentPrice(req.params.studentId, req.params.courseId)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Teachers ──────────────────────────────────────────────────────────────────

app.get('/api/teachers', async (_req, res) => {
  try { res.json(await listTeachers()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/teachers', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = genId('tr')
  try { await insertTeacher({ id, name }); res.status(201).json({ id, name }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/teachers/:id', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateTeacherName(req.params.id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, name })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const ok = await deleteTeacher(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Teacher rates ─────────────────────────────────────────────────────────────

app.get('/api/teachers/:teacherId/rates', async (req, res) => {
  try { res.json(await listTeacherRates(req.params.teacherId)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/teachers/:teacherId/rates/:courseId', async (req, res) => {
  const hourlyRate = parseFloat(req.body?.hourly_rate)
  if (isNaN(hourlyRate) || hourlyRate < 0) return res.status(400).json({ error: 'invalid_hourly_rate' })
  const id = genId('tcr')
  try {
    await upsertTeacherRate({ id, teacherId: req.params.teacherId, courseId: req.params.courseId, hourlyRate })
    res.json({ teacher_id: req.params.teacherId, course_id: req.params.courseId, hourly_rate: hourlyRate })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/teachers/:teacherId/rates/:courseId', async (req, res) => {
  try {
    const ok = await deleteTeacherRate(req.params.teacherId, req.params.courseId)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Courses ───────────────────────────────────────────────────────────────────

app.get('/api/courses', async (_req, res) => {
  try { res.json(await listCourses()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/courses', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = genId('cr')
  try { await insertCourse({ id, name }); res.status(201).json({ id, name }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/courses/:id', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateCourseName(req.params.id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, name })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const ok = await deleteCourse(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Lesson Records ────────────────────────────────────────────────────────────

app.get('/api/lessons', async (req, res) => {
  const { from, to, student_id, teacher_id, course_id } = req.query
  try {
    const rows = await listLessons({ from, to, studentId: student_id, teacherId: teacher_id, courseId: course_id })
    res.json(rows)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/lessons', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, note } = req.body || {}
  if (!student_id || !course_id || !teacher_id) return res.status(400).json({ error: 'student_id_course_id_teacher_id_required' })
  const parsedHours = parseFloat(hours)
  if (isNaN(parsedHours) || parsedHours <= 0) return res.status(400).json({ error: 'invalid_hours' })
  if (!lesson_date || !/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) return res.status(400).json({ error: 'invalid_lesson_date' })
  const id = genId('lr')
  try {
    await insertLesson({ id, studentId: student_id, courseId: course_id, teacherId: teacher_id, hours: parsedHours, lessonDate: lesson_date, note })
    res.status(201).json({ id, student_id, course_id, teacher_id, hours: parsedHours, lesson_date, note: note || '' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/lessons/:id', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, note } = req.body || {}
  const update = {}
  if (student_id  !== undefined) update.studentId  = student_id
  if (course_id   !== undefined) update.courseId   = course_id
  if (teacher_id  !== undefined) update.teacherId  = teacher_id
  if (hours       !== undefined) update.hours      = parseFloat(hours)
  if (lesson_date !== undefined) update.lessonDate = lesson_date
  if (note        !== undefined) update.note       = note
  try {
    const ok = await updateLesson(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/lessons/:id', async (req, res) => {
  try {
    const ok = await deleteLesson(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Settlement ────────────────────────────────────────────────────────────────

app.get('/api/settlement/tuition', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from_and_to_required' })
  try { res.json(await settlementTuition(from, to)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/settlement/salary', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from_and_to_required' })
  try { res.json(await settlementSalary(from, to)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[tuition-calculator-backend] listening on :${PORT}`)
})
