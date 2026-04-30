import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase non configuré. Remplis ton fichier .env')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

/**
 * Schéma SQL à exécuter dans Supabase :
 *
 * create table user_books (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users not null,
 *   google_id text not null,
 *   title text not null,
 *   authors text[],
 *   cover_url text,
 *   description text,
 *   published_date text,
 *   page_count integer,
 *   categories text[],
 *   isbn text,
 *   status text check (status in ('lu', 'possede', 'souhaite')) default 'souhaite',
 *   rating integer check (rating between 1 and 5),
 *   notes text,
 *   added_at timestamptz default now(),
 *   unique(user_id, google_id)
 * );
 *
 * alter table user_books enable row level security;
 * create policy "Users see own books" on user_books for all using (auth.uid() = user_id);
 */
