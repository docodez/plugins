// Los textos de la pantalla (el idioma sale de docodez.context.language).
import type { PartKind } from './model';

const es = {
  // pestañas
  tabSummary: 'Resumen', tabFuel: 'Gasolina', tabRepairs: 'Reparaciones', tabParts: 'Accesorios', tabTrips: 'Viajes', tabNotes: 'Notas',
  // el carro
  newCar: 'Tu carro', newCarHint: 'Ponle nombre, marca y modelo (✏️).', editCar: 'El carro', settings: 'Unidades y moneda',
  carName: 'Nombre (como le dices; opcional)', year: 'Año', make: 'Marca', model: 'Modelo', trim: 'Versión', vin: 'VIN (número de serie)',
  readVin: 'Leer el VIN', vinUnknown: 'No se pudo leer ese VIN (17 caracteres, sin I, O ni Q).', vinRead: 'Leído del VIN: revisa los datos.',
  plate: 'Placa / matrícula', color: 'Color', fuelType: 'Combustible', engine: 'Motor', tank: (v: string) => `Tanque (${v})`,
  purchaseDate: 'Fecha de compra', purchaseOdometer: (d: string) => `${d} al comprarlo`, carNotes: 'Notas', carPhoto: 'Foto del carro',
  modelsHint: 'Sugerencias de la base pública de EE. UU. (NHTSA); puedes escribir cualquiera.',
  // unidades
  distance: 'Distancia', volume: 'Volumen', economy: 'Consumo', per100: (v: string, d: string) => `${v}/100 ${d}`,
  perVolume: (v: string, d: string) => (d === 'mi' && v === 'gal' ? 'mpg' : `${d}/${v}`), currency: 'Moneda (símbolo)',
  convertAsk: 'Las cantidades ya anotadas se pasan a las nuevas unidades. ¿Seguir?', liters: 'Litros', gallons: 'Galones (EE. UU.)',
  // comunes
  date: 'Fecha', odometer: (d: string) => `Odómetro (${d})`, odometerShort: 'Odómetro', cost: 'Costo', note: 'Nota', notes: 'Notas',
  files: 'Fotos y archivos', camera: '📷 Cámara', photo: '🖼️ Foto', file: '📄 Archivo', save: 'Guardar', cancel: 'Cancelar', ok: 'Aceptar',
  delete: 'Borrar', close: 'Cerrar', confirmDelete: '¿Borrarlo? (también sus fotos y archivos)', today: 'Hoy', none: 'Nada todavía.',
  viewMode: 'Modo vista: para anotar, pasa a modo edición en Docodez.', saveError: 'No se pudo guardar: ', fileError: 'No se pudo agregar: ',
  lastOdometer: (v: string) => `Último anotado: ${v}`, removeFile: 'Quitar', badDate: 'Fecha: aaaa-mm-dd', odometerLower: 'Es menor que el último anotado.',
  // AI
  readPhoto: '📷 Leer de una foto', readOdometer: '📷 Leer el tablero', readPump: '📷 Leer la bomba o el recibo',
  noAi: 'La foto quedó guardada. Para leerla sola hace falta un proveedor de AI (Docodez → Configuración → Proveedores de AI).',
  aiRead: 'Leído de la foto: revisa los valores.', aiNothing: 'No se encontraron esos datos en la foto.', aiError: 'No se pudo leer la foto: ',
  // gasolina
  addFuel: '+ Carga', fuelEntry: 'Carga de combustible', quantity: (v: string) => `Cantidad (${v})`, pricePer: (c: string, v: string) => `Precio por ${v} (${c})`,
  total: (c: string) => `Total (${c})`, full: 'Llené el tanque', fullHint: 'Así se calcula el consumo: entre dos tanques llenos.',
  missed: 'Faltó anotar una carga antes de esta', station: 'Gasolinera', partial: 'parcial', fullShort: 'lleno',
  avg: 'Consumo medio', last: 'Último', best: 'Mejor', worst: 'Peor', costPer: (d: string) => `Costo por ${d}`, spent: 'Gastado',
  totalVolume: 'Cargado', avgPrice: 'Precio medio', loads: (n: number) => `${n} cargas`, needTwoFull: 'El consumo aparece con dos cargas de tanque lleno (con el odómetro).',
  computed: 'calculado', trend: 'Consumo por tanque',
  // reparaciones
  addRepair: '+ Reparación', repair: 'Reparación', title: 'Título', repairTitle: 'Qué se arregló', start: 'Empezó', end: 'Terminó',
  inProgress: 'en curso', mechanic: 'Mecánico', shop: 'Taller', repairsTotal: 'Total en reparaciones', notesPlaceholder: 'Qué se cambió, qué dijeron, garantía...',
  // accesorios
  addPart: '+ Pieza o accesorio', part: 'Pieza o accesorio', kind: 'Tipo', partName: 'Qué es', brand: 'Marca', spec: 'Medida / número de parte',
  use: 'Para qué / dónde', usePlaceholder: 'invierno, delantera izquierda, carrera...', installed: 'Puesta / comprada', where: 'Dónde se compra',
  // viajes
  addTrip: '+ Viaje', trip: 'Viaje', tripTitle: 'Viaje', leave: 'Salida', back: 'Vuelta', from: 'Desde', to: 'Hasta',
  odoStart: 'Odómetro al salir', odoEnd: 'Odómetro al volver', tripsTotal: 'Distancia en viajes',
  // notas
  addNote: '+ Nota', noteTitle: 'Nota',
  // resumen
  current: 'Odómetro', byYear: 'Gastos por año', fuel: 'Combustible', repairs: 'Reparaciones', parts: 'Piezas', all: 'Total',
  lastRepair: 'Última reparación', lastFuel: 'Última carga', ago: (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`),
  // editor
  bold: 'Negrita', italic: 'Cursiva', underline: 'Subrayado', bullets: 'Lista', numbers: 'Lista numerada', heading: 'Título', link: 'Enlace',
  linkPrompt: 'Dirección del enlace', clear: 'Quitar el formato',
  photoOf: (i: number, n: number) => `${i} de ${n}`,
  // Fase 11g: mantenimiento
  tabMaint: 'Mantenimiento', addMaint: '+ Mantenimiento', maint: 'Mantenimiento', maintTitle: 'Qué hay que hacer', icon: 'Ícono',
  everyDistance: (d: string) => `Cada (${d})`, everyMonths: 'Cada (meses)', lastTime: 'La última vez', done: '✓ Hecho',
  doneTitle: (x: string) => `${x}: hecho`, addToRepairs: 'Anotarlo también en Reparaciones', presets: 'Sugeridos',
  presetHint: 'Toca uno para agregarlo; los intervalos se pueden cambiar (mira el manual del carro).',
  overdue: 'Vencido', soon: 'Pronto', upToDate: 'Al día', unknown: 'Sin la última vez',
  leftDistance: (v: string) => `faltan ${v}`, overDistance: (v: string) => `se pasó por ${v}`, leftDays: (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`),
  overDays: (n: number) => (n === 0 ? 'hoy' : `hace ${n} días`), approxDays: (n: number) => `≈ ${n} días`, dueOn: (d: string) => `el ${d}`,
  banner: (o: number, s: number) => [o ? `${o} vencido${o > 1 ? 's' : ''}` : '', s ? `${s} pronto` : ''].filter(Boolean).join(' · '),
  history: 'Veces anteriores', noLast: 'Pon cuándo se hizo la última vez para saber cuándo toca.', needInterval: 'Pon cada cuánto (distancia o meses).',
  maintHint: 'Los avisos se ven al abrir el carro y en el resumen.',
};

