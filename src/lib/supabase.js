import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Vrai quand Supabase n'est pas configuré : l'app tourne alors en mode démo (données locales). */
export const isDemoMode = !supabaseUrl || !supabaseAnonKey

if (isDemoMode) {
  console.warn('⚠️ Supabase non configuré : mode démo (les livres sont stockés dans ce navigateur). Remplis ton fichier .env')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
