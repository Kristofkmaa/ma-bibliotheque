-- =============================================
-- Schéma Supabase pour Ma Bibliothèque
-- À coller dans l'éditeur SQL de Supabase
-- =============================================

-- Table principale : bibliothèque utilisateur
create table if not exists user_books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  google_id     text not null,
  title         text not null,
  authors       text[],
  cover_url     text,
  description   text,
  published_date text,
  page_count    integer,
  categories    text[],
  isbn          text,
  language      text default 'fr',
  status        text check (status in ('lu', 'possede', 'souhaite')) default 'souhaite',
  rating        integer check (rating between 1 and 5),
  notes         text,
  added_at      timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Un utilisateur ne peut pas avoir le même livre deux fois
  unique(user_id, google_id)
);

-- Mise à jour automatique de updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_books_updated_at
  before update on user_books
  for each row execute function update_updated_at();

-- Sécurité : chaque utilisateur ne voit que ses propres livres
alter table user_books enable row level security;

create policy "Lecture de ses propres livres"
  on user_books for select
  using (auth.uid() = user_id);

create policy "Ajout de ses propres livres"
  on user_books for insert
  with check (auth.uid() = user_id);

create policy "Modification de ses propres livres"
  on user_books for update
  using (auth.uid() = user_id);

create policy "Suppression de ses propres livres"
  on user_books for delete
  using (auth.uid() = user_id);

-- Index pour des requêtes rapides
create index idx_user_books_user_id on user_books(user_id);
create index idx_user_books_status on user_books(user_id, status);
create index idx_user_books_added_at on user_books(user_id, added_at desc);