const PART_KIND_ES: Record<PartKind, string> = {
  tires: 'Gomas / llantas', wipers: 'Limpiaparabrisas', bulbs: 'Lámparas / bombillos', oil: 'Aceite', filters: 'Filtros', battery: 'Batería',
  brakes: 'Frenos', fluids: 'Líquidos', other: 'Otros',
};
const PART_USES_ES: Record<PartKind, string[]> = {
  tires: ['Verano', 'Invierno', 'Todo el año', 'Carrera', 'Repuesto'],
  wipers: ['Delantero conductor', 'Delantero pasajero', 'Trasero', 'Invierno'],
  bulbs: ['Luz baja', 'Luz alta', 'Neblineros', 'Direccionales', 'Freno', 'Reversa', 'Placa', 'Interior'],
  oil: ['Motor', 'Transmisión', 'Diferencial'],
  filters: ['Aceite', 'Aire', 'Habitáculo', 'Combustible'],
  battery: ['Principal'],
  brakes: ['Pastillas delanteras', 'Pastillas traseras', 'Discos delanteros', 'Discos traseros', 'Líquido'],
  fluids: ['Refrigerante', 'Líquido de frenos', 'Dirección', 'Limpiaparabrisas', 'Transmisión'],
  other: [],
};

type Texts = typeof es;

