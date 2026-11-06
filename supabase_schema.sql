-- =============================================
-- Schéma Supabase — Bibliothèque Levana
-- À coller dans l'éditeur SQL de Supabase (SQL Editor → New query → Run)
-- =============================================

create table if not exists user_books (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  google_id      text not null,
  title          text not null,
  authors        text[],
  cover_url      text,
  description    text,
  published_date text,
  page_count     integer,
  categories     text[],
  isbn           text,
  language       text default 'fr',
  -- Statut principal (rétrocompatibilité) + liste de statuts (un livre peut être "lu" ET "possédé")
  status         text check (status in ('lu', 'possede', 'souhaite', 'en_cours')) default 'souhaite',
  statuses       text[] default '{souhaite}',
  rating         integer check (rating between 1 and 5),
  notes          text,
  added_at       timestamptz default now(),
  updated_at     timestamptz default now(),

  unique(user_id, google_id)
);

-- Si la table existait déjà (ancienne version "Ma Bibliothèque"), ajouter les colonnes manquantes :
alter table user_books add column if not exists statuses text[] default '{souhaite}';
alter table user_books drop constraint if exists user_books_status_check;
alter table user_books add constraint user_books_status_check
  check (status in ('lu', 'possede', 'souhaite', 'en_cours'));

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_books_updated_at on user_books;
create trigger user_books_updated_at
  before update on user_books
  for each row execute function update_updated_at();

-- Sécurité : chaque utilisatrice ne voit que ses propres livres
alter table user_books enable row level security;

drop policy if exists "Lecture de ses propres livres" on user_books;
create policy "Lecture de ses propres livres"
  on user_books for select using (auth.uid() = user_id);

drop policy if exists "Ajout de ses propres livres" on user_books;
create policy "Ajout de ses propres livres"
  on user_books for insert with check (auth.uid() = user_id);

drop policy if exists "Modification de ses propres livres" on user_books;
create policy "Modification de ses propres livres"
  on user_books for update using (auth.uid() = user_id);

drop policy if exists "Suppression de ses propres livres" on user_books;
create policy "Suppression de ses propres livres"
  on user_books for delete using (auth.uid() = user_id);

create index if not exists idx_user_books_user_id on user_books(user_id);
create index if not exists idx_user_books_added_at on user_books(user_id, added_at desc);

-- =============================================
-- Étagères personnalisées (nom, ordre, apparence, livres rangés)
-- À exécuter une fois : tant que cette table n'existe pas, le site garde
-- le rangement dans le navigateur, puis l'envoie ici dès qu'elle existe.
-- =============================================
create table if not exists shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null default 'Nouvelle étagère',
  position    integer not null default 0,
  material    text not null default 'chene',    -- chene | noyer | ebene | blanc | acier
  wall        text not null default 'papier',   -- couleur du fond
  doors       text not null default 'panneau',  -- panneau | cannage | lattes
  book_ids    text[] not null default '{}',     -- identifiants user_books, dans l'ordre
  created_at  timestamptz default now()
);

alter table shelves enable row level security;

drop policy if exists "Lecture de ses étagères" on shelves;
create policy "Lecture de ses étagères" on shelves for select using (auth.uid() = user_id);

drop policy if exists "Ajout de ses étagères" on shelves;
create policy "Ajout de ses étagères" on shelves for insert with check (auth.uid() = user_id);

drop policy if exists "Modification de ses étagères" on shelves;
create policy "Modification de ses étagères" on shelves for update using (auth.uid() = user_id);

drop policy if exists "Suppression de ses étagères" on shelves;
create policy "Suppression de ses étagères" on shelves for delete using (auth.uid() = user_id);

create index if not exists idx_shelves_user on shelves(user_id, position);

-- =============================================
-- Nos séries préférées (la télé du salon)
-- À exécuter une fois : tant que cette table n'existe pas, le site garde
-- les séries dans le navigateur, puis les envoie ici dès qu'elle existe.
-- =============================================
create table if not exists user_series (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  tmdb_id         integer not null,
  name            text not null,
  overview        text,
  first_air_date  text,
  poster_path     text,
  backdrop_path   text,
  genres          text[] default '{}',
  seasons         integer,
  networks        text[] default '{}',
  rating          integer check (rating between 1 and 5),
  added_at        timestamptz default now(),
  unique(user_id, tmdb_id)
);

