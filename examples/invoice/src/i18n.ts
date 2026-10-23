// Los textos: los de la pantalla (idioma de Docodez) y los de la factura (su propio idioma: se puede facturar en inglés con
// Docodez en español).
import type { ColumnKind, DocKind, Lang, Status, TemplateId } from './model';

const es = {
  // barra
  edit: 'Editar', preview: 'Vista previa', share: 'Compartir', business: 'Mi negocio', pdf: 'PDF', image: 'Imagen (PNG)', web: 'Página web',
  shareHint: 'Se manda con WhatsApp, SMS, correo... (en Android); en la computadora se guarda.', shared: 'Listo.', saved: 'Guardado.',
  building: 'Armando...', shareError: 'No se pudo: ', noShare: 'Este Docodez no puede compartir archivos desde un plugin: actualízalo.',
  viewMode: 'Modo vista: para cambiar la factura, pasa a modo edición en Docodez.', saveError: 'No se pudo guardar: ',
  welcome: 'Primero, los datos de tu negocio: nombre, logo, dirección, número fiscal. Quedan para todas las facturas.', setup: 'Configurar',
  // factura
  docKind: 'Tipo', kinds: { invoice: 'Factura', quote: 'Cotización', receipt: 'Recibo' } as Record<DocKind, string>,
  number: 'Número', date: 'Fecha', dueDate: 'Vence', status: 'Estado', statuses: { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada' } as Record<Status, string>,
  docLanguage: 'Idioma de la factura', currency: 'Moneda', days: (n: number) => `+${n} días`,
  client: 'Cliente', clientName: 'Nombre', company: 'Empresa', address: 'Dirección', email: 'Correo', phone: 'Teléfono', clientTaxId: 'Número fiscal del cliente',
  savedClients: 'Mis clientes', saveClient: 'Guardar en mis clientes', clientSaved: 'Guardado en tus clientes.',
  items: 'Lo que se cobra', addItem: '+ Renglón', columns: 'Columnas...', taxable: 'Con impuestos', removeItem: 'Quitar',
  taxes: 'Impuestos', addTax: '+ Impuesto', taxName: 'Nombre', taxRate: '%', discount: 'Descuento', percent: '%', amountOff: 'Monto',
  paidAmount: 'Pagado', subtotal: 'Subtotal', total: 'Total', balance: 'Saldo', notes: 'Notas (forma de pago, gracias...)', terms: 'Condiciones',
  look: 'Aspecto', template: 'Plantilla', templates: { classic: 'Clásica', modern: 'Moderna', minimal: 'Simple', bold: 'Llamativa' } as Record<TemplateId, string>,
  accent: 'Color', pageSize: 'Papel', letter: 'Carta', a4: 'A4',
  // columnas
  columnsTitle: 'Columnas de la tabla', columnsHint: 'Elige qué va en cada renglón. El importe se calcula con la cantidad, el precio y el descuento.',
  colLabel: 'Título (vacío: el de siempre)', colKind: 'Qué es', addColumn: '+ Columna', up: '↑', down: '↓',
  colKinds: { text: 'Texto', number: 'Número', date: 'Fecha', qty: 'Cantidad', price: 'Precio', discount: 'Descuento %', amount: 'Importe' } as Record<ColumnKind, string>,
  makeDefault: 'Usar estas columnas en las facturas nuevas', defaultSaved: 'Las facturas nuevas van a tener estas columnas.',
  // negocio
  businessTitle: 'Mi negocio (para todas las facturas)', businessName: 'Nombre del negocio o tuyo', logo: 'Logo o foto', logoPick: '🖼️ Elegir',
  logoCamera: '📷 Cámara', logoRemove: 'Quitar', website: 'Sitio web', country: 'País', taxIds: 'Números fiscales (van en la factura)',
  addTaxId: '+ Número', defaultTaxes: 'Impuestos de siempre', presets: 'Sugeridos para el país (revisa los porcentajes):',
  numbering: 'Numeración', prefix: 'Prefijo', nextNumber: 'Próximo número', dueDays: 'Vence a los (días)', defaultNotes: 'Notas de siempre', defaultTerms: 'Condiciones de siempre',
  applyToThis: 'Los datos nuevos también se pusieron en esta factura.',
  // comunes
  save: 'Guardar', cancel: 'Cancelar', close: 'Cerrar', ok: 'Aceptar', delete: 'Borrar', today: 'Hoy', none: '—',
  confirmRemoveColumn: '¿Quitar la columna? Lo escrito en ella se pierde.',
  shareText: (kind: string, n: string, total: string, due: string) => `${kind} ${n}: ${total}${due ? ` · vence ${due}` : ''}`,
};

type Texts = typeof es;

const en: Texts = {
  edit: 'Edit', preview: 'Preview', share: 'Share', business: 'My business', pdf: 'PDF', image: 'Image (PNG)', web: 'Web page',
  shareHint: 'Send it with WhatsApp, SMS, email... (on Android); on a computer it is saved.', shared: 'Done.', saved: 'Saved.',
  building: 'Building...', shareError: 'Could not: ', noShare: 'This Docodez cannot share files from a plugin: update it.',
  viewMode: 'View mode: to change the invoice, switch Docodez to edit mode.', saveError: 'Could not save: ',
  welcome: 'First, your business details: name, logo, address, tax number. They are used for every invoice.', setup: 'Set up',
  docKind: 'Type', kinds: { invoice: 'Invoice', quote: 'Quote', receipt: 'Receipt' },
  number: 'Number', date: 'Date', dueDate: 'Due', status: 'Status', statuses: { draft: 'Draft', sent: 'Sent', paid: 'Paid' },
  docLanguage: 'Invoice language', currency: 'Currency', days: (n) => `+${n} days`,
  client: 'Client', clientName: 'Name', company: 'Company', address: 'Address', email: 'Email', phone: 'Phone', clientTaxId: 'Client tax number',
  savedClients: 'My clients', saveClient: 'Save to my clients', clientSaved: 'Saved to your clients.',
  items: 'Items', addItem: '+ Line', columns: 'Columns...', taxable: 'Taxable', removeItem: 'Remove',
  taxes: 'Taxes', addTax: '+ Tax', taxName: 'Name', taxRate: '%', discount: 'Discount', percent: '%', amountOff: 'Amount',
  paidAmount: 'Paid', subtotal: 'Subtotal', total: 'Total', balance: 'Balance', notes: 'Notes (payment details, thank you...)', terms: 'Terms',
  look: 'Look', template: 'Template', templates: { classic: 'Classic', modern: 'Modern', minimal: 'Minimal', bold: 'Bold' },
  accent: 'Color', pageSize: 'Paper', letter: 'Letter', a4: 'A4',
  columnsTitle: 'Table columns', columnsHint: 'Choose what goes in each line. The amount is computed from quantity, price and discount.',
  colLabel: 'Title (empty: the usual one)', colKind: 'What it is', addColumn: '+ Column', up: '↑', down: '↓',
  colKinds: { text: 'Text', number: 'Number', date: 'Date', qty: 'Quantity', price: 'Price', discount: 'Discount %', amount: 'Amount' },
  makeDefault: 'Use these columns for new invoices', defaultSaved: 'New invoices will have these columns.',
  businessTitle: 'My business (for every invoice)', businessName: 'Business or your name', logo: 'Logo or photo', logoPick: '🖼️ Choose',
  logoCamera: '📷 Camera', logoRemove: 'Remove', website: 'Website', country: 'Country', taxIds: 'Tax numbers (printed on the invoice)',
  addTaxId: '+ Number', defaultTaxes: 'Usual taxes', presets: 'Suggested for the country (check the rates):',
  numbering: 'Numbering', prefix: 'Prefix', nextNumber: 'Next number', dueDays: 'Due after (days)', defaultNotes: 'Usual notes', defaultTerms: 'Usual terms',
  applyToThis: 'The new details were also put on this invoice.',
  save: 'Save', cancel: 'Cancel', close: 'Close', ok: 'OK', delete: 'Delete', today: 'Today', none: '—',
  confirmRemoveColumn: 'Remove the column? What is written in it is lost.',
  shareText: (kind, n, total, due) => `${kind} ${n}: ${total}${due ? ` · due ${due}` : ''}`,
};

const fr: Texts = {
  edit: 'Modifier', preview: 'Aperçu', share: 'Partager', business: 'Mon entreprise', pdf: 'PDF', image: 'Image (PNG)', web: 'Page web',
  shareHint: 'Envoyez-la par WhatsApp, SMS, courriel... (sur Android) ; sur un ordinateur, elle est enregistrée.', shared: 'Fait.', saved: 'Enregistré.',
  building: 'Préparation...', shareError: 'Impossible : ', noShare: 'Ce Docodez ne peut pas partager de fichiers depuis un plugin : mettez-le à jour.',
  viewMode: 'Mode lecture : pour modifier la facture, passez Docodez en mode édition.', saveError: 'Impossible d’enregistrer : ',
  welcome: 'D’abord, les données de votre entreprise : nom, logo, adresse, numéro de taxe. Elles servent pour toutes les factures.', setup: 'Configurer',
  docKind: 'Type', kinds: { invoice: 'Facture', quote: 'Devis', receipt: 'Reçu' },
  number: 'Numéro', date: 'Date', dueDate: 'Échéance', status: 'État', statuses: { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée' },
  docLanguage: 'Langue de la facture', currency: 'Devise', days: (n) => `+${n} jours`,
  client: 'Client', clientName: 'Nom', company: 'Entreprise', address: 'Adresse', email: 'Courriel', phone: 'Téléphone', clientTaxId: 'Numéro de taxe du client',
  savedClients: 'Mes clients', saveClient: 'Enregistrer dans mes clients', clientSaved: 'Enregistré dans vos clients.',
  items: 'Articles', addItem: '+ Ligne', columns: 'Colonnes...', taxable: 'Taxable', removeItem: 'Retirer',
  taxes: 'Taxes', addTax: '+ Taxe', taxName: 'Nom', taxRate: '%', discount: 'Remise', percent: '%', amountOff: 'Montant',
  paidAmount: 'Payé', subtotal: 'Sous-total', total: 'Total', balance: 'Solde', notes: 'Notes (paiement, remerciements...)', terms: 'Conditions',
  look: 'Apparence', template: 'Modèle', templates: { classic: 'Classique', modern: 'Moderne', minimal: 'Sobre', bold: 'Audacieux' },
  accent: 'Couleur', pageSize: 'Papier', letter: 'Lettre', a4: 'A4',
  columnsTitle: 'Colonnes du tableau', columnsHint: 'Choisissez ce qui va sur chaque ligne. Le montant se calcule avec la quantité, le prix et la remise.',
  colLabel: 'Titre (vide : l’habituel)', colKind: 'Type', addColumn: '+ Colonne', up: '↑', down: '↓',
  colKinds: { text: 'Texte', number: 'Nombre', date: 'Date', qty: 'Quantité', price: 'Prix', discount: 'Remise %', amount: 'Montant' },
  makeDefault: 'Utiliser ces colonnes pour les nouvelles factures', defaultSaved: 'Les nouvelles factures auront ces colonnes.',
  businessTitle: 'Mon entreprise (pour toutes les factures)', businessName: 'Nom de l’entreprise ou le vôtre', logo: 'Logo ou photo', logoPick: '🖼️ Choisir',
  logoCamera: '📷 Appareil', logoRemove: 'Retirer', website: 'Site web', country: 'Pays', taxIds: 'Numéros de taxe (imprimés sur la facture)',
  addTaxId: '+ Numéro', defaultTaxes: 'Taxes habituelles', presets: 'Suggérées pour le pays (vérifiez les taux) :',
  numbering: 'Numérotation', prefix: 'Préfixe', nextNumber: 'Prochain numéro', dueDays: 'Échéance après (jours)', defaultNotes: 'Notes habituelles', defaultTerms: 'Conditions habituelles',
  applyToThis: 'Les nouvelles données ont aussi été mises sur cette facture.',
  save: 'Enregistrer', cancel: 'Annuler', close: 'Fermer', ok: 'OK', delete: 'Supprimer', today: 'Aujourd’hui', none: '—',
  confirmRemoveColumn: 'Retirer la colonne ? Ce qui y est écrit est perdu.',
  shareText: (kind, n, total, due) => `${kind} ${n} : ${total}${due ? ` · échéance ${due}` : ''}`,
};

export const TEXTS = { es, en, fr };
export type { Texts };

/** Lo que va impreso en la factura, en su idioma. */
export interface DocTexts {
  title: Record<DocKind, string>; number: string; date: string; due: Record<DocKind, string>; to: Record<DocKind, string>;
  columns: Record<ColumnKind, string>; subtotal: string; discount: string; total: string; paid: string; balance: string;
  notes: string; terms: string; page: (i: number, n: number) => string; paidStamp: string; madeWith: string;
}

export const DOC: Record<Lang, DocTexts> = {
  es: {
    title: { invoice: 'FACTURA', quote: 'COTIZACIÓN', receipt: 'RECIBO' }, number: 'N.º', date: 'Fecha',
    due: { invoice: 'Vence', quote: 'Válida hasta', receipt: 'Fecha de pago' }, to: { invoice: 'Facturar a', quote: 'Para', receipt: 'Recibido de' },
    columns: { text: 'Descripción', number: 'Número', date: 'Fecha', qty: 'Cant.', price: 'Precio', discount: 'Desc. %', amount: 'Importe' },
    subtotal: 'Subtotal', discount: 'Descuento', total: 'Total', paid: 'Pagado', balance: 'Saldo a pagar', notes: 'Notas', terms: 'Condiciones',
    page: (i, n) => `Página ${i} de ${n}`, paidStamp: 'PAGADA', madeWith: 'Hecho con Docodez · docodez.com',
  },
  en: {
    title: { invoice: 'INVOICE', quote: 'QUOTE', receipt: 'RECEIPT' }, number: 'No.', date: 'Date',
    due: { invoice: 'Due date', quote: 'Valid until', receipt: 'Paid on' }, to: { invoice: 'Bill to', quote: 'Prepared for', receipt: 'Received from' },
    columns: { text: 'Description', number: 'Number', date: 'Date', qty: 'Qty', price: 'Price', discount: 'Disc. %', amount: 'Amount' },
    subtotal: 'Subtotal', discount: 'Discount', total: 'Total', paid: 'Paid', balance: 'Balance due', notes: 'Notes', terms: 'Terms',
    page: (i, n) => `Page ${i} of ${n}`, paidStamp: 'PAID', madeWith: 'Made with Docodez · docodez.com',
  },
  fr: {
    title: { invoice: 'FACTURE', quote: 'DEVIS', receipt: 'REÇU' }, number: 'N°', date: 'Date',
    due: { invoice: 'Échéance', quote: 'Valable jusqu’au', receipt: 'Payé le' }, to: { invoice: 'Facturé à', quote: 'Pour', receipt: 'Reçu de' },
    columns: { text: 'Description', number: 'Numéro', date: 'Date', qty: 'Qté', price: 'Prix', discount: 'Rem. %', amount: 'Montant' },
    subtotal: 'Sous-total', discount: 'Remise', total: 'Total', paid: 'Payé', balance: 'Solde dû', notes: 'Notes', terms: 'Conditions',
    page: (i, n) => `Page ${i} de ${n}`, paidStamp: 'PAYÉE', madeWith: 'Créé avec Docodez · docodez.com',
  },
};
