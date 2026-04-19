const API_BASE = '/api'
const TOKEN_KEY = 'tuition_calc.auth_token'

let onUnauthorized = null
export function setOnUnauthorized(fn) { onUnauthorized = fn }

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore storage errors */ }
}
export function clearToken() { setToken(null) }

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    if (onUnauthorized) onUnauthorized()
    throw new Error(`API ${options.method || 'GET'} ${path} failed: 401`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`login failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  if (data?.token) setToken(data.token)
  return data
}

export async function apiLogout() {
  try { await request('/logout', { method: 'POST' }) } catch { /* ignore */ }
  clearToken()
}

export const apiMe = () => request('/me')

export const apiChangePassword = (current_password, new_password) =>
  request('/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })

// ── Students ──────────────────────────────────────────────────────────────────

export const apiListStudents    = ()           => request('/students')
export const apiCreateStudent   = (name)       => request('/students', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameStudent   = (id, name)   => request(`/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteStudent   = (id)         => request(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Teachers ──────────────────────────────────────────────────────────────────

export const apiListTeachers    = ()           => request('/teachers')
export const apiCreateTeacher   = (name)       => request('/teachers', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameTeacher   = (id, name)   => request(`/teachers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteTeacher   = (id)         => request(`/teachers/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Courses ───────────────────────────────────────────────────────────────────

export const apiListCourses     = ()                        => request('/courses')
export const apiCreateCourse    = (name, hourly_rate = 0)  => request('/courses', { method: 'POST', body: JSON.stringify({ name, hourly_rate }) })
export const apiUpdateCourse    = (id, patch)              => request(`/courses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteCourse    = (id)                     => request(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Materials ─────────────────────────────────────────────────────────────────

export const apiListMaterials   = ()              => request('/materials')
export const apiCreateMaterial  = (name, unit_price = 0) => request('/materials', { method: 'POST', body: JSON.stringify({ name, unit_price }) })
export const apiUpdateMaterial  = (id, patch)     => request(`/materials/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteMaterial  = (id)            => request(`/materials/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Material Records ──────────────────────────────────────────────────────────

export const apiListMaterialRecords = ({ from, to, student_id } = {}) => {
  const params = new URLSearchParams()
  if (from)       params.set('from', from)
  if (to)         params.set('to', to)
  if (student_id) params.set('student_id', student_id)
  const qs = params.toString()
  return request(`/material-records${qs ? '?' + qs : ''}`)
}
export const apiCreateMaterialRecord = (record) => request('/material-records', { method: 'POST', body: JSON.stringify(record) })
export const apiUpdateMaterialRecord = (id, patch) => request(`/material-records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteMaterialRecord = (id) => request(`/material-records/${encodeURIComponent(id)}`, { method: 'DELETE' })

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
