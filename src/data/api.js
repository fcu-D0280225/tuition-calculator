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

export function apiListStudents() {
  return request('/students')
}

export function apiCreateStudent(name) {
  return request('/students', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function apiRenameStudent(id, name) {
  return request(`/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function apiDeleteStudent(id) {
  return request(`/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function apiGetMonthProjects() {
  return request('/month-projects')
}

export function apiPutMonthProjects(state) {
  return request('/month-projects', {
    method: 'PUT',
    body: JSON.stringify(state),
  })
}

export function apiGetCatalog() {
  return request('/catalog')
}

export function apiPutCatalog(items) {
  return request('/catalog', {
    method: 'PUT',
    body: JSON.stringify(items),
  })
}
