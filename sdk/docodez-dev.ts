// For developing a plugin OUTSIDE Docodez (npm run dev, in the browser): a mock window.docodez.
// Data is kept in localStorage, attachments in memory (lost on reload), and pickFile uses an <input type=file>.
// It is installed only if there is no real one, and only in development (import.meta.env.DEV): it is not in the built plugin.
// In the console: docodezDev.setEditable(false) tests view mode; docodezDev.setTheme('dark') tests the dark theme.
import type { DocodezApi, DocodezContext, DocodezEvents } from './docodez';

export function installDevDocodez(pluginId: string, pluginVersion = 'dev'): void {
  if ((window as any).docodez) return;
  const key = `docodez-dev:${pluginId}`;
  const attachments = new Map<string, ArrayBuffer>();
  const listeners: { [K in keyof DocodezEvents]?: Array<(p: DocodezEvents[K]) => void> } = {};
  const context: DocodezContext = {
    apiVersion: 3, pluginId, pluginVersion, nodeTitle: 'Test node', editable: true, camera: true, ai: ['image.text'], share: 'save', tier: 'pro',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    language: (navigator.language.slice(0, 2) as DocodezContext['language']) || 'es', platform: 'web',
  };
  const emit = <K extends keyof DocodezEvents>(name: K, payload: DocodezEvents[K]) =>
    (listeners[name] ?? []).forEach((fn) => (fn as (p: DocodezEvents[K]) => void)(payload));
  const requireEditable = () => { if (!context.editable) throw new Error('The document is not in edit mode.'); };
  const toBuffer = async (data: ArrayBuffer | ArrayBufferView | Blob | string): Promise<ArrayBuffer> =>
    data instanceof ArrayBuffer ? data
      : ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      : data instanceof Blob ? data.arrayBuffer()
      : new TextEncoder().encode(String(data)).buffer as ArrayBuffer;

  // API 3: the mock "AI": docodezDev.ai = (fields) => ({ ... }) (by default, it prompts for each value).
  let devAi: (fields: { name: string }[]) => Record<string, number | string | null> = (fields) =>
    Object.fromEntries(fields.map((f) => { const v = prompt(`[docodez-dev] AI: ${f.name}`); return [f.name, v == null || v === '' ? null : isNaN(Number(v)) ? v : Number(v)]; }));
  const pick = (accept?: string[], capture = false) => new Promise<{ name: string; data: ArrayBuffer } | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept?.length) input.accept = accept.join(',');
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, data: await file.arrayBuffer() } : null);
    };
    input.click();
  });

  const api: DocodezApi = {
    apiVersion: 3,
    context,
    ready: Promise.resolve(context),
    async getData() { return localStorage.getItem(key); },
    async setData(text) { requireEditable(); localStorage.setItem(key, text); console.info('[docodez-dev] setData', text.length, 'characters'); },
    async getJSON<T>() { const t = localStorage.getItem(key); return t ? (JSON.parse(t) as T) : null; },
    async setJSON(value) { await api.setData(JSON.stringify(value)); },
    async listAttachments() { return [...attachments].map(([name, d]) => ({ name, size: d.byteLength })); },
    async getAttachment(name) { const d = attachments.get(name); if (!d) throw new Error('No attachment named ' + name); return d; },
    async attachmentUrl(name) { return URL.createObjectURL(new Blob([await api.getAttachment(name)])); },
    async putAttachment(name, data) { requireEditable(); attachments.set(name, await toBuffer(data)); },
    async deleteAttachment(name) { requireEditable(); attachments.delete(name); },
    async getAppData() { return localStorage.getItem(key + ':app'); },
    async setAppData(json) { JSON.parse(json); localStorage.setItem(key + ':app', json); },
    async getAppJSON<T>() { const t = localStorage.getItem(key + ':app'); return t ? (JSON.parse(t) as T) : null; },
    async setAppJSON(value) { await api.setAppData(JSON.stringify(value)); },
    async setPreview(html) { requireEditable(); console.info('[docodez-dev] setPreview', html.length, 'characters'); },
    pickFile(accept) { return pick(accept); },
    capturePhoto() { return pick(['image/*'], true); },
    async aiCapabilities() { return ['image.text']; },
    async shareFile(name, data, type) {
      // Outside Docodez: downloads it (and keeps it in docodezDev.lastShared for tests).
      const blob = new Blob([await toBuffer(data as ArrayBuffer)], { type: type || 'application/octet-stream' });
      (window as any).docodezDev.lastShared = { name, type, size: blob.size, blob };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      return 'saved';
    },
    async aiExtract(_image, _instructions, fields) { return devAi(fields); },
    async aiReadText() { return prompt('[docodez-dev] AI: text in the photo'); },
    on(name, fn) { ((listeners[name] ??= []) as unknown[]).push(fn); return api; },
    off(name, fn) { listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn) as never; return api; },
  };
  (window as any).docodez = api;
  (window as any).docodezDev = {
    setEditable(editable: boolean) { context.editable = editable; emit('modechange', { editable }); },
    setTheme(theme: 'light' | 'dark') { context.theme = theme; emit('themechange', { theme }); },
    set ai(fn: typeof devAi) { devAi = fn; },
  };
  console.info('[docodez-dev] mock window.docodez (outside Docodez). docodezDev.setEditable(false) / setTheme("dark")');
}
