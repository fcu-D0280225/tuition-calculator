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
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { /* not json */ }
    const err = new Error(`API ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`)
    err.status = res.status
    err.body   = body
    throw err
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
export const apiSetStudentActive = (id, active) => request(`/students/${encodeURIComponent(id)}/active`, { method: 'PUT', body: JSON.stringify({ active: !!active }) })
export const apiReorderStudents = (ids)        => request('/students/reorder', { method: 'PUT', body: JSON.stringify({ ids }) })
export const apiListStudentCourses = (id)      => request(`/students/${encodeURIComponent(id)}/courses`)
export const apiGetStudentEnrollment = (id)    => request(`/students/${encodeURIComponent(id)}/enrollment`)
export const apiSetStudentEnrollment = (id, body) =>
  request(`/students/${encodeURIComponent(id)}/enrollment`, { method: 'PUT', body: JSON.stringify(body) })
export const apiListAllEnrollments = ()        => request('/enrollments')

// ── Teachers ──────────────────────────────────────────────────────────────────

export const apiListTeachers    = ()           => request('/teachers')
export const apiCreateTeacher   = (body)       => request('/teachers', { method: 'POST', body: JSON.stringify(typeof body === 'string' ? { name: body } : body) })
export const apiRenameTeacher   = (id, name)   => request(`/teachers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const apiUpdateTeacher   = (id, patch)  => request(`/teachers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const apiSetTeacherActive = (id, active) => request(`/teachers/${encodeURIComponent(id)}/active`, { method: 'PUT', body: JSON.stringify({ active: !!active }) })
export const apiListTeacherCourses = (id) => request(`/teachers/${encodeURIComponent(id)}/courses`)
export const apiReorderTeachers = (ids)        => request('/teachers/reorder', { method: 'PUT', body: JSON.stringify({ ids }) })

// ── Courses ───────────────────────────────────────────────────────────────────

export const apiListCourses     = ()                        => request('/courses')
export const apiCreateCourse    = (name, hourly_rate = 0, teacher_hourly_rate = 0, discount_per_student = 0, default_teacher_id = null, duration_hours = 1) => request('/courses', { method: 'POST', body: JSON.stringify({ name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id, duration_hours }) })
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
export const apiReorderGroups = (ids)     => request('/groups/reorder', { method: 'PUT', body: JSON.stringify({ ids }) })

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

// 嘗試建立上課紀錄；遇 409 重複則呼叫 confirmFn(existing, lesson) 由呼叫端決定要不要 force
export async function apiCreateLessonWithDupCheck(lesson, confirmFn) {
  try {
    return await apiCreateLesson(lesson)
  } catch (e) {
    if (e?.status === 409 && e?.body?.error === 'duplicate_lesson') {
      const ok = await confirmFn(e.body.existing || [], lesson)
      if (!ok) {
        const skipped = new Error('duplicate_skipped')
        skipped.skipped = true
        throw skipped
      }
      return await apiCreateLesson({ ...lesson, force: true })
    }
    throw e
  }
}

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

// ── Misc Expenses ─────────────────────────────────────────────────────────────

export const apiListMiscExpenses = ({ from, to, category } = {}) => {
  const params = new URLSearchParams()
  if (from)     params.set('from', from)
  if (to)       params.set('to', to)
  if (category) params.set('category', category)
  const qs = params.toString()
  return request(`/misc-expenses${qs ? '?' + qs : ''}`)
}
export const apiSumMiscExpensesByCategory = ({ from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to)   params.set('to', to)
  const qs = params.toString()
  return request(`/misc-expenses/summary${qs ? '?' + qs : ''}`)
}
export const apiCreateMiscExpense = (body)     => request('/misc-expenses', { method: 'POST', body: JSON.stringify(body) })
export const apiUpdateMiscExpense = (id, body) => request(`/misc-expenses/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
export const apiDeleteMiscExpense = (id)       => request(`/misc-expenses/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Period Locks ──────────────────────────────────────────────────────────────

export const apiListPeriodLocks   = ()      => request('/period-locks')
export const apiCreatePeriodLock  = (body)  => request('/period-locks', { method: 'POST', body: JSON.stringify(body) })
export const apiDeletePeriodLock  = (id)    => request(`/period-locks/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Settlement ────────────────────────────────────────────────────────────────

export const apiSettlementTuition = (from, to) =>
  request(`/settlement/tuition?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

export const apiSettlementSalary = (from, to) =>
  request(`/settlement/salary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

export const apiProfitLoss = (from, to) =>
  request(`/settlement/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

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
