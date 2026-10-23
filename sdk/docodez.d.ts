// The API that Docodez gives a plugin (window.docodez). See doc/04-plugins.md.
// In a TypeScript project, use "types" or a /// <reference path="../../sdk/docodez.d.ts" />. There is nothing to import:
// Docodez adds the API to the page before any plugin script runs.

export interface DocodezContext {
  apiVersion: number;
  pluginId: string;
  pluginVersion: string;
  nodeTitle: string;
  /** True when the document is in edit mode: data and attachments can be saved. */
  editable: boolean;
  theme: 'light' | 'dark';
  language: 'es' | 'en' | 'fr';
  platform: 'desktop' | 'android' | 'web';
  eventSeq?: number;
  /** API 3: a camera is available (see capturePhoto). */
  camera?: boolean;
  /** API 3: the Docodez tier ('free', 'pro' or 'cloud'). A plugin can offer more in Pro. */
  tier?: 'free' | 'pro' | 'cloud';
  /** API 3: what shareFile does: 'share' (sends to another app, on Android) or 'save' (Save as). */
  share?: 'share' | 'save';
  /** API 3: what the currently configured AI can do. 'image.text' means aiExtract and aiReadText are available. */
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

/** API 3: a value to read from a photo with aiExtract. */
export interface DocodezAiField {
  /** Letters, digits and _ only (used as the key in the result). */
  name: string;
  type: 'number' | 'string' | 'date';
  /** What the value is, in English or any other language: "the total price paid", "the odometer reading". */
  description: string;
}

export interface DocodezEvents {
  modechange: { editable: boolean };
  themechange: { theme: 'light' | 'dark' };
  /** API 2: another view of the same plugin changed the app data (see getAppData). */
  appdatachange: Record<string, never>;
}

export interface DocodezApi {
  apiVersion: number;
  /** The context (null until ready resolves). */
  context: DocodezContext | null;
  ready: Promise<DocodezContext>;

  /** The plugin data stored in the node (text), or null if there is none yet. */
  getData(): Promise<string | null>;
  /** Saves the data (edit mode only). The document is marked as modified. */
  setData(text: string): Promise<void>;
  getJSON<T = unknown>(): Promise<T | null>;
  setJSON(value: unknown): Promise<void>;

  listAttachments(): Promise<DocodezAttachmentInfo[]>;
  getAttachment(name: string): Promise<ArrayBuffer>;
  /** A URL to use an attachment in <img>, fetch, a loader... */
  attachmentUrl(name: string): Promise<string>;
  /** Adds or replaces an attachment (edit mode only). */
  putAttachment(name: string, data: ArrayBuffer | ArrayBufferView | Blob | string): Promise<void>;

  /** API 2: removes an attachment (edit mode only). */
  deleteAttachment(name: string): Promise<void>;

  /** API 2: the plugin's APP data (not the document's): the same across all its nodes and documents. JSON text or null.
   *  Can be read and saved in view mode too. 4 MB max. */
  getAppData(): Promise<string | null>;
  setAppData(json: string): Promise<void>;
  getAppJSON<T = unknown>(): Promise<T | null>;
  setAppJSON(value: unknown): Promise<void>;

  /** The node's fallback page (indexed by search; shown to users who do not have the plugin). No scripts. */
  setPreview(html: string): Promise<void>;
  /** Opens the Docodez file picker. Returns { name, data }, or null if canceled. Example accept: ['.stl', '.obj']. */
  pickFile(accept?: string[]): Promise<DocodezPickedFile | null>;

  /** API 3: takes a photo with the camera (if context.camera). Returns { name, data } (JPEG), or null if canceled. */
  capturePhoto?(): Promise<DocodezPickedFile | null>;
  /** API 3: sends a file to another app (Android) or saves it; text is sent along with the file. Returns 'shared', 'saved' or null (canceled). */
  shareFile?(name: string, data: ArrayBuffer | ArrayBufferView | Blob | string, type?: string, text?: string): Promise<'shared' | 'saved' | null>;
  /** API 3: the AI capabilities available now (they can change while the plugin is open). */
  aiCapabilities?(): Promise<string[]>;
  /** API 3: reads values from a photo with the AI (Docodez shows its own dialog, with Cancel). Returns null if canceled;
   *  a value that cannot be found is null. Dates are "YYYY-MM-DD". Throws if no AI is available. The user should review
   *  the values before they are used. */
  aiExtract?(image: ArrayBuffer | Blob, instructions: string, fields: DocodezAiField[]): Promise<Record<string, number | string | null> | null>;
  /** API 3: the text in a photo (OCR with the AI), or null if canceled. */
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
