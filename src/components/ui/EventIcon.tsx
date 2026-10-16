// Ícones oficiais das modalidades (mesmo conjunto do site da WCA e da
// CubingUSA): https://github.com/cubing/icons — licença MIT (src/assets/events/LICENSE).
// O SVG é usado como MÁSCARA e pintado com a cor do texto (currentColor),
// então acompanha o tema claro/escuro e os estados de seleção.

const urls = import.meta.glob('../../assets/events/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const BY_ID: Record<string, string> = {}
for (const [path, url] of Object.entries(urls)) {
  const id = path.split('/').pop()!.replace(/\.svg$/, '')
  BY_ID[id] = url
}

export function hasEventIcon(eventId: string): boolean {
  return eventId in BY_ID
}

export function EventIcon({
  eventId,
  className = 'h-5 w-5',
  title,
}: {
  eventId: string
  className?: string
  title?: string
}) {
  const url = BY_ID[eventId]
  if (!url) {
    // Evento sem ícone conhecido: quadradinho com a sigla.
    return (
      <span
        className={`${className} inline-grid place-items-center rounded border border-current text-[9px] font-semibold uppercase`}
        title={title}
        aria-label={title}
        role={title ? 'img' : undefined}
      >
        {eventId.slice(0, 3)}
      </span>
    )
  }
  const mask = `url("${url}") center / contain no-repeat`
  return (
    <span
      className={`${className} inline-block shrink-0 bg-current`}
      style={{ mask, WebkitMask: mask }}
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    />
  )
}