const en: Texts = {
  tabSummary: 'Summary', tabFuel: 'Fuel', tabRepairs: 'Repairs', tabParts: 'Parts', tabTrips: 'Trips', tabNotes: 'Notes',
  newCar: 'Your car', newCarHint: 'Give it a name, make and model (✏️).', editCar: 'The car', settings: 'Units and currency',
  carName: 'Name (what you call it; optional)', year: 'Year', make: 'Make', model: 'Model', trim: 'Trim', vin: 'VIN',
  readVin: 'Decode VIN', vinUnknown: 'That VIN could not be read (17 characters, no I, O or Q).', vinRead: 'Read from the VIN: check the data.',
  plate: 'License plate', color: 'Color', fuelType: 'Fuel', engine: 'Engine', tank: (v) => `Tank (${v})`,
  purchaseDate: 'Purchase date', purchaseOdometer: (d) => `${d} when bought`, carNotes: 'Notes', carPhoto: 'Photo of the car',
  modelsHint: 'Suggestions from the US public database (NHTSA); you can type any.',
  distance: 'Distance', volume: 'Volume', economy: 'Economy', per100: (v, d) => `${v}/100 ${d}`,
  perVolume: (v, d) => (d === 'mi' && v === 'gal' ? 'mpg' : `${d}/${v}`), currency: 'Currency (symbol)',
  convertAsk: 'What is already logged is converted to the new units. Continue?', liters: 'Liters', gallons: 'Gallons (US)',
  date: 'Date', odometer: (d) => `Odometer (${d})`, odometerShort: 'Odometer', cost: 'Cost', note: 'Note', notes: 'Notes',
  files: 'Photos and files', camera: '📷 Camera', photo: '🖼️ Photo', file: '📄 File', save: 'Save', cancel: 'Cancel', ok: 'OK',
  delete: 'Delete', close: 'Close', confirmDelete: 'Delete it? (its photos and files too)', today: 'Today', none: 'Nothing yet.',
  viewMode: 'View mode: to log, switch Docodez to edit mode.', saveError: 'Could not save: ', fileError: 'Could not add: ',
  lastOdometer: (v) => `Last logged: ${v}`, removeFile: 'Remove', badDate: 'Date: yyyy-mm-dd', odometerLower: 'It is lower than the last one logged.',
  readPhoto: '📷 Read from a photo', readOdometer: '📷 Read the dashboard', readPump: '📷 Read the pump or receipt',
  noAi: 'The photo was saved. To read it automatically you need an AI provider (Docodez → Settings → AI providers).',
  aiRead: 'Read from the photo: check the values.', aiNothing: 'Those values were not found in the photo.', aiError: 'Could not read the photo: ',
  addFuel: '+ Fill-up', fuelEntry: 'Fill-up', quantity: (v) => `Amount (${v})`, pricePer: (c, v) => `Price per ${v} (${c})`,
  total: (c) => `Total (${c})`, full: 'Filled the tank', fullHint: 'Economy is computed between two full tanks.',
  missed: 'A fill-up before this one was not logged', station: 'Station', partial: 'partial', fullShort: 'full',
  avg: 'Average economy', last: 'Last', best: 'Best', worst: 'Worst', costPer: (d) => `Cost per ${d}`, spent: 'Spent',
  totalVolume: 'Fueled', avgPrice: 'Average price', loads: (n) => `${n} fill-ups`, needTwoFull: 'Economy shows up after two full-tank fill-ups (with the odometer).',
  computed: 'computed', trend: 'Economy per tank',
  addRepair: '+ Repair', repair: 'Repair', title: 'Title', repairTitle: 'What was fixed', start: 'Started', end: 'Finished',
  inProgress: 'in progress', mechanic: 'Mechanic', shop: 'Shop', repairsTotal: 'Total on repairs', notesPlaceholder: 'What was changed, what they said, warranty...',
  addPart: '+ Part or accessory', part: 'Part or accessory', kind: 'Type', partName: 'What it is', brand: 'Brand', spec: 'Size / part number',
  use: 'What for / where', usePlaceholder: 'winter, front left, racing...', installed: 'Installed / bought', where: 'Where to buy',
  addTrip: '+ Trip', trip: 'Trip', tripTitle: 'Trip', leave: 'Departure', back: 'Return', from: 'From', to: 'To',
  odoStart: 'Odometer at departure', odoEnd: 'Odometer at return', tripsTotal: 'Distance on trips',
  addNote: '+ Note', noteTitle: 'Note',
  current: 'Odometer', byYear: 'Spending per year', fuel: 'Fuel', repairs: 'Repairs', parts: 'Parts', all: 'Total',
  lastRepair: 'Last repair', lastFuel: 'Last fill-up', ago: (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`),
  bold: 'Bold', italic: 'Italic', underline: 'Underline', bullets: 'List', numbers: 'Numbered list', heading: 'Heading', link: 'Link',
  linkPrompt: 'Link address', clear: 'Clear formatting',
  photoOf: (i, n) => `${i} of ${n}`,
  tabMaint: 'Maintenance', addMaint: '+ Maintenance', maint: 'Maintenance', maintTitle: 'What to do', icon: 'Icon',
  everyDistance: (d) => `Every (${d})`, everyMonths: 'Every (months)', lastTime: 'Last time', done: '✓ Done',
  doneTitle: (x) => `${x}: done`, addToRepairs: 'Also log it in Repairs', presets: 'Suggested',
  presetHint: 'Tap one to add it; the intervals can be changed (check the owner’s manual).',
  overdue: 'Overdue', soon: 'Soon', upToDate: 'OK', unknown: 'No last time',
  leftDistance: (v) => `${v} left`, overDistance: (v) => `${v} over`, leftDays: (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`),
  overDays: (n) => (n === 0 ? 'today' : `${n} days ago`), approxDays: (n) => `≈ ${n} days`, dueOn: (d) => `on ${d}`,
  banner: (o, s) => [o ? `${o} overdue` : '', s ? `${s} soon` : ''].filter(Boolean).join(' · '),
  history: 'Previous times', noLast: 'Enter when it was last done to know when it is due.', needInterval: 'Enter how often (distance or months).',
  maintHint: 'Reminders show up when you open the car and in the summary.',
};

