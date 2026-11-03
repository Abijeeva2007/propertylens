export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '8mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!geminiKey) {
    return res.status(500).json({
      error: { message: 'Server GEMINI_API_KEY environment variable is missing.' }
    });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: { message: 'Invalid or oversized request.' } });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${geminiKey}`;

    const upstreamResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(500).json({
      error: { message: err.message || 'Internal server error communicating with Gemini API' }
    });
  }
}
