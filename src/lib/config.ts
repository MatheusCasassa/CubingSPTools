// Configuração central lida das variáveis de ambiente do Vite.
// Todas são públicas por natureza (cliente público, sem secret) — o Client ID
// da WCA fica embutido no bundle de qualquer forma, então ter um padrão aqui
// não é problema de segurança. As envs VITE_* continuam sobrepondo (ex.: para
// apontar ao staging).

// Client ID (Application UID) padrão do app WCA do ScoreComps (produção).
const DEFAULT_WCA_CLIENT_ID = 'excsX95XmC-vQcKfCd7Qno_4yw7KjFgDz1HLs1jtIws'

const rawOrigin = (import.meta.env.VITE_WCA_ORIGIN ?? 'https://www.worldcubeassociation.org').replace(
  /\/$/,
  '',
)

export const config = {
  /** Client ID (Application UID) do app OAuth registrado na WCA. */
  wcaClientId: (import.meta.env.VITE_WCA_CLIENT_ID || DEFAULT_WCA_CLIENT_ID).trim(),

  /** Origem da WCA (produção ou staging). */
  wcaOrigin: rawOrigin,

  /** Endpoints derivados. */
  get wcaAuthorizeUrl() {
    return `${this.wcaOrigin}/oauth/authorize`
  },
  get wcaTokenUrl() {
    return `${this.wcaOrigin}/oauth/token`
  },
  get wcaApiBase() {
    return `${this.wcaOrigin}/api/v0`
  },

  /** Redirect URI = raiz atual do app (implicit grant volta o token no #). */
  get redirectUri() {
    const base = import.meta.env.BASE_URL || '/'
    return `${window.location.origin}${base}`.replace(/([^:]\/)\/+/g, '$1')
  },

  /** Escopos solicitados. manage_competitions dá acesso ao WCIF gerenciável. */
  scopes: ['public', 'manage_competitions'] as const,

  /** Site da CubingSP (link "voltar" no cabeçalho). */
  cubingspUrl: (import.meta.env.VITE_CUBINGSP_URL || 'https://cubingsp.mcasassa.workers.dev').replace(/\/$/, ''),
}

export const APP_VERSION = 'v0.5'

export const LINKS = {
  guide: 'https://github.com/MatheusCasassa/CubingSPTools/wiki/Guide',
  github: 'https://github.com/MatheusCasassa/CubingSPTools',
  email: 'mailto:matcasviana@gmail.com',
  wca: 'https://www.worldcubeassociation.org/persons/2017VIAN01',
}

export const isConfigured = () => config.wcaClientId.trim().length > 0
