// Tipos do WCIF (WCA Competition Interchange Format) — subconjunto usado
// para gerar súmulas. Ref.: https://github.com/thewca/wcif

export type WcifFormatId = '1' | '2' | '3' | 'a' | 'm'

export interface WcifTimeLimit {
  centiseconds: number
  /** Se não vazio, o limite é CUMULATIVO sobre estas rodadas. */
  cumulativeRoundIds: string[]
}

export interface WcifCutoff {
  /** Nº de tentativas dentro do corte (WCA: normalmente 1 ou 2). */
  numberOfAttempts: number
  /** Resultado-alvo do corte, em centésimos (ou pontos p/ multi). */
  attemptResult: number
}

export interface WcifRound {
  id: string // ex.: "333-r1"
  format: WcifFormatId
  timeLimit: WcifTimeLimit | null
  cutoff: WcifCutoff | null
  advancementCondition: unknown | null
  results?: unknown[]
}

export interface WcifEvent {
  id: string // ex.: "333", "666", "333bf"
  rounds: WcifRound[]
}

export interface WcifAssignment {
  activityId: number
  assignmentCode: string // "competitor" | "staff-judge" | "staff-scrambler" | ...
  stationNumber?: number | null
}

export interface WcifRegistration {
  eventIds: string[]
  status?: string // "accepted" | "pending" | "deleted"
  isCompeting?: boolean
}

export interface WcifPersonalBest {
  eventId: string
  best: number
  type: 'single' | 'average'
  worldRanking?: number
}

export interface WcifPerson {
  registrantId: number | null
  name: string
  wcaId: string | null
  countryIso2?: string
  registration: WcifRegistration | null
  assignments: WcifAssignment[]
  personalBests?: WcifPersonalBest[]
}

export interface WcifActivity {
  id: number
  name: string
  activityCode: string // ex.: "333-r1-g2"
  startTime?: string
  endTime?: string
  childActivities: WcifActivity[]
}

export interface WcifRoom {
  id: number
  name: string
  activities: WcifActivity[]
}

export interface WcifVenue {
  id: number
  name: string
  rooms: WcifRoom[]
}

export interface WcifSchedule {
  venues: WcifVenue[]
}

export interface Wcif {
  id: string
  name: string
  shortName?: string
  persons: WcifPerson[]
  events: WcifEvent[]
  schedule: WcifSchedule
}

// ------- API pública de competições / usuário -------

export interface CompetitionListItem {
  id: string
  name: string
  start_date?: string
  end_date?: string
  city?: string
  country_iso2?: string
}

export interface WcaMe {
  id: number
  wca_id: string | null
  name: string
  delegate_status?: string | null
  roles?: string[]
  teams?: { friendly_id?: string; leader?: boolean }[]
}
