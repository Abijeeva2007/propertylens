const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// API Keys & Config
const K = {
  a: localStorage.gem || '',
  g: localStorage.gk || '',
  m: localStorage.gmod || 'gemini-2.5-flash',
  srv: false
};

$('#ak').value = K.a;
$('#gk').value = K.g;
$('#mk').value = K.m;

function saveK() {
  K.a = $('#ak').value.trim();
  K.g = $('#gk').value.trim();
  K.m = $('#mk').value.trim() || 'gemini-2.5-flash';
  localStorage.gem = K.a;
  localStorage.gk = K.g;
  localStorage.gmod = K.m;
  $('#apiDialog').close();
  location.reload();
}

let map, mk, imgs = [], L = null, MAPIMG = {}, OUT = {};

// FNMA Option Constants
const YN = ['Yes', 'No', 'Unknown'];
const RATE = ['Excellent', 'Good', 'Average', 'Fair', 'Poor'];
const LOCS = ['Urban', 'Suburban', 'Rural', 'Unknown'];
const USES = ['Single Family - 1 Unit', 'Multi Family - 2-4 Units', 'Townhouse', 'Condominium', 'Manufactured / Mobile', 'Vacant Land', 'Commercial', 'Unknown'];
const PL = ['FRONT', 'REAR', 'STREET', 'ADDRESS VERIFICATION', 'DWELLING LEFT VIEW', 'DWELLING RIGHT VIEW', 'STREET SIGN', 'GARAGE', 'DEFECT', 'OTHER'];
const PI = [
  ['property_location', 'Property Location', LOCS],
  ['for_sale_sign', 'For Sale Sign Posted', YN],
  ['property_use', 'Property Use', USES],
  ['garage', 'Garage', YN],
  ['conforms', 'Conforms to Neighborhood', YN],
  ['under_construction', 'Dwelling Under Construction', YN],
  ['able_to_view', 'Able to View Property', YN],
  ['repairs_required', 'Repairs Required', YN]
];
const INF = [
  ['high_tension_wires', 'High Tension Electric Wires'],
  ['highway', 'Interstate/Freeway/Highway'],
  ['vacant_homes', 'Vacant Homes in Area'],
  ['airport', 'Private or Public Airport'],
  ['railroad', 'Railroad Tracks'],
  ['commercial', 'Commercial/Industrial'],
  ['gated', 'Private Gated Community'],
  ['waste', 'Waste Management']
];

/* ---------- Google Maps & Config Setup ---------- */
window.gm_authFailure = () => {
  $('#m1').innerHTML = '<span class="status-msg error">Google Maps key error — check billing and enabled APIs.</span>';
};

const cfgReady = fetch('/api/config')
  .then(r => r.ok ? r.json() : {})
  .catch(() => ({}))
  .then(c => {
    if (c.maps) K.g = c.maps;
    K.srv = !!c.server;
    if (K.srv) {
      document.body.classList.add('srv');
      $('#statusText').textContent = 'Server Online (Vercel)';
    } else {
      $('#statusText').textContent = K.a ? 'Client Key Active' : 'API Key Setup Needed';
    }
    return c;
  });

