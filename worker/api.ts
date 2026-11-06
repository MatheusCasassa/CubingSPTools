// Servidor do CSPTools (Cloudflare Worker) — lógica da /api. A entrada do
// Worker é worker/index.ts (só ela pode exportar o handler). Em /api/*, guarda os dados que precisam ser compartilhados entre pessoas e
// aparelhos — e que NÃO podem ir para a WCA, porque as extensões do WCIF são
// públicas:
//
//   /api/passcodes/:id  senhas dos sets do TNoodle (EasyPassword) — só
//                       Delegados (e trainees) daquela competição.
//   /api/schedule/:id   rascunho dos horários reais (SchedManager) — staff da
//                       competição (Delegados, Organizadores ou quem tem
//                       tarefa/função de staff no WCIF).
//   /api/checklist/:id  checklist da competição (RepCheck) — staff.
//
// Quem pede manda o token da WCA (o mesmo do login do site). O Worker confere
// na própria WCA quem é a pessoa e qual o vínculo dela com a competição.
// Os dados apagam sozinhos depois da competição (expiração do KV).

export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expiration?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  CSP_KV: KV
  ASSETS?: { fetch(req: Request): Promise<Response> }
  /** Origem da WCA (padrão: produção). */
  WCA_ORIGIN?: string
}

const DAY = 86400
/** Senhas: apagadas 7 dias depois do último dia da competição. */
export const PASSCODE_KEEP_DAYS = 7
/** Rascunho de cronograma: 60 dias depois do último dia. */
export const SCHEDULE_KEEP_DAYS = 60
/** Checklist: 90 dias depois do último dia (cobre o "Depois da competição"). */
export const CHECKLIST_KEEP_DAYS = 90
const MAX_BODY = 256 * 1024

// ---------------------------------------------------------------- respostas

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  })

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

// ------------------------------------------------------------ WCA (servidor)

interface Me {
  id: number
  name: string
  wcaId: string | null
}

interface CompetitionInfo {
  id: string
  name: string
  start_date: string
  end_date: string
  delegates: { id: number }[]
  organizers: { id: number }[]
}

interface PublicPerson {
  wcaUserId: number
  roles?: string[]
  assignments?: { assignmentCode: string }[]
}

const memo = new Map<string, { at: number; value: unknown }>()
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
  const value = await fn()
  memo.set(key, { at: Date.now(), value })
  if (memo.size > 500) memo.delete(memo.keys().next().value as string)
  return value
}

const origin = (env: Env) => (env.WCA_ORIGIN ?? 'https://www.worldcubeassociation.org').replace(/\/$/, '')

