export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';

  return res.status(200).json({
    maps: mapsKey,
    server: Boolean(geminiKey && mapsKey)
  });
}