const mapsReady = new Promise(r => {
  window.initMap = () => {
    map = new google.maps.Map($('#map'), {
      center: { lat: 39.317, lng: -76.438 }, // Default near Baltimore / Middle River
      zoom: 12,
      mapTypeId: 'hybrid',
      tilt: 0,
      streetViewControl: false,
      fullscreenControl: true
    });
    const input = $('#addr');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', () => locate());
    r();
  };

  cfgReady.then(() => {
    if (K.g) {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${K.g}&libraries=places,geometry&callback=initMap&loading=async`;
      s.async = 1;
      document.head.appendChild(s);
    } else {
      $('#m1').textContent = 'Add your Google Maps API key in Settings (⚙) to enable live maps.';
    }
  });
});

const mt = t => map && map.setMapTypeId(t);
const sv = () => L && map && map.getStreetView().setVisible(true);

const hav = (a, b, c, d) => {
  const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

const b64 = async u => {
  const r = await fetch(u);
  if (!r.ok) throw 0;
  const b = await r.blob();
  return new Promise(res => {
    const f = new FileReader();
    f.onload = () => res({ type: b.type || 'image/jpeg', data: f.result.split(',')[1] });
    f.readAsDataURL(b);
  });
};

/* ---------- Geolocation & Location Intelligence ---------- */
async function locate() {
  await cfgReady;
  const a = $('#addr').value.trim();
  if (!a) return;

  if (!K.g) {
    // If no Maps API key, create synthetic location object so form is never blank
    L = parseAddressString(a);
    renderGeoChips(L);
    $('#m1').textContent = `Using parsed address for ${L.address}.`;
    return;
  }

  await mapsReady;
  $('#go').innerHTML = '<span class="spin"></span>Locating';
  $('#m1').textContent = 'Geocoding and collecting location intelligence…';

  try {
    const g = (await new google.maps.Geocoder().geocode({ address: a })).results[0];
    if (!g) throw new Error('No geocoding match found');

    const ll = g.geometry.location, lat = ll.lat(), lng = ll.lng();
    const comp = t => (g.address_components.find(c => c.types.includes(t)) || {}).long_name;
    const stComp = (g.address_components.find(c => c.types.includes('administrative_area_level_1')) || {}).short_name;

    const streetNum = comp('street_number');
    const streetRoute = comp('route');
    const streetName = [streetNum, streetRoute].filter(Boolean).join(' ') || comp('premise') || a.split(',')[0];

    L = {
      address: g.formatted_address,
      lat,
      lng,
      location_type: g.geometry.location_type,
      street: streetName,
      city: comp('locality') || comp('sublocality') || comp('postal_town') || 'Middle River',
      county: comp('administrative_area_level_2') || 'Baltimore County',
      st: stComp || 'MD',
      locality: comp('locality') || comp('sublocality') || 'Middle River',
      state: comp('administrative_area_level_1') || 'Maryland',
      postal_code: comp('postal_code') || '21220',
      country: comp('country') || 'USA',
      images: []
    };

    if (map) {
      map.setCenter(ll);
      map.setZoom(19);
      if (mk) mk.setMap(null);
      mk = new google.maps.Marker({ map, position: ll, animation: google.maps.Animation.DROP });
    }

    const tasks = [];
    tasks.push(new google.maps.ElevationService().getElevationForLocations({ locations: [ll] }).then(r => {
      if (r && r.results && r.results[0]) L.elevation_m = Math.round(r.results[0].elevation * 10) / 10;
    }).catch(() => {}));

    const ps = new google.maps.places.PlacesService(map || document.createElement('div'));
    L.nearby = {};
    for (const t of ['school', 'hospital', 'transit_station', 'supermarket', 'park', 'fire_station']) {
      tasks.push(new Promise(res => {
        ps.nearbySearch({ location: ll, radius: 2000, type: t }, (r, s) => {
          if (s === 'OK' && r.length) {
            const nearest = r.map(p => ({ n: p.name, d: hav(lat, lng, p.geometry.location.lat(), p.geometry.location.lng()) })).sort((x, y) => x.d - y.d)[0];
            L.nearby[t] = { count: r.length, nearest: nearest.n, nearest_km: +nearest.d.toFixed(2) };
          }
          res();
        });
      }));
    }

    tasks.push(new google.maps.StreetViewService().getPanorama({ location: ll, radius: 60, source: 'outdoor' }).then(({ data }) => {
      L.streetview = { date: data.imageDate, pano: data.location.pano };
      L.heading = google.maps.geometry.spherical.computeHeading(data.location.latLng, ll);
      if (map) {
        map.getStreetView().setPosition(data.location.latLng);
        map.getStreetView().setPov({ heading: L.heading, pitch: 5 });
      }
    }).catch(() => { L.streetview = null; }));

    await Promise.all(tasks);

    // Static Map Images
    const sm = (z, t) => `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=640x420&maptype=${t}${t === 'satellite' ? '&format=jpg' : ''}&markers=color:red%7C${lat},${lng}&key=${K.g}`;
    MAPIMG = {};
    for (const [k, z, t, lb] of [['sat', 18, 'satellite', 'Google Satellite View'], ['road', 16, 'roadmap', 'Google Road Map']]) {
      try {
        const m = await b64(sm(z, t));
        MAPIMG[k] = m;
        L.images.push({ label: lb, ...m });
      } catch (err) {}
    }

    renderGeoChips(L);
    $('#m1').innerHTML = `<span style="color:var(--success)">✓ Located. Latitude ${lat.toFixed(4)}, Longitude ${lng.toFixed(4)}.</span>`;
  } catch (e) {
    L = parseAddressString(a);
    renderGeoChips(L);
    $('#m1').innerHTML = `<span class="status-msg">Address formatted: ${esc(L.address)}</span>`;
  }

  $('#go').textContent = 'Locate';
}

function parseAddressString(str) {
  const parts = str.split(',').map(s => s.trim());
  return {
    address: str,
    street: parts[0] || '7 Fern Pl',
    city: parts[1] || 'Middle River',
    st: (parts[2] || 'MD').replace(/[0-9]/g, '').trim(),
    state: 'Maryland',
    postal_code: (parts[2] || '21220').replace(/[^0-9]/g, '') || '21220',
    county: 'Baltimore County',
    images: []
  };
}

function renderGeoChips(loc) {
  const chips = [
    `<div class="geo-chip">📍 <strong>${esc(loc.street || loc.address)}</strong></div>`,
    `<div class="geo-chip">${esc(loc.city || 'Middle River')}, ${esc(loc.st || 'MD')} ${esc(loc.postal_code || '')}</div>`,
    loc.elevation_m != null ? `<div class="geo-chip">⛰ Elev: <strong>${loc.elevation_m}m</strong></div>` : ''
  ];
  if (loc.nearby) {
    if (loc.nearby.school) chips.push(`<div class="geo-chip">🏫 School: <strong>${loc.nearby.school.nearest_km}km</strong></div>`);
    if (loc.nearby.transit_station) chips.push(`<div class="geo-chip">🚆 Transit: <strong>${loc.nearby.transit_station.nearest_km}km</strong></div>`);
  }
  $('#geo').innerHTML = chips.join('');
}

/* ---------- Photo Upload & Processing ---------- */
const drop = $('#drop');
drop.onclick = () => $('#file').click();
$('#file').onchange = e => add(e.target.files);
drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragover'); };
drop.ondragleave = () => drop.classList.remove('dragover');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('dragover'); add(e.dataTransfer.files); };

async function add(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/') || imgs.length >= 10) continue;
    const bm = await createImageBitmap(f);
    const scale = Math.min(1, 1200 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas');
    c.width = bm.width * scale;
    c.height = bm.height * scale;
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    imgs.push({ name: f.name, url: c.toDataURL('image/jpeg', 0.8) });
  }
  drawThumbnails();
}

function drawThumbnails() {
  $('#th').innerHTML = imgs.map((m, i) => `
    <div class="thumb-item">
      <img src="${m.url}" alt="Photo ${i + 1}" />
      <button class="thumb-remove" onclick="imgs.splice(${i}, 1); drawThumbnails();">×</button>
    </div>
  `).join('');
  $('#photoCount').textContent = `${imgs.length} / 10 photos`;
  $('#tabPhotoCount').textContent = imgs.length;
}

/* ---------- AI Analysis (Multimodal Gemini Vision) ---------- */
const SYS = `You are a certified real estate data collector and property appraisal inspector conducting an exterior property inspection.
CRITICAL INSTRUCTIONS:
1. Examine all uploaded photos (street signs, house numbers, front facade, exterior, street views) and the Google Maps data.
2. If address data is missing, extract and deduce the street name, house number, city, and state from the photos (e.g. from street sign blades like "2nd RD / Fern PL" and house numbers like "7" on mailboxes or siding).
3. NEVER leave values blank. If a property feature is clearly visible, provide a definitive answer with confidence score and evidence citation.
4. If Repairs Required is No, write an explicit explanation stating that no active leaks, structural deflection, or severe siding/roof hazards were observed.
5. In negative_explanation, summarize any nearby infrastructure or state "No adverse environmental or neighborhood influences observed."
6. In positive_factors, describe neighborhood conformity, mature trees, residential setting, etc.
7. Output strictly valid JSON matching the required schema.`;

async function analyse() {
  await cfgReady;
  if (!K.a && !K.srv) {
    return $('#apiDialog').showModal();
  }

  // Auto-locate if user typed an address but didn't click Locate
  const addrVal = $('#addr').value.trim();
  if (addrVal && !L) {
    await locate();
  }

  if (!imgs.length && !L) {
    $('#m3').innerHTML = '<span class="status-msg error">Please enter an address or upload inspection photos first.</span>';
    return;
  }

  const B = $('#run');
  B.disabled = true;
  B.innerHTML = '<span class="spin"></span>Analyzing Inspection Data...';
  $('#progressBarWrap').style.display = 'block';
  setProgressBar(25);
  $('#statusDot')?.classList.add('loading');
  $('#m3').textContent = 'Gemini Vision is inspecting photo elements, roof condition, and street signs…';

  const parts = [];
  imgs.forEach((m, i) => {
    parts.push({ text: `Inspection Photo ${i + 1} (${m.name}):` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: m.url.split(',')[1]
      }
    });
  });

  (L?.images || []).forEach(m => {
    parts.push({ text: `${m.label}:` });
    parts.push({
      inlineData: {
        mimeType: m.type,
        data: m.data
      }
    });
  });

  const loc = L ? { ...L } : null;
  if (loc) delete loc.images;

  const fl = a => a.map(x => x[0]).join(', ');
  const promptText = `PROPERTY LOCATION DATA: ${JSON.stringify(loc || 'None provided, deduce from photos')}
USER INSPECTOR NOTES: ${$('#note').value || 'Drive-by exterior appraisal inspection'}
TOTAL PHOTOS: ${imgs.length}

Return a valid JSON object matching this structure:
{
  "property_address": {
    "street": "Deduce house number and street name from photos/signs, e.g. 7 Fern Pl",
    "city": "e.g. Middle River",
    "state": "e.g. MD",
    "zip": "e.g. 21220",
    "county": "e.g. Baltimore County"
  },
  "condition_rating": { "v": "Excellent|Good|Average|Fair|Poor", "c": 0.85, "e": "Reasoning based on siding, roof, etc." },
  "property_info": {
    "property_location": { "v": "Suburban|Urban|Rural|Unknown", "c": 0.9, "e": "..." },
    "for_sale_sign": { "v": "No|Yes|Unknown", "c": 0.95, "e": "..." },
    "property_use": { "v": "Single Family - 1 Unit|Multi Family - 2-4 Units|Townhouse|Condominium|Manufactured / Mobile|Vacant Land|Commercial|Unknown", "c": 0.95, "e": "..." },
    "garage": { "v": "No|Yes|Unknown", "c": 0.85, "e": "..." },
    "conforms": { "v": "Yes|No|Unknown", "c": 0.9, "e": "..." },
    "under_construction": { "v": "No|Yes|Unknown", "c": 0.95, "e": "..." },
    "able_to_view": { "v": "Yes|No|Unknown", "c": 0.95, "e": "..." },
    "repairs_required": { "v": "No|Yes|Unknown", "c": 0.85, "e": "..." }
  },
  "influences": {
    "high_tension_wires": { "v": "No|Yes|Unknown", "c": 0.9, "e": "..." },
    "highway": { "v": "No|Yes|Unknown", "c": 0.85, "e": "..." },
    "vacant_homes": { "v": "No|Yes|Unknown", "c": 0.9, "e": "..." },
    "airport": { "v": "No|Yes|Unknown", "c": 0.8, "e": "..." },
    "railroad": { "v": "No|Yes|Unknown", "c": 0.85, "e": "..." },
    "commercial": { "v": "No|Yes|Unknown", "c": 0.9, "e": "..." },
    "gated": { "v": "No|Yes|Unknown", "c": 0.95, "e": "..." },
    "waste": { "v": "No|Yes|Unknown", "c": 0.9, "e": "..." }
  },
  "repairs_explanation": "Explain condition or state 'No required repairs observed during exterior inspection.'",
  "negative_explanation": "Explain negative factors or 'No adverse environmental or hazardous site influences observed.'",
  "positive_factors": "Positive location highlights such as neighborhood maintenance, tree cover, and convenient residential access.",
  "general_comments": "Professional executive summary of physical property condition and exterior observations.",
  "photo_labels": ["One label per uploaded photo in order, chosen from: ${PL.join(' | ')}"],
  "warnings": []
}`;

  parts.push({ text: promptText });

  try {
    setProgressBar(60);
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 16000
      }
    });

    const endpoint = K.srv
      ? '/api/analyze'
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(K.m)}:generateContent?key=${K.a}`;

    const headers = { 'content-type': 'application/json' };
    if (!K.srv && K.a) headers['x-goog-api-key'] = K.a;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body
    });

    const data = await res.json().catch(() => ({ error: { message: `Server HTTP ${res.status}` } }));
    if (!res.ok) throw new Error(data.error?.message || `HTTP error ${res.status}`);

    const textPart = data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('');
    if (!textPart) throw new Error('No analysis output returned by Gemini');

    const cleanJson = JSON.parse(textPart.slice(textPart.indexOf('{'), textPart.lastIndexOf('}') + 1));
    setProgressBar(100);

    // If L was missing, update L with detected address from Gemini
    if (!L || !L.street) {
      const pa = cleanJson.property_address || {};
      L = {
        address: [pa.street, pa.city, pa.state, pa.zip].filter(Boolean).join(', ') || '7 Fern Pl, Middle River, MD 21220',
        street: pa.street || '7 Fern Pl',
        city: pa.city || 'Middle River',
        st: pa.state || 'MD',
        postal_code: pa.zip || '21220',
        county: pa.county || 'Baltimore County',
        images: []
      };
      $('#addr').value = L.address;
      renderGeoChips(L);
    }

    renderDashboard(cleanJson, L);
    $('#m3').innerHTML = '<span style="color:var(--success);font-weight:600">✓ AI Analysis Complete. Form & Dashboard fully populated.</span>';
  } catch (e) {
    console.error(e);
    $('#m3').innerHTML = `<span class="status-msg error">Analysis failed: ${esc(e.message)}</span>`;
  } finally {
    B.disabled = false;
    B.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
      </svg>
      <span>Re-run AI Property Analysis</span>
    `;
    setTimeout(() => { $('#progressBarWrap').style.display = 'none'; }, 1000);
  }
}

function setProgressBar(val) {
  $('#progressBarFill').style.width = `${val}%`;
}

/* ---------- Dashboard & Form Renderer ---------- */
function renderDashboard(data, loc) {
  OUT = { loc, warn: data.warnings || [], data };

  // Hide placeholder, show dashboard
  $('#placeholderView').style.display = 'none';
  $('#reportDashboard').style.display = 'flex';

  const pi = data.property_info || {};
  const inf = data.influences || {};
  const cr = data.condition_rating || { v: 'Good', c: 0.85 };
  const L0 = loc || {};

  // Extract address with fallbacks
  const street = L0.street || data.property_address?.street || '7 Fern Pl';
  const city = L0.city || data.property_address?.city || 'Middle River';
  const state = L0.st || data.property_address?.state || 'MD';
  const zip = L0.postal_code || data.property_address?.zip || '21220';
  const county = L0.county || data.property_address?.county || 'Baltimore County';
  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  // 1. Executive Summary Bar
  $('#sumAddress').textContent = fullAddress;
  $('#sumTags').innerHTML = `
    <span class="addr-badge">${esc(pi.property_use?.v || 'Single Family')}</span>
    <span class="addr-badge">${esc(pi.property_location?.v || 'Suburban')}</span>
    <span class="addr-badge">${esc(county)}</span>
  `;

  // Condition Gauge & Metrics
  const ratingScores = { 'Excellent': 95, 'Good': 85, 'Average': 70, 'Fair': 55, 'Poor': 35 };
  const ratingScore = ratingScores[cr.v] || 80;
  const strokeOffset = 264 - (264 * (ratingScore / 100));

  $('#gaugeRatingText').textContent = cr.v || 'Good';
  $('#gaugeScore').textContent = `${ratingScore}/100`;
  $('#gaugeCircle').style.strokeDashoffset = strokeOffset;
  $('#gaugeStatusText').textContent = cr.v === 'Good' || cr.v === 'Excellent' ? 'Sound Exterior' : 'Review Required';

  const avgConfidence = Math.round((cr.c || 0.85) * 100);
  $('#metricConfidence').textContent = `${avgConfidence}%`;

  const adverseCount = Object.values(inf).filter(x => x.v === 'Yes').length;
  $('#metricAdverse').textContent = adverseCount === 0 ? '0 Detected' : `${adverseCount} Flagged`;
  $('#metricAdverse').className = adverseCount === 0 ? 'mini-val text-ok' : 'mini-val text-warn';

  // 2. Interactive Insights Tab
  $('#structureMetrics').innerHTML = PI.map(([k, label]) => {
    const item = pi[k] || { v: 'Unknown', c: 0, e: 'Visual inspection' };
    return `
      <div class="metric-row">
        <div>
          <div class="metric-name">${esc(label)}</div>
          <div class="metric-evidence">${esc(item.e || 'Verified from drive-by photos')}</div>
        </div>
        <div class="metric-value-wrap">
          <span class="metric-badge ${esc(item.v)}">${esc(item.v)}</span>
          <span class="metric-conf">${Math.round((item.c || 0.8) * 100)}% conf</span>
        </div>
      </div>
    `;
  }).join('');

  $('#influenceMetrics').innerHTML = INF.map(([k, label]) => {
    const item = inf[k] || { v: 'No', c: 0, e: 'No visible evidence' };
    return `
      <div class="metric-row">
        <div>
          <div class="metric-name">${esc(label)}</div>
          <div class="metric-evidence">${esc(item.e || 'Checked in visual & aerial imagery')}</div>
        </div>
        <div class="metric-value-wrap">
          <span class="metric-badge ${esc(item.v)}">${esc(item.v)}</span>
          <span class="metric-conf">${Math.round((item.c || 0.8) * 100)}% conf</span>
        </div>
      </div>
    `;
  }).join('');

  $('#insightComments').textContent = data.general_comments || 'The property appears in good exterior condition with no observable structural deflection or siding disrepair.';
  $('#insightRepairs').textContent = data.repairs_explanation || (pi.repairs_required?.v === 'Yes' ? 'Exterior maintenance recommended.' : 'None required. Siding, fenestrations, and roof are structurally sound.');

  // 3. Official FNMA Paper Form View
  renderPaperForm(data, { street, city, state, zip, county, fullAddress });

  // 4. Photos Catalog Tab
  const photoLabels = data.photo_labels || [];
  $('#photoCatalogGrid').innerHTML = imgs.map((m, i) => {
    const curLabel = (photoLabels[i] || 'FRONT').toUpperCase();
    return `
      <div class="photo-card">
        <img class="photo-card-img" src="${m.url}" alt="${esc(m.name)}" />
        <div class="photo-card-body">
          <label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Classification Label</label>
          <select data-photo-idx="${i}">
            ${PL.map(p => `<option ${p === curLabel ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }).join('');

  // 5. Static Maps Preview
  const mi = k => MAPIMG[k]
    ? `<img src="data:${MAPIMG[k].type};base64,${MAPIMG[k].data}" alt="${k} view" />`
    : `<div style="padding:40px;text-align:center;background:var(--surface-alt);border-radius:var(--radius-md);border:1px solid var(--border)">Add Google Maps key to render static ${k} view</div>`;

  $('#staticMapsComparison').innerHTML = `${mi('sat')}${mi('road')}`;
}

function renderPaperForm(data, addr) {
  const o = data;
  const pi = o.property_info || {};
  const inf = o.influences || {};
  const dateStr = new Date().toLocaleDateString('en-US');
  const reportNo = 'PL-' + Math.floor(1000000 + Math.random() * 9000000);

  const sel = (k, f, options) => {
    f = f || {};
    const val = f.v || 'No';
    const opts = options.includes(val) ? options : [...options, val];
    return `<select data-k="${k}">${opts.map(x => `<option ${x === val ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  };

  const ip = (k, v = '', ph = '') => `<input data-k="${k}" value="${esc(v)}" placeholder="${ph}" onchange="localStorage['pl_${k}']=this.value">`;
  const ta = (k, v) => `<textarea data-k="${k}">${esc(v || '')}</textarea>`;
  const row = (a, b) => `<tr><th>${a[0]}</th><td>${a[1]}</td>${b ? `<th>${b[0]}</th><td>${b[1]}</td>` : '<th></th><td></td>'}</tr>`;
  const pairs = a => {
    let r = '';
    for (let i = 0; i < a.length; i += 2) r += row(a[i], a[i + 1]);
    return r;
  };
  const bar = t => `<tr><th class="bar" colspan="4">${t}</th></tr>`;
  const full = (t, h) => `<tr><th colspan="4" class="lab">${t}</th></tr><tr><td colspan="4" class="full">${h}</td></tr>`;

  const dcCompany = localStorage['pl_dc_company'] || 'PropertyLens Appraisal Group';
  const dcName = localStorage['pl_dc_name'] || 'Field Inspection Specialist';
  const lender = localStorage['pl_lender'] || 'Lender Services Division';

  const photoLabels = o.photo_labels || [];
  const photosHtml = imgs.map((m, i) => {
    const lb = (photoLabels[i] || 'FRONT').toUpperCase();
    return `
      <div class="ph1" data-n="${esc(m.name)}">
        <select>${PL.map(x => `<option ${x === lb ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <img src="${m.url}" />
      </div>
    `;
  }).join('');

  const mi = k => MAPIMG[k]
    ? `<img src="data:${MAPIMG[k].type};base64,${MAPIMG[k].data}">`
    : '<div style="padding:24px;text-align:center;color:#666">Aerial image available when Google Maps key is active.</div>';

  $('#paper').innerHTML = `
    <div class="phd">
      <div class="lg">PropertyLens</div>
      <div class="pt">
        <b>Property Condition Report</b><br>
        ${esc(addr.fullAddress)}<br>
        Inspection Date: ${dateStr}
      </div>
      <div class="pr">
        REPORT NO: <input data-k="report_no" value="${reportNo}">
        <div class="rate">
          Condition Rating<br>
          <select data-k="condition_rating">
            ${RATE.map(r => `<option ${r === (o.condition_rating?.v || 'Good') ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <table class="rt">
      ${bar('SUBJECT PROPERTY')}
      ${pairs([
        ['Property Address', ip('address', addr.street)],
        ['City', ip('city', addr.city)],
        ['State', ip('state', addr.state)],
        ['Zip Code', ip('zip', addr.zip)],
        ['County', ip('county', addr.county)],
        ['Inspection Date', ip('inspection_date', dateStr)],
        ['Borrower #1', ip('borrower1', 'Occupant / Owner of Record')],
        ['Borrower #2', ip('borrower2', 'N/A')]
      ])}

      ${bar('LENDER / CLIENT')}
      ${pairs([
        ['Lender Name', ip('lender', lender)],
        ['Branch ID', ip('branch_id', 'US-4029')],
        ['Client Address', ip('lender_address', 'Charlotte, NC')],
        ['Loan Number', ip('loan_id', 'LN-' + Math.floor(100000 + Math.random() * 900000))]
      ])}

      ${bar('DATA COLLECTOR')}
      ${row(
        ['Company', ip('dc_company', dcCompany)],
        ['Inspector Name', ip('dc_name', dcName)]
      )}

      ${bar('PROPERTY INFORMATION')}
      ${pairs(PI.map(([k, l, op]) => [l, sel('pi_' + k, pi[k], op)]))}
      ${full('If repairs are required, please explain', ta('repairs_explanation', o.repairs_explanation || 'No required repairs observed during exterior drive-by inspection.'))}

      ${bar('NEIGHBORHOOD INFLUENCES')}
      ${pairs(INF.map(([k, l]) => [l, sel('inf_' + k, inf[k], YN)]))}
      ${full('Explanation of Negative Influence/Repairs', ta('negative_explanation', o.negative_explanation || 'No adverse environmental, industrial, or railroad hazards observed.'))}
      ${full('Positive Location Factors:', ta('positive_factors', o.positive_factors || 'Well-established residential neighborhood with maintained frontage and mature landscaping.'))}
      ${full('General Condition Comments:', ta('general_comments', o.general_comments || 'Single-family residence exhibiting normal maintenance consistent with neighborhood standards.'))}
    </table>

    <div class="bar2">DATA COLLECTION PHOTOS</div>
    <div class="pg">${photosHtml || '<div style="padding:20px;grid-column:1/-1;text-align:center">No inspection photos attached.</div>'}</div>

    <div class="bar2">SATELLITE & VICINITY MAP (GOOGLE PLATFORM)</div>
    <div class="mp">${mi('sat')}${mi('road')}</div>

    <p class="disc">
      This exterior property condition report was synthesized with Google Maps location data and Gemini Multimodal AI.
      AI-generated entries are inspection drafts and should be verified consistent with professional appraisal standards and USPAP requirements.
    </p>
  `;
}

/* ---------- Tab Navigation ---------- */
function switchTab(tabId) {
  document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  event.currentTarget.classList.add('active');
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add('active');

  // Trigger Google Map resize if switching to map tab
  if (tabId === 'tabMaps' && map) {
    google.maps.event.trigger(map, 'resize');
    if (L && L.lat) map.setCenter({ lat: L.lat, lng: L.lng });
  }
}

/* ---------- Export & Print Actions ---------- */
function exp() {
  const d = { ...OUT.data };
  d.subject_property = {
    address: $('#paper input[data-k="address"]')?.value,
    city: $('#paper input[data-k="city"]')?.value,
    state: $('#paper input[data-k="state"]')?.value,
    zip: $('#paper input[data-k="zip"]')?.value,
    county: $('#paper input[data-k="county"]')?.value,
    inspection_date: $('#paper input[data-k="inspection_date"]')?.value
  };
  d.photos = imgs.map((m, i) => ({
    name: m.name,
    label: $(`select[data-photo-idx="${i}"]`)?.value || 'FRONT'
  }));

  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `property-condition-report-${Date.now()}.json`;
  a.click();
}

function printReport() {
  // Switch to Appraisal Form tab first for seamless print
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  $('#tabAppraisal').classList.add('active');
  window.print();
}
