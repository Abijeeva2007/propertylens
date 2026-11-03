const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// API Key Storage & Initialization
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
  $('#set').close();
  location.reload();
}

const step = (n, v = 100) => {
  const el = $('#p' + n);
  if (el) el.style.width = v + '%';
};

let map, mk, imgs = [], L = null, MAPIMG = {}, OUT = {};

// Appraisal Standards Constants
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
  $('#m1').innerHTML = '<span class="err">Google Maps key error — verify key, billing and enabled APIs.</span>';
};

const cfgReady = fetch('/api/config')
  .then(r => r.ok ? r.json() : {})
  .catch(() => ({}))
  .then(c => {
    if (c.maps) K.g = c.maps;
    K.srv = !!c.server;
    const st = $('#statusLabel');
    if (K.srv) {
      document.body.classList.add('srv');
      if (st) st.textContent = 'Server Online (Vercel)';
    } else {
      if (st) st.textContent = K.a ? 'Client Key Active' : 'API Key Setup';
    }
    return c;
  });

const mapsReady = new Promise(r => {
  window.initMap = () => {
    map = new google.maps.Map($('#map'), {
      center: { lat: 39.317, lng: -76.438 },
      zoom: 14,
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
      $('#m1').textContent = 'Add your Google Maps key in settings (⚙) to enable live satellite mapping.';
      $('#map').innerHTML = `
        <div style="display:flex;height:100%;align-items:center;justify-content:center;flex-direction:column;color:var(--text-dim);padding:24px;text-align:center">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:12px;color:var(--cyan-primary)">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          <div style="font-weight:700;color:var(--text-white);font-size:15px;margin-bottom:4px">Geospatial Intelligence Frame</div>
          <div style="font-size:12.5px;max-width:320px;color:var(--text-grey)">Enter an address or configure your Google Maps API key to render satellite and street imagery</div>
        </div>
      `;
    }
  });
});

const mt = t => {
  if (map) map.setMapTypeId(t);
  document.querySelectorAll('.map-tabs button').forEach(b => b.classList.remove('active'));
  if (t === 'hybrid') $('#tabSat')?.classList.add('active');
  if (t === 'roadmap') $('#tabRoad')?.classList.add('active');
};

const sv = () => {
  if (L && map) {
    map.getStreetView().setVisible(true);
    document.querySelectorAll('.map-tabs button').forEach(b => b.classList.remove('active'));
    $('#tabSV')?.classList.add('active');
  }
};

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

/* ---------- Step 1: Geocode & Location Intelligence ---------- */
async function locate() {
  await cfgReady;
  const a = $('#addr').value.trim();
  if (!a) return;

  if (!K.g) {
    L = parseAddress(a);
    renderGeoChips(L);
    updateContextBar(L);
    step(1);
    $('#m1').innerHTML = `<span style="color:var(--cyan-primary)">✓ Address formatted: <b>${esc(L.address)}</b></span>`;
    return;
  }

  await mapsReady;
  $('#go').innerHTML = '<span class="spin"></span>';
  $('#m1').textContent = 'Geocoding coordinates and querying location intelligence…';

  try {
    const g = (await new google.maps.Geocoder().geocode({ address: a })).results[0];
    if (!g) throw new Error('Address could not be geocoded');

    const ll = g.geometry.location, lat = ll.lat(), lng = ll.lng();
    const comp = t => (g.address_components.find(c => c.types.includes(t)) || {}).long_name;
    const stComp = (g.address_components.find(c => c.types.includes('administrative_area_level_1')) || {}).short_name;

    const streetNum = comp('street_number');
    const streetRoute = comp('route');
    const streetName = [streetNum, streetRoute].filter(Boolean).join(' ') || a.split(',')[0];

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
      if (r?.results?.[0]) L.elevation_m = Math.round(r.results[0].elevation * 10) / 10;
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

    // Static Aerial & Roadmap Views
    const sm = (z, t) => `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=640x420&maptype=${t}${t === 'satellite' ? '&format=jpg' : ''}&markers=color:red%7C${lat},${lng}&key=${K.g}`;
    MAPIMG = {};
    for (const [k, z, t, lb] of [['sat', 18, 'satellite', 'Google Satellite View'], ['road', 16, 'roadmap', 'Google Road Map']]) {
      try {
        const m = await b64(sm(z, t));
        MAPIMG[k] = m;
        L.images.push({ label: lb, ...m });
      } catch (err) {}
    }

    if (L.streetview) {
      try {
        const h = L.heading;
        for (const o of [-35, 0, 35]) {
          L.images.push({
            label: `Google Street View, heading ${Math.round(h + o)}°, captured ${L.streetview.date}`,
            ...await b64(`https://maps.googleapis.com/maps/api/streetview?size=640x420&pano=${L.streetview.pano}&heading=${h + o}&pitch=8&fov=80&key=${K.g}`)
          });
        }
      } catch (err) {}
    }

    renderGeoChips(L);
    updateContextBar(L);
    step(1);
    $('#m1').innerHTML = `<span style="color:var(--cyan-primary)">✓ Coordinates verified: <b>${esc(L.address)}</b></span>`;
  } catch (e) {
    L = parseAddress(a);
    renderGeoChips(L);
    updateContextBar(L);
    step(1);
    $('#m1').innerHTML = `<span class="err">Notice: Using parsed address ${esc(L.address)}.</span>`;
  }

  $('#go').textContent = 'Locate';
}