const fr: Texts = {
  tabSummary: 'Résumé', tabFuel: 'Carburant', tabRepairs: 'Réparations', tabParts: 'Accessoires', tabTrips: 'Voyages', tabNotes: 'Notes',
  newCar: 'Votre voiture', newCarHint: 'Donnez-lui un nom, une marque et un modèle (✏️).', editCar: 'La voiture', settings: 'Unités et devise',
  carName: 'Nom (comme vous l’appelez ; facultatif)', year: 'Année', make: 'Marque', model: 'Modèle', trim: 'Version', vin: 'VIN (numéro de série)',
  readVin: 'Lire le VIN', vinUnknown: 'Impossible de lire ce VIN (17 caractères, sans I, O ni Q).', vinRead: 'Lu depuis le VIN : vérifiez les données.',
  plate: 'Immatriculation', color: 'Couleur', fuelType: 'Carburant', engine: 'Moteur', tank: (v) => `Réservoir (${v})`,
  purchaseDate: 'Date d’achat', purchaseOdometer: (d) => `${d} à l’achat`, carNotes: 'Notes', carPhoto: 'Photo de la voiture',
  modelsHint: 'Suggestions de la base publique américaine (NHTSA) ; vous pouvez écrire n’importe lequel.',
  distance: 'Distance', volume: 'Volume', economy: 'Consommation', per100: (v, d) => `${v}/100 ${d}`,
  perVolume: (v, d) => (d === 'mi' && v === 'gal' ? 'mpg' : `${d}/${v}`), currency: 'Devise (symbole)',
  convertAsk: 'Ce qui est déjà noté est converti dans les nouvelles unités. Continuer ?', liters: 'Litres', gallons: 'Gallons (US)',
  date: 'Date', odometer: (d) => `Compteur (${d})`, odometerShort: 'Compteur', cost: 'Coût', note: 'Note', notes: 'Notes',
  files: 'Photos et fichiers', camera: '📷 Appareil', photo: '🖼️ Photo', file: '📄 Fichier', save: 'Enregistrer', cancel: 'Annuler', ok: 'OK',
  delete: 'Supprimer', close: 'Fermer', confirmDelete: 'Le supprimer ? (ses photos et fichiers aussi)', today: 'Aujourd’hui', none: 'Rien pour l’instant.',
  viewMode: 'Mode lecture : pour noter, passez Docodez en mode édition.', saveError: 'Impossible d’enregistrer : ', fileError: 'Impossible d’ajouter : ',
  lastOdometer: (v) => `Dernier noté : ${v}`, removeFile: 'Retirer', badDate: 'Date : aaaa-mm-jj', odometerLower: 'Il est inférieur au dernier noté.',
  readPhoto: '📷 Lire sur une photo', readOdometer: '📷 Lire le tableau de bord', readPump: '📷 Lire la pompe ou le reçu',
  noAi: 'La photo est enregistrée. Pour la lire automatiquement, il faut un fournisseur d’IA (Docodez → Paramètres → Fournisseurs d’IA).',
  aiRead: 'Lu sur la photo : vérifiez les valeurs.', aiNothing: 'Ces valeurs n’ont pas été trouvées sur la photo.', aiError: 'Impossible de lire la photo : ',
  addFuel: '+ Plein', fuelEntry: 'Plein de carburant', quantity: (v) => `Quantité (${v})`, pricePer: (c, v) => `Prix par ${v} (${c})`,
  total: (c) => `Total (${c})`, full: 'Réservoir plein', fullHint: 'La consommation se calcule entre deux pleins.',
  missed: 'Un plein avant celui-ci n’a pas été noté', station: 'Station', partial: 'partiel', fullShort: 'plein',
  avg: 'Consommation moyenne', last: 'Dernière', best: 'Meilleure', worst: 'Pire', costPer: (d) => `Coût par ${d}`, spent: 'Dépensé',
  totalVolume: 'Carburant', avgPrice: 'Prix moyen', loads: (n) => `${n} pleins`, needTwoFull: 'La consommation apparaît après deux pleins complets (avec le compteur).',
  computed: 'calculé', trend: 'Consommation par plein',
  addRepair: '+ Réparation', repair: 'Réparation', title: 'Titre', repairTitle: 'Ce qui a été réparé', start: 'Début', end: 'Fin',
  inProgress: 'en cours', mechanic: 'Mécanicien', shop: 'Garage', repairsTotal: 'Total des réparations', notesPlaceholder: 'Ce qui a été changé, ce qu’ils ont dit, garantie...',
  addPart: '+ Pièce ou accessoire', part: 'Pièce ou accessoire', kind: 'Type', partName: 'Ce que c’est', brand: 'Marque', spec: 'Taille / référence',
  use: 'Pour quoi / où', usePlaceholder: 'hiver, avant gauche, course...', installed: 'Posée / achetée', where: 'Où l’acheter',
  addTrip: '+ Voyage', trip: 'Voyage', tripTitle: 'Voyage', leave: 'Départ', back: 'Retour', from: 'De', to: 'À',
  odoStart: 'Compteur au départ', odoEnd: 'Compteur au retour', tripsTotal: 'Distance en voyages',
  addNote: '+ Note', noteTitle: 'Note',
  current: 'Compteur', byYear: 'Dépenses par an', fuel: 'Carburant', repairs: 'Réparations', parts: 'Pièces', all: 'Total',
  lastRepair: 'Dernière réparation', lastFuel: 'Dernier plein', ago: (n) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} jours`),
  bold: 'Gras', italic: 'Italique', underline: 'Souligné', bullets: 'Liste', numbers: 'Liste numérotée', heading: 'Titre', link: 'Lien',
  linkPrompt: 'Adresse du lien', clear: 'Effacer la mise en forme',
  photoOf: (i, n) => `${i} sur ${n}`,
  tabMaint: 'Entretien', addMaint: '+ Entretien', maint: 'Entretien', maintTitle: 'À faire', icon: 'Icône',
  everyDistance: (d) => `Tous les (${d})`, everyMonths: 'Tous les (mois)', lastTime: 'Dernière fois', done: '✓ Fait',
  doneTitle: (x) => `${x} : fait`, addToRepairs: 'Le noter aussi dans Réparations', presets: 'Suggestions',
  presetHint: 'Touchez-en un pour l’ajouter ; les intervalles peuvent être modifiés (voir le manuel).',
  overdue: 'En retard', soon: 'Bientôt', upToDate: 'À jour', unknown: 'Sans dernière fois',
  leftDistance: (v) => `reste ${v}`, overDistance: (v) => `dépassé de ${v}`, leftDays: (n) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`),
  overDays: (n) => (n === 0 ? 'aujourd’hui' : `il y a ${n} jours`), approxDays: (n) => `≈ ${n} jours`, dueOn: (d) => `le ${d}`,
  banner: (o, s) => [o ? `${o} en retard` : '', s ? `${s} bientôt` : ''].filter(Boolean).join(' · '),
  history: 'Fois précédentes', noLast: 'Indiquez la dernière fois pour savoir quand le refaire.', needInterval: 'Indiquez la fréquence (distance ou mois).',
  maintHint: 'Les rappels s’affichent à l’ouverture de la voiture et dans le résumé.',
};

