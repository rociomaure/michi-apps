import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.80.0/+esm";
import { createDemoDB } from "./demo.js";
import { createRealDB, parseInvite, keyFor, rememberKey } from "./data.js";

/* ================= utilidades ================= */
const ICON_GROUPS = [
  ["Comida", ["🍙","🍜","🍣","🍕","🍔","🌮","🥗","🍰","🧋","☕","🍷","🍺"]],
  ["Casa y súper", ["🛒","🏠","💡","💧","🔥","🧺","🧹","🧻","🛋️","🪑","🛏️","🪴"]],
  ["Viaje y panoramas", ["✈️","🧳","🏨","⛺","🏔️","🏖️","🎟️","🗺️","🚐","🛶","🍖","🎉"]],
  ["Transporte", ["🚗","🚕","🚌","🚇","⛽","🅿️","🛵","🚲","🚘","🔧","🛣️","⛴️"]],
  ["Tecnología y suscripciones", ["📱","💻","📶","📺","🎵","🎧","🎮","🤖","☁️","🖨️","⌚","📷"]],
  ["Salud y belleza", ["💊","🩺","🦷","👓","💄","💅","💇‍♀️","🏋️‍♀️","🧴","🩹","🧘‍♀️","🌸"]],
  ["Mascotas", ["🐾","🐈","🐟","🦴","🐕","🐦"]],
  ["Otros", ["💳","🏦","🧾","📦","🛠️","🎓","👶","🎁","🌿","🧸","💐","✨"]]
];
const ICONS = ICON_GROUPS.flatMap(g=>g[1]);
const GROUP_ICONS = ["🧳","🏔️","🏖️","🏠","🎉","🍖","⛺","🚐","🎓","⚽","🎤","🐾"];
const GOAL_ICONS = ["✈️","🏖️","🏠","🎁","🎮","🐾","🚗","🍣","✨","🎉","🏔️","💻"];
const REACS = ["❤️","😻","😹","🙀","👍"];
const COLORS = ["var(--pink)","var(--mint)","var(--lav)","var(--peach)"];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clp = n => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Math.round(n||0));
export const ym = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
export const today = () => { const d=new Date(); return ym(d)+"-"+String(d.getDate()).padStart(2,"0"); };
export function addM(m,k){let [y,mo]=m.split("-").map(Number);mo+=k;y+=Math.floor((mo-1)/12);mo=((mo-1)%12+12)%12+1;return y+"-"+String(mo).padStart(2,"0")}
export function mDiff(a,b){const [y1,m1]=a.split("-").map(Number),[y2,m2]=b.split("-").map(Number);return (y2-y1)*12+(m2-m1)}
export function dayIn(m,d){const [y,mo]=m.split("-").map(Number);const last=new Date(y,mo,0).getDate();return m+"-"+String(Math.min(d,last)).padStart(2,"0")}
const monthName = m => {const [y,mo]=m.split("-").map(Number);return new Date(y,mo-1,1).toLocaleDateString("es-CL",{month:"long",year:"numeric"})};
const monthShort = m => {const [y,mo]=m.split("-").map(Number);return new Date(y,mo-1,1).toLocaleDateString("es-CL",{month:"short"}).replace(".","")};
const fdate = s => {const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("es-CL",{day:"numeric",month:"short"})};
const daysUntil = s => {const [y,m,d]=s.split("-").map(Number);const a=new Date(y,m-1,d),t=new Date();t.setHours(0,0,0,0);return Math.round((a-t)/864e5)};
const digits = v => String(v||"").replace(/\D/g,"");
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

/* ================= estado ================= */
const S = {
  tab:"inicio", month: ym(new Date()), q:"",
  user:null, grupo:null, yo:"a", mis:[], miembros:[],
  gastos:[], reglas:[], pagos:[], metas:[], cierres:[], urls:{}, gview:"pend",
  online:navigator.onLine, view:"loading", email:""
};
const members = () => S.grupo?.integrantes || [];
const nm = k => members().find(m=>m.k===k)?.n || "Alguien";
const nmv = k => k===S.yo ? "Tú" : nm(k);
const conApp = k => S.miembros.some(m=>m.k===k);

/* ================= cómo se reparte cada gasto ================= */
export function shares(g, ints){ // {k: monto que le toca}
  const all = (ints||members()).map(m=>m.k);
  const w = g.reparto && Object.keys(g.reparto).length ? g.reparto : Object.fromEntries(all.map(k=>[k,1]));
  const ks = Object.keys(w).filter(k=>+w[k]>0), tot = ks.reduce((s,k)=>s+ +w[k],0) || 1, out={};
  ks.forEach(k=>out[k]=g.monto*(+w[k])/tot);
  return out;
}
const isEqual = g => { const w=g.reparto; if(!w) return true; const v=Object.values(w).filter(x=>+x>0); return v.every(x=>+x===+v[0]); };
function splitTxt(g){
  const sh=shares(g), ks=Object.keys(sh), n=members().length;
  if(isEqual(g)) return ks.length===n ? `÷ ${n} · todas` : `÷ ${ks.length} · ${ks.map(nmv).join(", ")}`;
  return "Montos distintos";
}
// Saldos: >0 le deben, <0 debe. Y la forma más corta de quedar a mano.
export function settle(net){
  const cr=[], db=[];
  for(const [k,v] of Object.entries(net)){ const r=Math.round(v); if(r>=1) cr.push([k,r]); else if(r<=-1) db.push([k,-r]); }
  cr.sort((a,b)=>b[1]-a[1]); db.sort((a,b)=>b[1]-a[1]);
  const out=[]; let i=0,j=0;
  while(i<db.length && j<cr.length){
    const x=Math.min(db[i][1],cr[j][1]);
    if(x>=1) out.push({de:db[i][0], para:cr[j][0], monto:x});
    db[i][1]-=x; cr[j][1]-=x;
    if(db[i][1]<1) i++; if(cr[j][1]<1) j++;
  }
  return out;
}
export function summarize(movs, pagos, ints){
  const r={paid:{}, share:{}, net:{}, total:0, abono:0};
  const add=(o,k,v)=>{o[k]=(o[k]||0)+v};
  for(const m of (ints||members())){ r.paid[m.k]=0; r.share[m.k]=0; r.net[m.k]=0; }
  for(const g of movs){
    add(r.paid,g.paga,g.monto); add(r.net,g.paga,g.monto); r.total+=g.monto;
    for(const [k,v] of Object.entries(shares(g,ints))){ add(r.share,k,v); add(r.net,k,-v); }
  }
  for(const p of pagos){ add(r.net,p.de,p.monto); add(r.net,p.para,-p.monto); r.abono+=p.monto; }
  r.transfers=settle(r.net);
  return r;
}

/* ================= motor de fijos y cuotas ================= */
export function occurrences(r, upTo){
  const out=[]; if(!r.inicio) return out;
  const n = r.tipo==="cuotas" ? Math.max(1, r.cuotas|0) : Infinity;
  for(let i=0;i<n && i<600;i++){
    const m=addM(r.inicio,i);
    if(r.tipo==="mensual" && r.fin && mDiff(r.fin,m)>0) break;
    const f=dayIn(m, r.dia||1);
    if(f>upTo) break;
    out.push({i,m,fecha:f});
  }
  return out;
}
const fromRule = (r,o) => ({id:r.id+"#"+o.i, regla:r.id, descr:r.descr, monto:r.monto, paga:r.paga, reparto:r.reparto, icono:r.icono, fecha:o.fecha,
  foto:r.foto, nota:r.nota, reac:r.reac, extra: r.tipo==="cuotas" ? `Cuota ${o.i+1}/${r.cuotas}` : "Mensual"});
function allMovs(upTo){
  const list = S.gastos.filter(g=>g.fecha<=upTo).map(g=>({...g}));
  for(const r of S.reglas) for(const o of occurrences(r,upTo)) list.push(fromRule(r,o));
  return list;
}
function monthMovs(m){ return allMovs(dayIn(m,31)).filter(g=>g.fecha.startsWith(m)).sort((x,y)=>y.fecha.localeCompare(x.fecha)); }

/* ================= períodos (liquidaciones) ================= */
const ts = v => v ? new Date(v).getTime() : 0;
export const sortedCierres = c => [...(c||[])].sort((a,b)=>ts(a.creado)-ts(b.creado));
export function after(item, c){
  if(!c) return true;
  if(item.regla) return item.fecha > c.corte;
  return ts(item.creado) > ts(c.creado) || (!!item.fecha && item.fecha > c.corte);
}
export function periodData(gastos, reglas, pagos, cierres, k, upTo){
  const cs = sortedCierres(cierres);
  const prev = k===-1 ? cs[cs.length-1] : cs[k-1];
  const cur = k===-1 ? null : cs[k];
  const lim = cur ? (cur.corte > upTo ? cur.corte : upTo) : upTo;
  const inP = it => after(it,prev) && (cur ? !after(it,cur) : it.fecha<=upTo);
  const movs = gastos.filter(inP).map(g=>({...g}));
  for(const r of reglas) for(const o of occurrences(r, cur?cur.corte:lim)){ const it=fromRule(r,o); if(inP(it)) movs.push(it); }
  movs.sort((x,y)=>y.fecha.localeCompare(x.fecha) || ts(y.creado)-ts(x.creado));
  return {movs, pagos: pagos.filter(inP).sort((x,y)=>ts(y.creado)-ts(x.creado)), prev, cur};
}
const pending = () => periodData(S.gastos,S.reglas,S.pagos,S.cierres,-1,today());
const endOfMonth = () => dayIn(ym(new Date()),31);
const pendingMonth = () => periodData(S.gastos,S.reglas,S.pagos,S.cierres,-1,endOfMonth());
const lastCierre = () => { const c=sortedCierres(S.cierres); return c[c.length-1]; };