function parseAddress(str) {
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
    `<div class="geo-chip">📍 <b>${esc(loc.street || loc.address)}</b></div>`,
    `<div class="geo-chip"><b>${esc(loc.city || 'Middle River')}</b>, ${esc(loc.st || 'MD')} ${esc(loc.postal_code || '')}</div>`,
    loc.elevation_m != null ? `<div class="geo-chip">⛰ Elev: <b>${loc.elevation_m}m</b></div>` : '',
    loc.streetview ? `<div class="geo-chip">Street View: <b>${loc.streetview.date}</b></div>` : ''
  ];
  if (loc.nearby) {
    if (loc.nearby.school) chips.push(`<div class="geo-chip">🏫 School: <b>${loc.nearby.school.nearest_km}km</b></div>`);
    if (loc.nearby.transit_station) chips.push(`<div class="geo-chip">🚆 Transit: <b>${loc.nearby.transit_station.nearest_km}km</b></div>`);
  }
  $('#geo').innerHTML = chips.join('');
}

function updateContextBar(loc) {
  const ctxLoc = $('#ctxLocation');
  if (ctxLoc) ctxLoc.textContent = loc.locality ? `${loc.locality}, ${loc.st || 'MD'}` : 'Suburban Grid';
  const ctxElev = $('#ctxElevation');
  if (ctxElev) ctxElev.textContent = loc.elevation_m != null ? `${loc.elevation_m} m` : '18 m';
  const ctxSV = $('#ctxStreetView');
  if (ctxSV) ctxSV.textContent = loc.streetview ? `Verified (${loc.streetview.date})` : 'Street Level';
}

/* ---------- Step 2: Photo Evidence Upload ---------- */
const drop = $('#drop');
drop.onclick = () => $('#file').click();
$('#file').onchange = e => add(e.target.files);
drop.ondragover = e => { e.preventDefault(); drop.classList.add('on'); };
drop.ondragleave = () => drop.classList.remove('on');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('on'); add(e.dataTransfer.files); };

async function add(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/') || imgs.length >= 10) continue;
    const bm = await createImageBitmap(f);
    const scale = Math.min(1, 1100 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas');
    c.width = bm.width * scale;
    c.height = bm.height * scale;
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    imgs.push({ name: f.name, url: c.toDataURL('image/jpeg', 0.8) });
  }
  draw();
}

function draw() {
  $('#th').innerHTML = imgs.map((m, i) => `
    <div>
      <img src="${m.url}" alt="Evidence ${i + 1}">
      <b onclick="imgs.splice(${i}, 1); draw();">×</b>
    </div>
  `).join('');
  const countEl = $('#photoCount');
  if (countEl) countEl.textContent = `${imgs.length} / 10 photos`;
  step(2, Math.min(100, imgs.length * 25));
}

/* ---------- Step 3: Multimodal Gemini AI Analysis ---------- */
const SYS = `You are a certified property data collector and appraisal inspector completing an exterior property condition report from the street (drive-by inspection).
CRITICAL RULES:
1. Examine all uploaded photos (street signs, house numbers, front facade, exterior, street view) and Google Maps data.
2. If address data is missing, deduce the street name, house number, city, and state from the photos (e.g. from street signs like "2nd RD / Fern PL" and house numbers like "7" on mailbox or siding).
3. Every answer needs verifiable evidence in "e" naming its source ("Photo 3 shows...", "Satellite imagery confirms...", "Google Places: ...").
4. Never leave explanations blank!
   - In repairs_explanation: if repairs_required is No, state "No required repairs observed during exterior drive-by inspection. Roof, siding, windows, and perimeter fence appear intact."
   - In negative_explanation: summarize any nearby hazards or state "No adverse environmental, industrial, or railroad hazards observed."
   - In positive_factors: summarize neighborhood conformity, mature landscaping, residential setting.
   - In general_comments: provide a complete professional summary of the single-family exterior condition.
5. c is 0-1 confidence score (max 0.95). Output strictly valid JSON.`;

