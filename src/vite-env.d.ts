/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * La dirección del proxy del asistente. Sin esto la app funciona completa y
   * el asistente avisa que no está conectado: el resto no depende de la red.
   */
  readonly VITE_ASISTENTE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
