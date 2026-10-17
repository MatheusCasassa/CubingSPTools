// Modelo do CubeStaff.
//
// A FONTE DA VERDADE é o Plano (Plan): quem compete em cada grupo, quem é
// juiz/embaralhador/runner, suplentes e travas. O WCIF da WCA é a SAÍDA:
// ao publicar, o plano vira atividades "evento-rN-gK" + assignments, que o
// Competition Groups, o Delegate Dashboard e o ScoreComps leem.
//
// O plano também é gravado numa extensão do WCIF (CubingSP.CubeStaff), então
// fica vinculado à competição: abre em qualquer aparelho, por qualquer
// Delegado/Organizador. Extensões do WCIF são PÚBLICAS — por isso e-mail,
// WhatsApp e respostas de formulário nunca entram aqui (ver storage.ts).

/** Pessoa do WCIF: "p<registrantId>". Ajudante extra (fora do WCIF): "x<id>". */
export type Ref = string

export type StaffRole = 'judge' | 'scrambler' | 'runner'

export const ROLE_CODE: Record<StaffRole, string> = {
  judge: 'staff-judge',
  scrambler: 'staff-scrambler',
  runner: 'staff-runner',
}

export type Distribution = 'newcomersFirst' | 'mixed'

/** Configuração geral da geração (definida pelo Organizador/Delegado). */
export interface CubeStaffConfig {
  /** Nº de estações (mesas com timer) da competição. */
  stations: number
  /** Estações por sala/palco (sobrepõe `stations`), chave = room id. */
  stationsByRoom: Record<string, number>
  /** Runners só são escalados se isto estiver ligado. */
  runnersEnabled: boolean
  /** Novatos concentrados nos grupos iniciais ou mesclados em todos. */
  distribution: Distribution
  /** Nos grupos de novatos: 100% novatos ou 50% novatos + 50% experientes. */
  newcomerShare: 100 | 50
  /** Numerar estações (competidores e juízes) nas atribuições. */
  stationNumbers: boolean
  /** Competidores por embaralhador: 1 a cada 8 (1–8 → 1, 9–16 → 2, …). */
  competitorsPerScrambler: number
  /**
   * "Número expressivo" de staff: se o staff elegível (sem Delegados) livre no
   * horário for ≥ este fator × vagas do grupo, Delegados ficam totalmente fora
   * de juiz/embaralhador.
   */
  delegateThreshold: number
  /** Máximo de tarefas de staff seguidas (grupos consecutivos) — 0 = sem limite. */
  maxConsecutive: number
  /** Máximo de tarefas de staff por pessoa na competição — 0 = sem limite. */
  maxTasksPerPerson: number
  /**
   * Presença pelos dias das modalidades inscritas: quem só compete num dia não
   * é escalado (nem sugerido como suplente) nos outros dias.
   */
  presenceByEvents: boolean
  /** Suplentes sugeridos por grupo. */
  reservesPerGroup: number
  /** Nº de grupos por rodada (chave = round id, ex.: "333-r1"). */
  groupsByRound: Record<string, number>
  /** Competidores ausentes (registrantId) — não entram nos grupos. */
  absent: number[]
}

export const DEFAULT_CONFIG: CubeStaffConfig = {
  stations: 12,
  stationsByRoom: {},
  runnersEnabled: false,
  distribution: 'newcomersFirst',
  newcomerShare: 100,
  stationNumbers: false,
  competitorsPerScrambler: 8,
  delegateThreshold: 1.5,
  maxConsecutive: 3,
  maxTasksPerPerson: 0,
  presenceByEvents: true,
  reservesPerGroup: 3,
  groupsByRound: {},
  absent: [],
}

/** Disponibilidade: dia da competição (AAAA-MM-DD) → períodos presentes. */
export type Availability = Record<string, { morning: boolean; afternoon: boolean }>

/** Candidato APROVADO para staff (a lista é a única fonte de staff automático). */
export interface StaffEntry {
  /** Pessoa do WCIF a quem esta entrada pertence. */
  registrantId: number
  /** Funções preferidas, em ordem (vazio = sem preferência). */
  preferred: StaffRole[]
  /** Funções que a pessoa marcou como possíveis (vazio = qualquer). */
  roles: StaffRole[]
  /** Quer embaralhar? null = não informado. */
  scrambler: boolean | null
  /** Puzzles com experiência de embaralhamento (event ids). */
  scramblePuzzles: string[]
  /** null = disponível o tempo todo. */
  availability: Availability | null
}

/** Ajudante extra fora da lista (pais, visitantes, quem se ofereceu no dia). */
export interface ExtraHelper {
  id: string
  name: string
  /** Se for alguém inscrito na competição. */
  registrantId?: number
  note?: string
}

export interface GroupPlan {
  number: number
  competitors: number[]
  judges: Ref[]
  scramblers: Ref[]
  runners: Ref[]
  reserves: Ref[]
  /** Itens travados (editados à mão): "competitor:p12", "judge:p40"… */
  locked: string[]
}

export interface RoundPlan {
  roundId: string
  groups: GroupPlan[]
  /** ISO da última geração/edição. */
  updatedAt: string
}

export interface Plan {
  version: 1
  config: CubeStaffConfig
  staff: StaffEntry[]
  extras: ExtraHelper[]
  rounds: Record<string, RoundPlan>
  /** Rodadas já publicadas na WCA (assignments gravados). */
  published: string[]
  /** Impressão digital de cada rodada no momento da publicação (detecta edição fora). */
  publishedHash: Record<string, string>
  /** Incrementa a cada gravação na WCA (detecta edição concorrente). */
  revision: number
  updatedAt: string
  updatedBy?: string
}

export function emptyPlan(): Plan {
  return {
    version: 1,
    config: structuredClone(DEFAULT_CONFIG),
    staff: [],
    extras: [],
    rounds: {},
    published: [],
    publishedHash: {},
    revision: 0,
    updatedAt: new Date(0).toISOString(),
  }
}

export const pref = (registrantId: number): Ref => `p${registrantId}`
export const refId = (ref: Ref): number | null => (ref.startsWith('p') ? Number(ref.slice(1)) : null)
export const isExtra = (ref: Ref) => ref.startsWith('x')

export const lockKey = (kind: 'competitor' | StaffRole | 'reserve', ref: Ref) => `${kind}:${ref}`

/** Eventos sem grupos por horário: tentativas agendadas (-a1, -a2…). */
export const ATTEMPT_EVENTS = new Set(['333fm', '333mbf'])
/** Eventos ordenados pelo single (às cegas). */
export const BLD_EVENTS = new Set(['333bf', '444bf', '555bf', '333mbf'])
