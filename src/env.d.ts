/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_API_PROTOCOL: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }