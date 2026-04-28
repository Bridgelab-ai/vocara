// Mubert music generation proxy — caches track URLs per theme
export const config = { api: { bodyParser: false } }

const THEME_TAGS = {
  hamburg: { tags: 'ambient,nordic,calm,harbor,rain', bpm: { min: 55, max: 75 } },
  nairobi: { tags: 'warm,african,evening,drums,fire', bpm: { min: 65, max: 85 } },
  welt:    { tags: 'cosmic,deep,ambient,aurora,wonder', bpm: { min: 50, max: 70 } },
}

export default async function handler(req, res) {
  const theme = req.query?.theme || 'nairobi'
  const config = THEME_TAGS[theme] || THEME_TAGS.welt

  if (!process.env.MUBERT_KEY) {
    return res.status(200).json({ url: null, reason: 'no_key' })
  }

  try {
    // Step 1: Get a personal token
    const tokenRes = await fetch('https://api.mubert.com/v2/GetServiceAccess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GetServiceAccess',
        params: { email: 'vocara@bridgelab.de', license: 'ttm', token: process.env.MUBERT_KEY }
      })
    })
    const tokenData = await tokenRes.json()
    const pat = tokenData?.data?.pat
    if (!pat) return res.status(200).json({ url: null, reason: 'no_pat' })

    // Step 2: Generate a track
    const trackRes = await fetch('https://api.mubert.com/v2/TTM', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'TTM',
        params: {
          pat,
          title: `Vocara ${theme} ambient`,
          tags: config.tags,
          bpm: config.bpm,
          duration: 300,
          format: 'mp3',
          intensity: 'low',
        }
      })
    })
    const trackData = await trackRes.json()
    const url = trackData?.data?.tasks?.[0]?.download_link
      || trackData?.data?.download_link
      || trackData?.data?.url
      || null

    res.status(200).json({ url, theme, tags: config.tags })
  } catch (e) {
    res.status(200).json({ url: null, error: e.message })
  }
}
