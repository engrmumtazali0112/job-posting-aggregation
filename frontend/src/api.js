export const getToken = () => localStorage.getItem('jb_token')
export const setToken = (t) => (t ? localStorage.setItem('jb_token', t) : localStorage.removeItem('jb_token'))

export async function api(path, { method = 'GET', body, form } = {}) {
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
  return data
}

export function timeAgo(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()) / 1000
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' min ago'
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago'
  const d = Math.floor(s / 86400)
  return d === 1 ? '1 day ago' : d + ' days ago'
}