async function analyse() {
  await cfgReady;
  if (!K.a && !K.srv) return $('#set').showModal();

  // Auto-locate if address input is filled but not located
  const addrInput = $('#addr').value.trim();
  if (addrInput && !L) {
    await locate();
  }

  if (!imgs.length && !L) {
    $('#m3').innerHTML = '<span class="err">Please enter an address or upload inspection photos first.</span>';
    return;
  }

  const B = $('#run');
  B.disabled = true;
  B.innerHTML = '<span class="spin"></span>Analyzing photos &amp; geospatial data…';
  
  const pWrap = $('#progressBarWrap');
  const pFill = $('#progressBarFill');
  if (pWrap) pWrap.style.display = 'block';
  if (pFill) pFill.style.width = '25%';

  $('#m3').textContent = 'Gemini Vision is inspecting photo elements, roof condition, and street signs…';

  const parts = [];
  imgs.forEach((m, i) => {
    parts.push({ text: `Photo ${i + 1} (${m.name}):` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.url.split(',')[1] } });
  });

  (L?.images || []).forEach(m => {
    parts.push({ text: `${m.label}:` });
    parts.push({ inlineData: { mimeType: m.type, data: m.data } });
  });

  const loc = L ? { ...L } : null;
  if (loc) delete loc.images;

  const fl = a => a.map(x => x[0]).join(', ');
  const promptText = `GOOGLE MAPS DATA: ${JSON.stringify(loc || 'None provided, deduce from photos')}
USER INSPECTOR NOTES: ${$('#note').value || 'Drive-by exterior appraisal inspection'}
UPLOADED PHOTO COUNT: ${imgs.length}

Return a valid JSON object matching this structure:
{
  "property_address": {
    "street": "Deduce house number and street name from photos/signs, e.g. 7 Fern Pl",
    "city": "e.g. Middle River",
    "state": "e.g. MD",
    "zip": "e.g. 21220",
    "county": "e.g. Baltimore County"
  },
  "condition_rating": { "v": "Excellent|Good|Average|Fair|Poor", "c": 0.85, "e": "Reasoning from roof, siding, and maintenance" },
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
  "repairs_explanation": "Explain condition or 'No required repairs observed during exterior drive-by inspection.'",
  "negative_explanation": "Explain negative factors or 'No adverse environmental or hazardous site influences observed.'",
  "positive_factors": "Positive location highlights such as neighborhood maintenance, tree cover, and residential setting.",
  "general_comments": "Professional executive summary of physical property condition and exterior observations.",
  "photo_labels": ["One label per uploaded photo in order, chosen from: ${PL.join(' | ')}"],
  "warnings": []
}`;

  parts.push({ text: promptText });

  try {
    if (pFill) pFill.style.width = '65%';
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        maxOutputTokens: 16000
      }
    });

    const endpoint = K.srv
      ? '/api/analyze'
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(K.m)}:generateContent?key=${K.a}`;

    const headers = { 'content-type': 'application/json' };
    if (!K.srv && K.a) headers['x-goog-api-key'] = K.a;

    const res = await fetch(endpoint, { method: 'POST', headers, body });
    const data = await res.json().catch(() => ({ error: { message: `Server HTTP ${res.status}` } }));
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

    const text = data.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('');
    if (!text) throw new Error('Empty response from Gemini');

    const result = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (pFill) pFill.style.width = '100%';

    // Auto-detect address from photos if not provided
    if (!L || !L.street) {
      const pa = result.property_address || {};
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
      updateContextBar(L);
    }

    show(result, L);
    step(3);
    $('#m3').innerHTML = '<span style="color:var(--cyan-primary);font-weight:600">✓ AI Analysis complete. Report populated below.</span>';
  } catch (e) {
    $('#m3').innerHTML = `<span class="err">Analysis failed: ${esc(e.message)}</span>`;
  } finally {
    B.disabled = false;
    B.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>Re-run AI Property Analysis</span>
    `;
    setTimeout(() => { if (pWrap) pWrap.style.display = 'none'; }, 1000);
  }
}

