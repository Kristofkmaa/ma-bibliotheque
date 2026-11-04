import { useCallback, useEffect, useState } from 'react'

const KEY = uid => `levana.basket.${uid}`
const slim = b => ({
  googleId: b.googleId, title: b.title, authors: b.authors, cover: b.cover, description: b.description,
  publishedDate: b.publishedDate, pageCount: b.pageCount, categories: b.categories, isbn: b.isbn, language: b.language,
})

/** Panier de livres à ranger, gardé dans le navigateur (il survit à un rechargement). */
export function useBasket(userId) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY(userId))) || [] } catch { return [] }
  })
  useEffect(() => {
    try { localStorage.setItem(KEY(userId), JSON.stringify(items)) } catch { /* ignore */ }
  }, [userId, items])

  const add = useCallback(book => setItems(prev => (prev.some(x => x.googleId === book.googleId) ? prev : [...prev, slim(book)])), [])
  const remove = useCallback(googleId => setItems(prev => prev.filter(x => x.googleId !== googleId)), [])
  const clear = useCallback(() => setItems([]), [])
  const has = useCallback(googleId => items.some(x => x.googleId === googleId), [items])
  return { items, add, remove, clear, has }
}
