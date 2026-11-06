/**
 * Les ingrédients de la cuisine : leur nom en français, en anglais (pour chercher les recettes),
 * un pictogramme, leur rayon et leur place (le frigo ou les placards).
 * Ce fichier sert à la fois au site et au relais /api/recipes : rien qui dépende du navigateur.
 */

// les rayons, dans l'ordre où on les range ; `place` : où ils vont par défaut
export const AISLES = [
  { id: 'cremerie', label: 'Crèmerie & œufs', place: 'frigo', icon: '🥛' },
  { id: 'viande', label: 'Viandes & poissons', place: 'frigo', icon: '🍗' },
  { id: 'legumes', label: 'Légumes', place: 'frigo', icon: '🥕' },
  { id: 'fruits', label: 'Fruits', place: 'frigo', icon: '🍎' },
  { id: 'frais', label: 'Sauces & traiteur', place: 'frigo', icon: '🫙' },
  { id: 'feculents', label: 'Pâtes, riz & céréales', place: 'placard', icon: '🍝' },
  { id: 'garde', label: 'Légumes de garde', place: 'placard', icon: '🧅' },
  { id: 'conserves', label: 'Conserves & bocaux', place: 'placard', icon: '🥫' },
  { id: 'patisserie', label: 'Pâtisserie', place: 'placard', icon: '🌾' },
  { id: 'epices', label: 'Épices & herbes', place: 'placard', icon: '🌿' },
  { id: 'huiles', label: 'Huiles, vinaigres & sauces', place: 'placard', icon: '🫒' },
  { id: 'sucre', label: 'Sucré & petit-déjeuner', place: 'placard', icon: '🍯' },
]
export const aisleOf = id => AISLES.find(a => a.id === id) || AISLES[0]

