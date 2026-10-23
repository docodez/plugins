// The plugin's own texts. Docodez tells the user's language in context.language ('es' | 'en' | 'fr').

const en = {
  placeholder: 'Write a note and press Enter...',
  add: 'Add',
  empty: 'No notes yet.',
  photo: 'Photo',
  remove: 'Remove',
  viewMode: 'View mode: switch Docodez to edit mode to change the notes.',
  saveError: 'Could not save: ',
  previewTitle: 'Quick notes',
};

type Texts = typeof en;

const es: Texts = {
  placeholder: 'Escribe una nota y presiona Enter...',
  add: 'Agregar',
  empty: 'Todavía no hay notas.',
  photo: 'Foto',
  remove: 'Quitar',
  viewMode: 'Modo vista: pasa Docodez a modo edición para cambiar las notas.',
  saveError: 'No se pudo guardar: ',
  previewTitle: 'Notas rápidas',
};

export const TEXTS: Record<string, Texts> = { en, es };
