import ReactMarkdown from 'react-markdown'

// Renders the AI article. react-markdown builds React elements and does not execute raw HTML (skipHtml drops it), and its default
// URL filter removes javascript: links, so text written by an AI or copied from a scraped page cannot inject scripts.
const components = {
  h1: ({ node, ...p }) => <h2 {...p} />,                                   // the job page already has an h1, so an article "#" becomes h2, "##" h3, ...
  h2: ({ node, ...p }) => <h3 {...p} />,
  h3: ({ node, ...p }) => <h4 {...p} />,
  a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer nofollow" />,
}

export default function Markdown({ text, className = '' }) {
  return (
    <div className={'md ' + className}>
      <ReactMarkdown skipHtml components={components}>{String(text || '')}</ReactMarkdown>
    </div>
  )
}