// [français, anglais (et synonymes séparés par |), pictogramme, rayon]
const RAW = [
  // crèmerie & œufs
  ['Œufs', 'egg|eggs', '🥚', 'cremerie'], ['Lait', 'milk|whole milk', '🥛', 'cremerie'], ['Beurre', 'butter|unsalted butter|salted butter', '🧈', 'cremerie'],
  ['Crème fraîche', 'creme fraiche|sour cream|cream', '🥛', 'cremerie'], ['Crème liquide', 'heavy cream|whipping cream|cream', '🥛', 'cremerie'],
  ['Yaourt nature', 'yogurt|plain yogurt|greek yogurt', '🥛', 'cremerie'], ['Fromage râpé', 'grated cheese|shredded cheese', '🧀', 'cremerie'],
  ['Emmental', 'emmental|swiss cheese', '🧀', 'cremerie'], ['Comté', 'comte|gruyere', '🧀', 'cremerie'], ['Parmesan', 'parmesan|parmigiano', '🧀', 'cremerie'],
  ['Mozzarella', 'mozzarella', '🧀', 'cremerie'], ['Chèvre', 'goat cheese', '🧀', 'cremerie'], ['Feta', 'feta', '🧀', 'cremerie'], ['Cheddar', 'cheddar', '🧀', 'cremerie'],
  ['Ricotta', 'ricotta', '🧀', 'cremerie'], ['Mascarpone', 'mascarpone', '🧀', 'cremerie'], ['Fromage frais', 'cream cheese', '🧀', 'cremerie'], ['Reblochon', 'reblochon|soft cheese', '🧀', 'cremerie'],
  // viandes & poissons
  ['Poulet', 'chicken|chicken thighs|chicken legs|whole chicken', '🍗', 'viande'], ['Blanc de poulet', 'chicken breast|chicken breasts', '🍗', 'viande'],
  ['Bœuf haché', 'ground beef|minced beef', '🥩', 'viande'], ['Steak', 'beef steak|steak', '🥩', 'viande'], ['Bœuf', 'beef', '🥩', 'viande'],
  ['Porc', 'pork|pork chops|pork loin', '🥩', 'viande'], ['Agneau', 'lamb', '🥩', 'viande'], ['Veau', 'veal', '🥩', 'viande'], ['Dinde', 'turkey', '🍗', 'viande'],
  ['Lardons', 'bacon|pancetta|lardons', '🥓', 'viande'], ['Jambon', 'ham', '🍖', 'viande'], ['Saucisses', 'sausage|sausages', '🌭', 'viande'], ['Chorizo', 'chorizo', '🌭', 'viande'],
  ['Saumon', 'salmon|salmon fillet', '🐟', 'viande'], ['Cabillaud', 'cod|white fish', '🐟', 'viande'], ['Thon frais', 'tuna steak|fresh tuna', '🐟', 'viande'],
  ['Crevettes', 'shrimp|prawns', '🦐', 'viande'], ['Moules', 'mussels', '🦪', 'viande'], ['Tofu', 'tofu', '🧊', 'viande'],
  // légumes
  ['Tomates', 'tomato|tomatoes', '🍅', 'legumes'], ['Tomates cerises', 'cherry tomatoes|cherry tomato', '🍅', 'legumes'], ['Carottes', 'carrot|carrots', '🥕', 'legumes'],
  ['Courgettes', 'zucchini|courgette', '🥒', 'legumes'], ['Concombre', 'cucumber', '🥒', 'legumes'], ['Poivron', 'bell pepper|red pepper|green pepper|peppers', '🫑', 'legumes'],
  ['Aubergine', 'eggplant|aubergine', '🍆', 'legumes'], ['Brocoli', 'broccoli', '🥦', 'legumes'], ['Chou-fleur', 'cauliflower', '🥦', 'legumes'], ['Salade', 'lettuce|salad greens|romaine', '🥬', 'legumes'],
  ['Épinards', 'spinach|baby spinach', '🥬', 'legumes'], ['Champignons', 'mushroom|mushrooms', '🍄', 'legumes'], ['Poireaux', 'leek|leeks', '🥬', 'legumes'],
  ['Haricots verts', 'green beans', '🫛', 'legumes'], ['Petits pois', 'peas|green peas', '🫛', 'legumes'], ['Céleri', 'celery', '🥬', 'legumes'], ['Avocat', 'avocado', '🥑', 'legumes'],
  ['Maïs', 'corn|sweet corn', '🌽', 'legumes'], ['Chou', 'cabbage', '🥬', 'legumes'], ['Radis', 'radish|radishes', '🥗', 'legumes'], ['Betterave', 'beet|beetroot', '🥗', 'legumes'],
  ['Persil', 'parsley', '🌿', 'legumes'], ['Coriandre', 'cilantro|coriander', '🌿', 'legumes'], ['Basilic', 'basil', '🌿', 'legumes'], ['Ciboulette', 'chives', '🌿', 'legumes'],
  ['Menthe', 'mint', '🌿', 'legumes'], ['Gingembre', 'ginger|fresh ginger', '🫚', 'legumes'], ['Piment', 'chili|chili pepper|jalapeno', '🌶️', 'legumes'], ['Oignons verts', 'green onion|green onions|scallion|scallions|spring onion', '🌱', 'legumes'],
  // fruits
  ['Citron', 'lemon|lemon juice|lemon zest', '🍋', 'fruits'], ['Citron vert', 'lime|lime juice', '🍋', 'fruits'], ['Pommes', 'apple|apples', '🍎', 'fruits'], ['Bananes', 'banana|bananas', '🍌', 'fruits'],
  ['Fraises', 'strawberry|strawberries', '🍓', 'fruits'], ['Framboises', 'raspberry|raspberries', '🍓', 'fruits'], ['Myrtilles', 'blueberry|blueberries', '🫐', 'fruits'],
  ['Oranges', 'orange|oranges|orange juice', '🍊', 'fruits'], ['Poires', 'pear|pears', '🍐', 'fruits'], ['Pêches', 'peach|peaches', '🍑', 'fruits'], ['Raisin', 'grapes', '🍇', 'fruits'],
  ['Mangue', 'mango', '🥭', 'fruits'], ['Ananas', 'pineapple', '🍍', 'fruits'], ['Kiwi', 'kiwi', '🥝', 'fruits'], ['Cerises', 'cherry|cherries', '🍒', 'fruits'],
  // sauces & traiteur (frais)
  ['Moutarde', 'mustard|dijon mustard', '🫙', 'frais'], ['Mayonnaise', 'mayonnaise|mayo', '🫙', 'frais'], ['Ketchup', 'ketchup', '🫙', 'frais'], ['Pesto', 'pesto', '🫙', 'frais'],
  ['Pâte feuilletée', 'puff pastry', '🥐', 'frais'], ['Pâte brisée', 'pie crust|shortcrust pastry|pie dough', '🥧', 'frais'], ['Pâte à pizza', 'pizza dough', '🍕', 'frais'],
  ['Houmous', 'hummus', '🫙', 'frais'], ['Olives', 'olives|black olives|kalamata olives', '🫒', 'frais'], ['Câpres', 'capers', '🫙', 'frais'],
  // pâtes, riz & céréales
  ['Pâtes', 'pasta|spaghetti|penne|fusilli|linguine|macaroni|tagliatelle', '🍝', 'feculents'], ['Spaghetti', 'spaghetti', '🍝', 'feculents'], ['Riz', 'rice|white rice|basmati rice|jasmine rice', '🍚', 'feculents'],
  ['Riz à risotto', 'arborio rice|risotto rice', '🍚', 'feculents'], ['Semoule', 'couscous|semolina', '🌾', 'feculents'], ['Quinoa', 'quinoa', '🌾', 'feculents'], ['Boulgour', 'bulgur', '🌾', 'feculents'],
  ['Lentilles', 'lentils|red lentils|green lentils', '🫘', 'feculents'], ['Pois chiches', 'chickpeas|garbanzo beans', '🫘', 'feculents'], ['Haricots rouges', 'kidney beans|red beans', '🫘', 'feculents'],
  ['Haricots blancs', 'white beans|cannellini beans', '🫘', 'feculents'], ['Nouilles', 'noodles|egg noodles|rice noodles|ramen', '🍜', 'feculents'], ['Flocons d’avoine', 'oats|rolled oats|oatmeal', '🌾', 'feculents'],
  ['Pain', 'bread|baguette|sourdough', '🍞', 'feculents'], ['Pain de mie', 'sandwich bread|white bread', '🍞', 'feculents'], ['Chapelure', 'breadcrumbs|panko', '🍞', 'feculents'], ['Tortillas', 'tortillas|tortilla|wraps', '🫓', 'feculents'],
  // légumes de garde
  ['Oignons', 'onion|onions|yellow onion|red onion', '🧅', 'garde'], ['Échalotes', 'shallot|shallots', '🧅', 'garde'], ['Ail', 'garlic|garlic cloves|garlic clove', '🧄', 'garde'],
  ['Pommes de terre', 'potato|potatoes', '🥔', 'garde'], ['Patates douces', 'sweet potato|sweet potatoes', '🍠', 'garde'], ['Courge', 'squash|butternut squash|pumpkin', '🎃', 'garde'],
  // conserves & bocaux
  ['Tomates pelées', 'canned tomatoes|diced tomatoes|crushed tomatoes|whole tomatoes', '🥫', 'conserves'], ['Coulis de tomate', 'tomato sauce|passata|tomato puree', '🥫', 'conserves'],
  ['Concentré de tomate', 'tomato paste', '🥫', 'conserves'], ['Thon en boîte', 'canned tuna|tuna', '🥫', 'conserves'], ['Lait de coco', 'coconut milk', '🥥', 'conserves'],
  ['Maïs en boîte', 'canned corn|corn kernels', '🥫', 'conserves'], ['Bouillon', 'broth|stock|chicken broth|vegetable broth|beef broth|bouillon', '🫙', 'conserves'],
  ['Sardines', 'sardines', '🥫', 'conserves'], ['Cornichons', 'pickles|gherkins', '🫙', 'conserves'],
  // pâtisserie
  ['Farine', 'flour|all purpose flour|all-purpose flour|plain flour', '🌾', 'patisserie'], ['Sucre', 'sugar|granulated sugar|white sugar', '🧂', 'patisserie'],
  ['Sucre roux', 'brown sugar', '🧂', 'patisserie'], ['Sucre glace', 'powdered sugar|icing sugar|confectioners sugar', '🧂', 'patisserie'], ['Levure chimique', 'baking powder', '🧂', 'patisserie'],
  ['Bicarbonate', 'baking soda', '🧂', 'patisserie'], ['Levure de boulanger', 'yeast|dry yeast|instant yeast', '🧂', 'patisserie'], ['Maïzena', 'cornstarch|corn starch', '🌾', 'patisserie'],
  ['Chocolat noir', 'dark chocolate|chocolate|chocolate chips|semisweet chocolate', '🍫', 'patisserie'], ['Cacao', 'cocoa|cocoa powder', '🍫', 'patisserie'], ['Vanille', 'vanilla|vanilla extract', '🌼', 'patisserie'],
  ['Poudre d’amande', 'almond flour|ground almonds', '🌰', 'patisserie'], ['Amandes', 'almonds', '🌰', 'patisserie'], ['Noix', 'walnuts', '🌰', 'patisserie'], ['Noisettes', 'hazelnuts', '🌰', 'patisserie'],
  ['Cacahuètes', 'peanuts', '🥜', 'patisserie'], ['Raisins secs', 'raisins', '🍇', 'patisserie'],
  // épices & herbes
  ['Sel', 'salt', '🧂', 'epices'], ['Poivre', 'pepper|black pepper', '🧂', 'epices'], ['Paprika', 'paprika|smoked paprika', '🌶️', 'epices'], ['Cumin', 'cumin', '🌿', 'epices'],
  ['Curry', 'curry powder|curry', '🌿', 'epices'], ['Curcuma', 'turmeric', '🌿', 'epices'], ['Cannelle', 'cinnamon', '🌿', 'epices'], ['Muscade', 'nutmeg', '🌿', 'epices'],
  ['Herbes de Provence', 'herbes de provence|dried herbs|italian seasoning', '🌿', 'epices'], ['Thym', 'thyme', '🌿', 'epices'], ['Romarin', 'rosemary', '🌿', 'epices'], ['Origan', 'oregano', '🌿', 'epices'],
  ['Laurier', 'bay leaf|bay leaves', '🌿', 'epices'], ['Piment de Cayenne', 'cayenne|cayenne pepper|chili flakes|red pepper flakes', '🌶️', 'epices'], ['Gingembre en poudre', 'ground ginger', '🌿', 'epices'],
  ['Graines de sésame', 'sesame seeds', '🌿', 'epices'],
  // huiles, vinaigres & sauces
  ['Huile d’olive', 'olive oil|extra virgin olive oil', '🫒', 'huiles'], ['Huile', 'oil|vegetable oil|canola oil|sunflower oil', '🫒', 'huiles'], ['Huile de sésame', 'sesame oil', '🫒', 'huiles'],
  ['Vinaigre', 'vinegar|white vinegar|wine vinegar|red wine vinegar', '🫙', 'huiles'], ['Vinaigre balsamique', 'balsamic vinegar', '🫙', 'huiles'], ['Sauce soja', 'soy sauce|tamari', '🫙', 'huiles'],
  ['Sauce Worcestershire', 'worcestershire sauce', '🫙', 'huiles'], ['Sauce piquante', 'hot sauce|sriracha', '🌶️', 'huiles'], ['Vin blanc', 'white wine|dry white wine', '🍷', 'huiles'], ['Vin rouge', 'red wine', '🍷', 'huiles'],
  // sucré & petit-déjeuner
  ['Miel', 'honey', '🍯', 'sucre'], ['Confiture', 'jam|jelly', '🍓', 'sucre'], ['Sirop d’érable', 'maple syrup', '🍁', 'sucre'], ['Pâte à tartiner', 'nutella|chocolate spread', '🍫', 'sucre'],
  ['Beurre de cacahuète', 'peanut butter', '🥜', 'sucre'], ['Café', 'coffee|espresso', '☕', 'sucre'], ['Thé', 'tea', '🍵', 'sucre'], ['Biscuits', 'cookies|biscuits', '🍪', 'sucre'],
]

