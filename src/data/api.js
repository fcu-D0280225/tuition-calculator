const API_BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Students ──────────────────────────────────────────────────────────────────

export const apiListStudents    = ()           => request('/students')
export const apiCreateStudent   = (name)       => request('/students', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameStudent   = (id, name)   => request(`/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteStudent   = (id)         => request(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Student prices ────────────────────────────────────────────────────────────

export const apiListStudentPrices    = (studentId)              => request(`/students/${encodeURIComponent(studentId)}/prices`)
export const apiSetStudentPrice      = (studentId, courseId, unit_price) => request(`/students/${encodeURIComponent(studentId)}/prices/${encodeURIComponent(courseId)}`, { method: 'PUT', body: JSON.stringify({ unit_price }) })
export const apiDeleteStudentPrice   = (studentId, courseId)    => request(`/students/${encodeURIComponent(studentId)}/prices/${encodeURIComponent(courseId)}`, { method: 'DELETE' })

// ── Teachers ──────────────────────────────────────────────────────────────────

export const apiListTeachers    = ()           => request('/teachers')
export const apiCreateTeacher   = (name)       => request('/teachers', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameTeacher   = (id, name)   => request(`/teachers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteTeacher   = (id)         => request(`/teachers/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Teacher rates ─────────────────────────────────────────────────────────────

export const apiListTeacherRates     = (teacherId)              => request(`/teachers/${encodeURIComponent(teacherId)}/rates`)
export const apiSetTeacherRate       = (teacherId, courseId, hourly_rate) => request(`/teachers/${encodeURIComponent(teacherId)}/rates/${encodeURIComponent(courseId)}`, { method: 'PUT', body: JSON.stringify({ hourly_rate }) })
export const apiDeleteTeacherRate    = (teacherId, courseId)    => request(`/teachers/${encodeURIComponent(teacherId)}/rates/${encodeURIComponent(courseId)}`, { method: 'DELETE' })

// ── Courses ───────────────────────────────────────────────────────────────────

export const apiListCourses     = ()           => request('/courses')
export const apiCreateCourse    = (name)       => request('/courses', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameCourse    = (id, name)   => request(`/courses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteCourse    = (id)         => request(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Lesson Records ────────────────────────────────────────────────────────────

export const apiListLessons = ({ from, to, student_id, teacher_id, course_id } = {}) => {
  const params = new URLSearchParams()
  if (from)       params.set('from', from)
  if (to)         params.set('to', to)
  if (student_id) params.set('student_id', student_id)
  if (teacher_id) params.set('teacher_id', teacher_id)
  if (course_id)  params.set('course_id', course_id)
  const qs = params.toString()
  return request(`/lessons${qs ? '?' + qs : ''}`)
}

export const apiCreateLesson = (lesson) =>
  request('/lessons', { method: 'POST', body: JSON.stringify(lesson) })

export const apiUpdateLesson = (id, patch) =>
  request(`/lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const apiDeleteLesson = (id) =>
  request(`/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Settlement ────────────────────────────────────────────────────────────────

export const apiSettlementTuition = (from, to) =>
  request(`/settlement/tuition?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

export const apiSettlementSalary = (from, to) =>
  request(`/settlement/salary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
