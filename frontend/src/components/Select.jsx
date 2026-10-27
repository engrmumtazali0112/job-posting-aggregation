import { useEffect, useId, useRef, useState } from 'react'

const Chevron = () => (
  <svg className="custom-select__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/**
 * Custom dropdown that replaces a native <select>.
 *   options: [{ value, label }]      value: current value (compared as strings)
 *   onChange(value)                  receives the new value, not an event
 * Keyboard: Arrow keys / Home / End to move, Enter or Space to pick, Esc to close.
 * Styled by `.custom-select*` in index.css (100% wide on phones).
 */
export default function Select({ value, onChange, options, placeholder = 'Select', ariaLabel, title, className = '', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef(null); const btn = useRef(null); const list = useRef(null)
  const uid = useId()

  const selIdx = options.findIndex((o) => String(o.value) === String(value))
  const label = selIdx >= 0 ? options[selIdx].label : placeholder

  // close when clicking / tapping outside
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // keep the highlighted option visible in long lists
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const openMenu = () => { if (disabled) return; setActive(selIdx >= 0 ? selIdx : 0); setOpen(true) }
  const choose = (o) => { onChange(o.value); setOpen(false); btn.current?.focus() }

  const onKey = (e) => {
    const last = options.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); open ? setActive((i) => Math.min(last, i + 1)) : openMenu() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open ? setActive((i) => Math.max(0, i - 1)) : openMenu() }
    else if (e.key === 'Home' && open) { e.preventDefault(); setActive(0) }
    else if (e.key === 'End' && open) { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!open) openMenu(); else if (active >= 0) choose(options[active]) }
    else if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className={'custom-select' + (open ? ' open' : '') + (className ? ' ' + className : '')} ref={root}>
      <button type="button" ref={btn} className="custom-select__btn" disabled={disabled} title={title}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={uid + '-list'} aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `${uid}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKey}>
        <span className="custom-select__label">{label}</span>
        <Chevron />
      </button>
      {open && (
        <ul className="custom-select__menu" role="listbox" id={uid + '-list'} ref={list} aria-label={ariaLabel}>
          {options.map((o, i) => (
            <li key={String(o.value)} id={`${uid}-${i}`} role="option" aria-selected={i === selIdx}
              className={'custom-select__opt' + (i === active ? ' active' : '') + (i === selIdx ? ' sel' : '')}
              onPointerEnter={() => setActive(i)} onClick={() => choose(o)}>
              <span>{o.label}</span>{i === selIdx && <Check />}
            </li>))}
        </ul>)}
    </div>
  )
}