export const norm = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
// au singulier, mot à mot (tomatoes → tomato, œufs → oeuf, choux → chou)
const sing = w => (w.length > 3 && /oes$/.test(w) ? w.slice(0, -2) : w.length > 3 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /[sx]$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w)
export const tokens = s => norm(s).split(' ').filter(Boolean).map(sing)
const key = s => tokens(s).join(' ')

export const INGREDIENTS = RAW.map(([fr, en, emoji, aisle]) => {
  const names = en.split('|')
  return { fr, en: names[0], alt: names, emoji, aisle, place: aisleOf(aisle).place }
})

// recherche par le français (sans accents, au singulier, sur le début des mots)
export function findIngredients(text, limit = 8) {
  const q = key(text)
  if (!q) return []
  const scored = []
  for (const it of INGREDIENTS) {
    const k = key(it.fr)
    const s = k === q ? 0 : k.startsWith(q) ? 1 : k.split(' ').some(w => w.startsWith(q)) ? 2 : k.includes(q) ? 3 : -1
    if (s >= 0) scored.push([s, it])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].fr.length - b[1].fr.length).slice(0, limit).map(x => x[1])
}
export const ingredientByFr = text => INGREDIENTS.find(it => key(it.fr) === key(text)) || null

// de l'anglais (une ligne de recette) vers notre catalogue : le nom le plus long qui y figure en entier
const BY_EN = INGREDIENTS.flatMap(it => it.alt.map(a => [tokens(a), it])).sort((a, b) => b[0].length - a[0].length)
export function ingredientByEn(text) {
  const t = tokens(text)
  if (!t.length) return null
  const has = new Set(t)
  for (const [words, it] of BY_EN) if (words.every(w => has.has(w))) return it
  return null
}

