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
