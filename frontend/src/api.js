export const getToken = () => localStorage.getItem('jb_token')
export const setToken = (t) => (t ? localStorage.setItem('jb_token', t) : localStorage.removeItem('jb_token'))

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = 'Bearer ' + t
  let payload
  if (form) { payload = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded' }
  else if (body) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json' }
  const res = await fetch('/api' + path, { method, headers, body: payload })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const d = data?.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(', ') : 'Request failed')
  }
  return { res, data }
}

export async function api(path, opts) { return (await request(path, opts)).data }

export async function apiList(path) {
  const { res, data } = await request(path)
  const items = data || []
  return { items, total: Number(res.headers.get('X-Total-Count')) || items.length }
}

// builds a query string and drops empty values
export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString()

export function timeAgo(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()) / 1000
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago'
  const d = Math.floor(s / 86400)
  return d === 1 ? '1 day ago' : d + ' days ago'
}

export const JOB_TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', fresher: 'Fresher', temporary: 'Temporary', internship: 'Internship' }
export const WORKPLACES = { in_person: 'In person', remote: 'Remote', hybrid: 'Hybrid' }
export const TIMELINES = ['1 to 3 days', '3 to 7 days', '1 to 2 weeks', '2 to 4 weeks', 'More than 4 weeks']

export function payText(j) {
  const a = j.salary_min, b = j.salary_max
  if (a == null && b == null) return ''
  const n = (x) => Number(x).toLocaleString('en-US')
  const cur = !j.currency || j.currency === 'PKR' ? 'Rs' : j.currency
  const range = a != null && b != null ? `${n(a)} – ${n(b)}` : a != null ? `from ${n(a)}` : `up to ${n(b)}`
  return `${cur} ${range} per ${j.salary_period || 'month'}`
}
