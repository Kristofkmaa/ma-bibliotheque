import { useState, useEffect, useCallback } from 'react'
import { supabase, isDemoMode } from '../lib/supabase'
import { demoLoad, demoSave, demoNewId } from '../lib/demoStore'

export const STATUSES = [
  { id: 'en_cours', label: 'En cours' },
  { id: 'lu',       label: 'Lus' },
  { id: 'possede',  label: 'Possédés' },
  { id: 'souhaite', label: 'Souhaités' },
]

export function getBookStatuses(book) {
  if (book.statuses?.length) return book.statuses
  if (book.status) return [book.status]
  return []
}

export function bookHasStatus(book, status) {
  return getBookStatuses(book).includes(status)
}

/** Transforme un résultat Google Books en ligne `user_books`. */
function toRow(userId, bookData, statusesArr) {
  return {
    user_id: userId,
    google_id: bookData.googleId,
    title: bookData.title,
    authors: bookData.authors,
    cover_url: bookData.cover,
    description: bookData.description,
    published_date: bookData.publishedDate,
    page_count: bookData.pageCount,
    categories: bookData.categories,
    isbn: bookData.isbn,
    status: statusesArr[0] || 'souhaite',
    statuses: statusesArr,
  }
}

export function useLibrary(userId) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchBooks = useCallback(async () => {
    if (!userId) return
    if (isDemoMode) { setBooks(demoLoad()); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
    if (error) setError(error.message)
    else setBooks(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  const addBook = async (bookData, statuses = ['souhaite']) => {
    if (!userId) throw new Error('Non connecté')
    const statusesArr = Array.isArray(statuses) ? statuses : [statuses]
    if (!statusesArr.length) statusesArr.push('souhaite')
    const row = toRow(userId, bookData, statusesArr)

    if (isDemoMode) {
      const current = demoLoad().filter(b => b.google_id !== row.google_id)
      const saved = { ...row, id: demoNewId(), rating: null, notes: '', added_at: new Date().toISOString() }
      demoSave([saved, ...current])
      setBooks([saved, ...current])
      return saved
    }

    const { data, error } = await supabase
      .from('user_books')
      .upsert(row, { onConflict: 'user_id,google_id' })
      .select()
      .single()
    if (error) throw error
    await fetchBooks()
    return data
  }

  const updateBook = async (id, updates) => {
    const payload = { ...updates }
    if (updates.statuses) payload.status = updates.statuses[0] || 'souhaite'

    if (isDemoMode) {
      const next = demoLoad().map(b => (b.id === id ? { ...b, ...payload } : b))
      demoSave(next)
      setBooks(next)
      return
    }

    const { error } = await supabase
      .from('user_books')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
    await fetchBooks()
  }

  const removeBook = async (id) => {
    if (isDemoMode) {
      const next = demoLoad().filter(b => b.id !== id)
      demoSave(next)
      setBooks(next)
      return
    }
    const { error } = await supabase
      .from('user_books')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  /** Retire plusieurs livres d'un coup (suppression d'une étagère avec ses livres). */
  const removeBooks = async (ids) => {
    if (!ids.length) return
    const gone = new Set(ids)
    if (isDemoMode) {
      const next = demoLoad().filter(b => !gone.has(b.id))
      demoSave(next)
      setBooks(next)
      return
    }
    const { error } = await supabase
      .from('user_books')
      .delete()
      .in('id', ids)
      .eq('user_id', userId)
    if (error) throw error
    setBooks(prev => prev.filter(b => !gone.has(b.id)))
  }

  const isInLibrary = (googleId) => books.some(b => b.google_id === googleId)

  return { books, loading, error, addBook, updateBook, removeBook, removeBooks, isInLibrary, refresh: fetchBooks }
}
