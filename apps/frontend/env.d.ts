/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** CD の build 時に注入される版識別子 (典型的には GITHUB_SHA)。dev では未注入 = undefined */
  readonly VITE_BUILD_VERSION?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
