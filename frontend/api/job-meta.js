// Social previews: link crawlers (WhatsApp, LinkedIn, Facebook, X, Telegram, Slack, Google) do not run JavaScript, so they would
// only see the default tags in index.html. vercel.json sends THEIR requests for /jobs/:id here; people still get the normal app.
// This page carries the real job title and description in Open Graph tags (plus a redirect, in case a person lands on it).
const API = (process.env.BACKEND_URL || 'https://job-posting-aggregation.onrender.com').replace(/\/$/, '')
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

export default async function handler(req, res) {
  const id = String(req.query.id || '').replace(/\D/g, '')
  const origin = SITE || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const url = `${origin}/jobs/${id}`
  let title = 'JobBoard – Find your next opportunity'
  let desc = 'Find jobs in Islamabad, Rawalpindi and across Pakistan on JobBoard.'
  let status = 200
  try {
    const r = await fetch(`${API}/api/jobs/${id}`, { headers: { Accept: 'application/json' } })
    if (r.ok) {
      const j = await r.json()
      const where = j.location ? ` – ${j.location}` : ''
      title = `${j.title} at ${j.company_name}${where} | JobBoard`
      desc = cut(plain(j.description) || `${j.title} at ${j.company_name}`, 200)
    } else if (r.status === 404) {
      status = 404
      title = 'Job not found | JobBoard'
    }
  } catch {
    /* backend asleep or unreachable: fall back to the default tags rather than failing the share */
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="article" /><meta property="og:site_name" content="JobBoard" />
<meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(desc)}" /><meta property="og:url" content="${esc(url)}" />
<meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${esc(title)}" /><meta name="twitter:description" content="${esc(desc)}" />
${status === 404 ? '<meta name="robots" content="noindex" />' : ''}
<meta http-equiv="refresh" content="0;url=${esc(url)}" /></head>
<body><h1>${esc(title)}</h1><p>${esc(desc)}</p><p><a href="${esc(url)}">Open on JobBoard</a></p></body></html>`)
}
