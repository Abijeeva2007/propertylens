
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const K={a:localStorage.gem||'',g:localStorage.gk||'',m:localStorage.gmod||'gemini-2.5-flash'};
$('#ak').value=K.a;$('#gk').value=K.g;$('#mk').value=K.m;
function saveK(){K.a=$('#ak').value.trim();K.g=$('#gk').value.trim();K.m=$('#mk').value.trim()||'gemini-2.5-flash';localStorage.gem=K.a;localStorage.gk=K.g;localStorage.gmod=K.m;$('#set').close();location.reload()}
const step=(n,v=100)=>$('#p'+n).style.width=v+'%';
let map,mk,imgs=[],L=null,sc=0,MAPIMG={},OUT={};
const TPL={"General":["Property type","Estimated era / year built","Number of storeys","Occupancy appearance"],
"Exterior":["Roof covering","Roof condition","Walls / cladding","Paint & finish","Windows & doors","Gutters & drainage","Foundation (visible)","Driveway & paths","Trees / vegetation near structure"],
"Structure & moisture":["Cracks","Settlement / sagging","Water staining / damp","Mold / mildew","Pest damage signs"],
"Interior":["Flooring","Walls & ceilings","Kitchen","Bathrooms","Interior doors & windows","Lighting & fixtures"],
"Systems":["Electrical (visible)","Plumbing (visible)","HVAC (visible)","Water heater","Smoke / CO detectors"],
"Safety":["Hazards observed","Stairs / railings"]};
const key=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_');

/* ---------- Google Maps ---------- */
window.gm_authFailure=()=>$('#m1').innerHTML='<span class="err">Google Maps key rejected — check key, billing and enabled APIs.</span>';
const cfgReady=fetch('/api/config').then(r=>r.ok?r.json():{}).catch(()=>({})).then(c=>{if(c.maps)K.g=c.maps;K.srv=!!c.server;if(K.srv)document.body.classList.add('srv');return c});
const mapsReady=new Promise(r=>{window.initMap=()=>{map=new google.maps.Map($('#map'),{center:{lat:20.6,lng:78.9},zoom:4,mapTypeId:'hybrid',tilt:0,streetViewControl:false,fullscreenControl:true});
 new google.maps.places.Autocomplete($('#addr')).addListener('place_changed',()=>locate());r()};
 cfgReady.then(()=>{if(K.g){const s=document.createElement('script');s.src=`https://maps.googleapis.com/maps/api/js?key=${K.g}&libraries=places,geometry&callback=initMap&loading=async`;s.async=1;document.head.appendChild(s)}else $('#m1').textContent='Add your Google Maps key (⚙) to begin.'})});
const mt=t=>map&&map.setMapTypeId(t),sv=()=>L&&map.getStreetView().setVisible(true);
const hav=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 12742*Math.asin(Math.sqrt(x))};
const b64=async u=>{const r=await fetch(u);if(!r.ok)throw 0;const b=await r.blob();return new Promise(res=>{const f=new FileReader();f.onload=()=>res({type:b.type||'image/jpeg',data:f.result.split(',')[1]});f.readAsDataURL(b)})};

