// Works whether VITE_API_URL is "https://host" or "https://host/api"
const ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '').replace(/\/api$/, '')
export const API = ROOT + '/api'

export const getToken = () => sessionStorage.getItem('token')
export const setToken = (t) => (t ? sessionStorage.setItem('token', t) : sessionStorage.removeItem('token'))

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = 'Bearer ' + t
  let payload
  if (form) { payload = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded' }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json' }
  let res
  try { res = await fetch(API + path, { method, headers, body: payload }) }
  catch { throw new Error('Cannot reach the server. Please try again.') }
  if (!res.ok) {
    let msg = 'Something went wrong'
    try {
      const d = await res.json()
      msg = typeof d.detail === 'string' ? d.detail : Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join(', ') : msg
    } catch { /* keep default */ }
    const e = new Error(msg); e.status = res.status; throw e
  }
  return res
}

export async function api(path, opts) {
  const res = await request(path, opts)
  return res.status === 204 ? null : res.json()
}
// For paginated endpoints: returns { items, total } using the X-Total-Count header
export async function apiList(path) {
  const res = await request(path)
  const items = await res.json()
  return { items, total: Number(res.headers.get('X-Total-Count') || items.length) }
}
export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString()

export const JOB_TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', fresher: 'Fresher', temporary: 'Temporary', internship: 'Internship' }
export const WORKPLACES = { in_person: 'In person', remote: 'Remote', hybrid: 'Hybrid' }
export const CATEGORIES = { private: 'Private', government: 'Government', contract: 'Contract', ngo: 'NGO' }
export const TIMELINES = ['1 to 3 days', '3 to 7 days', '1 to 2 weeks', '2 to 4 weeks', 'More than 4 weeks']
export const STATUS_LABEL = { new: 'Applied', reviewing: 'Application viewed', contacting: 'Employer contacted you', interviewing: 'Interview', hired: 'Hired', rejected: 'Not selected by employer' }

const asDate = (d) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d : d + 'Z')   // server sends UTC without a zone
export function timeAgo(d) {
  if (!d) return ''
  const s = Math.max(0, (Date.now() - asDate(d)) / 1000)
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago'
  return asDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export const shortDate = (d) => asDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

const money = (n) => 'Rs ' + Number(n).toLocaleString('en-PK')
export function payText(j) {
  const { salary_min: a, salary_max: b, salary_period: p } = j
  if (!a && !b) return ''
  const per = ' a ' + (p || 'month')
  if (a && b) return a === b ? money(a) + per : `${money(a)} - ${money(b)}${per}`
  return a ? `From ${money(a)}${per}` : `Up to ${money(b)}${per}`
}