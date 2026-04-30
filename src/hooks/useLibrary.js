import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Helper : retourne les statuts d'un livre (supporte ancien champ `status` et nouveau `statuses`)
export function getBookStatuses(book) {
  if (book.statuses?.length) return book.statuses
  if (book.status) return [book.status]
  return []
}

export function bookHasStatus(book, status) {
  return getBookStatuses(book).includes(status)
}

export function useLibrary(userId) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchBooks = useCallback(async () => {
    if (!userId) return
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
    const primaryStatus = statusesArr[0] || 'souhaite'

    const { data, error } = await supabase
      .from('user_books')
      .upsert({
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
        status: primaryStatus,    // rétrocompatibilité
        statuses: statusesArr,    // nouveau champ multi-statuts
      }, { onConflict: 'user_id,google_id' })
      .select()
      .single()

    if (error) throw error
    await fetchBooks()
    return data
  }

  const updateBook = async (id, updates) => {
    const payload = { ...updates }
    // Si on met à jour les statuts, synchroniser le champ status principal
    if (updates.statuses) {
      payload.status = updates.statuses[0] || 'souhaite'
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
    const { error } = await supabase
      .from('user_books')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  const isInLibrary = (googleId) => books.some(b => b.google_id === googleId)

  return { books, loading, error, addBook, updateBook, removeBook, isInLibrary, refresh: fetchBooks }
}
