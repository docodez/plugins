// Starter catalogs (templates) in English, Spanish and French. Each item is "en|es|fr" and optionally "@unit"
// (the unit it is usually bought in). The first one (grocery) is created automatically the first time; the others are
// offered when creating a new catalog. The grocery groups follow the usual sections of a printed shopping list
// (fruits, vegetables, meat, bakery, baking, pasta and rice, canned goods...).

export type Lang = 'en' | 'es' | 'fr';
const IDX: Record<Lang, number> = { en: 0, es: 1, fr: 2 };

interface SeedGroup { emoji: string; name: string; products: string[]; taxable: boolean }
interface Seed { emoji: string; name: string; groups: SeedGroup[] }

/** A group. Phase 9l: <taxable> = it is taxed (food is not, almost everywhere). */
const g = (emoji: string, name: string, products: string[], taxable = true): SeedGroup => ({ emoji, name, products, taxable });
const food = (emoji: string, name: string, products: string[]) => g(emoji, name, products, false);

export const SEEDS: Record<'grocery' | 'hardware' | 'electronics', Seed> = {
  grocery: {
    emoji: '🛒', name: 'Grocery|Supermercado|Épicerie',
    groups: [
      food('🍎', 'Fruits|Frutas|Fruits', [
        'Apples|Manzanas|Pommes@kg', 'Bananas|Plátanos|Bananes@kg', 'Oranges|Naranjas|Oranges@kg', 'Lemons|Limones|Citrons',
        'Limes|Limas|Citrons verts', 'Grapes|Uvas|Raisins@kg', 'Strawberries|Fresas|Fraises', 'Blueberries|Arándanos|Myrtilles',
        'Pears|Peras|Poires@kg', 'Peaches|Melocotones|Pêches@kg', 'Pineapple|Piña|Ananas', 'Watermelon|Sandía|Pastèque',
        'Avocados|Aguacates|Avocats', 'Mangoes|Mangos|Mangues', 'Kiwis|Kiwis|Kiwis']),
      food('🥦', 'Vegetables|Verduras|Légumes', [
        'Tomatoes|Tomates|Tomates@kg', 'Potatoes|Papas|Pommes de terre@kg', 'Onions|Cebollas|Oignons@kg', 'Garlic|Ajo|Ail',
        'Carrots|Zanahorias|Carottes@kg', 'Lettuce|Lechuga|Laitue', 'Spinach|Espinaca|Épinards', 'Broccoli|Brócoli|Brocoli',
        'Cucumbers|Pepinos|Concombres', 'Bell peppers|Pimientos|Poivrons', 'Zucchini|Calabacín|Courgettes',
        'Mushrooms|Champiñones|Champignons', 'Celery|Apio|Céleri', 'Corn|Elote|Maïs', 'Cilantro|Cilantro|Coriandre',
        'Parsley|Perejil|Persil']),
      food('🥩', 'Meat|Carne|Viande', [
        'Chicken breast|Pechuga de pollo|Blanc de poulet@kg', 'Whole chicken|Pollo entero|Poulet entier',
        'Chicken thighs|Muslos de pollo|Cuisses de poulet@kg', 'Ground beef|Carne molida|Bœuf haché@kg', 'Steak|Bistec|Steak@kg',
        'Pork chops|Chuletas de cerdo|Côtelettes de porc@kg', 'Bacon|Tocino|Bacon', 'Ham|Jamón|Jambon', 'Sausages|Salchichas|Saucisses',
        'Turkey|Pavo|Dinde@kg']),
      food('🐟', 'Seafood|Pescados y mariscos|Poissons et fruits de mer', [
        'Salmon|Salmón|Saumon@kg', 'Tuna|Atún|Thon@kg', 'Shrimp|Camarones|Crevettes@kg', 'White fish|Pescado blanco|Poisson blanc@kg',
        'Mussels|Mejillones|Moules@kg']),
      food('🧀', 'Dairy & eggs|Lácteos y huevos|Produits laitiers et œufs', [
        'Milk|Leche|Lait@L', 'Eggs|Huevos|Œufs@dozen', 'Butter|Mantequilla|Beurre', 'Cheese|Queso|Fromage', 'Yogurt|Yogur|Yaourt',
        'Cream|Crema|Crème', 'Sour cream|Crema agria|Crème aigre', 'Cream cheese|Queso crema|Fromage à la crème']),
      food('🍞', 'Bakery|Panadería|Boulangerie', [
        'Bread|Pan|Pain', 'Sliced bread|Pan de molde|Pain de mie', 'Tortillas|Tortillas|Tortillas', 'Bagels|Bagels|Bagels',
        'Rolls|Panecillos|Petits pains', 'Croissants|Cruasanes|Croissants']),
      food('🧁', 'Baking|Repostería|Pâtisserie', [
        'Flour|Harina|Farine@kg', 'Sugar|Azúcar|Sucre@kg', 'Brown sugar|Azúcar morena|Cassonade', 'Baking powder|Polvo de hornear|Levure chimique',
        'Baking soda|Bicarbonato|Bicarbonate', 'Yeast|Levadura|Levure', 'Vanilla extract|Extracto de vainilla|Extrait de vanille',
        'Cocoa powder|Cacao en polvo|Cacao en poudre', 'Chocolate chips|Chispas de chocolate|Pépites de chocolat',
        'Cornstarch|Maicena|Fécule de maïs', 'Powdered sugar|Azúcar glas|Sucre glace']),
      food('🍝', 'Pasta & rice|Pasta y arroz|Pâtes et riz', [
        'Spaghetti|Espaguetis|Spaghettis', 'Penne|Penne|Penne', 'Rice|Arroz|Riz@kg', 'Brown rice|Arroz integral|Riz complet@kg',
        'Noodles|Fideos|Nouilles', 'Lasagna sheets|Láminas de lasaña|Feuilles de lasagne', 'Quinoa|Quinoa|Quinoa',
        'Couscous|Cuscús|Couscous', 'Lentils|Lentejas|Lentilles@kg', 'Dried beans|Frijoles secos|Haricots secs@kg']),
      food('🥫', 'Canned goods|Enlatados|Conserves', [
        'Canned tomatoes|Tomate en lata|Tomates en conserve', 'Tomato sauce|Salsa de tomate|Sauce tomate', 'Beans|Frijoles|Haricots',
        'Chickpeas|Garbanzos|Pois chiches', 'Canned corn|Maíz en lata|Maïs en conserve', 'Canned tuna|Atún en lata|Thon en conserve',
        'Soup|Sopa|Soupe', 'Coconut milk|Leche de coco|Lait de coco']),
      food('🫒', 'Oils & condiments|Aceites y condimentos|Huiles et condiments', [
        'Olive oil|Aceite de oliva|Huile d\'olive@L', 'Vegetable oil|Aceite vegetal|Huile végétale@L', 'Vinegar|Vinagre|Vinaigre',
        'Ketchup|Kétchup|Ketchup', 'Mustard|Mostaza|Moutarde', 'Mayonnaise|Mayonesa|Mayonnaise', 'Soy sauce|Salsa de soya|Sauce soja',
        'Hot sauce|Salsa picante|Sauce piquante', 'Salad dressing|Aderezo|Vinaigrette']),
      food('🧂', 'Spices|Especias|Épices', [
        'Salt|Sal|Sel', 'Black pepper|Pimienta negra|Poivre noir', 'Paprika|Pimentón|Paprika', 'Cumin|Comino|Cumin',
        'Oregano|Orégano|Origan', 'Cinnamon|Canela|Cannelle', 'Chili powder|Chile en polvo|Piment en poudre',
        'Garlic powder|Ajo en polvo|Ail en poudre', 'Bay leaves|Laurel|Laurier']),
      food('🥣', 'Breakfast|Desayuno|Petit-déjeuner', [
        'Cereal|Cereal|Céréales', 'Oatmeal|Avena|Flocons d\'avoine', 'Peanut butter|Mantequilla de maní|Beurre de cacahuète',
        'Jam|Mermelada|Confiture', 'Honey|Miel|Miel', 'Coffee|Café|Café', 'Tea|Té|Thé', 'Maple syrup|Sirope de arce|Sirop d\'érable']),
      food('🍪', 'Snacks|Botanas|Collations', [
        'Chips|Papas fritas|Chips', 'Crackers|Galletas saladas|Crackers', 'Cookies|Galletas|Biscuits', 'Nuts|Nueces|Noix',
        'Popcorn|Palomitas|Pop-corn', 'Chocolate|Chocolate|Chocolat', 'Granola bars|Barritas de granola|Barres de céréales']),
      g('🥤', 'Beverages|Bebidas|Boissons', [
        'Water|Agua|Eau@L', 'Sparkling water|Agua con gas|Eau gazeuse@L', 'Juice|Jugo|Jus@L', 'Soda|Refresco|Soda@L',
        'Beer|Cerveza|Bière', 'Wine|Vino|Vin']),
      food('❄️', 'Frozen|Congelados|Surgelés', [
        'Frozen vegetables|Verduras congeladas|Légumes surgelés', 'Frozen fruit|Fruta congelada|Fruits surgelés',
        'Ice cream|Helado|Glace', 'Frozen pizza|Pizza congelada|Pizza surgelée', 'French fries|Papas a la francesa|Frites surgelées']),
      g('🧽', 'Household|Limpieza y hogar|Entretien', [
        'Toilet paper|Papel higiénico|Papier toilette', 'Paper towels|Toallas de papel|Essuie-tout', 'Dish soap|Lavavajillas|Liquide vaisselle',
        'Laundry detergent|Detergente|Lessive', 'Trash bags|Bolsas de basura|Sacs poubelle', 'Sponges|Esponjas|Éponges',
        'Aluminum foil|Papel aluminio|Papier aluminium', 'Plastic wrap|Film plástico|Film alimentaire', 'Bleach|Cloro|Javel']),
      g('🧴', 'Personal care|Cuidado personal|Hygiène', [
        'Shampoo|Champú|Shampooing', 'Conditioner|Acondicionador|Après-shampooing', 'Soap|Jabón|Savon', 'Toothpaste|Pasta de dientes|Dentifrice',
        'Toothbrush|Cepillo de dientes|Brosse à dents', 'Deodorant|Desodorante|Déodorant', 'Razors|Rastrillos|Rasoirs']),
      g('👶', 'Baby|Bebé|Bébé', ['Diapers|Pañales|Couches', 'Baby wipes|Toallitas húmedas|Lingettes', 'Formula|Fórmula|Lait infantile']),
      g('🐾', 'Pets|Mascotas|Animaux', ['Dog food|Comida para perro|Nourriture pour chien@kg', 'Cat food|Comida para gato|Nourriture pour chat@kg',
        'Cat litter|Arena para gato|Litière@kg']),
    ],
  },
  hardware: {
    emoji: '🔨', name: 'Hardware store|Ferretería|Quincaillerie',
    groups: [
      g('🔩', 'Fasteners|Tornillería|Visserie', ['Wood screws|Tornillos para madera|Vis à bois', 'Drywall screws|Tornillos para tablaroca|Vis à placo',
        'Nails|Clavos|Clous', 'Wall anchors|Taquetes|Chevilles', 'Bolts|Pernos|Boulons', 'Nuts|Tuercas|Écrous', 'Washers|Arandelas|Rondelles']),
      g('🔨', 'Tools|Herramientas|Outils', ['Hammer|Martillo|Marteau', 'Screwdriver set|Juego de desarmadores|Jeu de tournevis',
        'Tape measure|Cinta métrica|Mètre ruban', 'Level|Nivel|Niveau', 'Utility knife|Cúter|Cutter', 'Drill bits|Brocas|Forets',
        'Saw blade|Hoja de sierra|Lame de scie', 'Pliers|Pinzas|Pince']),
      g('⚡', 'Electrical|Electricidad|Électricité', ['Electrical wire|Cable eléctrico|Câble électrique@m', 'Outlets|Contactos|Prises',
        'Switches|Apagadores|Interrupteurs', 'Light bulbs|Focos|Ampoules', 'Extension cord|Extensión|Rallonge',
        'Electrical tape|Cinta aislante|Ruban isolant', 'Wire nuts|Capuchones|Dominos']),
      g('🚰', 'Plumbing|Plomería|Plomberie', ['PVC pipe|Tubo de PVC|Tuyau PVC@m', 'Fittings|Conexiones|Raccords', 'Teflon tape|Cinta teflón|Ruban téflon',
        'Faucet|Llave de agua|Robinet', 'Plunger|Destapacaños|Ventouse', 'Drain cleaner|Destapador de caños|Déboucheur']),
      g('🎨', 'Paint|Pintura|Peinture', ['Paint|Pintura|Peinture@L', 'Primer|Sellador|Apprêt@L', 'Brushes|Brochas|Pinceaux', 'Rollers|Rodillos|Rouleaux',
        'Painter\'s tape|Cinta de pintor|Ruban de masquage', 'Drop cloth|Lona protectora|Bâche', 'Sandpaper|Lija|Papier de verre']),
      g('🪵', 'Lumber|Madera|Bois', ['2x4|Barrote 2x4|Planche 2x4', 'Plywood|Triplay|Contreplaqué', 'MDF|MDF|MDF', 'Trim|Moldura|Moulure@m']),
      g('🧴', 'Adhesives & sealants|Pegamentos y selladores|Colles et mastics', ['Wood glue|Pegamento para madera|Colle à bois',
        'Construction adhesive|Adhesivo de montaje|Colle de montage', 'Silicone caulk|Silicón|Silicone', 'Epoxy|Epóxico|Époxy',
        'Lubricant (WD-40)|Lubricante (WD-40)|Lubrifiant (WD-40)']),
      g('🌱', 'Garden|Jardín|Jardin', ['Potting soil|Tierra para macetas|Terreau', 'Fertilizer|Fertilizante|Engrais', 'Mulch|Mantillo|Paillis',
        'Seeds|Semillas|Graines', 'Garden hose|Manguera|Tuyau d\'arrosage', 'Garden gloves|Guantes de jardín|Gants de jardin']),
      g('🦺', 'Safety|Seguridad|Sécurité', ['Work gloves|Guantes de trabajo|Gants de travail', 'Safety glasses|Lentes de seguridad|Lunettes de protection',
        'Dust masks|Cubrebocas|Masques anti-poussière', 'Ear protection|Protectores auditivos|Protection auditive']),
    ],
  },
  electronics: {
    emoji: '🔌', name: 'Electronics|Electrónica|Électronique',
    groups: [
      g('🔌', 'Components|Componentes|Composants', ['Resistors|Resistencias|Résistances', 'Capacitors|Capacitores|Condensateurs',
        'LEDs|LEDs|LED', 'Diodes|Diodos|Diodes', 'Transistors|Transistores|Transistors', 'Potentiometers|Potenciómetros|Potentiomètres',
        'Push buttons|Botones|Boutons-poussoirs']),
      g('🧠', 'Boards & microcontrollers|Placas y microcontroladores|Cartes et microcontrôleurs', ['Arduino|Arduino|Arduino', 'ESP32|ESP32|ESP32',
        'Raspberry Pi|Raspberry Pi|Raspberry Pi', 'Sensor modules|Módulos de sensores|Modules capteurs']),
      g('🔋', 'Power|Alimentación|Alimentation', ['Batteries|Baterías|Piles', 'Battery holders|Portapilas|Supports de piles',
        'Voltage regulators|Reguladores de voltaje|Régulateurs de tension', 'Power supply|Fuente de poder|Alimentation']),
      g('🧵', 'Cables & connectors|Cables y conectores|Câbles et connecteurs', ['Jumper wires|Cables dupont|Fils de connexion', 'USB cables|Cables USB|Câbles USB',
        'Pin headers|Tiras de pines|Barrettes à broches', 'JST connectors|Conectores JST|Connecteurs JST', 'Terminal blocks|Borneras|Borniers',
        'Hook-up wire|Cable para protoboard|Fil de câblage@m']),
      g('🛠️', 'Tools & supplies|Herramientas e insumos|Outils et fournitures', ['Solder|Soldadura|Soudure', 'Flux|Flux|Flux',
        'Heat shrink|Termofil|Gaine thermo', 'Breadboard|Protoboard|Platine d\'essai', 'Perfboard|Placa perforada|Plaque à trous',
        'Multimeter|Multímetro|Multimètre']),
      g('📟', 'Displays & modules|Pantallas y módulos|Écrans et modules', ['OLED display|Pantalla OLED|Écran OLED', 'LCD display|Pantalla LCD|Écran LCD',
        'Relays|Relevadores|Relais', 'Motors|Motores|Moteurs', 'Servos|Servos|Servos']),
    ],
  },
};

