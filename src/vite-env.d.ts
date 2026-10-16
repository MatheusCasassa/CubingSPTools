/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WCA_CLIENT_ID?: string
  readonly VITE_WCA_ORIGIN?: string
  readonly VITE_CUBINGSP_URL?: string
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
