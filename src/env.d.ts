/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string;
  readonly VITE_DEEPSEEK_BASE_URL: string;
  readonly VITE_LLM_MODEL: string;
  readonly VITE_EMBEDDING_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