const PART_KIND_EN: Record<PartKind, string> = {
  tires: 'Tires', wipers: 'Wipers', bulbs: 'Bulbs', oil: 'Oil', filters: 'Filters', battery: 'Battery', brakes: 'Brakes', fluids: 'Fluids', other: 'Other',
};
const PART_USES_EN: Record<PartKind, string[]> = {
  tires: ['Summer', 'Winter', 'All season', 'Racing', 'Spare'],
  wipers: ['Front driver', 'Front passenger', 'Rear', 'Winter'],
  bulbs: ['Low beam', 'High beam', 'Fog lights', 'Turn signals', 'Brake', 'Reverse', 'License plate', 'Interior'],
  oil: ['Engine', 'Transmission', 'Differential'],
  filters: ['Oil', 'Air', 'Cabin', 'Fuel'],
  battery: ['Main'],
  brakes: ['Front pads', 'Rear pads', 'Front rotors', 'Rear rotors', 'Fluid'],
  fluids: ['Coolant', 'Brake fluid', 'Power steering', 'Washer fluid', 'Transmission'],
  other: [],
};
const PART_KIND_FR: Record<PartKind, string> = {
  tires: 'Pneus', wipers: 'Essuie-glaces', bulbs: 'Ampoules', oil: 'Huile', filters: 'Filtres', battery: 'Batterie', brakes: 'Freins',
  fluids: 'Liquides', other: 'Autres',
};
const PART_USES_FR: Record<PartKind, string[]> = {
  tires: ['Été', 'Hiver', 'Toutes saisons', 'Course', 'Secours'],
  wipers: ['Avant conducteur', 'Avant passager', 'Arrière', 'Hiver'],
  bulbs: ['Feux de croisement', 'Feux de route', 'Antibrouillards', 'Clignotants', 'Stop', 'Recul', 'Plaque', 'Intérieur'],
  oil: ['Moteur', 'Boîte de vitesses', 'Différentiel'],
  filters: ['Huile', 'Air', 'Habitacle', 'Carburant'],
  battery: ['Principale'],
  brakes: ['Plaquettes avant', 'Plaquettes arrière', 'Disques avant', 'Disques arrière', 'Liquide'],
  fluids: ['Liquide de refroidissement', 'Liquide de frein', 'Direction', 'Lave-glace', 'Boîte de vitesses'],
  other: [],
};

