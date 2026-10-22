import { useEffect } from 'react'

const NAME = 'JobBoard'
const SITE = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')
const DAY = 86400000
const asDate = (d) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d : d + 'Z')

function meta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  const created = !el; const prev = el ? el.getAttribute('content') : null
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', content)
  return () => { if (created) el.remove(); else if (prev !== null) el.setAttribute('content', prev) }
}

function canonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  const created = !el; const prev = el ? el.getAttribute('href') : null
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el) }
  el.setAttribute('href', href)
  return () => { if (created) el.remove(); else if (prev !== null) el.setAttribute('href', prev) }
}

export default function Seo({ title, description, path, jsonLd, noindex = false }) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : ''
  useEffect(() => {
    const prevTitle = document.title
    const full = title ? (title.includes(NAME) ? title : `${title} | ${NAME}`) : NAME
    document.title = full
    const url = (SITE || window.location.origin) + (path ?? window.location.pathname)
    const undo = [canonical(url), meta('property', 'og:title', full), meta('property', 'og:url', url),
      meta('property', 'og:type', 'website'), meta('property', 'og:site_name', NAME), meta('name', 'twitter:card', 'summary')]
    if (description) undo.push(meta('name', 'description', description), meta('property', 'og:description', description))
    if (noindex) undo.push(meta('name', 'robots', 'noindex, nofollow'))
    let script = null
    if (ld) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.text = ld
      document.head.appendChild(script)
    }
    return () => { document.title = prevTitle; undo.forEach((f) => f()); if (script) script.remove() }
  }, [title, description, path, ld, noindex])
  return null
}

/* ---------- Google "JobPosting" structured data ---------- */
const TYPE = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR', fresher: 'FULL_TIME', temporary: 'TEMPORARY', internship: 'INTERN' }
const UNIT = { hour: 'HOUR', day: 'DAY', week: 'WEEK', month: 'MONTH', year: 'YEAR' }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Only employer jobs get structured data: people can apply on this page.
// Aggregated jobs send people to another site, which Google's guidelines don't allow us to mark up.
export function jobPostingLd(job, validDays = 30) {
  if (!job || job.source_type !== 'employer') return null
  const posted = asDate(job.created_at)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: esc(job.description || '').replace(/\r?\n/g, '<br>'),
    datePosted: posted.toISOString(),
    validThrough: new Date(posted.getTime() + validDays * DAY).toISOString(),
    employmentType: TYPE[job.job_type] || 'OTHER',
    directApply: true,
    hiringOrganization: { '@type': 'Organization', name: job.company_name },
  }
  if (job.workplace_type === 'remote') {
    ld.jobLocationType = 'TELECOMMUTE'
    ld.applicantLocationRequirements = { '@type': 'Country', name: 'PK' }
  } else {
    ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location || undefined, addressCountry: 'PK' } }
  }
  if (job.salary_min != null || job.salary_max != null) {
    const value = { '@type': 'QuantitativeValue', unitText: UNIT[job.salary_period] || 'MONTH' }
    if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max) { value.minValue = job.salary_min; value.maxValue = job.salary_max }
    else value.value = job.salary_max ?? job.salary_min
    ld.baseSalary = { '@type': 'MonetaryAmount', currency: job.currency || 'PKR', value }
  }
  return ld
}