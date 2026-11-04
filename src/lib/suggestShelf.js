/**
 * Propose une étagère pour un livre du panier :
 * 1. une étagère où se trouvent déjà des livres du même auteur ;
 * 2. une étagère dont le nom correspond au genre (catégories Google Books) ;
 * 3. une étagère dont les livres ont le même genre ;
 * 4. sinon, l'étagère choisie pour le livre précédent.
 */

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// genre → mots des catégories Google Books (anglais surtout) / noms d'étagères possibles
const GENRES = [
  { label: 'policier', cats: ['mystery', 'detective', 'crime', 'thriller', 'suspense', 'policier', 'polar', 'noir'], names: ['polar', 'policier', 'thriller', 'crime', 'mystere', 'enquete', 'noir', 'suspense'] },
  { label: 'science-fiction', cats: ['science fiction', 'sci-fi', 'dystopi', 'space opera'], names: ['sf', 'science-fiction', 'science fiction', 'anticipation', 'imaginaire'] },
  { label: 'fantasy', cats: ['fantasy'], names: ['fantasy', 'fantastique', 'imaginaire'] },
  { label: 'horreur', cats: ['horror'], names: ['horreur', 'epouvante', 'fantastique'] },
  { label: 'romance', cats: ['romance', 'love stor'], names: ['romance', 'amour', 'romantique', 'feel good', 'feel-good'] },
  { label: 'poésie', cats: ['poetry', 'poesie'], names: ['poesie', 'poemes', 'poete', 'poetry'] },
  { label: 'bande dessinée', cats: ['comics', 'graphic novel', 'manga', 'bandes dessinees', 'bande dessinee'], names: ['bd', 'bande dessinee', 'bandes dessinees', 'manga', 'comics', 'roman graphique'] },
  { label: 'cuisine', cats: ['cooking', 'cuisine', 'food', 'wine'], names: ['cuisine', 'recette', 'gastronomie', 'patisserie'] },
  { label: 'jeunesse', cats: ['juvenile', 'young adult', 'children', 'jeunesse'], names: ['enfance', 'enfant', 'jeunesse', 'ado', 'kids', 'young adult'] },
  { label: 'histoire', cats: ['history', 'histoire'], names: ['histoire', 'historique'] },
  { label: 'voyage', cats: ['travel', 'voyage'], names: ['voyage', 'ailleurs', 'monde'] },
  { label: 'biographie', cats: ['biography', 'autobiography', 'memoir'], names: ['biographie', 'memoires', 'vies', 'portraits'] },
  { label: 'philosophie', cats: ['philosophy', 'philosophie'], names: ['philo'] },
  { label: 'bien-être', cats: ['self-help', 'psychology', 'health', 'body, mind', 'mind & spirit'], names: ['psycho', 'developpement personnel', 'bien-etre', 'sante', 'bien etre'] },
  { label: 'spiritualité', cats: ['religion', 'spiritual'], names: ['spiritualite', 'religion'] },
  { label: 'art', cats: ['art', 'photography', 'design', 'architecture', 'music'], names: ['art', 'beaux livres', 'photo', 'design', 'musique'] },
  { label: 'sciences', cats: ['science', 'mathematics', 'nature', 'technology'], names: ['science', 'nature', 'technique'] },
  { label: 'essai', cats: ['political', 'social science', 'essay', 'essais'], names: ['essai', 'societe', 'politique', 'idees'] },
  { label: 'classique', cats: ['classics', 'literary collections', 'literary criticism'], names: ['classique'] },
  { label: 'roman', cats: ['fiction', 'novel', 'literature', 'litterature', 'roman'], names: ['roman', 'litterature', 'fiction', 'a lire', 'a relire', 'pile a lire'] },
]

const authorsOf = b => (b.authors || []).map(norm).filter(a => a && a !== 'auteur inconnu')
const topCats = b => (b.categories || []).map(c => norm(c).split('/')[0].trim()).filter(Boolean)

export function suggestShelf(book, shelves, byId, lastShelfId = null) {
  if (!book || !shelves.length) return null
  // 1. même auteur
  const authors = authorsOf(book)
  if (authors.length) {
    let best = null, n = 0
    for (const s of shelves) {
      const k = s.book_ids.filter(id => { const b = byId.get(id); return b && authorsOf(b).some(a => authors.includes(a)) }).length
      if (k > n) { n = k; best = s }
    }
    if (best) return { shelfId: best.id, reason: `déjà ${n > 1 ? 'des livres' : 'un livre'} de ${(book.authors || [])[0]}` }
  }
  // 2. le nom de l'étagère correspond au genre
  const cats = norm((book.categories || []).join(' | '))
  if (cats) {
    for (const g of GENRES) {
      if (!g.cats.some(c => cats.includes(c))) continue
      const s = shelves.find(sh => { const n = norm(sh.name); return g.names.some(w => n.includes(w)) })
      if (s) return { shelfId: s.id, reason: `genre : ${g.label}` }
    }
  }
  // 3. les livres de l'étagère ont le même genre
  const mine = topCats(book)
  if (mine.length) {
    let best = null, n = 0
    for (const s of shelves) {
      const k = s.book_ids.filter(id => { const b = byId.get(id); return b && topCats(b).some(c => mine.includes(c)) }).length
      if (k > n) { n = k; best = s }
    }
    if (best) return { shelfId: best.id, reason: 'même genre que ses livres' }
  }
  // 4. comme le précédent
  if (lastShelfId && shelves.some(s => s.id === lastShelfId)) return { shelfId: lastShelfId, reason: 'comme le précédent' }
  return null
}