// toujours là : on ne les compte jamais comme « à acheter »
const STAPLES = ['water', 'salt', 'pepper', 'black pepper', 'ice', 'salt and pepper', 'ice cube']
export const isStaple = en => STAPLES.includes(tokens(en).join(' '))

// mots qui changent l'ingrédient : « lait de coco » n'est pas du lait, « beurre de cacahuète » pas du beurre
const DISTINCT = new Set(['coconut', 'almond', 'soy', 'oat', 'peanut', 'sesame', 'rice', 'corn', 'sweet', 'powder', 'ground', 'sauce', 'paste', 'juice', 'zest', 'vinegar', 'broth', 'stock', 'cream', 'butter', 'flour', 'syrup', 'canned', 'dried'])
/** Dans nos réserves (frigo + placards), l'article qui couvre cet ingrédient de recette (ou null). */
export function inPantry(en, items) {
  const t = tokens(en)
  if (!t.length) return null
  const has = new Set(t)
  let best = null, bestLen = 0
  for (const it of items) {
    for (const name of [it.en, ...(it.alt || [])]) {
      const w = tokens(name)
      if (!w.length || !w.every(x => has.has(x))) continue
      // un mot qui change tout dans la recette, et pas dans notre article : ce n'est pas le même
      if (t.some(x => DISTINCT.has(x) && !w.includes(x))) continue
      if (w.length > bestLen) { best = it; bestLen = w.length }
    }
  }
  return best
}