async function locate(){
 await cfgReady;if(!K.g)return $('#set').showModal();await mapsReady;const a=$('#addr').value.trim();if(!a)return;
 $('#go').innerHTML='<span class="spin"></span>';$('#m1').textContent='Geocoding and collecting location intelligence…';
 try{
  const g=(await new google.maps.Geocoder().geocode({address:a})).results[0],ll=g.geometry.location,lat=ll.lat(),lng=ll.lng();
  const comp=t=>(g.address_components.find(c=>c.types.includes(t))||{}).long_name;
  L={address:g.formatted_address,lat,lng,location_type:g.geometry.location_type,street:[comp('street_number'),comp('route')].filter(Boolean).join(' '),city:comp('locality')||comp('sublocality')||comp('postal_town'),county:comp('administrative_area_level_2'),st:(g.address_components.find(c=>c.types.includes('administrative_area_level_1'))||{}).short_name,locality:comp('locality')||comp('administrative_area_level_2'),state:comp('administrative_area_level_1'),postal_code:comp('postal_code'),country:comp('country'),images:[]};
  map.setCenter(ll);map.setZoom(19);mk&&mk.setMap(null);mk=new google.maps.Marker({map,position:ll,animation:google.maps.Animation.DROP});
  const tasks=[];
  tasks.push(new google.maps.ElevationService().getElevationForLocations({locations:[ll]}).then(r=>L.elevation_m=Math.round(r.results[0].elevation*10)/10).catch(()=>{}));
  const ps=new google.maps.places.PlacesService(map);L.nearby={};
  for(const t of ['school','hospital','transit_station','supermarket','park','fire_station','police','restaurant'])tasks.push(new Promise(res=>ps.nearbySearch({location:ll,radius:1500,type:t},(r,s)=>{
    if(s==='OK'&&r.length){const n=r.map(p=>({n:p.name,d:hav(lat,lng,p.geometry.location.lat(),p.geometry.location.lng())})).sort((x,y)=>x.d-y.d)[0];L.nearby[t]={count_within_1_5km:r.length,nearest:n.n,nearest_km:+n.d.toFixed(2)}}res()})));
  tasks.push(new google.maps.StreetViewService().getPanorama({location:ll,radius:60,source:'outdoor'}).then(({data})=>{
   L.streetview={date:data.imageDate,pano:data.location.pano};L.heading=google.maps.geometry.spherical.computeHeading(data.location.latLng,ll);
   map.getStreetView().setPosition(data.location.latLng);map.getStreetView().setPov({heading:L.heading,pitch:5})}).catch(()=>L.streetview=null));
  L.inf={};
  const near=(o,k,rad)=>tasks.push(new Promise(res=>ps.nearbySearch({location:ll,radius:rad,...o},(r,st)=>{if(st==='OK')L.inf[k]=r.map(p=>({name:p.name,ft:Math.round(hav(lat,lng,p.geometry.location.lat(),p.geometry.location.lng())*3280.84)})).sort((a,b)=>a.ft-b.ft).slice(0,3);res()})));
  near({type:'airport'},'airport',8000);near({keyword:'railway station'},'rail_station',3000);near({keyword:'landfill waste transfer station recycling center'},'waste',3000);near({keyword:'industrial factory warehouse'},'industrial',1500);near({keyword:'electrical substation power plant'},'power',2000);near({keyword:'gated community'},'gated',800);
  const rd={};tasks.push(Promise.all([250,600].flatMap(d=>[0,45,90,135,180,225,270,315].map(h=>new google.maps.Geocoder().geocode({location:google.maps.geometry.spherical.computeOffset(ll,d,h)}).then(x=>{const r=x.results.find(q=>q.types.includes('route'));if(r){const n=r.address_components[0].long_name;rd[n]=Math.min(rd[n]||1e9,d)}}).catch(()=>{})))).then(()=>L.inf.roads_sampled_around_property=Object.entries(rd).map(([name,m])=>({name,found_within_ft:Math.round(m*3.281)}))));
  await Promise.all(tasks);
  const sm=(z,t)=>`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${z}&size=640x420&maptype=${t}${t==='satellite'?'&format=jpg':''}&markers=color:red%7C${lat},${lng}&key=${K.g}`;MAPIMG={};
  for(const [k,z,t,lb] of [['sat',18,'satellite','Google satellite view centred on the property (red pin)'],['road',16,'roadmap','Google road map around the property (shows highways, rail lines, water, land use)']])try{const m=await b64(sm(z,t));MAPIMG[k]=m;L.images.push({label:lb,...m})}catch{}
  if(L.streetview)try{const h=L.heading;for(const o of [-35,0,35])L.images.push({label:`Google Street View, heading ${Math.round(h+o)}°, captured ${L.streetview.date}`,...await b64(`https://maps.googleapis.com/maps/api/streetview?size=640x420&pano=${L.streetview.pano}&heading=${h+o}&pitch=8&fov=80&key=${K.g}`)})}catch{}
  const N=L.nearby,nm={school:'Schools',hospital:'Hospitals',transit_station:'Transit',supermarket:'Supermarkets',park:'Parks',fire_station:'Fire stn',police:'Police',restaurant:'Restaurants'};
  $('#geo').innerHTML=[`<div class="chip"><b>${esc(L.locality)}</b>, ${esc(L.state)} ${esc(L.postal_code||'')}</div>`,L.elevation_m!=null?`<div class="chip">Elev <b>${L.elevation_m} m</b></div>`:'',`<div class="chip">Street View <b>${L.streetview?L.streetview.date:'n/a'}</b></div>`,...Object.entries(N).map(([k,v])=>`<div class="chip">${nm[k]} <b>${v.nearest_km} km</b></div>`)].join('');
  $('#m1').textContent=`Located. ${L.images.length} Google imagery frame(s) will be analysed with your photos.`;step(1);
 }catch(e){L=null;$('#m1').innerHTML='<span class="err">Could not locate that address. '+esc(e.message||'')+'</span>'}
 $('#go').textContent='Locate'}

