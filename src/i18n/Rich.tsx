import { Fragment } from 'react'

/** Texto com **negrito** marcado nas mensagens traduzidas. */
export function Rich({ text, strongClass = '' }: { text: string; strongClass?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={strongClass}>
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}