// les unités de Spoonacular, en français
const UNITS = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l', cl: 'cl', mg: 'mg', tsp: 'c. à c.', tsps: 'c. à c.', teaspoon: 'c. à c.', teaspoons: 'c. à c.',
  tbsp: 'c. à s.', tbsps: 'c. à s.', tablespoon: 'c. à s.', tablespoons: 'c. à s.', pinch: 'pincée', pinches: 'pincées', cup: 'tasse', cups: 'tasses',
  clove: 'gousse', cloves: 'gousses', slice: 'tranche', slices: 'tranches', can: 'boîte', cans: 'boîtes', handful: 'poignée', handfuls: 'poignées',
  bunch: 'botte', bunches: 'bottes', serving: 'portion', servings: 'portions', large: 'gros', medium: 'moyen', small: 'petit', stick: 'bâton', sticks: 'bâtons',
  piece: 'morceau', pieces: 'morceaux', leaf: 'feuille', leaves: 'feuilles', sprig: 'brin', sprigs: 'brins', dash: 'trait', dashes: 'traits', head: 'tête', heads: 'têtes',
  fillet: 'filet', fillets: 'filets', package: 'paquet', packages: 'paquets', pkg: 'paquet', jar: 'bocal', bottle: 'bouteille', drop: 'goutte', drops: 'gouttes',
}
export const unitFr = u => { const k = String(u || '').toLowerCase().replace(/\.$/, ''); return k in UNITS ? UNITS[k] : u || '' }