/* ---------- Photos ---------- */
const drop=$('#drop');drop.onclick=()=>$('#file').click();$('#file').onchange=e=>add(e.target.files);
drop.ondragover=e=>{e.preventDefault();drop.classList.add('on')};drop.ondragleave=()=>drop.classList.remove('on');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('on');add(e.dataTransfer.files)};
async function add(fl){for(const f of fl){if(!f.type.startsWith('image/')||imgs.length>=10)continue;
 const bm=await createImageBitmap(f),s=Math.min(1,1100/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=bm.width*s;c.height=bm.height*s;c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
 imgs.push({name:f.name,url:c.toDataURL('image/jpeg',.76)})}draw()}
function draw(){$('#th').innerHTML=imgs.map((m,i)=>`<div><img src="${m.url}"><b onclick="imgs.splice(${i},1);draw()">×</b></div>`).join('');step(2,Math.min(100,imgs.length*25))}

/* ---------- AI analysis ---------- */
const YN=['Yes','No','Unknown'],RATE=['Excellent','Good','Average','Fair','Poor'],LOCS=['Urban','Suburban','Rural','Unknown'],USES=['Single Family - 1 Unit','Multi Family - 2-4 Units','Townhouse','Condominium','Manufactured / Mobile','Vacant Land','Commercial','Unknown'];
const PL=['FRONT','REAR','STREET','ADDRESS VERIFICATION','DWELLING LEFT VIEW','DWELLING RIGHT VIEW','STREET SIGN','GARAGE','OTHER'];
const PI=[['property_location','Property Location',LOCS],['for_sale_sign','For Sale Sign Posted',YN],['property_use','Property Use',USES],['garage','Garage',YN],['conforms','Conforms to Neighborhood',YN],['under_construction','Dwelling Under Construction',YN],['able_to_view','Able to View Property',YN],['repairs_required','Repairs Required',YN]];
const INF=[['high_tension_wires','High Tension Electric Wires'],['highway','Interstate/Freeway/Highway'],['vacant_homes','Vacant Homes in Area'],['airport','Private or Public Airport'],['railroad','Railroad Tracks'],['commercial','Commercial/Industrial'],['gated','Private Gated Community'],['waste','Waste Management']];
const SYS=`You are a property data collector completing an EXTERIOR property condition report from the street, like a lender drive-by inspection. Use only: the numbered uploaded photos, the Google satellite / road map / Street View images, and the Google Maps data JSON.
Rules: 1) Never guess. No evidence -> value "Unknown", c<=0.2. 2) Every answer needs evidence in "e" naming its source ("Photo 3 shows...", "Satellite: ...", "Google Places: airport 4,200 ft"). 3) The "inf" lists in the Maps data are unverified keyword hints; confirm with imagery or distance before answering Yes, and never infer a hazard from a business name alone. 4) Highway = Yes only for a major/limited-access road visible on the road map or clearly named in the road candidates; give approximate distance in feet. 5) Property Location (Urban/Suburban/Rural) from amenity counts and imagery. 6) High tension wires means transmission towers or large overhead transmission lines, not ordinary street poles. 7) Railroad Tracks needs visible tracks in imagery. 8) Repairs Required = Yes only for visible exterior damage; then describe it. 9) Condition rating (Excellent/Good/Average/Fair/Poor) is exterior-only; justify it in general_comments. 10) Compare the house number seen in address-verification photos / Street View with the subject address; add a warning on mismatch. 11) c is 0-1 evidence quality, max 0.9. 12) Output ONLY valid JSON.`;
async function analyse(){
 await cfgReady;if(!K.a&&!K.srv)return $('#set').showModal();if(!imgs.length&&!(L&&L.images.length))return $('#m3').innerHTML='<span class="err">Add photos or locate an address first.</span>';
 const B=$('#run');B.disabled=1;B.innerHTML='<span class="spin"></span>Analysing…';$('#m3').textContent='Gemini is reading every photo and cross-checking with Google data…';
 const c=[];imgs.forEach((m,i)=>c.push({type:'text',text:`Photo ${i+1} (${m.name}):`},{type:'image',source:{media_type:'image/jpeg',data:m.url.split(',')[1]}}));
 (L?.images||[]).forEach(m=>c.push({type:'text',text:m.label+':'},{type:'image',source:{media_type:m.type,data:m.data}}));
 const loc=L?{...L}:null;if(loc)delete loc.images;
 const fl=a=>a.map(x=>x[0]).join(', ');
 c.push({type:'text',text:`GOOGLE MAPS DATA: ${JSON.stringify(loc||'none')}\nUSER NOTES: ${$('#note').value||'none'}\nUPLOADED PHOTO COUNT: ${imgs.length}\n\nReturn JSON exactly like: {"property_info":{KEY:{"v":"","c":0.0,"e":""}},"influences":{KEY:{"v":"Yes|No|Unknown","c":0.0,"e":""}},"repairs_explanation":"","negative_explanation":"one line per Yes influence, format 'Interstate/Freeway/Highway: Within 1000ft.'","positive_factors":"","general_comments":"","condition_rating":{"v":"Excellent|Good|Average|Fair|Poor","c":0.0,"e":""},"photo_labels":["one label per uploaded photo in order, from: ${PL.join(' | ')}"],"warnings":[""]}\nproperty_info KEYS (values: Yes/No/Unknown, except property_location: ${LOCS.join('/')}; property_use: ${USES.join('/')}): ${fl(PI)}\ninfluences KEYS: ${fl(INF)}`});
 try{
  const parts=c.map(x=>x.type==='text'?{text:x.text}:{inlineData:{mimeType:x.source.media_type,data:x.source.data}});
  const body=JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:16000}});
  if(K.srv&&body.length>4.3e6)throw new Error('Photos are too large to send. Remove a few photos and retry.');
  const r=await(K.srv?fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body}):fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(K.m)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':K.a},body}));
  const d=await r.json().catch(()=>({error:{message:'Server error '+r.status+(r.status===413?' (photos too large)':'')}}));if(!r.ok)throw new Error(r.status===429?'Free-tier rate limit hit. Wait a minute and retry, or use fewer photos.':(d.error?.message||r.status));
  const t=d.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');if(!t)throw new Error(d.promptFeedback?.blockReason?'Blocked by safety filter: '+d.promptFeedback.blockReason:'Empty response from Gemini');
  show(JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1)),loc);step(3);$('#m3').textContent='Done. Amber fields have low confidence: verify them, then export or print.';
 }catch(e){$('#m3').innerHTML='<span class="err">Analysis failed: '+esc(e.message)+'</span>'}
 B.disabled=0;B.textContent='Re-run AI analysis'}

