# 📚 Bibliothèque Levana

Une étagère de livres en ligne, à feuilleter comme une archive : les livres lus, ceux qu'on possède, ceux qu'on attend encore.

Direction artistique « archive papier » : fond papier grainé, encre noire, cobalt, typographies Newsreader + Inter Tight.
Les livres sont des volumes posés sur les planches d'un meuble vu en perspective (fond, côtés, dessus des planches,
tranches des livres). Ils restent à leur place : on change d'étagère avec les flèches, la molette ou un glissé du doigt,
et un clic sur un livre ouvre sa fiche, une feuille qui grandit depuis le dos, l'encre qui s'étale sur la couverture.

La perspective est calculée une seule fois en JavaScript puis dessinée à plat (SVG + calques agrandis) : même rendu
qu'une vraie scène 3D, sans aucun coût d'affichage, même avec des centaines de livres.
Aucun fondu : chaque apparition est un masque, un clip ou une mise à l'échelle.

## ✨ Fonctionnalités

- **Étagère en perspective** : livres en volume, rayons étiquetés (« Rayon II · E – P »), étagères suivantes avec ← →
- **Portes coulissantes** : la bibliothèque s'ouvre portes fermées puis elles coulissent ; sur chaque rayon, une porte
  cache la place libre (avec « + Ajouter un livre ») ; changer d'étagère, de filtre ou de tri ferme les portes, échange
  les livres derrière et les rouvre
- **Mes étagères** (tri « Mon rangement ») : « + Étagère » en crée une, qui se construit sous tes yeux (le fond se
  dessine, la planche se pose, les portes arrivent) puis demande son nom ; un clic sur l'étiquette d'une planche permet
  de la renommer, de la monter/descendre, de la supprimer et de changer son apparence : **matière** (chêne clair, noyer,
  laque noire, bois blanc, acier), **couleur du fond** (8 teintes) et **portes** (panneau, cannage, lattes), avec
  « Ce style partout »
- **Glisser-déposer** : attrape un livre (appui long au doigt) et dépose-le ailleurs, sur la même étagère ou une autre ;
  les livres s'écartent pour lui faire de la place, et le lâcher dans une place libre crée une nouvelle étagère ; en
  approchant le bord de l'écran, on passe à la page suivante
- **Étagère vivante** : au survol le livre sort de l'étagère et ses voisins s'inclinent, le ruban se balance, les livres
  se posent un à un, et au clic le livre est tiré avant que la fiche s'ouvre
- **Tri** par ajout récent, titre (articles ignorés), auteur, année ou couleur
- **Repères visuels** : ruban cobalt = en cours, silhouette en pointillés = souhaité, pas encore sur l'étagère
- **Onglets de statut** avec bloc cobalt glissant, légende titre / auteur au survol
- **Fiche livre** : résumé, auteur, année, pages, ISBN, statuts multiples, note sur 5, notes personnelles
- **Recherche** dans des millions de livres (Google Books API)
- **Scanner ISBN** par code-barres (caméra, html5-qrcode)
- **Reconnaissance par photo** de couverture (Google Vision API, optionnel)
- **4 statuts** cumulables : En cours · Lus · Possédés · Souhaités
- **Auth Google** via Supabase, chaque personne a sa propre bibliothèque
- **Mode démo** automatique sans Supabase (livres stockés dans le navigateur) pour tester l'interface
- Responsive (téléphone, tablette, ordinateur), curseur personnalisé sur ordinateur, `prefers-reduced-motion` respecté

## 🚀 Installation

```bash
npm install
cp .env.example .env   # puis remplir les clés
npm run dev
```

Sans `.env`, l'application démarre en **mode démo** avec quelques livres d'exemple.

### 1. Supabase

1. [supabase.com](https://supabase.com) → New Project
2. **SQL Editor** → coller le contenu de `supabase_schema.sql` → Run
3. **Authentication → Providers** → activer **Google**
   - Créer un projet sur [Google Cloud Console](https://console.cloud.google.com), des identifiants OAuth (Web)
   - Copier Client ID / Client Secret dans Supabase
   - Ajouter l'URL de callback Supabase dans les origines autorisées côté Google
4. **Authentication → URL Configuration** : Site URL + Redirect URLs de ton domaine (`https://ton-app.vercel.app/**`)

> Les étagères personnalisées utilisent la table `shelves` (fin de `supabase_schema.sql`). Si elle n'existe pas encore,
> le rangement est gardé dans le navigateur, puis envoyé automatiquement vers Supabase dès que la table existe.

### 2. Google Books API

Google Cloud Console → activer **Books API** → créer une clé API (restreindre au domaine de l'app).

### 3. Google Vision API (optionnel)

Activer **Cloud Vision API** et créer une clé : le bouton « Photo de la couverture » apparaît alors dans la recherche.

### 4. Variables d'environnement

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx
VITE_GOOGLE_BOOKS_API_KEY=AIzaSyxxxx
VITE_GOOGLE_VISION_API_KEY=AIzaSyxxxx   # optionnel
```

## 📦 Déploiement (Vercel)

1. Importer le dépôt sur [vercel.com](https://vercel.com)
2. Ajouter les variables d'environnement ci-dessus
3. Déployer : `vercel.json` gère les rewrites SPA et quelques en-têtes de sécurité

## 🛠 Stack

| Technologie | Usage |
|---|---|
| React 19 + Vite | Frontend |
| SVG + CSS + Web Animations API | Perspective, fiches, masques (aucune lib d'animation) |
| Supabase | Base de données + Auth Google |
| Google Books API | Catalogue de livres |
| Google Vision API | Reconnaissance de couverture |
| html5-qrcode | Scan code-barres ISBN |

## 📁 Structure

```
src/
├── components/
│   ├── Shelf3D.jsx       # Meuble en perspective : étagères, portes, glisser-déposer, création animée
│   ├── ShelfEditor.jsx   # Carte d'édition d'une étagère (nom, matière, fond, portes, ordre)
│   ├── Caption.jsx       # Légende : titre / auteur qui glissent dans des masques
│   ├── StatusTabs.jsx    # Onglets avec indicateur cobalt glissant
│   ├── DetailSheet.jsx   # Fiche livre : feuille clip-path, encre, édition
│   ├── SearchPanel.jsx   # Recherche Google Books + photo de couverture
│   ├── Scanner.jsx       # Scanner ISBN (chargé à la demande)
│   ├── LoginPage.jsx     # Connexion
│   └── Cursor.jsx        # Curseur anneau / disque "OUVRIR"
├── hooks/
│   ├── useAuth.js        # Auth Supabase (ou démo)
│   ├── useLibrary.js     # CRUD user_books (ou localStorage en démo)
│   ├── useShelves.js     # Étagères (table shelves, ou navigateur en secours)
│   └── useIsMobile.js
├── lib/
│   ├── supabase.js       # Client Supabase + détection du mode démo
│   ├── googleBooks.js    # Recherche, ISBN, couvertures HD
│   ├── visionApi.js      # OCR de couverture
│   ├── bookUtils.js      # Palette et tailles des dos, tris, normalisation des livres
│   ├── shelfOps.js       # Opérations pures : déplacer, créer, renommer, habiller
│   ├── skins.js          # Matières, couleurs de fond, styles de portes
│   ├── demoStore.js      # Livres d'exemple du mode démo
│   └── cursorState.js
├── App.jsx
├── main.jsx
└── styles.css
```