/* ================= gatito café ================= */
function cat(mood="happy",size=96,acc="var(--pink)"){
  const fur="#a8714a", furL="#c99470", stripe="#7a4c2e", line="#3b2618", muzzle="#f6e3cf";
  const eyes = mood==="sleep"
    ? `<path d="M37 55 q6 5 12 0" stroke="${line}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M63 55 q6 5 12 0" stroke="${line}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood==="happy"
    ? `<path d="M37 56 q6 -7 12 0" stroke="${line}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M63 56 q6 -7 12 0" stroke="${line}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="43" cy="54" rx="8" ry="8.5" fill="#9fd36e"/><ellipse cx="69" cy="54" rx="8" ry="8.5" fill="#9fd36e"/>
       <ellipse cx="44" cy="55" rx="4.6" ry="6" fill="#1d140e"/><ellipse cx="70" cy="55" rx="4.6" ry="6" fill="#1d140e"/>
       <circle cx="46.5" cy="51.5" r="2.4" fill="#fff"/><circle cx="72.5" cy="51.5" r="2.4" fill="#fff"/><circle cx="42" cy="58" r="1.1" fill="#fff"/><circle cx="68" cy="58" r="1.1" fill="#fff"/>`;
  return `<svg viewBox="0 0 112 112" width="${size}" height="${size}" aria-hidden="true">
    <path d="M86 92 q22 -2 18 -24 q-2 -8 -8 -6" stroke="${fur}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M100 76 l6 -2 M101 84 l6 1" stroke="${stripe}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="56" cy="88" rx="38" ry="22" fill="${fur}"/>
    <ellipse cx="56" cy="92" rx="18" ry="13" fill="${muzzle}"/>
    <ellipse cx="40" cy="104" rx="10" ry="6" fill="${muzzle}"/><ellipse cx="72" cy="104" rx="10" ry="6" fill="${muzzle}"/>
    <path d="M20 40 Q18 10 30 12 Q38 16 46 28 Z" fill="${fur}"/><path d="M92 40 Q94 10 82 12 Q74 16 66 28 Z" fill="${fur}"/>
    <path d="M26 33 Q26 20 31 20 Q35 23 39 29Z" fill="${acc}" opacity=".9"/><path d="M86 33 Q86 20 81 20 Q77 23 73 29Z" fill="${acc}" opacity=".9"/>
    <ellipse cx="56" cy="56" rx="42" ry="34" fill="${fur}"/>
    <path d="M45 24 q3 6 0 11 M56 22 q3 7 0 13 M67 24 q3 6 0 11" stroke="${stripe}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M15 52 q7 1 10 4 M16 46 q7 0 10 3 M97 52 q-7 1 -10 4 M96 46 q-7 0 -10 3" stroke="${stripe}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="56" cy="68" rx="15" ry="10" fill="${muzzle}"/>
    ${eyes}
    <ellipse cx="31" cy="66" rx="7" ry="4" fill="var(--blush)" opacity=".8"/><ellipse cx="81" cy="66" rx="7" ry="4" fill="var(--blush)" opacity=".8"/>
    <path d="M53 63 h6 l-3 3.5 z" fill="#e88aa8"/>
    <path d="M56 66.5 q-3.5 5 -7 1.5 M56 66.5 q3.5 5 7 1.5" stroke="${line}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M12 62 l14 1 M13 70 l13 -3 M100 62 l-14 1 M99 70 l-13 -3" stroke="#6b4a33" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M40 86 q16 9 32 0" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="56" cy="93" r="4.5" fill="#ffd36e" stroke="#2a3a33" stroke-width="1.4"/>
  </svg>`;
}

/* ================= datos ================= */
const lsSet = (k,v) => { try{ localStorage.setItem(k,v) }catch(_){} };
const lsGet = k => { try{ return localStorage.getItem(k) }catch(_){ return null } };
const FILE_CFG = window.MICHI_CONFIG || {};
const live = !!FILE_CFG.SUPABASE_URL && !FILE_CFG.SUPABASE_URL.includes("TU-PROYECTO");
const DEMO = !live || new URLSearchParams(location.search).has("demo");
const DB = DEMO ? createDemoDB() : createRealDB(createClient(FILE_CFG.SUPABASE_URL, FILE_CFG.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}));
const appURL = () => location.origin+location.pathname;
const inviteLink = () => appURL()+"#g="+S.grupo.codigo+"."+keyFor(S.grupo.id);
let INVITE = parseInvite(location.hash);
if(INVITE) history.replaceState(null,"",location.pathname+location.search);
const cacheKey = () => "michiteam:"+S.grupo?.id;
function saveCache(){ try{ localStorage.setItem(cacheKey(), JSON.stringify({grupo:S.grupo,yo:S.yo,mis:S.mis,miembros:S.miembros,gastos:S.gastos,reglas:S.reglas,pagos:S.pagos,metas:S.metas,cierres:S.cierres})) }catch(_){} }
function loadCache(id){ try{ return JSON.parse(localStorage.getItem("michiteam:"+id)||"null") }catch(_){ return null } }

async function loadData(){ const it=await DB.items(S.grupo.id); Object.assign(S,it); saveCache(); }
async function loadGrupo(){ const {grupo,miembros}=await DB.grupo(S.grupo.id); S.grupo=grupo; S.miembros=miembros; saveCache(); }
async function loadMis(){
  S.mis=(await DB.misGrupos(S.user.id)).map(m=>({id:m.id,k:m.k,codigo:m.codigo,nombre:m.grupo?.nombre||"Grupo sin llave",icono:m.grupo?.icono||"🔒",sinLlave:m.sinLlave}));
}
function subscribe(){ DB.subscribe(S.grupo.id, async()=>{await loadData(); refresh();}, async()=>{await loadGrupo(); refresh();}); }
async function enterGrupo(id){
  const m=S.mis.find(x=>x.id===id); if(!m) return;
  if(m.sinLlave){ S.llave=m; S.view="llave"; return render(); }
  S.yo=m.k; S.grupo={id, codigo:m.codigo, nombre:m.nombre, icono:m.icono, integrantes:[]};
  Object.assign(S,{gastos:[],reglas:[],pagos:[],metas:[],cierres:[],miembros:[]});
  const c=loadCache(id); if(c){ Object.assign(S,{grupo:c.grupo||S.grupo,miembros:c.miembros||[],gastos:c.gastos||[],reglas:c.reglas||[],pagos:c.pagos||[],metas:c.metas||[],cierres:c.cierres||[]}); }
  lsSet("michiteam:last",id);
  S.view="app"; S.tab="inicio"; render();
  try{ await Promise.all([loadGrupo(), loadData()]); }
  catch(e){ if(e.message==="sin-llave"){ m.sinLlave=true; S.llave=m; S.view="llave"; return render(); } }
  subscribe(); refresh();
  if(DEMO) S.push="demo"; else if(!S.push) pushState().then(st=>{S.push=st; refresh();});
}
async function boot(){
  try{ S.user=(await DB.ensureSession()).user; }
  catch(e){ S.view="error"; return render(); }
  if(INVITE){ const inv=INVITE; INVITE=null; return openInvite(inv); }
  await home();
}
async function home(prefer){
  try{ await loadMis(); }
  catch(e){
    const last=lsGet("michiteam:last"), c=last&&loadCache(last);
    if(c){ Object.assign(S,c); S.view="app"; return render(); }
    S.view="error"; return render();
  }
  if(!S.mis.length){ S.view="onboard"; return render(); }
  const ok=S.mis.filter(m=>!m.sinLlave), last=prefer||lsGet("michiteam:last");
  await enterGrupo(S.mis.some(m=>m.id===last) ? last : (ok[0]||S.mis[0]).id);
}
async function openInvite(inv){
  S.view="loading"; render();
  try{
    const v=await DB.ver(inv);
    try{ await loadMis(); }catch(_){}
    if(S.mis.some(m=>m.id===v.id)){ rememberKey(v.id, inv.key); await loadMis(); return enterGrupo(v.id); }
    S.inv={...inv, ...v}; S.soy=null; S.view="join"; render();
  }catch(e){ await home().catch(()=>{}); toast(e.message||"No pude abrir la invitación"); }
}

/* ================= render ================= */
function refresh(){ if(!F && S.view==="app") render(); }
function render(){
  const app = S.view==="app";
  $("#tabs").hidden = !app;
  $("#fab").hidden = !app || S.tab==="ajustes";
  $("#fab").setAttribute("aria-label", S.tab==="metas"?"Nueva meta":"Agregar gasto");
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-current", b.dataset.tab===S.tab?"page":"false"));
  $("#who").innerHTML = app ? `<button class="who-btn" data-act="grupos" aria-label="Cambiar de grupo">${S.online?"":'<span class="offline-dot"></span>'}${esc(S.grupo?.icono||"🧳")} ${esc(S.grupo?.nombre||"")} <span aria-hidden="true">▾</span></button>` : "";
  $("#banner").innerHTML = app && DEMO ? `<div class="banner">🎮 <b>Modo demo</b> con datos de ejemplo. Juega con todo: lo que anotes se guarda solo en este navegador. ${live?`<a href="${esc(appURL())}">Úsala de verdad con tu grupo →</a>`:`<a href="https://github.com/rociomaure/michi-apps/tree/main/michi-cuentas-team" target="_blank" rel="noopener">Cómo usarla de verdad →</a>`}</div>`
    : app && !S.online ? `<div class="banner">Sin internet: puedes mirar, pero los cambios se guardan cuando vuelva la conexión 🐾</div>` : "";
  const v=$("#view");
  if(S.view==="join") v.innerHTML=vJoin();
  else if(S.view==="llave") v.innerHTML=vLlave();
  else if(S.view==="error") v.innerHTML=`<div class="card center">${cat("wow",100)}<h2>No pude conectarme</h2><div class="hint">Revisa tu internet e inténtalo de nuevo.</div><button class="btn pink" data-act="reintentar">Reintentar</button></div>`;
  else if(S.view==="onboard") v.innerHTML=vOnboard();
  else if(S.view==="loading") v.innerHTML=`<div class="card empty">${cat("sleep",70)}Cargando…</div>`;
  else v.innerHTML = {inicio:vInicio,gastos:vGastos,fijos:vFijos,metas:vMetas,ajustes:vAjustes}[S.tab]();
  hydrateImages();
}
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent||"") || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const backBtn = () => S.mis.some(m=>!m.sinLlave) ? `<button class="btn ghost full" data-act="back-app">Volver a mis grupos</button>` : "";
function vJoin(){
  const v=S.inv, ints=v.grupo.integrantes||[], sel=ints.find(m=>m.k===S.soy);
  return `<div class="list" style="gap:16px">
  <div class="card center herobg">${cat("happy",100)}<div class="lbl">Te invitaron a</div><h2>${esc(v.grupo.icono||"🧳")} ${esc(v.grupo.nombre)}</h2><div class="hint">${ints.length} personas en el grupo</div></div>
  <div class="card list"><div class="field"><span class="lab">¿Quién eres?</span>
    <div class="chips">${ints.map(m=>`<button data-soy="${m.k}" aria-pressed="${S.soy===m.k}">${esc(m.n)}${v.conApp.includes(m.k)?" 📱":""}</button>`).join("")}
      ${ints.length<12?`<button data-soy="nuevo" aria-pressed="${S.soy==="nuevo"}">✨ Soy otra persona</button>`:""}</div></div>
    ${S.soy==="nuevo"?`<div class="field"><label for="j-n">¿Cómo te llamo?</label><input class="inp" id="j-n" maxlength="20" placeholder="Tu nombre" autocomplete="given-name"></div>`:""}
    ${sel&&v.conApp.includes(sel.k)?`<div class="hint">📱 ${esc(sel.n)} ya entró desde otro celular. Elígelo solo si eres tú (por ejemplo, si cambiaste de celular).</div>`:""}
    <div id="o-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="unirme" ${S.soy?"":"disabled"}>Entrar al grupo 💚</button></div>
  <div class="hint" style="text-align:center">🔒 Lo del grupo viaja cifrado: solo quienes tienen este link pueden verlo.</div>
  ${backBtn()}</div>`;
}
function vLlave(){
  const m=S.llave||{};
  return `<div class="list" style="gap:16px"><div class="card center">${cat("wow",100)}<h2>Falta la llave de este grupo 🔑</h2>
    <div class="hint">Por seguridad, cada grupo se abre con su link de invitación, y en este celular no está guardado. Pídele el link a alguien del grupo y pégalo aquí.</div></div>
  <form id="f-pegar" class="card list"><div class="field"><label for="o-link">Link de invitación</label><input class="inp" id="o-link" type="url" inputmode="url" autocomplete="off" required placeholder="https://…#g=…"></div>
    <div id="o-err" class="hint" style="color:var(--danger)"></div><button class="btn pink full" type="submit">Abrir el grupo 🔓</button></form>
  ${backBtn()}
  <div id="cf"></div><button class="btn ghost full" data-act="ask-salir-llave" data-k="${esc(m.id||"")}">Quitar este grupo de este celular</button></div>`;
}
let newIcon="🧳";
function vOnboard(){return `<div class="list" style="gap:16px">
  <div class="card center">${cat("happy",100)}<h2>${S.mis.length?"Otro grupo":"Las cuentas del grupo"}</h2>
    <div class="hint">Para viajes, roomies, asados o el regalo de cumpleaños. Una persona crea el grupo y manda el link por WhatsApp.</div></div>
  <form id="f-crear" class="card list"><h2 style="font-size:20px">Crear un grupo</h2>
    <div class="field"><label for="o-gn">Nombre del grupo</label><input class="inp" id="o-gn" maxlength="40" required placeholder="Ej: Viaje a Pucón"></div>
    <div class="field"><span class="lab">Ícono</span><div class="icons">${GROUP_ICONS.map(i=>`<button type="button" data-nico="${i}" aria-pressed="${newIcon===i}" aria-label="${i}">${i}</button>`).join("")}</div></div>
    <div class="field"><label for="o-n1">¿Cómo te llamo?</label><input class="inp" id="o-n1" maxlength="20" required placeholder="Ej: Luna"></div>
    <div class="field"><label for="o-otros">¿Quiénes más? (opcional)</label><input class="inp" id="o-otros" placeholder="Ej: Sol, Amaru, Rayén">
      <div class="hint">Separa los nombres con comas. No hace falta que instalen la app: puedes anotar los gastos por ellas.</div></div>
    <button class="btn pink full" type="submit">Crear grupo 🎉</button></form>
  <form id="f-pegar" class="card list"><h2 style="font-size:20px">¿Te invitaron?</h2>
    <div class="hint">Abre el link que te mandaron por WhatsApp, o pégalo aquí.</div>
    <div class="field"><label for="o-link">Link de invitación</label><input class="inp" id="o-link" type="url" inputmode="url" autocomplete="off" required placeholder="https://…#g=…"></div>
    <button class="btn full" type="submit">Abrir invitación 💚</button></form>
  <div class="hint" style="text-align:center">🔒 Sin registro ni contraseñas. Todo se cifra en tu celular: ni quien hizo la app puede ver sus cuentas.</div>
  ${DEMO?"":`<a class="link" href="?demo=1" style="text-align:center">👀 Primero quiero ver el demo</a>`}
  <div id="o-err" class="hint" style="color:var(--danger);text-align:center"></div>
  ${backBtn()}</div>`}

function itemHTML(g, withDue){
  const sh=shares(g), mine=sh[S.yo];
  const due = withDue ? daysUntil(g.fecha) : null;
  return `<button class="item" data-open="${g.regla?"r:"+g.regla:"g:"+g.id}">
    <span class="ico">${esc(g.icono||"✨")}</span>
    <span class="mid"><span class="t">${esc(g.descr||"Gasto")} ${g.reac?esc(g.reac):""}</span>
      <span class="m">${fdate(g.fecha)} · pagó ${esc(nmv(g.paga))}
        ${g.extra?`<span class="chip ${g.extra==="Mensual"?"mint":"peach"}">${esc(g.extra)}</span>`:""}
        ${due!==null?`<span class="chip ${due<=3?"warn":""}">${due<=0?"hoy":due===1?"mañana":"en "+due+" días"}</span>`:""}
        <span class="chip">${isEqual(g)?"÷ "+Object.keys(sh).length:"⚖️"}</span>
        ${g.foto?`<span class="chip pink">📎</span>`:""}${g.nota?`<span class="chip">💬</span>`:""}${!withDue && S.cierres.length && !after(g,lastCierre())?`<span class="chip mint">✓ liquidado</span>`:""}</span></span>
    <span class="amt">${clp(g.monto)}<small>${mine!==undefined?"tu parte "+clp(mine):"sin ti"}</small></span></button>`;
}
function transferHTML(t, btn){
  const me = t.de===S.yo || t.para===S.yo;
  return `<div class="xfer ${me?"me":""}"><span class="who"><b>${esc(nmv(t.de))}</b> <span aria-hidden="true">→</span><span class="sr"> le paga a </span> <b>${esc(nmv(t.para))}</b></span>
    <b class="m">${clp(t.monto)}</b>${btn?`<button class="btn mini" data-tpay="${t.de}|${t.para}|${t.monto}" aria-label="Marcar como pagado: ${esc(nm(t.de))} a ${esc(nm(t.para))}">✓ Pagado</button>`:""}</div>`;
}
function tableHTML(sum, withNet=true){
  return `<div class="tbl" role="table" aria-label="Resumen por persona">
    <div class="tr th" role="row"><span role="columnheader">Persona</span><span role="columnheader">Pagó</span><span role="columnheader">Le toca</span>${withNet?`<span role="columnheader">Saldo</span>`:""}</div>
    ${members().map(m=>{const n=Math.round(sum.net[m.k]||0);return `<div class="tr ${m.k===S.yo?"me":""}" role="row"><span role="cell">${esc(nmv(m.k))}</span><span role="cell">${clp(sum.paid[m.k])}</span><span role="cell">${clp(sum.share[m.k])}</span>${withNet?`<span role="cell" class="${n>=1?"pos":n<=-1?"neg":""}">${n>=1?"+":n<=-1?"−":""}${clp(Math.abs(n))}</span>`:""}</div>`}).join("")}
  </div>`;
}
function myHead(sum){
  const n=Math.round(sum.net[S.yo]||0);
  if(n>=1) return {lbl:"Te deben", amt:clp(n), mood:"wow"};
  if(n<=-1) return {lbl:"Debes", amt:clp(-n), mood:"wow"};
  return {lbl:sum.transfers.length?"Tú estás a mano":"Este período", amt:sum.transfers.length?"✓":"¡A mano!", mood:"sleep"};
}
function vInicio(){
  const m=ym(new Date()), movs=monthMovs(m), P=pending(), sumHoy=summarize(P.movs,P.pagos);
  const PM=pendingMonth(), sum=summarize(PM.movs,PM.pagos), t=today();
  const fut=PM.movs.filter(g=>g.fecha>t), tot=movs.reduce((s,g)=>s+g.monto,0);
  const since = P.prev ? "desde el "+fdate(P.prev.corte) : "desde el inicio";
  const h=myHead(sum), mine=sum.transfers.filter(x=>x.de===S.yo||x.para===S.yo), others=sum.transfers.length-mine.length;
  const canClose = sum.transfers.length>0 || PM.movs.length>0;
  const pres=S.grupo?.presupuesto, pct=pres?tot/pres*100:0;
  const byI={}; movs.forEach(g=>{byI[g.icono||"✨"]=(byI[g.icono||"✨"]||0)+g.monto});
  const top=Object.entries(byI).sort((x,y)=>y[1]-x[1]).slice(0,4);
  const list=[...fut.sort((x,y)=>x.fecha.localeCompare(y.fecha)).map(g=>itemHTML(g,true)), ...P.movs.map(g=>itemHTML(g))];
  const hoyN=Math.round(sumHoy.net[S.yo]||0), mesN=Math.round(sum.net[S.yo]||0);
  return `<div class="list" style="gap:16px">
  <section class="card list herobg" style="gap:14px">
    <div class="row" style="gap:14px"><div style="flex:0 0 96px">${cat(h.mood,96)}</div><div class="txt" style="min-width:0;display:flex;flex-direction:column;gap:4px">
      <div class="lbl">${h.lbl}</div><div class="big">${h.amt}</div>
      <div class="hint">${h.mood==="sleep"&&!sum.transfers.length?"Nadie le debe a nadie 💚":fut.length?"Mes completo, con los fijos que vienen":"Todo lo anotado en el período"}${fut.length&&hoyN!==mesN?` · hasta hoy: ${clp(Math.abs(hoyN))}`:""}</div></div></div>
    ${mine.length?`<div class="list" style="gap:6px">${mine.map(x=>transferHTML(x)).join("")}</div>`:""}
    ${others>0?`<div class="hint">${others===1?"Falta 1 transferencia":"Faltan "+others+" transferencias"} entre otras personas del grupo.</div>`:""}
    ${canClose?`<div class="two"><button class="btn pink" data-act="liquidar">✅ Liquidar</button><button class="btn" data-act="detalle">👀 Ver detalle</button></div>`:""}
    <button class="btn ghost full" data-act="recordar" style="background:var(--paper)">🔔 Recordarle al grupo</button>
  </section>
  ${(S.push==="off"||S.push==="ios-browser") && !S.pushDismiss ? `<div class="banner row" style="gap:10px;justify-content:space-between">
    <span>🔔 ${S.push==="ios-browser"?"Para recibir recordatorios en iPhone, instala la app (Compartir → Agregar a inicio).":"Activa las notificaciones para recibir los recordatorios del grupo."}</span>
    ${S.push==="off"?`<button class="btn pink" data-act="push-on" style="padding:6px 12px;flex:0 0 auto">Activar</button>`:""}</div>`:""}

  <section class="list"><div class="sec-h"><h2>Cuentas por liquidar</h2><span class="hint">${since}</span></div>
    ${fut.length?`<div class="hint">Incluye ${fut.length===1?"el fijo que viene":"los "+fut.length+" fijos y cuotas que vienen"} este mes (marcados con "en X días").</div>`:""}
    ${list.join("") || `<div class="card empty">${cat("happy",60)}Período nuevo en blanco ✨<br>Toca el + para anotar el primer gasto.</div>`}
    ${P.pagos.length?`<div class="sec-h"><h2 style="font-size:17px">Pagos entre ustedes</h2></div>${P.pagos.map(pagoHTML).join("")}`:""}
  </section>

  ${pres?`<section class="card list" style="gap:8px"><div class="sec-h"><span class="lbl">Presupuesto del mes</span><b class="sub">${clp(tot)} / ${clp(pres)}</b></div>
    <div class="prog ${pct>=100?"over":pct>=80?"warn":""}"><i style="width:${Math.min(100,pct)}%"></i></div>
    <div class="hint">${pct>=100?"Se pasaron del presupuesto 🙀":pct>=80?"Ojo, van en el "+Math.round(pct)+"% 😿":"Quedan "+clp(pres-tot)+" para este mes 😸"}</div></section>`
   :`<section class="stats"><div class="card stat"><div class="lbl">Gastos del mes</div><div class="v">${clp(tot)}</div></div>
     <div class="card stat"><div class="lbl">Tu parte del mes</div><div class="v">${clp(movs.reduce((s,g)=>s+(shares(g)[S.yo]||0),0))}</div></div></section>`}
  ${top.length?`<section class="card list" style="gap:10px"><div class="lbl">En qué se va la plata este mes</div>
    <div class="bar">${top.map(([i,v],k)=>`<i style="width:${tot?v/tot*100:0}%;background:${COLORS[k]}"></i>`).join("")}</div>
    <div class="legend">${top.map(([i,v],k)=>`<span><b style="background:${COLORS[k]}"></b>${esc(i)} ${clp(v)}</span>`).join("")}</div></section>`:""}
  </div>`;
}
function trendHTML(){
  const months=[...Array(6)].map((_,i)=>addM(S.month,i-5));
  const vals=months.map(m=>monthMovs(m).reduce((s,g)=>s+g.monto,0));
  const max=Math.max(1,...vals);
  const k=v=>v>=1e6?(v/1e6).toFixed(1).replace(".0","")+"M":v>=1e3?Math.round(v/1e3)+"k":String(v);
  return `<div class="card"><div class="lbl">Últimos 6 meses</div><div class="trend">${months.map((m,i)=>`<div class="col ${m===S.month?"on":""}"><em>${vals[i]?k(vals[i]):""}</em><div class="b" style="height:${vals[i]/max*70}%"></div><small>${monthShort(m)}</small></div>`).join("")}</div></div>`;
}
function gList(){
  if(S.q.trim()){
    const q=S.q.trim().toLowerCase();
    const res=allMovs(today()).filter(g=>(g.descr||"").toLowerCase().includes(q)||(g.nota||"").toLowerCase().includes(q)||(g.icono||"")===S.q.trim()).sort((x,y)=>y.fecha.localeCompare(x.fecha));
    const tot=res.reduce((s,g)=>s+g.monto,0);
    return `<div class="hint">${res.length} resultado${res.length===1?"":"s"} · ${clp(tot)}</div>${res.slice(0,100).map(g=>itemHTML(g)).join("")||`<div class="card empty">${cat("wow",60)}No encontré nada con eso.</div>`}`;
  }
  const movs=monthMovs(S.month), pagos=S.pagos.filter(p=>p.fecha.startsWith(S.month));
  return movs.map(g=>itemHTML(g)).join("") + (movs.length?"":`<div class="card empty">${cat("sleep",64)}Sin gastos en este mes.</div>`)
    + (pagos.length?`<div class="sec-h"><h2>Pagos entre ustedes</h2></div>${pagos.map(pagoHTML).join("")}`:"");
}
function pagoHTML(p){return `<button class="item" data-open="p:${p.id}"><span class="ico" style="background:var(--mint-2)">💸</span><span class="mid"><span class="t">${esc(nmv(p.de))} → ${esc(nmv(p.para))}</span><span class="m">${fdate(p.fecha)} · pago</span></span><span class="amt">${clp(p.monto)}</span></button>`}
function vGastos(){
  const seg = `<div class="seg" role="group" aria-label="Vista">${[["pend","Sin liquidar"],["hist","Historial"],["mes","Por mes"]].map(([k,l])=>`<button data-gview="${k}" aria-pressed="${S.gview===k}">${l}</button>`).join("")}</div>`;
  if(S.gview==="pend"){
    const P=pendingMonth(), tot=P.movs.reduce((s,g)=>s+g.monto,0), t=today();
    return `<div class="list" style="gap:14px">${seg}
      <div class="stats"><div class="card stat"><div class="lbl">Período actual</div><div class="v" style="font-size:16px">${P.prev?"Desde el "+fdate(P.prev.corte):"Desde el inicio"}</div></div>
        <div class="card stat"><div class="lbl">Total gastado</div><div class="v">${clp(tot)}</div></div></div>
      <div class="list">${P.movs.map(g=>itemHTML(g, g.fecha>t)).join("") || `<div class="card empty">${cat("happy",64)}Período nuevo en blanco ✨<br>Lo liquidado quedó guardado en Historial.</div>`}
      ${P.pagos.length?`<div class="sec-h"><h2>Pagos del período</h2></div>${P.pagos.map(pagoHTML).join("")}`:""}</div>
      ${P.movs.length?`<button class="btn pink full" data-act="liquidar">✅ Liquidar cuentas</button>`:""}
    </div>`;
  }
  if(S.gview==="hist"){
    const cs=sortedCierres(S.cierres);
    return `<div class="list" style="gap:14px">${seg}
      ${cs.length?cs.map((c,i)=>({c,i})).reverse().map(({c,i})=>{const n=(c.detalle||[]).length;return `<button class="goal" data-open="c:${i}">
        <div class="row"><span class="ico" style="background:var(--mint-2)">✅</span><div style="min-width:0;flex:1"><b>Liquidado el ${fdate(c.corte)}</b>
        <div class="hint">${n?n+(n===1?" transferencia":" transferencias"):"Estaban a mano"} · gastos del período ${clp(c.gastos_total)}</div></div><b>›</b></div></button>`}).join("")
      :`<div class="card empty">${cat("sleep",64)}Aún no hay liquidaciones.<br>Cuando liquiden las cuentas, el período queda guardado aquí.</div>`}
    </div>`;
  }
  const movs=monthMovs(S.month), tot=movs.reduce((s,g)=>s+g.monto,0);
  const paid={}; movs.forEach(g=>paid[g.paga]=(paid[g.paga]||0)+g.monto);
  return `<div class="list" style="gap:14px">${seg}
    <input class="inp" id="q" type="search" placeholder="🔎 Buscar gasto (ej: súper, bencina…)" value="${esc(S.q)}" autocomplete="off">
    <div class="month"><button class="round" data-mon="-1" aria-label="Mes anterior">‹</button><b>${monthName(S.month)}</b><button class="round" data-mon="1" aria-label="Mes siguiente">›</button></div>
    ${trendHTML()}
    <div class="card list" style="gap:8px"><div class="sec-h"><span class="lbl">Total del mes</span><b class="big" style="font-size:22px">${clp(tot)}</b></div>
      <div class="pills">${members().map(m=>`<span class="pill">${esc(nmv(m.k))} pagó <b>${clp(paid[m.k]||0)}</b></span>`).join("")}</div></div>
    <div class="list" id="glist">${gList()}</div>
    <button class="btn ghost full" data-act="csv">⬇️ Descargar ${monthName(S.month)} para Excel</button>
  </div>`;
}
function vFijos(){
  const t=today(), act=[], fin=[];
  for(const r of S.reglas){
    const done = r.tipo==="cuotas" ? occurrences(r,t).length>=r.cuotas : (r.fin && mDiff(r.fin,ym(new Date()))>0);
    (done?fin:act).push(r);
  }
  const totMes=act.reduce((s,r)=>s+r.monto,0);
  const share={}; act.forEach(r=>{for(const [k,v] of Object.entries(shares(r))) share[k]=(share[k]||0)+v});
  const card = r => { const occ=occurrences(r,t).length;
    const extra = r.tipo==="cuotas" ? `<span class="chip peach">Cuota ${Math.min(occ,r.cuotas)}/${r.cuotas}</span>` : `<span class="chip mint">Día ${r.dia}</span>`;
    return `<button class="item" data-open="r:${r.id}"><span class="ico">${esc(r.icono||"✨")}</span>
      <span class="mid"><span class="t">${esc(r.descr)} ${r.reac?esc(r.reac):""}</span><span class="m">${extra} paga ${esc(nmv(r.paga))}</span>
        <span class="m"><span class="chip pink">⚖️ ${splitTxt(r)}</span></span></span>
      <span class="amt">${clp(r.monto)}<small>${r.tipo==="cuotas"?"por cuota":"al mes"}</small></span></button>`; };
  return `<div class="list" style="gap:14px">
    <div class="card row" style="background:var(--mint-2);border-color:transparent">${cat("happy",64,"var(--mint)")}<div class="sub">Los fijos y las cuotas (arriendo, internet, la tele en cuotas) se anotan solos cada mes 💤</div></div>
    ${act.length?`<div class="card list" style="gap:10px"><div><div class="lbl">Compromiso mensual total</div><div class="big" style="font-size:24px">${clp(totMes)}</div></div>
      <div class="pills">${members().map(m=>`<span class="pill">${esc(nmv(m.k))} <b>${clp(share[m.k]||0)}</b></span>`).join("")}</div>
      <div class="hint">Lo que le toca a cada una al mes, según cómo se divide cada fijo.</div></div>`:""}
    <div class="sec-h"><h2>Activos</h2></div>
    <div class="list">${act.map(card).join("") || `<div class="card empty">Aún no hay fijos ni cuotas.<br>Toca el + y elige "Mensual" o "En cuotas".</div>`}</div>
    ${fin.length?`<div class="sec-h"><h2>Terminados</h2></div><div class="list" style="opacity:.7">${fin.map(card).join("")}</div>`:""}
  </div>`;
}
function vMetas(){
  return `<div class="list" style="gap:14px">
    <div class="card row" style="background:var(--lav-2);border-color:transparent">${cat("wow",64,"var(--lav)")}<div class="sub">Una alcancía común para lo que quiera el grupo: el próximo viaje, el regalo, la parrilla ✨</div></div>
    ${S.metas.map(g=>{const p=Math.min(100,g.ahorrado/g.objetivo*100);return `<button class="goal" data-open="m:${g.id}">
      <div class="row"><span class="ico">${esc(g.icono||"✨")}</span><div style="min-width:0;flex:1"><b>${esc(g.nombre)}</b><div class="hint">${clp(g.ahorrado)} de ${clp(g.objetivo)}</div></div><b>${Math.round(p)}%</b></div>
      <div class="prog"><i style="width:${p}%"></i></div></button>`}).join("") || `<div class="card empty">Aún no hay metas.<br>Toca el + para crear la primera (ej: viaje al sur ✈️).</div>`}
  </div>`;
}
function usado(k){ return S.gastos.some(g=>g.paga===k||(g.reparto&&+g.reparto[k]>0)) || S.reglas.some(g=>g.paga===k||(g.reparto&&+g.reparto[k]>0)) || S.pagos.some(p=>p.de===k||p.para===k) || conApp(k); }
function vAjustes(){
  const g=S.grupo||{};
  return `<div class="list" style="gap:14px">
    <div class="card list"><h2 style="font-size:20px">El grupo</h2>
      <div class="field"><label for="gn">Nombre</label><input class="inp" id="gn" value="${esc(g.nombre||"")}" maxlength="40"></div>
      <div class="field"><span class="lab">Ícono</span><div class="icons">${GROUP_ICONS.map(i=>`<button type="button" data-gicon="${i}" aria-pressed="${g.icono===i}" aria-label="${i}">${i}</button>`).join("")}</div></div>
      <div class="field"><span class="lab">Integrantes (${members().length})</span>
        <div class="list" style="gap:8px">${members().map(m=>`<div class="row" style="gap:8px">
          <input class="inp" data-int="${m.k}" value="${esc(m.n)}" maxlength="20" aria-label="Nombre de integrante" style="flex:1">
          ${conApp(m.k)?`<span class="chip mint" title="Ya entró a la app">📱${m.k===S.yo?" tú":""}</span>`:usado(m.k)?"":`<button class="round" data-quitar="${m.k}" aria-label="Quitar a ${esc(m.n)}">✕</button>`}</div>`).join("")}</div>
        ${members().length<12?`<div class="row" style="gap:8px"><input class="inp" id="nuevo-int" maxlength="20" placeholder="Agregar a alguien…" style="flex:1"><button class="btn" data-act="add-int">＋</button></div>`:""}
        <div class="hint">📱 = ya entró a la app. A las demás puedes anotarles los gastos tú; si después abren el link de invitación y tocan su nombre, se quedan con sus gastos.</div></div>
      <div class="field"><label for="pres">Presupuesto mensual (opcional)</label><input class="inp" id="pres" inputmode="numeric" value="${g.presupuesto?Number(g.presupuesto).toLocaleString("es-CL"):""}" placeholder="Ej: 500.000"></div>
      <button class="btn pink full" data-act="ajustes">Guardar 🎀</button></div>
    <div class="card list"><h2 style="font-size:20px">Invitar al grupo 💌</h2>
      <div class="hint">Manda este link por WhatsApp. Al abrirlo, cada persona elige su nombre y listo: sin registrarse.</div>
      ${DEMO?`<div class="banner">En el demo los links de invitación no funcionan. ${live?`<a href="${esc(appURL())}">Usa la app de verdad →</a>`:""}</div>`
        :`<div class="two"><button class="btn pink" data-act="copy-link">Copiar link</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent("¡Súmate a "+(g.nombre||"nuestro grupo")+" en Michi Cuentas Team! 🐱 "+inviteLink())}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">WhatsApp</a></div>
      <div class="hint">🔑 Este link es la llave del grupo. Guárdalo (por ejemplo, en tu chat de WhatsApp) por si cambias de celular, y compártelo solo con el grupo.</div>`}</div>
    <div class="card list"><h2 style="font-size:20px">Mis grupos</h2>
      ${S.mis.map(m=>`<button class="item" data-grupo="${m.id}"><span class="ico">${esc(m.icono)}</span><span class="mid"><span class="t">${esc(m.nombre)}</span><span class="m">${m.id===g.id?"Abierto ahora":"Tocar para abrir"}</span></span><span class="amt">${m.id===g.id?"✓":"›"}</span></button>`).join("")}
      <button class="btn full" data-act="nuevo-grupo">＋ Crear o unirme a otro grupo</button></div>
    <div class="card list"><h2 style="font-size:20px">Notificaciones 🔔</h2>
      <div class="hint">${({on:"Activadas en este celular ✅",off:"Desactivadas en este celular",denied:"Bloqueadas: actívalas en los ajustes del celular → Notificaciones → Michi Cuentas Team",unsupported:"Este navegador no permite notificaciones","ios-browser":"En iPhone, primero instala la app (Compartir → Agregar a inicio) y ábrela desde el ícono",demo:"En el demo no se envían notificaciones"})[S.push]||"Revisando…"}</div>
      ${S.push==="off"?`<button class="btn pink full" data-act="push-on">Activar en este celular</button>`:S.push==="on"?`<button class="btn ghost full" data-act="push-off">Desactivar en este celular</button>`:""}
      <div class="hint">Sirven para todos tus grupos. Cada persona las activa en su propio celular.</div></div>
    <div class="card list"><h2 style="font-size:20px">Instalar en el celular</h2>
      <div class="hint">En Chrome toca ⋮ → "Instalar app". En iPhone, Safari → Compartir → "Agregar a inicio". Queda con su ícono de gatito 🐈</div></div>
    <div class="hint" style="text-align:center">🔒 Cifrado de extremo a extremo · sin cuentas ni contraseñas</div>
    <div id="cf"></div>
    <button class="btn ghost full" data-act="ask-salir">Salir de este grupo</button>
    ${DEMO?`<button class="btn ghost full" data-act="reset-demo">Reiniciar el demo</button>`:""}
  </div>`;
}

/* ================= notificaciones ================= */
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function b64ToBytes(b64){ const p="=".repeat((4-b64.length%4)%4); const s=atob((b64+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(s,c=>c.charCodeAt(0)); }
async function pushState(){
  if(!pushSupported()) return isIOS && !isStandalone() ? "ios-browser" : "unsupported";
  if(Notification.permission==="denied") return "denied";
  try{ const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription(); return sub && Notification.permission==="granted" ? "on" : "off"; }catch(_){ return "off"; }
}
async function enablePush(){
  if(DEMO) throw new Error("En el demo las notificaciones no se activan 🙂");
  if(!pushSupported()) throw new Error(isIOS ? "En iPhone primero instala la app (Compartir → Agregar a inicio) y ábrela desde el ícono." : "Este navegador no permite notificaciones.");
  const perm = await Notification.requestPermission();
  if(perm!=="granted") throw new Error("No se dio permiso. Puedes activarlo en los ajustes del celular → Notificaciones.");
  let publicKey; try{ publicKey=await DB.pushKey(); }catch(_){ throw new Error("No pude preparar las notificaciones. Inténtalo de nuevo."); }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToBytes(publicKey)});
  const j = sub.toJSON();
  try{ await DB.savePush(S.user.id, j); }catch(_){ throw new Error("No pude guardar este celular. Inténtalo de nuevo."); }
  S.push="on";
}
async function disablePush(){
  try{ const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
    if(sub){ await DB.deletePush(sub.endpoint); await sub.unsubscribe(); } }catch(_){}
  S.push="off";
}
const REC_PRESETS = ["¡Hay que liquidar las cuentas! 💸","Anoté un gasto nuevo 🧾","Te toca transferir tu parte 🐾","Revisa Michi Cuentas Team 🐱"];
function openRecordar(){
  if(!F || F.kind!=="recordar") F={kind:"recordar", msg:REC_PRESETS[0], para:""};
  const dest = F.para ? nm(F.para) : "todo el grupo";
  if(F.sent){
    openSheet(`<div class="center">${cat("happy",96,"var(--mint)")}<h3>¡Enviado! 🔔</h3>
      <div class="sub">Le llegó a ${esc(dest)} este mensaje:</div></div>
      <div class="note-box" style="font-size:16px">🐾 ${esc(F.msg)}</div>
      <button class="btn pink full" data-act="close">Listo</button>
      <button class="btn ghost full" data-act="rec-otro">Enviar otro</button>`);
    return;
  }
  const otras = members().filter(m=>m.k!==S.yo && conApp(m.k));
  openSheet(`<div class="center">${cat("wow",84)}<h3>Recordarle al grupo</h3><div class="hint">Les llega como notificación a quienes tienen la app 📲</div></div>
    ${otras.length>1?`<div class="field"><span class="lab">¿A quién?</span><div class="chips"><button data-rpara="" aria-pressed="${!F.para}">Todo el grupo</button>${otras.map(m=>`<button data-rpara="${m.k}" aria-pressed="${F.para===m.k}">${esc(m.n)}</button>`).join("")}</div></div>`:""}
    <div class="field"><span class="lab">Mensajes rápidos</span><div class="list" style="gap:8px">${REC_PRESETS.map(p=>{const on=F.msg===p;
      return `<button class="btn full preset ${on?"on":""}" data-preset="${esc(p)}" aria-pressed="${on}"><span>${esc(p)}</span><span class="tick">${on?"✓":""}</span></button>`;}).join("")}</div></div>
    <div class="field"><label for="r-msg">Mensaje que se enviará (puedes editarlo)</label><input class="inp" id="r-msg" maxlength="140" value="${esc(F.msg)}" placeholder="Ej: ¿me transfieren lo de la cabaña? 💚"></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="enviar-rec">🔔 Enviar recordatorio</button>
    <button class="btn ghost full" data-act="close">Cancelar</button>`);
}
async function sendReminder(msg, para){
  if(DEMO) throw new Error("En el modo demo los recordatorios no se envían 🙂 Instala tu propia copia para usarlos.");
  let data; try{ data=await DB.remind(S.grupo.id,{mensaje:msg, para:para||null, titulo:`${S.grupo.icono||"🐾"} ${S.grupo.nombre} · ${nm(S.yo)}`}); }
  catch(_){ throw new Error("No se pudo enviar. Revisa tu conexión e inténtalo otra vez."); }
  if(!data?.personas) throw new Error("Nadie más del grupo ha entrado a la app todavía. Mándales el link de invitación (Ajustes → Invitar al grupo).");
  if(!data?.sent) throw new Error("Todavía no activan las notificaciones en su celular (Ajustes → Notificaciones).");
  return data.sent;
}

/* ================= imágenes privadas ================= */
async function signed(path){
  if(!path) return null; if(S.urls[path]) return S.urls[path];
  const u=await DB.fileURL(S.grupo.id, path); if(u) S.urls[path]=u; return u;
}
function hydrateImages(){
  document.querySelectorAll("img[data-path]").forEach(async img=>{ const u=await signed(img.dataset.path); if(u) img.src=u; });
}
async function compress(file){
  try{
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600/Math.max(bmp.width,bmp.height));
    const c = document.createElement("canvas"); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k);
    c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",0.82));
  }catch(_){ return file; }
}

/* ================= hojas / formularios ================= */
let F=null;
function openSheet(html){ $("#layer").innerHTML=`<div class="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`; hydrateImages(); }
function closeSheet(){ $("#layer").innerHTML=""; F=null; render(); }
function newForm(edit){
  F = edit || {kind:"gasto",tipo:"una",descr:"",monto:"",paga:S.yo,parts:members().map(m=>m.k),modo:"iguales",montos:{},icono:"🍙",fecha:today(),
    dia:new Date().getDate(),cuotas:12,inicio:ym(new Date()),montoModo:"total",foto:null,nota:"",busy:false};
  drawForm();
}
function drawForm(){
  const keep={sheet:$(".sheet")?.scrollTop||0, icons:$(".icon-box")?.scrollTop||0};
  drawFormInner();
  const sh=$(".sheet"), ib=$(".icon-box"); if(sh) sh.scrollTop=keep.sheet; if(ib) ib.scrollTop=keep.icons;
  if(sh && (keep.sheet||keep.icons||document.querySelector(".scrim[data-redraw]"))) sh.style.animation="none";
  $(".scrim")?.setAttribute("data-redraw","1");
}
const baseMonto = f => f.tipo==="cuotas" && f.montoModo==="total" && f.monto ? Math.round(+f.monto/(f.cuotas||1)) : +f.monto||0;
function splitHint(){
  const f=F, n=f.parts.length, m=+f.monto||0;
  if(f.modo==="iguales") return n&&m ? `= ${clp(m/n)} cada una (${n})` : n?"":"Elige al menos a una persona";
  const sum=f.parts.reduce((s,k)=>s+(+f.montos[k]||0),0), diff=m-sum;
  return !m?"Escribe primero el monto total": diff===0?"✓ Cuadra con el total": diff>0?`Faltan ${clp(diff)} por repartir`:`Te pasaste por ${clp(-diff)}`;
}
function drawFormInner(){
  const f=F, isEdit=!!f.id;
  const perCuota = f.tipo==="cuotas" && f.montoModo==="total" && f.monto ? Math.round(+f.monto/(f.cuotas||1)) : null;
  openSheet(`<h3>${isEdit?"Editar":"Nuevo gasto"} ${f.tipo==="una"?"":f.tipo==="mensual"?"mensual":"en cuotas"}</h3>
    ${isEdit?"":`<div class="seg" role="group" aria-label="Tipo">${[["una","Una vez"],["mensual","Mensual"],["cuotas","En cuotas"]].map(([k,l])=>`<button data-tipo="${k}" aria-pressed="${f.tipo===k}">${l}</button>`).join("")}</div>`}
    <div class="field"><label for="f-desc">¿Qué fue?</label><input class="inp" id="f-desc" value="${esc(f.descr)}" placeholder="Ej: Cabaña en Pucón" maxlength="60"></div>
    <div class="field"><label for="f-monto">${f.tipo==="cuotas"?(f.montoModo==="total"?"Monto total":"Valor de cada cuota"):"Monto"}</label>
      <input class="inp money" id="f-monto" inputmode="numeric" value="${f.monto?Number(f.monto).toLocaleString("es-CL"):""}" placeholder="$0"></div>
    ${f.tipo==="cuotas"?`<div class="two"><div class="field"><label for="f-cuotas">N° de cuotas</label><input class="inp" id="f-cuotas" inputmode="numeric" value="${f.cuotas}"></div>
      <div class="field"><span class="lab">El monto es…</span><div class="seg"><button data-mm="total" aria-pressed="${f.montoModo==="total"}">Total</button><button data-mm="cuota" aria-pressed="${f.montoModo==="cuota"}">Cuota</button></div></div></div>
      ${perCuota?`<div class="hint">Serán ${f.cuotas} cuotas de ${clp(perCuota)} 🐾</div>`:""}`:""}
    <div class="field"><span class="lab">¿Quién pagó?</span><div class="chips">${members().map(m=>`<button data-paga="${m.k}" aria-pressed="${f.paga===m.k}">${esc(nmv(m.k))}</button>`).join("")}</div></div>
    <div class="field"><span class="lab">¿Entre quiénes se divide?</span>
      <div class="chips">${members().map(m=>{const on=f.parts.includes(m.k);return `<button data-part="${m.k}" aria-pressed="${on}">${on?"✓ ":""}${esc(nmv(m.k))}</button>`}).join("")}</div>
      <div class="row" style="gap:8px;justify-content:space-between"><button class="link" data-allparts="1">${f.parts.length===members().length?"Quitar a todas":"Elegir a todas"}</button></div>
      <div class="seg"><button data-modo="iguales" aria-pressed="${f.modo==="iguales"}">Partes iguales</button><button data-modo="montos" aria-pressed="${f.modo==="montos"}">Montos distintos</button></div>
      ${f.modo==="montos"?`<div class="list" style="gap:6px">${f.parts.map(k=>`<div class="row" style="gap:8px"><label for="fm-${k}" style="flex:1;font-weight:700">${esc(nmv(k))}</label>
        <input class="inp money" id="fm-${k}" data-fm="${k}" inputmode="numeric" style="max-width:150px" value="${f.montos[k]?Number(f.montos[k]).toLocaleString("es-CL"):""}" placeholder="$0"></div>`).join("")}</div>`:""}
      <div class="hint" id="split-h">${splitHint()}</div></div>
    <div class="field"><span class="lab">Ícono</span>
      <div class="icon-box">${ICON_GROUPS.map(([g,list])=>`<div class="icon-group">${g}</div><div class="icons">${list.map(i=>`<button type="button" data-ico="${i}" aria-pressed="${f.icono===i}" aria-label="${i}">${i}</button>`).join("")}</div>`).join("")}</div>
      <div class="row" style="gap:8px"><span class="hint">¿Otro? Escribe cualquier emoji:</span><input class="inp" id="f-emoji" maxlength="8" style="max-width:76px;text-align:center;font-size:20px;padding:8px" value="${ICONS.includes(f.icono)?"":esc(f.icono||"")}" placeholder="🙂"></div></div>
    ${f.tipo==="una"?`<div class="field"><label for="f-fecha">Fecha</label><input class="inp" type="date" id="f-fecha" value="${f.fecha}"></div>`
     :`<div class="two"><div class="field"><label for="f-ini">${f.tipo==="cuotas"?"Primera cuota":"Desde"}</label><input class="inp" type="month" id="f-ini" value="${f.inicio}" ${isEdit?"disabled":""}></div>
       <div class="field"><label for="f-dia">Día del mes</label><input class="inp" id="f-dia" inputmode="numeric" value="${f.dia}"></div></div>`}
    <div class="field"><label for="f-nota">Nota (opcional)</label><input class="inp" id="f-nota" value="${esc(f.nota||"")}" maxlength="140" placeholder="Ej: incluye la leña"></div>
    <div class="field"><span class="lab">Foto de la boleta (opcional)</span><div class="photo">
      ${f.preview?`<img src="${f.preview}" alt="Boleta">`:f.foto?`<img data-path="${esc(f.foto)}" alt="Boleta">`:""}
      <label class="btn ghost" for="f-file" style="display:inline-block">📷 ${f.foto||f.preview?"Cambiar foto":"Sacar o subir foto"}</label>
      <input type="file" id="f-file" accept="image/*" hidden></div></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="save" ${f.busy?"disabled":""}>${f.busy?"Guardando…":"Guardar"} 🐾</button>
    <button class="btn ghost full" data-act="close">Cancelar</button>`);
}
function syncForm(){
  if(!F) return; const g=id=>document.getElementById(id);
  if(g("f-desc")) F.descr=g("f-desc").value;
  if(g("f-monto")) F.monto=digits(g("f-monto").value);
  if(g("f-cuotas")) F.cuotas=Math.max(1,parseInt(g("f-cuotas").value)||1);
  if(g("f-fecha")) F.fecha=g("f-fecha").value||today();
  if(g("f-ini") && !g("f-ini").disabled) F.inicio=g("f-ini").value||ym(new Date());
  if(g("f-dia")) F.dia=Math.min(31,Math.max(1,parseInt(g("f-dia").value)||1));
  if(g("f-nota")) F.nota=g("f-nota").value;
  document.querySelectorAll("[data-fm]").forEach(i=>{F.montos[i.dataset.fm]=digits(i.value)});
}
const friendly = e => !navigator.onLine ? "Sin internet. Inténtalo cuando vuelva la conexión." : (e?.message?.includes("row-level")||e?.code==="42501") ? "No tienes permiso para este grupo." : "No se pudo guardar. Inténtalo de nuevo.";
async function saveForm(){
  syncForm(); const f=F, err=$("#f-err");
  if(!f.monto || +f.monto<=0){err.textContent="Escribe un monto mayor a cero.";return}
  if(!f.parts.length){err.textContent="Elige entre quiénes se divide.";return}
  let reparto;
  if(f.modo==="iguales") reparto=Object.fromEntries(f.parts.map(k=>[k,1]));
  else{
    const sum=f.parts.reduce((s,k)=>s+(+f.montos[k]||0),0);
    if(sum!==+f.monto){err.textContent=splitHint()+". Los montos tienen que sumar "+clp(+f.monto)+".";return}
    reparto=Object.fromEntries(f.parts.filter(k=>+f.montos[k]>0).map(k=>[k,+f.montos[k]]));
  }
  f.busy=true; drawForm();
  try{
    let foto=f.foto||null;
    if(f.file){
      const blob=await compress(f.file);
      foto=await DB.upload(S.grupo.id, blob);
    }
    const base={grupo_id:S.grupo.id, descr:f.descr.trim()||(f.tipo==="una"?"Gasto":"Gasto fijo"), paga:f.paga, reparto, icono:f.icono, foto, nota:f.nota.trim()||null};
    let t, body;
    if(f.tipo==="una"){ t="gastos"; body={...base, monto:+f.monto, fecha:f.fecha}; }
    else { t="reglas"; body={...base, monto: baseMonto(f), tipo:f.tipo, cuotas:f.tipo==="cuotas"?f.cuotas:null, inicio:f.inicio, dia:f.dia}; }
    if(f.id){ const old=S[t].find(r=>r.id===f.id)||{}; await DB.update(S.grupo.id, t, {...old, ...body, id:f.id}); }
    else await DB.insert(S.grupo.id, t, body);
    await loadData();
    F=null; closeSheet(); toast(f.id?"Cambios guardados 🐾":"¡Gasto anotado! 🐱");
  }catch(e){ f.busy=false; drawForm(); $("#f-err").textContent=friendly(e); }
}
function find(key){
  const t=key[0], id=key.slice(2);
  const map={g:["gastos","gasto"],r:["reglas","regla"],p:["pagos","pago"],m:["metas","meta"]}[t];
  return {x:S[map[0]].find(r=>r.id===id), table:map[0], kind:map[1]};
}
function openDetail(key){
  const {x,table,kind}=find(key); if(!x) return;
  if(kind==="pago"){
    openSheet(`<h3>💸 Pago de ${clp(x.monto)}</h3><div class="sub">${esc(nmv(x.de))} → ${esc(nmv(x.para))}, el ${fdate(x.fecha)}.</div>
      <div id="cf"></div><button class="btn ghost full" data-act="askdel" data-k="${table}:${x.id}">Borrar pago</button><button class="btn ghost full" data-act="close">Cerrar</button>`); return;
  }
  if(kind==="meta"){
    const p=Math.min(100,x.ahorrado/x.objetivo*100);
    openSheet(`<div class="row"><span class="ico" style="width:56px;height:56px;font-size:30px">${esc(x.icono||"✨")}</span><div><h3>${esc(x.nombre)}</h3><div class="hint">${clp(x.ahorrado)} de ${clp(x.objetivo)} · faltan ${clp(Math.max(0,x.objetivo-x.ahorrado))}</div></div></div>
      <div class="prog"><i style="width:${p}%"></i></div>
      ${p>=100?`<div class="card center">${cat("happy",80)}<b>¡Lo lograron! 🎉</b></div>`:""}
      <div class="field"><label for="m-ab">Monto</label><input class="inp money" id="m-ab" inputmode="numeric" placeholder="$0"></div>
      <div class="two"><button class="btn pink" data-act="abonar" data-k="${x.id}" data-s="1">Guardar 🐷</button><button class="btn" data-act="abonar" data-k="${x.id}" data-s="-1">Sacar</button></div>
      <div id="f-err" class="hint" style="color:var(--danger)"></div><div id="cf"></div>
      <button class="btn ghost full" data-act="askdel" data-k="metas:${x.id}">Borrar meta</button><button class="btn ghost full" data-act="close">Cerrar</button>`); return;
  }
  const occ = kind==="regla"?occurrences(x,today()).length:0;
  const desc = kind==="regla" ? (x.tipo==="cuotas"?`${x.cuotas} cuotas de ${clp(x.monto)} · van ${Math.min(occ,x.cuotas)} · total ${clp(x.monto*x.cuotas)}`:`${clp(x.monto)} cada mes, el día ${x.dia}${x.fin?` · hasta ${monthName(x.fin)}`:""}`) : `${fdate(x.fecha)} · ${clp(x.monto)}`;
  const sh=shares(x);
  openSheet(`<div class="row"><span class="ico" style="width:56px;height:56px;font-size:30px">${esc(x.icono||"✨")}</span><div style="min-width:0"><h3>${esc(x.descr)}</h3><div class="hint">${desc}</div></div></div>
    <div class="card list" style="gap:8px;padding:12px"><div class="sub">Pagó ${esc(nmv(x.paga))} · ${splitTxt(x)}</div>
      <div class="pills">${Object.entries(sh).map(([k,v])=>`<span class="pill ${k===S.yo?"me":""}">${esc(nmv(k))} <b>${clp(v)}</b></span>`).join("")}</div>
      ${kind==="regla"?`<div class="hint">${x.tipo==="cuotas"?"Por cuota":"Cada mes"}</div>`:""}</div>
    ${x.nota?`<div class="note-box">💬 ${esc(x.nota)}</div>`:""}
    <div class="field"><span class="lab">Reaccionar</span><div class="reacs">${REACS.map(r=>`<button data-reac="${r}" data-k="${table}:${x.id}" aria-pressed="${x.reac===r}">${r}</button>`).join("")}</div></div>
    ${x.foto?`<img class="receipt-big" data-path="${esc(x.foto)}" alt="Foto de la boleta">`:""}
    <div id="cf"></div>
    <button class="btn pink full" data-act="edit" data-k="${key}">Editar</button>
    ${kind==="regla"&&x.tipo==="mensual"&&!x.fin?`<button class="btn ghost full" data-act="stop" data-k="${x.id}">Dejar de cobrarlo desde el próximo mes</button>`:""}
    <button class="btn ghost full" data-act="askdel" data-k="${table}:${x.id}">${kind==="regla"?"Borrar (también sus meses pasados)":"Borrar gasto"}</button>
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function editFrom(key){
  const {x,kind}=find(key);
  const sh=x.reparto&&Object.keys(x.reparto).length?x.reparto:Object.fromEntries(members().map(m=>[m.k,1]));
  const parts=Object.keys(sh).filter(k=>+sh[k]>0), eq=isEqual(x);
  const montos = eq ? {} : Object.fromEntries(Object.entries(shares(x)).map(([k,v])=>[k,String(Math.round(v))]));
  const common={kind,id:x.id,descr:x.descr,monto:String(x.monto),paga:x.paga,parts,modo:eq?"iguales":"montos",montos,icono:x.icono,foto:x.foto,nota:x.nota||""};
  newForm(kind==="gasto"
    ? {...common,tipo:"una",fecha:x.fecha,dia:1,cuotas:1,inicio:ym(new Date()),montoModo:"total"}
    : {...common,tipo:x.tipo,inicio:x.inicio,dia:x.dia,cuotas:x.cuotas||12,montoModo:"cuota",fecha:today()});
}
function openSaldar(pre){
  if(!F || F.kind!=="pago") F={kind:"pago", de:pre?.de||S.yo, para:pre?.para||(members().find(m=>m.k!==S.yo)?.k), monto:pre?.monto||""};
  const sel=(attr,val)=>`<div class="chips">${members().map(m=>`<button data-${attr}="${m.k}" aria-pressed="${val===m.k}">${esc(nmv(m.k))}</button>`).join("")}</div>`;
  openSheet(`<div class="center">${cat("happy",90,"var(--mint)")}<h3>Registrar un pago</h3><div class="hint">Cuando alguien le transfiere a otra persona del grupo.</div></div>
    <div class="field"><span class="lab">¿Quién pagó?</span>${sel("pde",F.de)}</div>
    <div class="field"><span class="lab">¿A quién?</span>${sel("ppara",F.para)}</div>
    <div class="field"><label for="p-monto">Monto (puede ser un abono parcial)</label><input class="inp money" id="p-monto" inputmode="numeric" value="${F.monto?Number(F.monto).toLocaleString("es-CL"):""}" placeholder="$0"></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="pagar">Registrar pago 💸</button><button class="btn ghost full" data-act="close">Cancelar</button>`);
}
function openDetalle(){
  const P=pending(), sumHoy=summarize(P.movs,P.pagos), PM=pendingMonth(), sum=summarize(PM.movs,PM.pagos);
  const fut=PM.movs.filter(g=>g.fecha>today()), h=myHead(sum);
  F={kind:"detalle"};
  openSheet(`<h3>Detalle de las cuentas</h3>
    <section class="card center herobg" style="gap:6px;padding:20px 16px">
      <div class="lbl">${fut.length?"Este mes":"En este período"} · ${esc(cap(h.lbl.toLowerCase()))}</div>
      <div class="big" style="font-size:40px;line-height:1.05">${h.amt}</div>
      <div class="hint">Gastos del ${fut.length?"mes":"período"}: ${clp(sum.total)} · ${P.prev?"desde el "+fdate(P.prev.corte):"desde el inicio"}</div>
      ${fut.length&&Math.round(sumHoy.net[S.yo]||0)!==Math.round(sum.net[S.yo]||0)?`<div class="hint">Incluye ${fut.length===1?"1 fijo que vence":fut.length+" fijos y cuotas que vencen"} más adelante</div>`:""}
    </section>
    <div class="field"><span class="lab">Para quedar a mano</span>
      ${sum.transfers.length?`<div class="list" style="gap:6px">${sum.transfers.map(t=>transferHTML(t)).join("")}</div><div class="hint">Es la forma con menos transferencias posible 🐾</div>`:`<div class="hint">¡Todas están a mano! 💚</div>`}</div>
    <div class="field"><span class="lab">Cómo se calcula</span>${tableHTML(sum)}
      <div class="hint">Saldo = lo que pagó − lo que le toca${sum.abono?" ± los pagos entre ustedes":""}. Positivo: le deben. Negativo: debe.</div></div>
    ${sum.transfers.length||PM.movs.length?`<button class="btn pink full" data-act="liquidar" style="font-size:17px;padding:14px">✅ Liquidar cuentas</button>`:""}
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function openLiquidar(){
  const P=pending(), PM=pendingMonth();
  const fut=PM.movs.filter(g=>g.fecha>today());
  if(!F || F.kind!=="liq") F={kind:"liq", modo: fut.length?"mes":"hoy"};
  const D = F.modo==="mes" ? PM : P, sum=summarize(D.movs,D.pagos), tot=D.movs.reduce((s,g)=>s+g.monto,0);
  Object.assign(F,{transfers:sum.transfers, total:tot, corte:F.modo==="mes"?endOfMonth():today()});
  openSheet(`<div class="center">${cat("happy",90,"var(--mint)")}<h3>Liquidar cuentas</h3></div>
    ${fut.length?`<div class="field"><span class="lab">¿Qué liquidan?</span><div class="seg">
      <button data-liq="mes" aria-pressed="${F.modo==="mes"}">Todo el mes</button><button data-liq="hoy" aria-pressed="${F.modo==="hoy"}">Solo hasta hoy</button></div>
      <div class="hint">${F.modo==="mes"?`Incluye ${fut.length===1?"el fijo que falta":"los "+fut.length+" fijos y cuotas que faltan"} de este mes; no se volverán a cobrar.`:"Los fijos que faltan este mes quedan para la próxima liquidación."}</div></div>`:""}
    <div class="field"><span class="lab">${sum.transfers.length?"Transferencias para quedar a mano":"Estado"}</span>
      ${sum.transfers.length?`<div class="list" style="gap:6px">${sum.transfers.map(t=>transferHTML(t,true)).join("")}</div>
        <div class="hint">Puedes marcar cada una cuando se haga, o liquidar todo de una vez abajo.</div>`
        :`<div class="sub">Todas están a mano 💚 Solo se cierra el período.</div>`}</div>
    <div class="card list" style="gap:6px;padding:12px">
      <div class="hint">Al liquidar:</div>
      ${sum.transfers.length?`<div class="sub">✅ Se registran ${sum.transfers.length===1?"la transferencia":"las "+sum.transfers.length+" transferencias"} y todas quedan en $0</div>`:""}
      <div class="sub">🗂️ Los ${D.movs.length} gastos (${clp(tot)}) quedan guardados en Historial</div>
      <div class="sub">✨ Empieza un período nuevo en blanco</div>
      <div class="sub">🔁 Los fijos y cuotas siguen anotándose solos</div></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="liq-ok">✅ ${sum.transfers.length?"Sí, ya se transfirió todo: liquidar":"Cerrar el período"}</button>
    <button class="btn ghost full" data-act="saldar">Registrar otro pago</button>
    <button class="btn ghost full" data-act="close">Cancelar</button>`);
}
function openCierre(i){
  const cs=sortedCierres(S.cierres), c=cs[i]; if(!c) return;
  const D=periodData(S.gastos,S.reglas,S.pagos,S.cierres,i,today());
  const sum=summarize(D.movs,[]);
  F={kind:"hist", i};
  openSheet(`<h3>Liquidado el ${fdate(c.corte)}</h3>
    <div class="hint">${D.prev?"Período desde el "+fdate(D.prev.corte):"Desde el inicio"} · ${D.movs.length} gastos · ${clp(c.gastos_total)}</div>
    <div class="field"><span class="lab">Quién pagó qué</span>${tableHTML(sum,false)}</div>
    <div class="field"><span class="lab">Pagos del período</span>
      ${D.pagos.length?`<div class="list" style="gap:6px">${D.pagos.slice().reverse().map(p=>transferHTML(p)).join("")}</div>`:`<div class="hint">Estaban a mano.</div>`}</div>
    <div class="list">${D.movs.map(g=>itemHTML(g)).join("")||'<div class="hint">Sin gastos en este período.</div>'}</div>
    <button class="btn ghost full" data-act="csv-c" data-k="${i}">⬇️ Descargar este período para Excel</button>
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function openMeta(){
  F={kind:"meta",icono:"✈️"};
  const draw=()=>openSheet(`<h3>Nueva meta 🐷</h3>
    <div class="field"><label for="g-n">¿Para qué ahorran?</label><input class="inp" id="g-n" maxlength="40" placeholder="Ej: Viaje a San Pedro" value="${esc(F.nombre||"")}"></div>
    <div class="field"><label for="g-o">¿Cuánto necesitan?</label><input class="inp money" id="g-o" inputmode="numeric" placeholder="$0" value="${F.objetivo?Number(F.objetivo).toLocaleString("es-CL"):""}"></div>
    <div class="field"><span class="lab">Ícono</span><div class="icons">${GOAL_ICONS.map(i=>`<button data-gico="${i}" aria-pressed="${F.icono===i}">${i}</button>`).join("")}</div></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="savemeta">Crear meta ✨</button><button class="btn ghost full" data-act="close">Cancelar</button>`);
  F.draw=draw; draw();
}
function openGrupos(){
  F={kind:"grupos"};
  openSheet(`<h3>Mis grupos</h3>
    <div class="list">${S.mis.map(m=>`<button class="item" data-grupo="${m.id}"><span class="ico">${esc(m.icono)}</span><span class="mid"><span class="t">${esc(m.nombre)}</span><span class="m">${m.id===S.grupo?.id?"Abierto ahora":"Tocar para abrir"}</span></span><span class="amt">${m.id===S.grupo?.id?"✓":"›"}</span></button>`).join("")}</div>
    <button class="btn pink full" data-act="nuevo-grupo">＋ Crear o unirme a otro grupo</button>
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function downloadCSV(movsIn, pagosIn, label){
  const movs=(movsIn||monthMovs(S.month)).slice().reverse();
  const pagos=pagosIn||S.pagos.filter(p=>p.fecha.startsWith(S.month));
  const ms=members();
  const rows=[["Fecha","Detalle","Tipo","Monto","Pagó","División",...ms.map(m=>"Le toca a "+m.n),"Nota"]];
  for(const g of movs){ const sh=shares(g); rows.push([g.fecha,g.descr,g.extra||"Una vez",g.monto,nm(g.paga),splitTxt(g).replace(/^÷ /,"entre "),...ms.map(m=>Math.round(sh[m.k]||0)),g.nota||""]); }
  for(const p of pagos) rows.push([p.fecha,`Pago de ${nm(p.de)} a ${nm(p.para)}`,"Pago",p.monto,nm(p.de),"",...ms.map(()=>""),""]);
  const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`michi-team-${label||S.month}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
let tt; function toast(m){clearTimeout(tt);let el=$(".toast");if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=m;tt=setTimeout(()=>el.remove(),2200)}
// "Sol, Amaru y Rayén" → ["Sol","Amaru","Rayén"] (sin repetidos)
export function splitNames(txt){
  const out=[]; for(const n of String(txt||"").split(/,|;|\s+y\s+|\s+e\s+|\s*&\s*|\n/i).map(x=>x.trim()).filter(Boolean)){ if(!out.some(o=>o.toLowerCase()===n.toLowerCase())) out.push(n.slice(0,20)); }
  return out;
}
// Integrantes con los nombres que están escritos en Ajustes aunque aún no se hayan guardado
const editedMembers = () => members().map(m=>({k:m.k, n:(document.querySelector(`[data-int="${m.k}"]`)?.value.trim()||m.n).slice(0,20)}));
async function saveIntegrantes(list){
  await DB.saveGrupo(S.grupo.id, {...S.grupo, integrantes:list});
  await loadGrupo(); await loadMis();
}

/* ================= eventos ================= */
document.addEventListener("submit", async e=>{
  e.preventDefault(); const id=e.target.id;
  const err = $("#o-err");
  try{
    if(id==="f-crear"){
      const yo=$("#o-n1").value.trim()||"Yo";
      const otros=splitNames($("#o-otros").value).filter(n=>n.toLowerCase()!==yo.toLowerCase()).slice(0,11);
      const integrantes=[{k:"a",n:yo.slice(0,20)}, ...otros.map((n,i)=>({k:"bcdefghijkl"[i], n:n.slice(0,20)}))];
      e.target.querySelector("button[type=submit]").disabled=true;
      const gid=await DB.crear({nombre:($("#o-gn").value.trim()||"Nuestro grupo").slice(0,40), icono:newIcon, integrantes, presupuesto:null});
      await home(gid); S.tab="ajustes"; render(); scrollTo(0,0); toast("¡Grupo creado! Ahora invita al grupo 💌");
    }else if(id==="f-pegar"){
      const inv=parseInvite($("#o-link").value);
      if(!inv) throw new Error("Ese no parece un link de invitación de Michi Cuentas Team. Cópialo completo.");
      await openInvite(inv);
    }
  }catch(ex){ if(err) err.textContent = ex.message||"Algo falló, inténtalo otra vez."; e.target.querySelector("button[type=submit]")?.removeAttribute("disabled"); }
});
document.addEventListener("click", async e=>{
  if(e.target.classList.contains("scrim")){closeSheet();return}
  const el=e.target.closest("button"); if(!el) return;
  const d=el.dataset;
  if(d.tab){S.tab=d.tab;S.q="";if(d.tab==="gastos")S.gview="pend";render();scrollTo(0,0);return}
  if(d.mon){S.month=addM(S.month,+d.mon);render();return}
  if(d.gview){S.gview=d.gview;S.q="";render();return}
  if(d.open){ if(d.open.startsWith("c:")) openCierre(+d.open.slice(2)); else openDetail(d.open); return}
  if(d.grupo){ if(F) { $("#layer").innerHTML=""; F=null; } await enterGrupo(d.grupo); scrollTo(0,0); return }
  if(d.soy && S.view==="join"){ S.soy=d.soy; render(); if(d.soy==="nuevo") setTimeout(()=>$("#j-n")?.focus(),30); return }
  if(d.nico){ newIcon=d.nico; document.querySelectorAll("[data-nico]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.nico===newIcon)); return }
  if(d.gicon){ document.querySelectorAll("[data-gicon]").forEach(b=>b.setAttribute("aria-pressed",b===el)); return }
  if(F?.kind==="gasto"){
    if(d.tipo){syncForm();F.tipo=d.tipo;return drawForm()}
    if(d.mm){syncForm();F.montoModo=d.mm;return drawForm()}
    if(d.ico){syncForm();F.icono=d.ico;return drawForm()}
    if(d.paga){syncForm();F.paga=d.paga;return drawForm()}
    if(d.part){syncForm();F.parts=F.parts.includes(d.part)?F.parts.filter(k=>k!==d.part):members().map(m=>m.k).filter(k=>k===d.part||F.parts.includes(k));return drawForm()}
    if(d.allparts){syncForm();F.parts=F.parts.length===members().length?[]:members().map(m=>m.k);return drawForm()}
    if(d.modo){syncForm();F.modo=d.modo;return drawForm()}
  }
  if(F?.kind==="pago"){
    if(d.pde){F.monto=digits($("#p-monto").value);F.de=d.pde;if(F.para===F.de)F.para=members().find(m=>m.k!==F.de)?.k;return openSaldar()}
    if(d.ppara){F.monto=digits($("#p-monto").value);F.para=d.ppara;if(F.para===F.de)F.de=members().find(m=>m.k!==F.para)?.k;return openSaldar()}
  }
  if(d.liq && F?.kind==="liq"){F.modo=d.liq;return openLiquidar()}
  if(d.tpay && F?.kind==="liq"){
    const [de,para,monto]=d.tpay.split("|"); el.disabled=true;
    try{ await DB.insert(S.grupo.id,"pagos",{de,para,monto:+monto,fecha:today()}); }catch(ex){ el.disabled=false; return toast(friendly(ex)); }
    await loadData(); toast(`Listo: ${nm(de)} le pagó a ${nm(para)} 💸`); return openLiquidar();
  }
  if(d.preset!==undefined && F?.kind==="recordar"){ F.msg=d.preset; return openRecordar(); }
  if(d.rpara!==undefined && F?.kind==="recordar"){ F.msg=$("#r-msg").value; F.para=d.rpara; return openRecordar(); }
  if(d.gico && F?.kind==="meta"){F.nombre=$("#g-n").value;F.objetivo=digits($("#g-o").value);F.icono=d.gico;return F.draw()}
  if(d.reac){
    const [t,id]=d.k.split(":"); const x=S[t].find(r=>r.id===id); const val=x.reac===d.reac?null:d.reac;
    try{ await DB.update(S.grupo.id,t,{...x,reac:val}); }catch(ex){ return toast(friendly(ex)); }
    await loadData(); openDetail((t==="gastos"?"g:":"r:")+id); return;
  }
  if(d.quitar){
    if(usado(d.quitar)) return toast("No se puede quitar: ya tiene gastos o pagos anotados.");
    try{ await saveIntegrantes(editedMembers().filter(m=>m.k!==d.quitar)); render(); toast("Listo 🐾"); }catch(ex){ toast(friendly(ex)); }
    return;
  }
  const a=d.act; if(!a) return;
  try{
    if(a==="close") closeSheet();
    else if(a==="save") await saveForm();
    else if(a==="saldar"){ const tr=F?.transfers?.find(t=>t.de===S.yo)||F?.transfers?.[0]; F=null; openSaldar(tr); }
    else if(a==="liquidar"){ F=null; openLiquidar(); }
    else if(a==="detalle") openDetalle();
    else if(a==="recordar") openRecordar();
    else if(a==="grupos") openGrupos();
    else if(a==="nuevo-grupo"){ $("#layer").innerHTML=""; F=null; S.view="onboard"; render(); scrollTo(0,0); }
    else if(a==="back-app"){ S.view="app"; render(); }
    else if(a==="push-on"){ el.disabled=true; try{ await enablePush(); toast("Notificaciones activadas 🔔"); }catch(err){ toast(err.message); } render(); }
    else if(a==="push-off"){ await disablePush(); toast("Notificaciones desactivadas"); render(); }
    else if(a==="enviar-rec"){
      const msg=($("#r-msg").value.trim())||REC_PRESETS[0]; F.msg=msg; el.disabled=true; el.textContent="Enviando…";
      try{ await sendReminder(msg, F.para); F.sent=true; openRecordar(); }
      catch(err){ el.disabled=false; el.textContent="🔔 Enviar recordatorio"; $("#f-err").textContent=err.message; }
    }
    else if(a==="rec-otro"){ F={kind:"recordar", msg:REC_PRESETS[0], para:""}; openRecordar(); }
    else if(a==="csv-c"){ const i=+d.k, c=sortedCierres(S.cierres)[i], D=periodData(S.gastos,S.reglas,S.pagos,S.cierres,i,today()); downloadCSV(D.movs,D.pagos,"liquidado-"+c.corte); }
    else if(a==="liq-ok"){
      el.disabled=true;
      const tr=F.transfers||[];
      if(tr.length) await DB.insert(S.grupo.id,"pagos",tr.map(t=>({de:t.de,para:t.para,monto:t.monto,fecha:today()})));
      await DB.insert(S.grupo.id,"cierres",{corte:F.corte||today(),detalle:tr,gastos_total:F.total});
      await loadData(); S.gview="pend"; closeSheet(); toast("¡Cuentas liquidadas! Empieza un período nuevo 🎉");
    }
    else if(a==="edit") editFrom(d.k);
    else if(a==="csv") downloadCSV();
    else if(a==="reintentar"){ S.view="loading"; render(); boot(); }
    else if(a==="reset-demo"){ await DB.reset(); location.reload(); }
    else if(a==="unirme"){
      const v=S.inv; let k=S.soy;
      const nombre = k==="nuevo" ? ($("#j-n")?.value.trim()||"") : null;
      if(k==="nuevo" && !nombre){ $("#o-err").textContent="Escribe tu nombre."; return; }
      el.disabled=true;
      try{
        if(k==="nuevo"){ const used=(v.grupo.integrantes||[]).map(m=>m.k); k="abcdefghijkl".split("").find(x=>!used.includes(x)); }
        const gid=await DB.unirse(v, k);
        if(nombre){ const {grupo}=await DB.grupo(gid); await DB.saveGrupo(gid,{...grupo, integrantes:[...(grupo.integrantes||[]),{k,n:nombre.slice(0,20)}]}); }
        S.inv=null; await home(gid); toast("¡Bienvenida al grupo! 💚");
      }catch(ex){ el.disabled=false; $("#o-err").textContent=ex.message||friendly(ex); }
    }
    else if(a==="askdel") $("#cf").innerHTML=`<div class="confirm"><div class="sub">¿Seguro? Esto no se puede deshacer.</div><button class="btn danger full" data-act="del" data-k="${esc(d.k)}">Sí, borrar</button></div>`;
    else if(a==="del"){
      const [t,id]=d.k.split(":"); const x=S[t].find(r=>r.id===id);
      await DB.remove(t,id);
      if(x?.foto) DB.removeFile(x.foto);
      await loadData(); closeSheet(); toast("Borrado 🗑️");
    }
    else if(a==="ask-salir-llave") $("#cf").innerHTML=`<div class="confirm"><div class="sub">Este grupo dejará de aparecer en este celular. Los gastos quedan para el resto.</div><button class="btn danger full" data-act="salir" data-k="${esc(d.k)}">Sí, quitarlo</button></div>`;
    else if(a==="ask-salir") $("#cf").innerHTML=`<div class="confirm"><div class="sub">Dejarás de ver "${esc(S.grupo.nombre)}" en este celular. Los gastos quedan para el resto del grupo.</div><button class="btn danger full" data-act="salir">Sí, salir del grupo</button></div>`;
    else if(a==="salir"){
      await DB.salir(d.k||S.grupo.id);
      try{localStorage.removeItem("michiteam:last")}catch(_){}
      S.grupo=null; await home(); toast("Listo 🐾");
    }
    else if(a==="stop"){ const r=S.reglas.find(x=>x.id===d.k); await DB.update(S.grupo.id,"reglas",{...r,fin:ym(new Date())}); await loadData(); closeSheet(); toast("Listo, no se cobra más 🐾"); }
    else if(a==="pagar"){
      const m=+digits($("#p-monto").value); if(m<=0){$("#f-err").textContent="Escribe un monto mayor a cero.";return}
      if(F.de===F.para){$("#f-err").textContent="Elige dos personas distintas.";return}
      await DB.insert(S.grupo.id,"pagos",{de:F.de,para:F.para,monto:m,fecha:today()});
      await loadData(); closeSheet(); toast("¡Pago registrado! 💚");
    }
    else if(a==="savemeta"){
      const n=$("#g-n").value.trim(), o=+digits($("#g-o").value);
      if(!n||o<=0){$("#f-err").textContent="Ponle un nombre y un monto.";return}
      await DB.insert(S.grupo.id,"metas",{nombre:n,objetivo:o,ahorrado:0,icono:F.icono});
      await loadData(); closeSheet(); toast("Meta creada ✨");
    }
    else if(a==="abonar"){
      const m=+digits($("#m-ab").value); if(m<=0){$("#f-err").textContent="Escribe un monto.";return}
      const x=S.metas.find(g=>g.id===d.k); const nuevo=Math.max(0,x.ahorrado+m*(+d.s));
      await DB.update(S.grupo.id,"metas",{...x,ahorrado:nuevo});
      await loadData(); closeSheet(); toast(+d.s>0?"¡A la alcancía! 🐷":"Listo");
    }
    else if(a==="add-int"){
      const nuevos=splitNames($("#nuevo-int").value); if(!nuevos.length) return toast("Escribe un nombre");
      const list=editedMembers(), libres="abcdefghijkl".split("").filter(x=>!list.some(m=>m.k===x));
      if(nuevos.length>libres.length) return toast("Máximo 12 personas");
      nuevos.forEach((n,i)=>list.push({k:libres[i], n}));
      await saveIntegrantes(list); render(); toast(`${nuevos.join(" y ")} se ${nuevos.length>1?"sumaron":"sumó"} al grupo 🎉`);
    }
    else if(a==="ajustes"){
      const list=members().map(m=>({k:m.k, n:(document.querySelector(`[data-int="${m.k}"]`)?.value.trim()||m.n).slice(0,20)}));
      const ic=document.querySelector("[data-gicon][aria-pressed='true']")?.dataset.gicon||S.grupo.icono;
      const body={nombre:$("#gn").value.trim()||"Nuestro grupo", icono:ic, integrantes:list, presupuesto:+digits($("#pres").value)||null};
      await DB.saveGrupo(S.grupo.id,{...S.grupo,...body});
      await loadGrupo(); await loadMis(); render(); toast("Guardado 🎀");
    }
    else if(a==="copy-link"){ const l=inviteLink(); try{await navigator.clipboard.writeText(l);toast("Link copiado: pégalo en WhatsApp 💌")}catch(_){ $("#cf").innerHTML=`<div class="note-box" style="word-break:break-all;user-select:all">${esc(l)}</div>`; } }
  }catch(ex){ const fe=$("#f-err"); if(fe) fe.textContent=friendly(ex); else toast(friendly(ex)); }
});
$("#fab").addEventListener("click",()=> S.tab==="metas" ? openMeta() : newForm());
document.addEventListener("input", e=>{
  const id=e.target.id;
  if(["f-monto","p-monto","pres","m-ab","g-o"].includes(id)||e.target.dataset.fm){const v=digits(e.target.value);e.target.value=v?Number(v).toLocaleString("es-CL"):""}
  if((id==="f-monto"||e.target.dataset.fm)&&F?.kind==="gasto"){syncForm();const h=$("#split-h");if(h)h.textContent=splitHint()}
  if(id==="f-emoji"&&F){const v=[...e.target.value.trim()].join(""); if(v){F.icono=v; document.querySelectorAll("[data-ico]").forEach(b=>b.setAttribute("aria-pressed","false"));}}
  if(id==="r-msg"&&F?.kind==="recordar"){ F.msg=e.target.value; document.querySelectorAll("[data-preset]").forEach(b=>{const on=b.dataset.preset===F.msg; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); b.querySelector(".tick").textContent=on?"✓":"";}); }
  if(id==="q"){S.q=e.target.value;$("#glist").innerHTML=gList()}
});
document.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.id==="nuevo-int"){ e.preventDefault(); document.querySelector('[data-act="add-int"]')?.click(); } });
document.addEventListener("change", e=>{
  if(e.target.id==="f-file"&&F){const file=e.target.files[0]; if(!file) return; syncForm(); F.file=file; F.preview=URL.createObjectURL(file); drawForm();}
});
addEventListener("online",()=>{S.online=true; if(S.grupo?.id && S.view==="app"){Promise.all([loadGrupo(),loadData()]).then(refresh).catch(()=>{})} refresh();});
addEventListener("offline",()=>{S.online=false;refresh();});
addEventListener("keydown",e=>{ if(e.key==="Escape" && $("#layer").innerHTML) closeSheet(); });

if(typeof window!=="undefined" && !window.__MICHI_TEST__) boot();
