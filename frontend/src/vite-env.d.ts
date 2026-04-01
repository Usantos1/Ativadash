/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** `1` / `true`: agência filial com menu e rotas de operação completas (ADS, Projetos, Equipe). */
  readonly VITE_AGENCY_BRANCH_EXPANDED_OPS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
