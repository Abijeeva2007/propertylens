# PropertyLens 🏡🔍

**PropertyLens** is an AI-powered property condition report generator. It combines **Google Maps Platform** location intelligence (Satellite, Geocoding, Places, Elevation, Street View) and **Google Gemini Multimodal Vision AI** to automatically inspect photos, cross-reference geospatial data, and draft complete, defensible property condition reports in minutes.

---

## ✨ Features

- 📍 **Maps Intelligence**: Automatically fetches street-level geocoding, elevation, nearby amenities (schools, transit, parks, hospitals), Google Satellite imagery, road maps, and Street View panoramas.
- 📷 **Multimodal Vision Analysis**: Powered by Google Gemini (`gemini-2.5-flash`), evaluating roofs, walls, foundation, moisture, windows, doors, gutters, and site hazards across uploaded photos.
- 🎯 **Defensible Confidence Scoring**: Every field is assigned a confidence percentage and evidence citation (e.g., *"Photo 2 shows architectural shingle roof with no missing tiles"*). Fields under 60% confidence are highlighted in amber.
- 📝 **Interactive Form & Fannie Mae Grid**: Complete drive-by inspection data grid (Subject Property, Lender, Data Collector, Property Information, Neighborhood Influences, Repairs & General Comments).
- 🖨️ **Export Anywhere**: Download raw structured data as JSON or print/save a pixel-perfect USPAP-compliant PDF report.
- 🔒 **Dual Architecture**:
  - **Server Mode (Production / Vercel)**: Keeps your `GEMINI_API_KEY` safe on the backend via Vercel serverless functions (`/api/analyze` and `/api/config`).
  - **Client Mode (Local / Standalone)**: Allows entering API keys directly in the browser dialog (saved to `localStorage`).

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, Modern CSS3, JavaScript (ES6+)
- **APIs**:
  - [Google Gemini API](https://aistudio.google.com/apikey) (Multimodal vision & structured JSON reasoning)
  - [Google Maps Platform](https://console.cloud.google.com/google/maps-apis) (JavaScript API, Places, Geocoding, Elevation, Static Maps, Street View Static)
- **Backend / Deployment**: [Vercel](https://vercel.com/) Serverless Functions (`api/config.js`, `api/analyze.js`)

---

## 🔑 Required API Keys

### 1. Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
2. Click **Create API Key**.
3. Copy your API key.

### 2. Google Maps API Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis).
2. Create or select a project with billing enabled.
3. Enable the following **6 APIs**:
   - **Maps JavaScript API**
   - **Places API** (or Places API New)
   - **Geocoding API**
   - **Elevation API**
   - **Maps Static API**
   - **Street View Static API**
4. Under **Credentials**, create an **API key**.
5. *(Recommended for production)* Under **API restrictions**, restrict the key to the 6 APIs above and set HTTP referrer restrictions for your Vercel domain.

---

## 🚀 Local Development

1. Clone or navigate to the repository:
   ```bash
   cd propertylens
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in your keys in `.env.local`:
   ```env
   GOOGLE_MAPS_API_KEY=AIzaSy...
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-2.5-flash
   ```

4. Run locally with the Vercel CLI:
   ```bash
   npx vercel dev
   ```
   *Or simply open `index.html` in your browser and enter your keys in the **API Keys** modal (⚙).*

---

## 🚢 Deploy to Vercel

### Option 1: Via Vercel Web Dashboard (Recommended)

1. Push your repository to GitHub (see instructions below).
2. Go to [vercel.com](https://vercel.com/) and click **Add New... > Project**.
3. Import your `propertylens` GitHub repository.
4. In the **Environment Variables** section, add:
   - `GOOGLE_MAPS_API_KEY` = `your_google_maps_key`
   - `GEMINI_API_KEY` = `your_gemini_key`
   - *(Optional)* `GEMINI_MODEL` = `gemini-2.5-flash`
5. Click **Deploy**.

### Option 2: Via Vercel CLI

```bash
npx vercel
```
Then add the environment variables in the project settings on Vercel:
```bash
npx vercel env add GOOGLE_MAPS_API_KEY
npx vercel env add GEMINI_API_KEY
npx vercel --prod
```

---

## 📄 License

MIT License. Designed for appraisers, inspectors, and proptech developers.
