interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // otras VITE_… que uses
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