export type SeedId = keyof typeof SEEDS;

const pick = (text: string, lang: Lang) => {
  const parts = text.split('|');
  return (parts[IDX[lang]] || parts[0]).trim();
};

/** A template's catalog in one language: { emoji, name, groups: [{ emoji, name, products: [{ name, unit }] }] }. */
export function seedCatalog(id: SeedId, lang: Lang) {
  const seed = SEEDS[id];
  return {
    emoji: seed.emoji,
    name: pick(seed.name, lang),
    groups: seed.groups.map((group) => ({
      emoji: group.emoji,
      name: pick(group.name, lang),
      taxable: group.taxable,
      products: group.products.map((p) => {
        const [names, unit] = p.split('@');
        return { name: pick(names, lang), unit: unit ?? '' };
      }),
    })),
  };
}

/** Phase 9l: the names (in the three languages) of the untaxed food groups: for catalogs created before. */
export const FOOD_GROUPS = new Set(Object.values(SEEDS).flatMap((seed) => seed.groups.filter((gr) => !gr.taxable)
  .flatMap((gr) => gr.name.split('|').map((n) => n.trim().toLocaleLowerCase()))));

/** A template's name in one language. */
export const seedName = (id: SeedId, lang: Lang) => pick(SEEDS[id].name, lang);
