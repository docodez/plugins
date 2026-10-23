// La API que Docodez le da a un plugin (window.docodez). Ver doc/04-plugins.md.
// En un proyecto TypeScript: "types" o un /// <reference path="../../sdk/docodez.d.ts" /> - no hay nada que importar,
// Docodez agrega la API a la página antes que cualquier script del plugin.

export interface DocodezContext {
  apiVersion: number;
  pluginId: string;
  pluginVersion: string;
  nodeTitle: string;
  /** El documento está en modo edición: se pueden guardar datos y anexos. */
  editable: boolean;
  theme: 'light' | 'dark';
  language: 'es' | 'en' | 'fr';
  platform: 'desktop' | 'android' | 'web';
  eventSeq?: number;
  /** API 3: hay cámara (capturePhoto). */
  camera?: boolean;
  /** API 3: el nivel de Docodez ('free', 'pro' o 'cloud'): un plugin puede ofrecer más en Pro. */
  tier?: 'free' | 'pro' | 'cloud';
  /** API 3: qué hace shareFile: 'share' (a otra app, Android) o 'save' (Guardar como). */
  share?: 'share' | 'save';
  /** API 3: lo que puede hacer la AI configurada ahora: 'image.text' = aiExtract / aiReadText. */
  ai?: string[];
}

export interface DocodezAttachmentInfo {
  name: string;
  size: number;
}

export interface DocodezPickedFile {
  name: string;
  data: ArrayBuffer;
}

/** API 3: un dato que se quiere leer de una foto con aiExtract. */
export interface DocodezAiField {
  /** Letras, números y _ (es la clave de la respuesta). */
  name: string;
  type: 'number' | 'string' | 'date';
  /** Qué es, en inglés o en el idioma que sea: "the total price paid", "the odometer reading". */
  description: string;
}

export interface DocodezEvents {
  modechange: { editable: boolean };
  themechange: { theme: 'light' | 'dark' };
  /** API 2: otra vista del mismo plugin cambió los datos de la app (getAppData). */
  appdatachange: Record<string, never>;
}

export interface DocodezApi {
  apiVersion: number;
  /** El contexto (null hasta que se cumple ready). */
  context: DocodezContext | null;
  ready: Promise<DocodezContext>;

  /** Los datos del plugin guardados en el nodo (texto), o null si todavía no hay. */
  getData(): Promise<string | null>;
  /** Guarda los datos (solo en modo edición). El documento queda modificado. */
  setData(text: string): Promise<void>;
  getJSON<T = unknown>(): Promise<T | null>;
  setJSON(value: unknown): Promise<void>;

  listAttachments(): Promise<DocodezAttachmentInfo[]>;
  getAttachment(name: string): Promise<ArrayBuffer>;
  /** Una URL para usar un anexo en <img>, fetch, un cargador... */
  attachmentUrl(name: string): Promise<string>;
  /** Agrega o reemplaza un anexo (solo en modo edición). */
  putAttachment(name: string, data: ArrayBuffer | ArrayBufferView | Blob | string): Promise<void>;

  /** API 2: quita un anexo (solo en modo edición). */
  deleteAttachment(name: string): Promise<void>;

  /** API 2: datos de la APP del plugin (no del documento): los mismos en todos sus nodos y documentos. Texto JSON o null.
   *  Se leen y guardan también en modo vista. Máximo 4 MB. */
  getAppData(): Promise<string | null>;
  setAppData(json: string): Promise<void>;
  getAppJSON<T = unknown>(): Promise<T | null>;
  setAppJSON(value: unknown): Promise<void>;

  /** Página de respaldo del nodo (la indexa la búsqueda; la ven quienes no tienen el plugin). Sin scripts. */
  setPreview(html: string): Promise<void>;
  /** El selector de archivos de Docodez ({ name, data } o null si se canceló). accept: ['.stl', '.obj']. */
  pickFile(accept?: string[]): Promise<DocodezPickedFile | null>;

  /** API 3: una foto con la cámara (si context.camera): { name, data } (JPEG), o null si se canceló. */
  capturePhoto?(): Promise<DocodezPickedFile | null>;
  /** API 3: mandar un archivo a otra app (Android) o guardarlo; text va con el archivo. 'shared' | 'saved' | null (canceló). */
  shareFile?(name: string, data: ArrayBuffer | ArrayBufferView | Blob | string, type?: string, text?: string): Promise<'shared' | 'saved' | null>;
  /** API 3: las capacidades de AI disponibles ahora (pueden cambiar mientras el plugin está abierto). */
  aiCapabilities?(): Promise<string[]>;
  /** API 3: leer datos de una foto con la AI (Docodez muestra su ventanita, con Cancelar). null = cancelado; un dato que
   *  no se ve, null. Fechas "YYYY-MM-DD". Si no hay AI, error. Lo leído lo revisa la persona antes de usarlo. */
  aiExtract?(image: ArrayBuffer | Blob, instructions: string, fields: DocodezAiField[]): Promise<Record<string, number | string | null> | null>;
  /** API 3: el texto de una foto (OCR con la AI), o null si se canceló. */
  aiReadText?(image: ArrayBuffer | Blob): Promise<string | null>;

  on<K extends keyof DocodezEvents>(name: K, fn: (payload: DocodezEvents[K]) => void): DocodezApi;
  off<K extends keyof DocodezEvents>(name: K, fn: (payload: DocodezEvents[K]) => void): DocodezApi;
}

declare global {
  interface Window {
    docodez: DocodezApi;
  }

  const docodez: DocodezApi;
}