export const TEXTS = { es, en, fr };

/** Fase 11g: mantenimientos sugeridos: ícono, título, cada cuántos km (null = no va por distancia), cada cuántos meses. */
type Preset = [string, string, number | null, number | null];
const P = (icons: string[], titles: string[], km: (number | null)[], months: (number | null)[]): Preset[] =>
  titles.map((title, i) => [icons[i], title, km[i], months[i]]);
const ICONS = ['🛢️', '🛞', '🌀', '🌬️', '🛑', '💧', '🧊', '⚡', '🔋', '⚙️', '❄️', '📋', '📄', '🪪'];
const KM = [8000, 10000, 20000, 20000, 20000, null, 100000, 100000, null, 100000, null, null, null, null];
const MONTHS = [6, null, 12, 12, 12, 24, 60, null, 12, 84, 12, 12, 12, 12];
export const MAINT_PRESETS = {
  es: P(ICONS, ['Cambio de aceite y filtro', 'Rotar las gomas', 'Filtro de aire', 'Filtro de habitáculo', 'Revisar los frenos', 'Líquido de frenos',
    'Refrigerante', 'Bujías', 'Revisar la batería', 'Correa de distribución', 'Poner las gomas de invierno', 'Inspección técnica', 'Seguro', 'Registro / marbete'], KM, MONTHS),
  en: P(ICONS, ['Oil and filter change', 'Tire rotation', 'Engine air filter', 'Cabin air filter', 'Brake inspection', 'Brake fluid',
    'Coolant', 'Spark plugs', 'Battery check', 'Timing belt', 'Put on winter tires', 'Safety inspection', 'Insurance', 'Registration'], KM, MONTHS),
  fr: P(ICONS, ['Vidange et filtre', 'Permutation des pneus', 'Filtre à air', 'Filtre d’habitacle', 'Contrôle des freins', 'Liquide de frein',
    'Liquide de refroidissement', 'Bougies', 'Contrôle de la batterie', 'Courroie de distribution', 'Pneus d’hiver', 'Contrôle technique', 'Assurance', 'Immatriculation'], KM, MONTHS),
};
export const PART_KINDS_TEXT = { es: PART_KIND_ES, en: PART_KIND_EN, fr: PART_KIND_FR };
export const PART_USES = { es: PART_USES_ES, en: PART_USES_EN, fr: PART_USES_FR };
/** Las unidades que se ofrecen al crear un carro, según el idioma (el inglés, como en EE. UU.). */
export const DEFAULT_UNITS = {
  es: { distance: 'km', volume: 'L', economy: 'per100' }, fr: { distance: 'km', volume: 'L', economy: 'per100' },
  en: { distance: 'mi', volume: 'gal', economy: 'perVolume' },
} as const;
export type { Texts };