alter table user_series enable row level security;

drop policy if exists "Lecture de ses séries" on user_series;
create policy "Lecture de ses séries" on user_series for select using (auth.uid() = user_id);

drop policy if exists "Ajout de ses séries" on user_series;
create policy "Ajout de ses séries" on user_series for insert with check (auth.uid() = user_id);

drop policy if exists "Modification de ses séries" on user_series;
create policy "Modification de ses séries" on user_series for update using (auth.uid() = user_id);

drop policy if exists "Suppression de ses séries" on user_series;
create policy "Suppression de ses séries" on user_series for delete using (auth.uid() = user_id);

create index if not exists idx_user_series_user on user_series(user_id, added_at desc);

-- Catégories de séries (à exécuter une fois ; sans elle, les catégories restent dans le navigateur)
alter table user_series add column if not exists category text;

-- Films (en plus des séries) : à exécuter une fois
alter table user_series add column if not exists media text not null default 'tv';
alter table user_series add column if not exists runtime integer;
alter table user_series drop constraint if exists user_series_user_id_tmdb_id_key;
create unique index if not exists user_series_work on user_series(user_id, media, tmdb_id);

-- =============================================
-- Le PC du salon : nos jeux (achetés dans Stim, pour de faux) et le porte-monnaie
-- À exécuter une fois : sans ces tables, tout reste gardé dans le navigateur.
-- =============================================
create table if not exists user_games (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  app_id      integer not null,
  name        text not null,
  img         text,
  genres      text[] default '{}',
  release     text,
  price_paid  numeric default 0,
  favorite    boolean default false,
  rating      integer check (rating between 1 and 5),
  added_at    timestamptz default now(),
  unique(user_id, app_id)
);
alter table user_games enable row level security;
drop policy if exists "Ses jeux" on user_games;
create policy "Ses jeux" on user_games for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists user_wallet (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  balance  numeric not null default 0
);
alter table user_wallet enable row level security;
drop policy if exists "Son porte-monnaie" on user_wallet;
create policy "Son porte-monnaie" on user_wallet for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Le PC : l'ordre de « Mon top », le fond d'écran et les couleurs des lumières
alter table user_games add column if not exists fav_rank integer;
alter table user_wallet add column if not exists pc_setup jsonb;

-- Les jeux deviennent une bibliothèque (plus d'argent) : toutes les plateformes (IGDB), un statut
alter table user_games alter column app_id drop not null;
alter table user_games add column if not exists igdb_id integer;
alter table user_games add column if not exists hero text;
alter table user_games add column if not exists platforms text[] default '{}';
alter table user_games add column if not exists platform text;
alter table user_games add column if not exists status text default 'a_jouer';
create unique index if not exists user_games_igdb on user_games(user_id, igdb_id);
alter table user_wallet alter column balance drop not null;

-- Notre top 5 de livres (l'étagère d'honneur, en haut de la bibliothèque)
create table if not exists user_book_top (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  book_ids  text[] not null default '{}'
);
alter table user_book_top enable row level security;
drop policy if exists "Son top" on user_book_top;
create policy "Son top" on user_book_top for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Les boutiques PC où un jeu est vendu (Steam, Epic Games, GOG…)
alter table user_games add column if not exists stores text[] default '{}';

-- Nos médias préférés, posés sur le meuble télé du salon
create table if not exists user_showcase (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  items    jsonb not null default '[]'
);
alter table user_showcase enable row level security;
drop policy if exists "Sa vitrine" on user_showcase;
create policy "Sa vitrine" on user_showcase for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- La cuisine : frigo, placards, recettes préférées, déjà cuisinées, courses
-- (une ligne par personne, tout dans `data`)
-- ============================================================================
create table if not exists public.user_kitchen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_kitchen enable row level security;
drop policy if exists "user_kitchen_own" on public.user_kitchen;
create policy "user_kitchen_own" on public.user_kitchen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
