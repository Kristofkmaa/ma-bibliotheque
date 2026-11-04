# 📚 Bibliothèque Levana

Une étagère de livres en ligne, à feuilleter comme une archive : les livres lus, ceux qu'on possède, ceux qu'on attend encore.

Direction artistique « archive papier » : fond papier grainé, encre noire, cobalt, typographies Newsreader + Inter Tight.
Les livres sont rangés debout, rayon par rayon, dans un meuble qui s'adapte à la largeur de l'écran : chaque dos a sa couleur,
son épaisseur (selon le nombre de pages), son titre et les initiales de l'auteur. Au survol, le livre se soulève ; au clic,
la fiche s'ouvre comme une feuille qui grandit depuis le dos, l'encre s'étale sur la couverture, chaque ligne de texte monte de son masque.
Aucun fondu : chaque apparition est un masque, un clip ou une mise à l'échelle.

## ✨ Fonctionnalités

- **Bibliothèque en rayons** : les dos se rangent selon la place disponible, rayons étiquetés (« Rayon II · E – P »), serre-livres
- **Tri** par ajout récent, titre (articles ignorés), auteur, année ou couleur, et **filtre** instantané par titre ou auteur
- **Repères visuels** : ruban cobalt = en cours, silhouette en pointillés = souhaité, pas encore sur l'étagère
- **En-tête** avec statistiques (livres, lus, en cours, pages lues) et onglets de statut à bloc cobalt glissant
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
| CSS + Web Animations API | Rayons, fiches, masques (aucune lib d'animation) |
| Supabase | Base de données + Auth Google |
| Google Books API | Catalogue de livres |
| Google Vision API | Reconnaissance de couverture |
| html5-qrcode | Scan code-barres ISBN |

## 📁 Structure

```
src/
├── components/
│   ├── Bookcase.jsx      # Meuble : dos rangés rayon par rayon, étiquettes, serre-livres
│   ├── Caption.jsx       # Encart de survol : titre / auteur qui glissent dans des masques
│   ├── StatusTabs.jsx    # Onglets avec indicateur cobalt glissant
│   ├── DetailSheet.jsx   # Fiche livre : feuille clip-path, encre, édition
│   ├── SearchPanel.jsx   # Recherche Google Books + photo de couverture
│   ├── Scanner.jsx       # Scanner ISBN (chargé à la demande)
│   ├── LoginPage.jsx     # Connexion
│   └── Cursor.jsx        # Curseur anneau / disque "OUVRIR"
├── hooks/
│   ├── useAuth.js        # Auth Supabase (ou démo)
│   ├── useLibrary.js     # CRUD user_books (ou localStorage en démo)
│   └── useIsMobile.js
├── lib/
│   ├── supabase.js       # Client Supabase + détection du mode démo
│   ├── googleBooks.js    # Recherche, ISBN, couvertures HD
│   ├── visionApi.js      # OCR de couverture
│   ├── bookUtils.js      # Palette et tailles des dos, tris, normalisation des livres
│   ├── demoStore.js      # Livres d'exemple du mode démo
│   └── cursorState.js
├── App.jsx
├── main.jsx
└── styles.css
```
