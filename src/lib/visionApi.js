const API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY

/**
 * Convertit un File en base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Envoie une image à Google Vision API pour détecter texte + barcode
 * Retourne { isbn, texts } ou null en cas d'échec
 */
export async function analyzeBookImage(imageFile) {
  if (!API_KEY) {
    throw new Error('VITE_GOOGLE_VISION_API_KEY non configuré')
  }

  const base64 = await fileToBase64(imageFile)

  const body = {
    requests: [{
      image: { content: base64 },
      features: [
        { type: 'TEXT_DETECTION', maxResults: 10 },
        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
      ],
    }],
  }

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )

  if (!res.ok) throw new Error(`Vision API error: ${res.status}`)
  const data = await res.json()

  const annotations = data.responses?.[0]?.textAnnotations || []
  const fullText = annotations[0]?.description || ''

  // Cherche un ISBN dans le texte détecté
  const isbnMatch = fullText.match(/(?:ISBN[-: ]?)?(97[89][-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,6}[-\s]?\d|[\dX]{10})/i)
  const isbn = isbnMatch ? isbnMatch[0].replace(/[-\s]/g, '') : null

  return {
    isbn,
    fullText,
    // Extraire titre potentiel (premières lignes non-ISBN)
    detectedLines: fullText
      .split('\n')
      .filter(l => l.trim().length > 2 && !/^\d+$/.test(l.trim()))
      .slice(0, 5),
  }
}
