const API_BASE = '/api'

const PUBLIC_PATHS = ['/auth/login', '/auth/logout', '/auth/me', '/health']

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers,
  })
  if (res.status === 401 && !PUBLIC_PATHS.some(p => path.startsWith(p)) && !path.startsWith('/share/')) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const apiAuthMe     = ()                   => request('/auth/me')
export const apiAuthLogin  = (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
export const apiAuthLogout = ()                   => request('/auth/logout', { method: 'POST' })
export const apiAuthChangePassword = (current_password, new_password) =>
  request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) })

// ── Admin: user management ───────────────────────────────────────────────────

export const apiAdminListUsers  = ()      => request('/admin/users')
export const apiAdminCreateUser = (body)  => request('/admin/users', { method: 'POST', body: JSON.stringify(body) })
export const apiAdminUpdateUser = (id, patch) =>
  request(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiAdminDeleteUser = (id)    =>
  request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const apiAdminListGroups  = ()       => request('/admin/groups')
export const apiAdminCreateGroup = (body)   => request('/admin/groups', { method: 'POST', body: JSON.stringify(body) })
export const apiAdminUpdateGroup = (id, patch) =>
  request(`/admin/groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiAdminDeleteGroup = (id)     =>
  request(`/admin/groups/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Students ──────────────────────────────────────────────────────────────────

export const apiListStudents    = ()           => request('/students')
export const apiCreateStudent   = (body)       => request('/students', { method: 'POST', body: JSON.stringify(typeof body === 'string' ? { name: body } : body) })
export const apiUpdateStudent   = (id, patch)  => request(`/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteStudent   = (id)         => request(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const apiListStudentCourses = (id)      => request(`/students/${encodeURIComponent(id)}/courses`)
export const apiGetStudentEnrollment = (id)    => request(`/students/${encodeURIComponent(id)}/enrollment`)
export const apiSetStudentEnrollment = (id, body) =>
  request(`/students/${encodeURIComponent(id)}/enrollment`, { method: 'PUT', body: JSON.stringify(body) })
export const apiListAllEnrollments = ()        => request('/enrollments')

// ── Teachers ──────────────────────────────────────────────────────────────────

export const apiListTeachers    = ()           => request('/teachers')
export const apiCreateTeacher   = (name)       => request('/teachers', { method: 'POST', body: JSON.stringify({ name }) })
export const apiRenameTeacher   = (id, name)   => request(`/teachers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiDeleteTeacher   = (id)         => request(`/teachers/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Courses ───────────────────────────────────────────────────────────────────

export const apiListCourses     = ()                        => request('/courses')
export const apiCreateCourse    = (name, hourly_rate = 0, teacher_hourly_rate = 0, discount_per_student = 0, default_teacher_id = null) => request('/courses', { method: 'POST', body: JSON.stringify({ name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id }) })
export const apiUpdateCourse    = (id, patch)              => request(`/courses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteCourse    = (id)                     => request(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const apiReorderCourses  = (ids)                    => request('/courses/reorder', { method: 'PUT', body: JSON.stringify({ ids }) })

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

// ── Groups ────────────────────────────────────────────────────────────────────

export const apiListGroups   = ()         => request('/groups')
export const apiCreateGroup  = (group)    => request('/groups', { method: 'POST', body: JSON.stringify(group) })
export const apiUpdateGroup  = (id, patch) => request(`/groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteGroup  = (id)       => request(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Group Records ─────────────────────────────────────────────────────────────

export const apiListGroupRecords = ({ from, to, group_id, student_id } = {}) => {
  const params = new URLSearchParams()
  if (from)       params.set('from', from)
  if (to)         params.set('to', to)
  if (group_id)   params.set('group_id', group_id)
  if (student_id) params.set('student_id', student_id)
  const qs = params.toString()
  return request(`/group-records${qs ? '?' + qs : ''}`)
}
export const apiListGroupMembers = (groupId) =>
  request(`/groups/${encodeURIComponent(groupId)}/members`)
export const apiSetGroupMembers = (groupId, studentIds) =>
  request(`/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'PUT',
    body: JSON.stringify({ student_ids: studentIds }),
  })

export const apiCreateGroupRecord = (record) => request('/group-records', { method: 'POST', body: JSON.stringify(record) })
export const apiUpdateGroupRecord = (id, patch) => request(`/group-records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiDeleteGroupRecord = (id) => request(`/group-records/${encodeURIComponent(id)}`, { method: 'DELETE' })

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

// ── Payment Records ───────────────────────────────────────────────────────────

export const apiListPaymentRecords = ({ from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to)   params.set('to', to)
  const qs = params.toString()
  return request(`/payment-records${qs ? '?' + qs : ''}`)
}
export const apiCreatePaymentRecord = (record) =>
  request('/payment-records', { method: 'POST', body: JSON.stringify(record) })
export const apiDeletePaymentRecord = (id) =>
  request(`/payment-records/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Settlement ────────────────────────────────────────────────────────────────

export const apiSettlementTuition = (from, to) =>
  request(`/settlement/tuition?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

export const apiSettlementSalary = (from, to) =>
  request(`/settlement/salary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

// ── Leave Requests ────────────────────────────────────────────────────────────

export const apiListStudentLeaveRequests = (studentId, { from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to)   params.set('to', to)
  const qs = params.toString()
  return request(`/students/${encodeURIComponent(studentId)}/leave-requests${qs ? '?' + qs : ''}`)
}
export const apiCreateLeaveRequest = (body) =>
  request('/leave-requests', { method: 'POST', body: JSON.stringify(body) })
export const apiDeleteLeaveRequest = (id) =>
  request(`/leave-requests/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Share Tokens ──────────────────────────────────────────────────────────────

export const apiCreateShareToken = (studentId, { from, to, expires_days } = {}) =>
  request(`/students/${encodeURIComponent(studentId)}/share-token`, {
    method: 'POST',
    body: JSON.stringify({ from, to, expires_days }),
  })

export const apiGetShare = (token) =>
  request(`/share/${encodeURIComponent(token)}`)
