// POST /api/delete-shared-cards
// Deletes all documents from the sharedCards collection (admin use only)
export const config = { api: { bodyParser: false } }

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const docNames = []
  let pageToken = null

  // List all docs (pagination in case of many docs)
  do {
    try {
      const url = `${FIRESTORE_BASE}/sharedCards?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
      const listRes = await fetch(url)
      if (!listRes.ok) return res.status(500).json({ error: `List failed: ${listRes.status}` })
      const listData = await listRes.json()
      const docs = listData.documents || []
      docNames.push(...docs.map(d => d.name))
      pageToken = listData.nextPageToken || null
    } catch (e) {
      return res.status(500).json({ error: `List error: ${e.message}` })
    }
  } while (pageToken)

  if (docNames.length === 0) return res.status(200).json({ deleted: 0, total: 0, message: 'Collection already empty' })

  // Delete each document
  const results = []
  for (const name of docNames) {
    try {
      const delRes = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE' })
      results.push({ id: name.split('/').pop(), ok: delRes.ok, status: delRes.status })
    } catch (e) {
      results.push({ id: name.split('/').pop(), ok: false, error: e.message })
    }
  }

  const deleted = results.filter(r => r.ok).length
  res.status(200).json({ deleted, total: results.length, results })
}