function show(o,loc){OUT={loc,warn:o.warnings||[]};const pi=o.property_info||{},inf=o.influences||{},g=k=>localStorage['pl_'+k]||'',L0=loc||{};
 const sel=(k,f,o2)=>{f=f||{};const v=f.v||'Unknown',op=o2.includes(v)?o2:[...o2,v],cf=Math.round((f.c||0)*100);return `<select data-k="${k}" class="${cf<60?'lo':''}">${op.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('')}</select><em class="cf" title="${esc(f.e||'No evidence given')}">${cf}%</em>`};
 const ip=(k,v='',ph='')=>`<input data-k="${k}" value="${esc(v)}" placeholder="${ph}" ${k.startsWith('dc_')?`onchange="localStorage['pl_${k}']=this.value"`:''}>`;
 const ta=(k,v)=>`<textarea data-k="${k}">${esc(v||'')}</textarea>`;
 const row=(a,b)=>`<tr><th>${a[0]}</th><td>${a[1]}</td>${b?`<th>${b[0]}</th><td>${b[1]}</td>`:'<th></th><td></td>'}</tr>`;
 const pairs=a=>{let r='';for(let i=0;i<a.length;i+=2)r+=row(a[i],a[i+1]);return r};
 const bar=t=>`<tr><th class="bar" colspan="4">${t}</th></tr>`,full=(t,h)=>`<tr><th colspan="4" class="lab">${t}</th></tr><tr><td colspan="4" class="full">${h}</td></tr>`;
 const date=new Date().toLocaleDateString('en-US'),no=String(10000000+Math.floor(Math.random()*9e6));
 const photos=imgs.map((m,i)=>{const lb=String((o.photo_labels||[])[i]||'OTHER').toUpperCase(),op=PL.includes(lb)?PL:[...PL,lb];return `<div class="ph1" data-n="${esc(m.name)}"><select>${op.map(x=>`<option${x===lb?' selected':''}>${esc(x)}</option>`).join('')}</select><img src="${m.url}"></div>`}).join('');
 const mi=k=>MAPIMG[k]?`<img src="data:${MAPIMG[k].type};base64,${MAPIMG[k].data}">`:'<div class="ev" style="padding:20px">Locate an address to include this image.</div>';
 $('#wb').innerHTML=(OUT.warn.length?`<div class="card" style="border-color:var(--gold)">⚠ ${OUT.warn.map(esc).join(' · ')}</div>`:'')+'<div class="msg">Amber fields have under 60% confidence. Hover the percentage to see the AI\'s evidence. Everything is editable.</div>';
 $('#paper').innerHTML=`<div class="phd"><div class="lg">PropertyLens</div><div class="pt"><b>Property Condition Report</b><br>${esc(L0.address||'')}<br>Inspection Date: ${date}</div><div class="pr">REPORT NO: <input data-k="report_no" value="${no}"><div class="rate">Condition Rating<br>${sel('condition_rating',o.condition_rating,RATE)}</div></div></div>
<table class="rt">${bar('SUBJECT PROPERTY')}${pairs([['Property Address',ip('address',L0.street)],['City',ip('city',L0.city)],['State',ip('state',L0.st)],['Zip',ip('zip',L0.postal_code)],['County',ip('county',L0.county)],['Inspection Date',ip('inspection_date',date)],['Borrower #1',ip('borrower1')],['Borrower #2',ip('borrower2')]])}
${bar('LENDER')}${pairs([['Lender',ip('lender')],['Branch ID',ip('branch_id')],['Address',ip('lender_address')],['Client Loan ID',ip('loan_id')]])}
${bar('DATA COLLECTOR')}${row(['Company',ip('dc_company',g('dc_company'))],['Name',ip('dc_name',g('dc_name'))])}
${bar('PROPERTY INFORMATION')}${pairs(PI.map(([k,l,op])=>[l,sel('pi_'+k,pi[k],op)]))}${full('If repairs are required, please explain',ta('repairs_explanation',o.repairs_explanation))}
${bar('NEIGHBORHOOD INFLUENCES')}${pairs(INF.map(([k,l])=>[l,sel('inf_'+k,inf[k],YN)]))}
${full('Explanation of Negative Influence/Repairs',ta('negative_explanation',o.negative_explanation))}${full('Positive Location Factors:',ta('positive_factors',o.positive_factors))}${full('General Comments:',ta('general_comments',o.general_comments))}</table>
<div class="bar2">DATA COLLECTION PHOTOS</div><div class="pg">${photos||'<div class="ev">No photos uploaded.</div>'}</div>
<div class="bar2">SATELLITE IMAGE &amp; LOCATION MAP (Google)</div><div class="mp">${mi('sat')}${mi('road')}</div>
<p class="disc">This is an exterior property condition report prepared from photographs and Google Maps data. It makes no claims about interior condition or features not visible from the street. AI-generated entries are drafts and must be verified by the data collector before use. If used by an appraiser, statements of opinion should not be incorporated into the appraisal; the appraiser must make an independent evaluation consistent with USPAP.</p>`;
 $('#report').style.display='block';$('#report').scrollIntoView({behavior:'smooth'})}
function exp(){const d={};document.querySelectorAll('#paper [data-k]').forEach(e=>d[e.dataset.k]=e.value);d.photos=[...document.querySelectorAll('#paper .ph1')].map(e=>({file:e.dataset.n,label:e.querySelector('select').value}));d.google_data=OUT.loc;d.warnings=OUT.warn;
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='property-condition-report.json';a.click()}

/* ---------- Landing page effects ---------- */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));
const co=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target,n=+el.dataset.n;let k=0;const t=setInterval(()=>{k+=Math.ceil(n/40);if(k>=n){k=n;clearInterval(t)}el.textContent=k.toLocaleString()+(el.dataset.s||'')},30);co.unobserve(el)}),{threshold:.6});
document.querySelectorAll('[data-n]').forEach(el=>co.observe(el));
addEventListener('scroll',()=>$('#nav').classList.toggle('sc',scrollY>10));