async function wcaGet<T>(env: Env, path: string, token?: string): Promise<T> {
  const res = await fetch(`${origin(env)}/api/v0${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CSPTools (cubingspferramentas)',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401) throw new HttpError(401, 'session')
  if (res.status === 404) throw new HttpError(404, 'competition')
  if (!res.ok) throw new HttpError(502, 'wca')
  return (await res.json()) as T
}

async function whoAmI(env: Env, req: Request): Promise<Me> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError(401, 'session')
  return cached(`me:${token}`, 5 * 60_000, async () => {
    const data = await wcaGet<{ me: { id: number; name: string; wca_id: string | null } }>(env, '/me', token)
    return { id: data.me.id, name: data.me.name, wcaId: data.me.wca_id }
  })
}

const competitionInfo = (env: Env, id: string) =>
  cached(`comp:${id}`, 5 * 60_000, () => wcaGet<CompetitionInfo>(env, `/competitions/${encodeURIComponent(id)}`))

async function isStaffInWcif(env: Env, id: string, userId: number): Promise<boolean> {
  const wcif = await cached(`wcif:${id}`, 2 * 60_000, () =>
    wcaGet<{ persons: PublicPerson[] }>(env, `/competitions/${encodeURIComponent(id)}/wcif/public`),
  )
  const p = wcif.persons.find((x) => x.wcaUserId === userId)
  if (!p) return false
  return (
    (p.roles ?? []).length > 0 || (p.assignments ?? []).some((a) => a.assignmentCode.startsWith('staff-'))
  )
}

export type Access = 'delegate' | 'staff'

/** Confere o vínculo da pessoa com a competição. Delegado ⇒ também é staff. */
export async function authorize(env: Env, req: Request, compId: string, need: Access) {
  const me = await whoAmI(env, req)
  const info = await competitionInfo(env, compId)
  const delegate = info.delegates.some((d) => d.id === me.id)
  const organizer = info.organizers.some((o) => o.id === me.id)
  if (need === 'delegate' && !delegate) throw new HttpError(403, 'notDelegate')
  if (need === 'staff' && !delegate && !organizer && !(await isStaffInWcif(env, compId, me.id)))
    throw new HttpError(403, 'notStaff')
  return { me, info, delegate, organizer }
}

/** Expiração (epoch s): N dias depois do último dia, e no mínimo amanhã. */
export function expiryFor(endDate: string, keepDays: number, nowMs = Date.now()): number {
  const end = Date.parse(`${endDate}T23:59:59Z`)
  const at = Math.floor((Number.isFinite(end) ? end : nowMs) / 1000) + keepDays * DAY
  return Math.max(at, Math.floor(nowMs / 1000) + DAY)
}

async function readBody<T>(req: Request): Promise<T> {
  const text = await req.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'tooLarge')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(400, 'badJson')
  }
}

// ------------------------------------------------------------------ senhas

export interface PasscodeEntry {
  event: string
  eventId: string | null
  round: number
  set: string
  attempt: number | null
  code: string
}

export interface PasscodeFile {
  competitionId: string
  title: string
  fileName: string
  entries: PasscodeEntry[]
  uploadedAt: string
  uploadedBy: { id: number; name: string }
}

export function validEntries(x: unknown): PasscodeEntry[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > 3000) return null
  const out: PasscodeEntry[] = []
  for (const e of x) {
    if (!e || typeof e !== 'object') return null
    const r = e as Record<string, unknown>
    if (typeof r.event !== 'string' || r.event.length > 80) return null
    if (r.eventId !== null && (typeof r.eventId !== 'string' || !/^[a-z0-9]{2,12}$/.test(r.eventId))) return null
    if (typeof r.round !== 'number' || !Number.isInteger(r.round) || r.round < 1 || r.round > 9) return null
    if (typeof r.set !== 'string' || !/^[A-Z]{1,3}$/.test(r.set)) return null
    if (r.attempt !== null && (typeof r.attempt !== 'number' || !Number.isInteger(r.attempt) || r.attempt < 1 || r.attempt > 9))
      return null
    if (typeof r.code !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(r.code)) return null
    out.push({
      event: r.event,
      eventId: (r.eventId as string | null) ?? null,
      round: r.round,
      set: r.set,
      attempt: (r.attempt as number | null) ?? null,
      code: r.code,
    })
  }
  return out
}

async function passcodes(env: Env, req: Request, compId: string): Promise<Response> {
  const { me, info } = await authorize(env, req, compId, 'delegate')
  const key = `pass:${compId}`
  if (req.method === 'GET') {
    const raw = await env.CSP_KV.get(key)
    // Ainda sem arquivo: 200 com { empty: true } (não é erro).
    return raw ? json(JSON.parse(raw)) : json({ empty: true })
  }
  if (req.method === 'PUT') {
    const body = await readBody<{ entries?: unknown; fileName?: unknown; title?: unknown }>(req)
    const entries = validEntries(body.entries)
    if (!entries) throw new HttpError(400, 'badFile')
    const file: PasscodeFile = {
      competitionId: compId,
      title: typeof body.title === 'string' ? body.title.slice(0, 120) : info.name,
      fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : '',
      entries,
      uploadedAt: new Date().toISOString(),
      uploadedBy: { id: me.id, name: me.name },
    }
    await env.CSP_KV.put(key, JSON.stringify(file), { expiration: expiryFor(info.end_date, PASSCODE_KEEP_DAYS) })
    return json(file)
  }
  if (req.method === 'DELETE') {
    await env.CSP_KV.delete(key)
    return json({ ok: true })
  }
  throw new HttpError(405, 'method')
}

// --------------------------------------------------- rascunho do cronograma

export type SchedField = 'start' | 'end' | 'sets' | 'advance'

/** Condição de classificação para a próxima rodada (igual ao WCIF). */
export interface Advance {
  type: 'ranking' | 'percent' | 'attemptResult'
  level: number
}

export interface ScheduleDraft {
  competitionId: string
  /** Por linha (código@dia): horários reais "HH:MM". */
  rows: Record<string, { start?: string; end?: string; by?: string; at?: string }>
  /** Por rodada (ex.: "333-r1"): número de sets/grupos realizados. */
  sets: Record<string, number>
  /** Por rodada: nova condição de classificação (Top N, N% ou resultado). */
  advance?: Record<string, Advance>
  rev: number
  updatedAt: string | null
  updatedBy: string | null
  savedToWcaAt: string | null
  savedToWcaBy: string | null
}

export const emptyDraft = (id: string): ScheduleDraft => ({
  competitionId: id,
  rows: {},
  sets: {},
  advance: {},
  rev: 0,
  updatedAt: null,
  updatedBy: null,
  savedToWcaAt: null,
  savedToWcaBy: null,
})

export interface SchedChange {
  key: string
  field: SchedField
  value: string | number | Advance | null
}

export function validAdvance(v: unknown): v is Advance {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  if (typeof a.level !== 'number' || !Number.isInteger(a.level) || a.level < 1) return false
  if (a.type === 'ranking') return a.level <= 10000
  if (a.type === 'percent') return a.level <= 75 // máximo do Regulamento (9p1)
  if (a.type === 'attemptResult') return a.level <= 2_000_000_000
  return false
}

const ROW_KEY = /^[a-z0-9-]{1,40}@\d{4}-\d{2}-\d{2}(#\d{1,3})?$/
const ROUND_KEY = /^[a-z0-9]{2,12}-r\d$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Aplica as mudanças de uma pessoa ao rascunho (campo a campo: quem digita por último vence). */
export function applyChanges(draft: ScheduleDraft, changes: SchedChange[], who: string, now: string): ScheduleDraft {
  const next: ScheduleDraft = structuredClone(draft)
  next.advance ??= {}
  for (const c of changes) {
    if (c.field === 'advance') {
      if (!ROUND_KEY.test(c.key)) throw new HttpError(400, 'badChange')
      if (c.value === null) delete next.advance[c.key]
      else if (validAdvance(c.value)) next.advance[c.key] = { type: c.value.type, level: c.value.level }
      else throw new HttpError(400, 'badChange')
      continue
    }
    if (c.field === 'sets') {
      if (!ROUND_KEY.test(c.key)) throw new HttpError(400, 'badChange')
      if (c.value === null) delete next.sets[c.key]
      else if (typeof c.value === 'number' && Number.isInteger(c.value) && c.value >= 1 && c.value <= 26)
        next.sets[c.key] = c.value
      else throw new HttpError(400, 'badChange')
      continue
    }
    if ((c.field !== 'start' && c.field !== 'end') || !ROW_KEY.test(c.key)) throw new HttpError(400, 'badChange')
    const row = { ...(next.rows[c.key] ?? {}) }
    if (c.value === null || c.value === '') delete row[c.field]
    else if (typeof c.value === 'string' && HHMM.test(c.value)) row[c.field] = c.value
    else throw new HttpError(400, 'badChange')
    row.by = who
    row.at = now
    if (row.start || row.end) next.rows[c.key] = row
    else delete next.rows[c.key]
  }
  if (Object.keys(next.rows).length > 2000) throw new HttpError(413, 'tooLarge')
  next.rev = draft.rev + 1
  next.updatedAt = now
  next.updatedBy = who
  return next
}

async function schedule(env: Env, req: Request, compId: string): Promise<Response> {
  const { me, info } = await authorize(env, req, compId, 'staff')
  const key = `sched:${compId}`
  const load = async () => {
    const raw = await env.CSP_KV.get(key)
    return raw ? (JSON.parse(raw) as ScheduleDraft) : emptyDraft(compId)
  }
  if (req.method === 'GET') return json(await load())
  if (req.method === 'PATCH') {
    const body = await readBody<{ changes?: SchedChange[]; savedToWca?: boolean }>(req)
    const now = new Date().toISOString()
    let draft = applyChanges(await load(), Array.isArray(body.changes) ? body.changes.slice(0, 500) : [], me.name, now)
    if (body.savedToWca) draft = { ...draft, savedToWcaAt: now, savedToWcaBy: me.name }
    await env.CSP_KV.put(key, JSON.stringify(draft), { expiration: expiryFor(info.end_date, SCHEDULE_KEEP_DAYS) })
    return json(draft)
  }
  if (req.method === 'DELETE') {
    await env.CSP_KV.delete(key)
    return json(emptyDraft(compId))
  }
  throw new HttpError(405, 'method')
}

// ---------------------------------------------------------------- checklist

export type ChecklistPhase = 'before' | 'during' | 'after'

export interface ChecklistItem {
  id: string
  phase: ChecklistPhase
  text: string
  /** Responsável (texto livre). */
  owner?: string
  /**
   * Prazo em dias: antes/durante, relativo ao 1º dia da competição (−7 = uma
   * semana antes); depois, relativo ao último dia (+7 = uma semana depois).
   */
  due?: number
  required?: boolean
  /** Conferência automática que o app sabe fazer (ex.: 'groups'). */
  auto?: string
  done?: { by: string; at: string } | null
}

export interface ChecklistDoc {
  competitionId: string
  /** null = ainda no modelo padrão (o app mostra o padrão no idioma de quem abre). */
  items: ChecklistItem[] | null
  rev: number
  updatedAt: string | null
  updatedBy: string | null
}

export type ChecklistOp =
  | { op: 'set'; items: ChecklistItem[] }
  | { op: 'check'; id: string; done: boolean }

export const emptyChecklist = (id: string): ChecklistDoc => ({
  competitionId: id,
  items: null,
  rev: 0,
  updatedAt: null,
  updatedBy: null,
})

const ITEM_ID = /^[a-z0-9-]{1,32}$/
const PHASES = new Set(['before', 'during', 'after'])

function cleanItem(v: unknown): ChecklistItem {
  if (!v || typeof v !== 'object') throw new HttpError(400, 'badChange')
  const x = v as Record<string, unknown>
  const text = typeof x.text === 'string' ? x.text.trim().slice(0, 300) : ''
  if (typeof x.id !== 'string' || !ITEM_ID.test(x.id) || !PHASES.has(x.phase as string) || !text)
    throw new HttpError(400, 'badChange')
  const item: ChecklistItem = { id: x.id, phase: x.phase as ChecklistPhase, text }
  if (typeof x.owner === 'string' && x.owner.trim()) item.owner = x.owner.trim().slice(0, 80)
  if (typeof x.due === 'number' && Number.isInteger(x.due) && Math.abs(x.due) <= 365) item.due = x.due
  if (x.required === true) item.required = true
  if (typeof x.auto === 'string' && ITEM_ID.test(x.auto)) item.auto = x.auto
  const d = x.done as Record<string, unknown> | null | undefined
  if (d && typeof d.by === 'string' && typeof d.at === 'string')
    item.done = { by: d.by.slice(0, 120), at: d.at.slice(0, 40) }
  return item
}

/** Aplica as operações: "set" troca a lista (personalização); "check" marca um item. */
export function applyChecklist(doc: ChecklistDoc, ops: ChecklistOp[], who: string, now: string): ChecklistDoc {
  const next: ChecklistDoc = structuredClone(doc)
  for (const o of ops) {
    if (o.op === 'set') {
      if (!Array.isArray(o.items) || o.items.length > 300) throw new HttpError(400, 'badChange')
      const items = o.items.map(cleanItem)
      if (new Set(items.map((i) => i.id)).size !== items.length) throw new HttpError(400, 'badChange')
      next.items = items
    } else if (o.op === 'check') {
      const item = next.items?.find((i) => i.id === o.id)
      if (!item) throw new HttpError(409, 'unknownItem')
      item.done = o.done ? { by: who, at: now } : null
    } else throw new HttpError(400, 'badChange')
  }
  next.rev = doc.rev + 1
  next.updatedAt = now
  next.updatedBy = who
  return next
}

async function checklist(env: Env, req: Request, compId: string): Promise<Response> {
  const { me, info } = await authorize(env, req, compId, 'staff')
  const key = `check:${compId}`
  const load = async () => {
    const raw = await env.CSP_KV.get(key)
    return raw ? (JSON.parse(raw) as ChecklistDoc) : emptyChecklist(compId)
  }
  if (req.method === 'GET') return json(await load())
  if (req.method === 'PATCH') {
    const body = await readBody<{ ops?: ChecklistOp[] }>(req)
    const doc = applyChecklist(await load(), Array.isArray(body.ops) ? body.ops.slice(0, 50) : [], me.name, new Date().toISOString())
    await env.CSP_KV.put(key, JSON.stringify(doc), { expiration: expiryFor(info.end_date, CHECKLIST_KEEP_DAYS) })
    return json(doc)
  }
  throw new HttpError(405, 'method')
}

// ------------------------------------------------------------------ roteador

const DEV_ORIGINS = /^http:\/\/(localhost|127\.0\.0\.1):5173$/

function cors(req: Request, res: Response): Response {
  const o = req.headers.get('origin')
  if (!o || !DEV_ORIGINS.test(o)) return res
  const h = new Headers(res.headers)
  h.set('access-control-allow-origin', o)
  h.set('access-control-allow-headers', 'authorization, content-type')
  h.set('access-control-allow-methods', 'GET, PUT, PATCH, DELETE, OPTIONS')
  h.set('vary', 'origin')
  return new Response(res.body, { status: res.status, headers: h })
}

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return cors(req, new Response(null, { status: 204 }))
  try {
    const m = url.pathname.match(/^\/api\/(passcodes|schedule|checklist)\/([A-Za-z0-9]{3,64})$/)
    if (url.pathname === '/api/health') return cors(req, json({ ok: true }))
    if (!m) throw new HttpError(404, 'route')
    const res =
      m[1] === 'passcodes'
        ? await passcodes(env, req, m[2])
        : m[1] === 'schedule'
          ? await schedule(env, req, m[2])
          : await checklist(env, req, m[2])
    return cors(req, res)
  } catch (e) {
    if (e instanceof HttpError) return cors(req, json({ error: e.code }, e.status))
    return cors(req, json({ error: 'server' }, 500))
  }
}
