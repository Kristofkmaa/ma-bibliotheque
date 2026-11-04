/**
 * Mode démo : une petite bibliothèque stockée dans le navigateur (localStorage),
 * utilisée quand Supabase n'est pas configuré. Même forme que la table `user_books`.
 */
const KEY = 'levana.demo.books'

const SEED = [
  {
    google_id: 'demo-1', title: "L'Élégance du hérisson", authors: ['Muriel Barbery'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782070782932-L.jpg',
    description: "Renée est concierge d'un immeuble bourgeois de la rue de Grenelle. Elle cache sous une apparence bourrue une culture immense. Paloma, douze ans, a décidé d'en finir avec la vie le jour de ses treize ans. Deux solitudes que va réunir l'arrivée d'un nouveau locataire.",
    published_date: '2006', page_count: 359, categories: ['Roman'], isbn: '9782070782932',
    statuses: ['lu'], rating: 5, notes: 'Lu en une nuit.',
  },
  {
    google_id: 'demo-2', title: 'Le Petit Prince', authors: ['Antoine de Saint-Exupéry'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782070612758-L.jpg',
    description: "Un aviateur en panne dans le désert rencontre un petit garçon venu d'une autre planète. Un conte poétique sur l'enfance, l'amitié et ce qui est essentiel : invisible pour les yeux.",
    published_date: '1943', page_count: 96, categories: ['Conte'], isbn: '9782070612758',
    statuses: ['lu', 'possede'], rating: 5, notes: '',
  },
  {
    google_id: 'demo-3', title: 'Cent ans de solitude', authors: ['Gabriel García Márquez'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782020238113-L.jpg',
    description: "La saga de la famille Buendía dans le village imaginaire de Macondo, sur un siècle de fondations, de guerres, d'amours et de malédictions.",
    published_date: '1967', page_count: 460, categories: ['Roman'], isbn: '9782020238113',
    statuses: ['en_cours'], rating: null, notes: 'Page 120.',
  },
  {
    google_id: 'demo-4', title: 'Les Années', authors: ['Annie Ernaux'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782070402472-L.jpg',
    description: "Une autobiographie impersonnelle qui traverse soixante ans d'histoire française à travers photographies, chansons, objets et souvenirs collectifs.",
    published_date: '2008', page_count: 254, categories: ['Récit'], isbn: '9782070402472',
    statuses: ['possede'], rating: 4, notes: '',
  },
  {
    google_id: 'demo-5', title: 'La Promesse de l\'aube', authors: ['Romain Gary'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782070360734-L.jpg',
    description: "Le récit d'une enfance portée par l'amour démesuré d'une mère qui a tout misé sur son fils, de Wilno à Nice puis dans la guerre.",
    published_date: '1960', page_count: 391, categories: ['Autobiographie'], isbn: '9782070360734',
    statuses: ['souhaite'], rating: null, notes: '',
  },
  {
    google_id: 'demo-6', title: 'Kafka sur le rivage', authors: ['Haruki Murakami'],
    cover_url: 'https://covers.openlibrary.org/b/isbn/9782264043122-L.jpg',
    description: "Kafka Tamura, quinze ans, fuit la maison paternelle. Nakata, vieil homme qui parle aux chats, quitte Tokyo. Deux trajectoires qui se répondent dans un Japon onirique.",
    published_date: '2002', page_count: 618, categories: ['Roman'], isbn: '9782264043122',
    statuses: ['souhaite'], rating: null, notes: '',
  },
]

function uid() { return 'demo-' + Math.random().toString(36).slice(2, 10) }

export function demoLoad() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  const base = Date.now()
  const books = SEED.map((b, i) => ({
    ...b, id: uid(), user_id: 'demo', status: b.statuses[0],
    added_at: new Date(base - i * 86400000).toISOString(),
  }))
  demoSave(books)
  return books
}

export function demoSave(books) {
  try { localStorage.setItem(KEY, JSON.stringify(books)) } catch { /* ignore */ }
}

export function demoNewId() { return uid() }