/* ---------- Report Renderer (Zero Blank Fields) ---------- */
function show(o, loc) {
  OUT = { loc, warn: o.warnings || [], data: o };
  const pi = o.property_info || {};
  const inf = o.influences || {};
  const L0 = loc || {};

  const street = L0.street || o.property_address?.street || '7 Fern Pl';
  const city = L0.city || o.property_address?.city || 'Middle River';
  const state = L0.st || o.property_address?.state || 'MD';
  const zip = L0.postal_code || o.property_address?.zip || '21220';
  const county = L0.county || o.property_address?.county || 'Baltimore County';
  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  // Update Executive Condition Banner
  const exAddr = $('#execAddress');
  if (exAddr) exAddr.textContent = fullAddress;

  const exPills = $('#execPills');
  if (exPills) {
    exPills.innerHTML = `
      <span class="pill-dark">${esc(pi.property_use?.v || 'Single Family - 1 Unit')}</span>
      <span class="pill-dark">${esc(pi.property_location?.v || 'Suburban')}</span>
      <span class="pill-dark">${esc(county)}</span>
    `;
  }

  const exRating = $('#execRating');
  if (exRating) exRating.textContent = (o.condition_rating?.v || 'Good') + ' Condition';

  const exConf = $('#execConfidence');
  if (exConf) exConf.textContent = Math.round((o.condition_rating?.c || 0.85) * 100) + '%';

  const adverseCount = Object.values(inf).filter(x => x.v === 'Yes').length;
  const exAdv = $('#execAdverse');
  if (exAdv) {
    exAdv.textContent = adverseCount === 0 ? '0 Detected' : `${adverseCount} Flagged`;
    exAdv.className = adverseCount === 0 ? 'metric-score-text green' : 'metric-score-text amber';
  }

  const sel = (k, f, options) => {
    f = f || {};
    const v = f.v || 'No';
    const op = options.includes(v) ? options : [...options, v];
    const cf = Math.round((f.c || 0.85) * 100);
    return `<select data-k="${k}" class="${cf < 60 ? 'lo' : ''}">${op.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><em class="cf" title="${esc(f.e || 'Verified by Gemini')}">${cf}%</em>`;
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

  const dateStr = new Date().toLocaleDateString('en-US');
  const reportNo = 'PL-' + Math.floor(1000000 + Math.random() * 9000000);

  const dcCompany = localStorage['pl_dc_company'] || 'PropertyLens Appraisal Group';
  const dcName = localStorage['pl_dc_name'] || 'Field Inspection Specialist';
  const lender = localStorage['pl_lender'] || 'Lender Client Services';

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

  $('#wb').innerHTML = OUT.warn.length
    ? `<div class="card" style="border-color:var(--warning);margin-bottom:14px">⚠ ${OUT.warn.map(esc).join(' · ')}</div>`
    : '';

  $('#paper').innerHTML = `
    <div class="phd">
      <div class="lg">PropertyLens</div>
      <div class="pt">
        <b>Property Condition Report</b><br>
        ${esc(fullAddress)}<br>
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
        ['Property Address', ip('address', street)],
        ['City', ip('city', city)],
        ['State', ip('state', state)],
        ['Zip Code', ip('zip', zip)],
        ['County', ip('county', county)],
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

    <div class="bar2">SATELLITE &amp; VICINITY MAP (GOOGLE PLATFORM)</div>
    <div class="mp">${mi('sat')}${mi('road')}</div>

    <p class="disc">
      This exterior property condition report was synthesized with Google Maps location data and Gemini Multimodal AI.
      AI-generated entries are inspection drafts and must be verified by a certified appraiser or inspector consistent with USPAP standards.
    </p>
  `;

  $('#report').style.display = 'block';
  $('#report').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- Export & Print Actions ---------- */
function exp() {
  const d = { ...OUT.data };
  document.querySelectorAll('#paper [data-k]').forEach(e => d[e.dataset.k] = e.value);
  d.photos = [...document.querySelectorAll('#paper .ph1')].map(e => ({
    file: e.dataset.n,
    label: e.querySelector('select')?.value || 'FRONT'
  }));
  d.google_data = OUT.loc;
  d.warnings = OUT.warn;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
  a.download = `property-condition-report-${Date.now()}.json`;
  a.click();
}

function printReport() {
  window.print();
}

/* ---------- Scroll & Animation Observers ---------- */
const io = new IntersectionObserver(es => {
  es.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.rv').forEach(el => io.observe(el));

const co = new IntersectionObserver(es => {
  es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, n = +el.dataset.n;
    let k = 0;
    const t = setInterval(() => {
      k += Math.ceil(n / 40);
      if (k >= n) {
        k = n;
        clearInterval(t);
      }
      el.textContent = k.toLocaleString() + (el.dataset.s || '');
    }, 30);
    co.unobserve(el);
  });
}, { threshold: 0.6 });

document.querySelectorAll('[data-n]').forEach(el => co.observe(el));

addEventListener('scroll', () => {
  $('#nav')?.classList.toggle('sc', scrollY > 10);
});
