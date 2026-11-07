import { Fragment } from 'react'

// A small, safe Markdown renderer for the AI articles: headings (#, ##, ###), paragraphs, bullet and numbered lists, **bold**,
// *italic* and [text](https://link). It builds React elements and never inserts raw HTML, so text written by an AI or taken from a
// scraped page cannot inject markup or scripts. Only http(s) links are made clickable.
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g

function inline(text, key) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key + i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key + i}>{part.slice(1, -1)}</em>
    const m = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (m) return <a key={key + i} href={m[2]} target="_blank" rel="noopener noreferrer nofollow">{m[1]}</a>
    return <Fragment key={key + i}>{part}</Fragment>
  })
}

export default function Markdown({ text, className = '' }) {
  const blocks = []
  let para = [], list = null
  const flushPara = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ') }); para = [] } }
  const flushList = () => { if (list) { blocks.push(list); list = null } }
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    let m
    if (!line) { flushPara(); flushList(); continue }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flushPara(); flushList(); blocks.push({ t: 'h', level: m[1].length, text: m[2] }); continue }
    if ((m = line.match(/^[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] } } list.items.push(m[1]); continue }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] } } list.items.push(m[1]); continue }
    flushList(); para.push(line)
  }
  flushPara(); flushList()
  return (
    <div className={'md ' + className}>
      {blocks.map((b, i) => {
        if (b.t === 'h') { const H = 'h' + (b.level + 1); return <H key={i}>{inline(b.text, i + 'h')}</H> }   // an article "#" becomes <h2>: the page already has an h1
        if (b.t === 'ul') return <ul key={i}>{b.items.map((x, j) => <li key={j}>{inline(x, i + '-' + j)}</li>)}</ul>
        if (b.t === 'ol') return <ol key={i}>{b.items.map((x, j) => <li key={j}>{inline(x, i + '-' + j)}</li>)}</ol>
        return <p key={i}>{inline(b.text, i + 'p')}</p>
      })}
    </div>
  )
}
