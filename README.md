# 📚 Ma Bibliothèque

Ton étagère de livres virtuelle — retrouve tous tes livres, ceux que tu as lus, ceux que tu possèdes, ceux que tu souhaites.

## ✨ Fonctionnalités

- **Étagère visuelle** avec tranches de livres en 3D
- **Animation d'ouverture de livre** pour lire le synopsis
- **Recherche** dans des millions de livres via Google Books API
- **Scanner ISBN** par code-barres (caméra)
- **Reconnaissance par photo** de couverture (Google Vision API)
- **3 catégories** : Lu ✅ / Possédé 📚 / Souhaité ⭐
- **Notes & étoiles** personnelles par livre
- **Auth Google** via Supabase — chaque utilisateur a sa propre bibliothèque

## 🚀 Setup en 5 étapes

### 1. Clone & installe

```bash
git clone <ton-repo>
cd bibliothequeia
npm install
```

### 2. Supabase — créer le projet

1. Va sur [supabase.com](https://supabase.com) → New Project
2. Dans **SQL Editor**, colle le contenu de `supabase_schema.sql` et exécute
3. Dans **Authentication > Providers**, active **Google**
   - Crée un projet sur [Google Cloud Console](https://console.cloud.google.com)
   - Active l'API Google Identity
   - Crée des identifiants OAuth → copie Client ID et Client Secret dans Supabase
   - Ajoute l'URL de callback Supabase dans les origines autorisées Google

### 3. Google Books API

1. Va sur [Google Cloud Console](https://console.cloud.google.com)
2. Active **Books API**
3. Crée une clé API → restreins-la aux domaines de ton app (recommandé)

### 4. Google Vision API (optionnel — pour scan par photo)

1. Dans Google Cloud Console, active **Cloud Vision API**
2. Crée une clé API séparée (ou utilise la même)

### 5. Variables d'environnement

Copie `.env.example` en `.env` et remplis :

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
VITE_GOOGLE_BOOKS_API_KEY=AIzaSyxxxx
VITE_GOOGLE_VISION_API_KEY=AIzaSyxxxx   # optionnel
```

### Lancer en dev

```bash
npm run dev
```

## 📦 Déploiement sur Vercel

1. Push le projet sur GitHub
2. Importe le repo sur [vercel.com](https://vercel.com)
3. Ajoute les variables d'environnement dans les Settings Vercel
4. Dans Supabase → Authentication → URL Configuration :
   - Ajoute `https://ton-app.vercel.app` dans **Site URL**
   - Ajoute `https://ton-app.vercel.app/**` dans **Redirect URLs**

## 🛠 Stack technique

| Technologie | Usage |
|---|---|
| React + Vite | Frontend |
| Tailwind CSS | Styles utilitaires |
| Framer Motion | Animations 3D |
| Supabase | Base de données + Auth |
| Google Books API | Catalogue de livres |
| Google Vision API | Reconnaissance de couverture |
| html5-qrcode | Scan code-barres ISBN |
| Vercel | Déploiement |

## 📁 Structure du projet

```
src/
├── components/
│   ├── BookSpine.jsx        # Tranche de livre sur l'étagère
│   ├── Bookshelf.jsx        # Étagère complète avec rangées
│   ├── BookModal.jsx        # Modal avec animation d'ouverture
│   ├── SearchBar.jsx        # Barre de recherche Google Books
│   ├── Scanner.jsx          # Scanner ISBN + photo couverture
│   └── LoginPage.jsx        # Page de connexion
├── hooks/
│   ├── useAuth.js           # Authentification Supabase
│   └── useLibrary.js        # CRUD bibliothèque utilisateur
├── lib/
│   ├── supabase.js          # Client Supabase
│   ├── googleBooks.js       # Wrapper Google Books API
│   └── visionApi.js         # Wrapper Google Vision API
└── App.jsx                  # Composant racine
```
