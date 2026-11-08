import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.80.0/+esm";
import { createDemoClient } from "./demo.js";

/* ================= utilidades ================= */
const ICON_GROUPS = [
  ["Comida", ["🍙","🍜","🍣","🍕","🍔","🌮","🥗","🍰","🧋","☕","🍷","🍺"]],
  ["Casa y súper", ["🛒","🏠","💡","💧","🔥","🧺","🧹","🧻","🛋️","🪑","🛏️","🪴"]],
  ["Tecnología y suscripciones", ["📱","💻","📶","📺","🎵","🎧","🎮","🤖","☁️","🖨️","⌚","📷"]],
  ["Transporte", ["🚗","🚕","🚌","🚇","⛽","🅿️","🛵","🚲","✈️","🧳","🔧","🚘"]],
  ["Salud y belleza", ["💊","🩺","🦷","👓","💄","💅","💇‍♀️","🏋️‍♀️","🧴","🩹","🧘‍♀️","🌸"]],
  ["Mascotas", ["🐾","🐈‍⬛","🐟","🦴","🐕","🐦"]],
  ["Ocio y compras", ["🎬","🎟️","🎀","👗","👟","👜","🎁","🏖️","📚","🎨","🎤","🎉"]],
  ["Otros", ["💳","🏦","🧾","📦","🛠️","🎓","👶","💍","🌿","🧸","💐","✨"]]
];
const ICONS = ICON_GROUPS.flatMap(g=>g[1]);
const GOAL_ICONS = ["✈️","🏖️","🏠","💍","🎮","🐾","🎁","🚗","🍣","✨","🎀","💻"];
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
const other = k => k==="a"?"b":"a";
const deudaTxt = p => p>=100?"Todo":p===50?"La mitad":p+"%";
const digits = v => String(v||"").replace(/\D/g,"");

/* ================= estado ================= */
const S = {
  tab:"inicio", month: ym(new Date()), q:"",
  user:null, hogar:null, lado:"a",
  gastos:[], reglas:[], pagos:[], metas:[], cierres:[], urls:{}, gview:"pend",
  online:navigator.onLine, view:"loading", email:""
};
const nmv = k => k===S.lado ? "Tú" : nm(k);
const nm = k => (k==="a"?S.hogar?.nombre_a:S.hogar?.nombre_b) || (k==="a"?"Yo":"Mi amor");

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
const fromRule = (r,o) => ({id:r.id+"#"+o.i, regla:r.id, descr:r.descr, monto:r.monto, paga:r.paga, deuda:r.deuda, icono:r.icono, fecha:o.fecha,
  foto:r.foto, nota:r.nota, reac:r.reac, extra: r.tipo==="cuotas" ? `Cuota ${o.i+1}/${r.cuotas}` : "Mensual"});
function allMovs(upTo){
  const list = S.gastos.filter(g=>g.fecha<=upTo).map(g=>({...g}));
  for(const r of S.reglas) for(const o of occurrences(r,upTo)) list.push(fromRule(r,o));
  return list;
}
export function computeBalance(gastos, reglas, pagos, upTo){ // >0 : B le debe a A
  let b=0;
  const movs = gastos.filter(g=>g.fecha<=upTo).concat(reglas.flatMap(r=>occurrences(r,upTo).map(o=>fromRule(r,o))));
  for(const g of movs){const d=g.monto*(g.deuda??50)/100; b += g.paga==="a"?d:-d}
  for(const p of pagos){ if(p.fecha<=upTo) b += p.de==="a"?p.monto:-p.monto }
  return Math.round(b);
}
const balance = () => computeBalance(S.gastos,S.reglas,S.pagos,today());
function monthMovs(m){ // todo el mes, incluidos los fijos y cuotas que vencen más adelante
  return allMovs(dayIn(m,31)).filter(g=>g.fecha.startsWith(m)).sort((x,y)=>y.fecha.localeCompare(x.fecha));
}
function upcoming(){
  const t=today(), m=ym(new Date()), out=[];
  for(const r of S.reglas) for(const o of occurrences(r,dayIn(m,31))) if(o.fecha>t) out.push(fromRule(r,o));
  return out.sort((a,b)=>a.fecha.localeCompare(b.fecha));
}

/* ================= períodos (liquidaciones) ================= */
const ts = v => v ? new Date(v).getTime() : 0;
export const sortedCierres = c => [...(c||[])].sort((a,b)=>ts(a.creado)-ts(b.creado));
// true si el ítem NO quedó cubierto por la liquidación c
export function after(item, c){
  if(!c) return true;
  if(item.regla) return item.fecha > c.corte;
  return ts(item.creado) > ts(c.creado) || (!!item.fecha && item.fecha > c.corte);
}
// k = índice de la liquidación (orden cronológico) o -1 para el período pendiente
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
export function summarize(movs, pagos){
  const side = () => ({half:0, halfBase:0, full:0, other:0, owed:0});
  const r = {a:side(), b:side(), abono:{a:0,b:0}, total:0};
  for(const g of movs){
    const pct = g.deuda ?? 50, d = g.monto*pct/100, s = r[g.paga];
    if(pct===50){ s.half+=d; s.halfBase+=g.monto; } else if(pct>=100) s.full+=d; else s.other+=d;
    s.owed+=d; r.total+=g.monto;
  }
  for(const p of pagos) r.abono[p.de]+=p.monto;
  r.net = Math.round(r.a.owed - r.b.owed - r.abono.b + r.abono.a); // >0: B le debe a A
  return r;
}
const pending = () => periodData(S.gastos,S.reglas,S.pagos,S.cierres,-1,today());
const lastCierre = () => { const c=sortedCierres(S.cierres); return c[c.length-1]; };

/* ================= gatito ================= */
function cat(mood="happy",size=96,acc="var(--pink)"){
  const fur="#25202e", furL="#3a3346";
  const eyes = mood==="sleep"
    ? `<path d="M37 55 q6 5 12 0" stroke="#f3eaff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M63 55 q6 5 12 0" stroke="#f3eaff" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood==="happy"
    ? `<path d="M37 56 q6 -7 12 0" stroke="#f3eaff" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M63 56 q6 -7 12 0" stroke="#f3eaff" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="43" cy="54" rx="8" ry="8.5" fill="#c9e88f"/><ellipse cx="69" cy="54" rx="8" ry="8.5" fill="#c9e88f"/>
       <ellipse cx="44" cy="55" rx="4.6" ry="6" fill="#141018"/><ellipse cx="70" cy="55" rx="4.6" ry="6" fill="#141018"/>
       <circle cx="46.5" cy="51.5" r="2.4" fill="#fff"/><circle cx="72.5" cy="51.5" r="2.4" fill="#fff"/><circle cx="42" cy="58" r="1.1" fill="#fff"/><circle cx="68" cy="58" r="1.1" fill="#fff"/>`;
  return `<svg viewBox="0 0 112 112" width="${size}" height="${size}" aria-hidden="true">
    <path d="M86 92 q22 -2 18 -24 q-2 -8 -8 -6" stroke="${fur}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="56" cy="88" rx="38" ry="22" fill="${fur}"/>
    <ellipse cx="40" cy="104" rx="10" ry="6" fill="${furL}"/><ellipse cx="72" cy="104" rx="10" ry="6" fill="${furL}"/>
    <path d="M20 40 Q18 10 30 12 Q38 16 46 28 Z" fill="${fur}"/><path d="M92 40 Q94 10 82 12 Q74 16 66 28 Z" fill="${fur}"/>
    <path d="M26 33 Q26 20 31 20 Q35 23 39 29Z" fill="${acc}" opacity=".85"/><path d="M86 33 Q86 20 81 20 Q77 23 73 29Z" fill="${acc}" opacity=".85"/>
    <ellipse cx="56" cy="56" rx="42" ry="34" fill="${fur}"/>
    <path d="M44 26 q4 4 0 8 M56 24 q4 4 0 8 M68 26 q4 4 0 8" stroke="${furL}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${eyes}
    <ellipse cx="31" cy="67" rx="7" ry="4" fill="var(--blush)" opacity=".75"/><ellipse cx="81" cy="67" rx="7" ry="4" fill="var(--blush)" opacity=".75"/>
    <path d="M53 63 h6 l-3 3.5 z" fill="#f6b6cf"/>
    <path d="M56 66.5 q-3.5 5 -7 1.5 M56 66.5 q3.5 5 7 1.5" stroke="#f3eaff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M12 60 l14 2 M13 69 l13 -3 M100 60 l-14 2 M99 69 l-13 -3" stroke="#6a5f80" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M40 88 q16 9 32 0" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="56" cy="95" r="4.5" fill="#ffd36e" stroke="#2b2140" stroke-width="1.4"/>
  </svg>`;
}

/* ================= Supabase ================= */
const CFG = window.MICHI_CONFIG || {};
const configured = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("TU-PROYECTO");
const DEMO = !configured;
const sb = configured ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : createDemoClient();
const TABLES = ["gastos","reglas","pagos","metas","cierres"];
const cacheKey = () => "michi:"+S.hogar?.id;
function saveCache(){ try{ localStorage.setItem(cacheKey(), JSON.stringify({hogar:S.hogar,gastos:S.gastos,reglas:S.reglas,pagos:S.pagos,metas:S.metas,cierres:S.cierres})) }catch(_){} }
function loadCache(id){ try{ return JSON.parse(localStorage.getItem("michi:"+id)||"null") }catch(_){ return null } }

async function loadTable(t){
  const {data,error} = await sb.from(t).select("*").eq("hogar_id",S.hogar.id).order("creado",{ascending:true});
  if(!error){ S[t]=data; saveCache(); }
}
async function loadHogar(){
  const {data} = await sb.from("hogares").select("*").eq("id",S.hogar.id).single();
  if(data){ S.hogar=data; saveCache(); }
}
let channel;
function subscribe(){
  if(channel) sb.removeChannel(channel);
  channel = sb.channel("hogar-"+S.hogar.id);
  for(const t of TABLES) channel.on("postgres_changes",{event:"*",schema:"public",table:t,filter:"hogar_id=eq."+S.hogar.id}, async()=>{await loadTable(t); refresh();});
  channel.on("postgres_changes",{event:"UPDATE",schema:"public",table:"hogares",filter:"id=eq."+S.hogar.id}, async()=>{await loadHogar(); refresh();});
  channel.subscribe();
}
async function enterHogar(h){
  S.hogar=h;
  const c=loadCache(h.id); if(c){Object.assign(S,{gastos:c.gastos||[],reglas:c.reglas||[],pagos:c.pagos||[],metas:c.metas||[],cierres:c.cierres||[]});}
  S.view="app"; render();
  await Promise.all([loadHogar(), ...TABLES.map(loadTable)]);
  subscribe(); refresh();
  if(DEMO) S.push="demo"; else pushState().then(st=>{S.push=st; refresh();});
}
async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  await onSession(session);
  sb.auth.onAuthStateChange((ev,ses)=>{ if(ev==="SIGNED_IN" && !S.user) onSession(ses); if(ev==="SIGNED_OUT"){S.user=null;S.hogar=null;S.view="login";render();} });
}
async function onSession(session){
  if(!session){ S.view="login"; return render(); }
  S.user=session.user;
  const {data:m,error} = await sb.from("miembros").select("hogar_id,lado").eq("user_id",S.user.id).maybeSingle();
  if(error && !navigator.onLine){
    const last=localStorage.getItem("michi:last"); const c=last&&loadCache(last);
    if(c){ S.lado=localStorage.getItem("michi:lado")||"a"; S.hogar=c.hogar; Object.assign(S,c); S.view="app"; return render(); }
  }
  if(!m){ S.view="onboard"; return render(); }
  S.lado=m.lado; try{localStorage.setItem("michi:last",m.hogar_id);localStorage.setItem("michi:lado",m.lado)}catch(_){}
  await enterHogar({id:m.hogar_id});
}

/* ================= render ================= */
function refresh(){ if(!F && S.view==="app") render(); }
function render(){
  const app = S.view==="app";
  $("#tabs").hidden = !app;
  $("#fab").hidden = !app || S.tab==="ajustes";
  $("#fab").setAttribute("aria-label", S.tab==="metas"?"Nueva meta":"Agregar gasto");
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-current", b.dataset.tab===S.tab?"page":"false"));
  $("#who").innerHTML = app ? `<button class="who-btn" data-go-ajustes="1" aria-label="Editar nombres">${S.online?"":'<span class="offline-dot"></span>'}${esc(nm("a"))} 🤍 ${esc(nm("b"))} <span aria-hidden="true">✏️</span></button>` : "";
  $("#banner").innerHTML = app && DEMO ? `<div class="banner">🎮 <b>Modo demo</b> con datos de ejemplo. Juega con todo: lo que anotes se guarda solo en este navegador. <a href="https://github.com/rociomaure/michi-apps/tree/main/michi-cuentas#instálala-gratis" target="_blank" rel="noopener">Instálala gratis para tu pareja →</a></div>`
    : app && !S.online ? `<div class="banner">Sin internet: puedes mirar, pero los cambios se guardan cuando vuelva la conexión 🐾</div>` : "";
  const v=$("#view");
  if(S.view==="setup") v.innerHTML=vSetup();
  else if(S.view==="login") v.innerHTML=vLogin();
  else if(S.view==="code") v.innerHTML=vCode();
  else if(S.view==="onboard") v.innerHTML=vOnboard();
  else if(S.view==="loading") v.innerHTML=`<div class="card empty">${cat("sleep",70)}Cargando…</div>`;
  else v.innerHTML = {inicio:vInicio,gastos:vGastos,fijos:vFijos,metas:vMetas,ajustes:vAjustes}[S.tab]();
  hydrateImages();
}
function vSetup(){return `<div class="center login">${cat("wow",120)}<h2>Falta conectar la base de datos</h2><div class="hint">Completa el archivo config.js con la URL y la anon key de tu proyecto de Supabase (ver README).</div></div>`}
function vLogin(){return `<div class="center login">${cat("happy",130)}
  <h2>¡Hola! Entremos a sus cuentas</h2>
  <div class="hint">Te mando un código a tu correo. Sin contraseñas.</div>
  <form id="f-login" class="field" style="width:100%">
    <label for="l-email">Tu correo</label>
    <input class="inp" id="l-email" type="email" autocomplete="email" inputmode="email" required value="${esc(S.email)}" placeholder="tu@gmail.com">
    <div id="l-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" type="submit">Enviarme el código 💌</button>
  </form></div>`}
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent||"") || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
function vCode(){
  const linkForm = `<form id="f-link" class="field" style="width:100%">
    <label for="l-link">Pega aquí el link del correo</label>
    <input class="inp" id="l-link" type="url" inputmode="url" autocomplete="off" required placeholder="https://…supabase.co/auth/v1/verify?…">
    <div class="hint">En el correo <b>no toques</b> el link: mantenlo presionado → <b>Copiar</b> y pégalo aquí.</div>
    <button class="btn pink full" type="submit">Entrar con el link 🔗</button>
  </form>`;
  const codeForm = `<form id="f-code" class="field" style="width:100%">
    <label for="l-code">¿Te llegó un código de 6 dígitos?</label>
    <input class="inp money" id="l-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required style="text-align:center;letter-spacing:6px">
    <button class="btn ${isIOS?"":"pink"} full" type="submit">Entrar con el código 🐾</button>
  </form>`;
  return `<div class="center login">${cat("wow",110)}
  <h2>Revisa tu correo</h2>
  <div class="hint">Mandé un correo a <b>${esc(S.email)}</b>.${isIOS?"":" Toca el link del correo, o usa una de estas opciones:"}</div>
  ${isIOS?`<div class="banner" style="text-align:left">🍎 En iPhone, la app y Safari no comparten la sesión. Por eso conviene <b>copiar el link</b> del correo en vez de tocarlo.</div>${linkForm}${codeForm}`:`${codeForm}${linkForm}`}
  <div id="l-err" class="hint" style="color:var(--danger)"></div>
  <button class="btn ghost full" type="button" data-act="back-login">Usar otro correo</button>
  </div>`;
}
export function parseAuthLink(raw){
  let u; try{ u=new URL(String(raw||"").trim()); }catch(_){ return null; }
  const h=new URLSearchParams(u.hash.replace(/^#/,""));
  if(h.get("access_token") && h.get("refresh_token")) return {kind:"session", access_token:h.get("access_token"), refresh_token:h.get("refresh_token")};
  const th=u.searchParams.get("token_hash")||u.searchParams.get("token");
  if(th) return {kind:"otp", token_hash:th, type:u.searchParams.get("type")||"magiclink"};
  return null;
}
async function loginWithLink(raw){
  const p=parseAuthLink(raw);
  if(!p) throw new Error("Ese no parece el link del correo. Cópialo completo, desde el botón o enlace del mail.");
  if(p.kind==="session"){
    const {data,error}=await sb.auth.setSession({access_token:p.access_token,refresh_token:p.refresh_token});
    if(error) throw new Error("Ese link ya venció. Pide un correo nuevo.");
    return data.session;
  }
  const types=[...new Set([p.type==="signup"?"signup":p.type==="email"?"email":"magiclink","email"])];
  let last;
  for(const type of types){
    const {data,error}=await sb.auth.verifyOtp({token_hash:p.token_hash,type});
    if(!error && data?.session) return data.session;
    last=error;
  }
  throw new Error("Ese link ya se usó o venció. Pide un correo nuevo y esta vez cópialo sin tocarlo.");
}
function vOnboard(){return `<div class="list" style="gap:16px">
  <div class="card center">${cat("happy",100)}<h2>Su libreta compartida</h2><div class="hint">Una de las dos la crea y le pasa el código a la otra.</div></div>
  <form id="f-crear" class="card list"><h2 style="font-size:20px">Crear nuestra libreta</h2>
    <div class="field"><label for="o-n1">¿Cómo te llamo?</label><input class="inp" id="o-n1" maxlength="20" required placeholder="Ej: Luna"></div>
    <button class="btn pink full" type="submit">Crear libreta 🎀</button></form>
  <form id="f-unir" class="card list"><h2 style="font-size:20px">Ya tengo un código</h2>
    <div class="field"><label for="o-cod">Código de 6 letras</label><input class="inp money" id="o-cod" maxlength="6" required style="text-transform:uppercase;letter-spacing:4px"></div>
    <div class="field"><label for="o-n2">¿Cómo te llamo?</label><input class="inp" id="o-n2" maxlength="20" required></div>
    <button class="btn full" type="submit">Unirme 💜</button></form>
  <div id="o-err" class="hint" style="color:var(--danger);text-align:center"></div>
  <button class="link" data-act="logout">Cerrar sesión</button></div>`}

function itemHTML(g, withDue){
  const debe = g.monto*(g.deuda??50)/100;
  const due = withDue ? daysUntil(g.fecha) : null;
  return `<button class="item" data-open="${g.regla?"r:"+g.regla:"g:"+g.id}">
    <span class="ico">${esc(g.icono||"✨")}</span>
    <span class="mid"><span class="t">${esc(g.descr||"Gasto")} ${g.reac?esc(g.reac):""}</span>
      <span class="m">${fdate(g.fecha)} · pagó ${esc(nm(g.paga))}
        ${g.extra?`<span class="chip ${g.extra==="Mensual"?"mint":"peach"}">${esc(g.extra)}</span>`:""}
        ${due!==null?`<span class="chip ${due<=3?"warn":""}">${due<=0?"hoy":due===1?"mañana":"en "+due+" días"}</span>`:""}
        ${g.foto?`<span class="chip pink">📎</span>`:""}${g.nota?`<span class="chip">💬</span>`:""}${!withDue && S.cierres.length && !after(g,lastCierre())?`<span class="chip mint">✓ liquidado</span>`:""}</span></span>
    <span class="amt">${clp(g.monto)}<small>${esc(nm(other(g.paga)))} debe ${clp(debe)}</small></span></button>`;
}
function debtTxt(net){ // net>0 : B le debe a A
  const deudor = net>0?"b":"a", acre=other(deudor);
  return deudor===S.lado ? `le debes a ${esc(nm(acre))}` : `${esc(nm(deudor))} te debe`;
}
function summaryCard(sum, since, title, noTotal){
  const deudor = sum.net>0?"b":"a", acre=other(deudor);
  const block = k => { const x=sum[k], o=other(k); if(x.owed<1) return "";
    return `<div class="list" style="gap:6px">
      <div class="sec-h"><b class="sub" style="font-size:16px">${o===S.lado?"Tú debes":esc(nm(o))+" debe"}</b><b style="font-size:17px">${clp(x.owed)}</b></div>
      <div class="hint">por gastos que ${k===S.lado?"pagaste tú":"pagó "+esc(nm(k))}:</div>
      ${x.half?`<div class="sec-h"><span class="sub">🤝 A medias <span class="hint">(mitad de ${clp(x.halfBase)})</span></span><span>${clp(x.half)}</span></div>`:""}
      ${x.full?`<div class="sec-h"><span class="sub">💜 ${o===S.lado?"Te toca completo":"Le toca completo a "+esc(nm(o))}</span><span>${clp(x.full)}</span></div>`:""}
      ${x.other?`<div class="sec-h"><span class="sub">📊 Con otro %</span><span>${clp(x.other)}</span></div>`:""}</div>`; };
  const hr = `<hr style="border:0;border-top:2px dashed var(--line);margin:0">`;
  const ab = ["a","b"].filter(k=>sum.abono[k]>0).map(k=>`<div class="sec-h"><span class="sub">💸 ${k===S.lado?"Ya abonaste":"Ya abonó "+esc(nm(k))}</span><span>− ${clp(sum.abono[k])}</span></div>`).join("");
  const blocks=[block("b"),block("a")].filter(Boolean);
  return `<section class="card list" style="gap:12px">
    <div class="sec-h"><h2 style="font-size:19px">${title||"Quién debe qué"}</h2><span class="hint">${since}</span></div>
    ${blocks.join(hr) || `<div class="hint">Aún no hay gastos en este período.</div>`}
    ${ab?hr+ab:""}
    ${noTotal?"":`<div class="sec-h" style="background:var(--pink-2);border-radius:14px;padding:10px 12px">
      <b class="sub">${Math.abs(sum.net)<1?"Están a mano 💕":`Total: ${debtTxt(sum.net)}`}</b>
      <b class="big" style="font-size:22px">${clp(Math.abs(sum.net))}</b></div>`}
  </section>`;
}
const endOfMonth = () => dayIn(ym(new Date()),31);
const pendingMonth = () => periodData(S.gastos,S.reglas,S.pagos,S.cierres,-1,endOfMonth());
function vInicio(){
  const m=ym(new Date()), movs=monthMovs(m), P=pending(), sumHoy=summarize(P.movs,P.pagos);
  const PM=pendingMonth(), sumM=summarize(PM.movs,PM.pagos), t=today(), sum=sumM, b=sumM.net;
  const fut=PM.movs.filter(g=>g.fecha>t);
  const tot=movs.reduce((s,g)=>s+g.monto,0);
  const since = P.prev ? "desde el "+fdate(P.prev.corte) : "desde el inicio";
  let head, mood="happy";
  if(Math.abs(b)<1){head=`<div class="lbl">Este mes</div><div class="big">¡A mano!</div><div class="sub">Nadie le debe a nadie 💕</div>`;mood="sleep"}
  else{mood="wow"; const t2=debtTxt(b);
    head=`<div class="lbl">${t2.charAt(0).toUpperCase()+t2.slice(1)}</div><div class="big">${clp(Math.abs(b))}</div>
      <div class="hint">${fut.length?"Mes completo, con los fijos que vienen":"Todo lo anotado en el período"}${fut.length&&Math.round(sumHoy.net)!==Math.round(b)?` · hasta hoy: ${clp(Math.abs(sumHoy.net))}`:""}</div>`}
  const canClose = Math.abs(b)>=1 || PM.movs.length>0;
  const pres=S.hogar?.presupuesto, pct=pres?tot/pres*100:0;
  const byI={}; movs.forEach(g=>{byI[g.icono||"✨"]=(byI[g.icono||"✨"]||0)+g.monto});
  const top=Object.entries(byI).sort((x,y)=>y[1]-x[1]).slice(0,4);
  const list=[...fut.sort((x,y)=>x.fecha.localeCompare(y.fecha)).map(g=>itemHTML(g,true)), ...P.movs.map(g=>itemHTML(g))];
  return `<div class="list" style="gap:16px">
  <section class="card list" style="gap:14px;background:linear-gradient(160deg,var(--pink-2),var(--lav-2));border-color:transparent">
    <div class="row" style="gap:14px"><div style="flex:0 0 96px">${cat(mood,96)}</div><div class="txt" style="min-width:0;display:flex;flex-direction:column;gap:4px">${head}</div></div>
    ${canClose?`<div class="two"><button class="btn pink" data-act="liquidar">✅ Liquidar</button><button class="btn" data-act="detalle">👀 Ver detalle</button></div>`:""}
    <button class="btn ghost full" data-act="recordar" style="background:var(--paper)">🔔 Recordarle a ${esc(nm(other(S.lado)))}</button>
  </section>
  ${(S.push==="off"||S.push==="ios-browser") && !S.pushDismiss ? `<div class="banner row" style="gap:10px;justify-content:space-between">
    <span>🔔 ${S.push==="ios-browser"?"Para recibir recordatorios en iPhone, instala la app (Compartir → Agregar a inicio).":"Activa las notificaciones para recibir los recordatorios de "+esc(nm(other(S.lado)))+"."}</span>
    ${S.push==="off"?`<button class="btn pink" data-act="push-on" style="padding:6px 12px;flex:0 0 auto">Activar</button>`:""}</div>`:""}

  <section class="list"><div class="sec-h"><h2>Cuentas por liquidar</h2><span class="hint">${since}</span></div>
    ${fut.length?`<div class="hint">Incluye ${fut.length===1?"el fijo que viene":"los "+fut.length+" fijos y cuotas que vienen"} este mes (marcados con "en X días").</div>`:""}
    ${list.join("") || `<div class="card empty">${cat("happy",60)}Período nuevo en blanco ✨<br>Toca el + para anotar el primer gasto.</div>`}
    ${P.pagos.length?`<div class="sec-h"><h2 style="font-size:17px">Abonos</h2></div>${P.pagos.map(pagoHTML).join("")}`:""}
  </section>

  ${pres?`<section class="card list" style="gap:8px"><div class="sec-h"><span class="lbl">Presupuesto del mes</span><b class="sub">${clp(tot)} / ${clp(pres)}</b></div>
    <div class="prog ${pct>=100?"over":pct>=80?"warn":""}"><i style="width:${Math.min(100,pct)}%"></i></div>
    <div class="hint">${pct>=100?"Se pasaron del presupuesto 🙀":pct>=80?"Ojo, van en el "+Math.round(pct)+"% 😿":"Quedan "+clp(pres-tot)+" para este mes 😸"}</div></section>`
   :`<section class="stats"><div class="card stat"><div class="lbl">Gastos del mes</div><div class="v">${clp(tot)}</div></div>
     <div class="card stat"><div class="lbl">De eso, fijos y cuotas</div><div class="v">${clp(movs.filter(g=>g.regla).reduce((s,g)=>s+g.monto,0))}</div></div></section>`}
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
function pagoHTML(p){return `<button class="item" data-open="p:${p.id}"><span class="ico" style="background:var(--mint-2)">💸</span><span class="mid"><span class="t">${esc(nm(p.de))} le pagó a ${esc(nm(other(p.de)))}</span><span class="m">${fdate(p.fecha)}</span></span><span class="amt">${clp(p.monto)}</span></button>`}
function vGastos(){
  const seg = `<div class="seg" role="group" aria-label="Vista">${[["pend","Sin liquidar"],["hist","Historial"],["mes","Por mes"]].map(([k,l])=>`<button data-gview="${k}" aria-pressed="${S.gview===k}">${l}</button>`).join("")}</div>`;
  if(S.gview==="pend"){
    const P=pendingMonth(), tot=P.movs.reduce((s,g)=>s+g.monto,0), t=today();
    return `<div class="list" style="gap:14px">${seg}
      <div class="stats"><div class="card stat"><div class="lbl">Período actual</div><div class="v" style="font-size:16px">${P.prev?"Desde el "+fdate(P.prev.corte):"Desde el inicio"}</div></div>
        <div class="card stat"><div class="lbl">Total gastado</div><div class="v">${clp(tot)}</div></div></div>
      <div class="list">${P.movs.map(g=>itemHTML(g, g.fecha>t)).join("") || `<div class="card empty">${cat("happy",64)}Período nuevo en blanco ✨<br>Lo liquidado quedó guardado en Historial.</div>`}
      ${P.pagos.length?`<div class="sec-h"><h2>Abonos del período</h2></div>${P.pagos.map(pagoHTML).join("")}`:""}</div>
      ${P.movs.length?`<button class="btn pink full" data-act="liquidar">✅ Liquidar deuda</button>`:""}
    </div>`;
  }
  if(S.gview==="hist"){
    const cs=sortedCierres(S.cierres);
    return `<div class="list" style="gap:14px">${seg}
      ${cs.length?cs.map((c,i)=>({c,i})).reverse().map(({c,i})=>`<button class="goal" data-open="c:${i}">
        <div class="row"><span class="ico" style="background:var(--mint-2)">✅</span><div style="min-width:0;flex:1"><b>Liquidado el ${fdate(c.corte)}</b>
        <div class="hint">${c.de&&c.monto?`${esc(nm(c.de))} pagó ${clp(c.monto)}`:"Estaban a mano"} · gastos del período ${clp(c.gastos_total)}</div></div><b>›</b></div></button>`).join("")
      :`<div class="card empty">${cat("sleep",64)}Aún no hay liquidaciones.<br>Cuando liquiden la deuda, el período queda guardado aquí.</div>`}
    </div>`;
  }
  const movs=monthMovs(S.month), tot=movs.reduce((s,g)=>s+g.monto,0), pa=movs.filter(g=>g.paga==="a").reduce((s,g)=>s+g.monto,0);
  return `<div class="list" style="gap:14px">${seg}
    <input class="inp" id="q" type="search" placeholder="🔎 Buscar gasto (ej: súper, uber…)" value="${esc(S.q)}" autocomplete="off">
    <div class="month"><button class="round" data-mon="-1" aria-label="Mes anterior">‹</button><b>${monthName(S.month)}</b><button class="round" data-mon="1" aria-label="Mes siguiente">›</button></div>
    ${trendHTML()}
    <div class="stats"><div class="card stat"><div class="lbl">Total del mes</div><div class="v">${clp(tot)}</div></div>
      <div class="card stat"><div class="lbl">Pagó ${esc(nm("a"))} / ${esc(nm("b"))}</div><div class="v" style="font-size:16px">${clp(pa)} / ${clp(tot-pa)}</div></div></div>
    <div class="list" id="glist">${gList()}</div>
    <button class="btn ghost full" data-act="csv">⬇️ Descargar ${monthName(S.month)} para Excel</button>
  </div>`;
}
function splitTxt(g){ // cuánto le toca a cada una de ese gasto
  const d=g.deuda??50, payer=g.paga, o=other(payer);
  if(d===50) return "50-50";
  if(d>=100) return `100% ${esc(nm(o))}`;
  if(d<=0) return `100% ${esc(nm(payer))}`;
  return `${esc(nm(payer))} ${100-d}% · ${esc(nm(o))} ${d}%`;
}
function vFijos(){
  const t=today(), act=[], fin=[];
  for(const r of S.reglas){
    const done = r.tipo==="cuotas" ? occurrences(r,t).length>=r.cuotas : (r.fin && mDiff(r.fin,ym(new Date()))>0);
    (done?fin:act).push(r);
  }
  const totMes=act.reduce((s,r)=>s+r.monto,0);
  const share=k=>Math.round(act.reduce((s,r)=>s+(r.paga===k? r.monto*(100-(r.deuda??50))/100 : r.monto*(r.deuda??50)/100),0));
  const card = r => { const occ=occurrences(r,t).length;
    const extra = r.tipo==="cuotas" ? `<span class="chip peach">Cuota ${Math.min(occ,r.cuotas)}/${r.cuotas}</span>` : `<span class="chip mint">Día ${r.dia}</span>`;
    return `<button class="item" data-open="r:${r.id}"><span class="ico">${esc(r.icono||"✨")}</span>
      <span class="mid"><span class="t">${esc(r.descr)} ${r.reac?esc(r.reac):""}</span><span class="m">${extra} paga ${esc(nm(r.paga))}</span>
        <span class="m"><span class="chip pink">⚖️ ${splitTxt(r)}</span></span></span>
      <span class="amt">${clp(r.monto)}<small>${r.tipo==="cuotas"?"por cuota":"al mes"}</small></span></button>`; };
  return `<div class="list" style="gap:14px">
    <div class="card row" style="background:var(--mint-2);border-color:transparent">${cat("happy",64,"var(--mint)")}<div class="sub">Los fijos y las cuotas se anotan solos cada mes en el día que elijas 💤</div></div>
    ${act.length?`<div class="card list" style="gap:10px"><div class="sec-h"><div><div class="lbl">Compromiso mensual total</div><div class="big" style="font-size:24px">${clp(totMes)}</div></div></div>
      <div class="stats"><div class="stat" style="background:var(--pink-2);border-radius:14px"><div class="lbl">Le toca a ${esc(nm("a"))}</div><div class="v" style="font-size:18px">${clp(share("a"))}</div></div>
      <div class="stat" style="background:var(--mint-2);border-radius:14px"><div class="lbl">Le toca a ${esc(nm("b"))}</div><div class="v" style="font-size:18px">${clp(share("b"))}</div></div></div>
      <div class="hint">Según cómo se divide cada fijo y cuota (mitad, todo o %).</div></div>`:""}
    <div class="sec-h"><h2>Activos</h2></div>
    <div class="list">${act.map(card).join("") || `<div class="card empty">Aún no hay fijos ni cuotas.<br>Toca el + y elige "Mensual" o "En cuotas".</div>`}</div>
    ${fin.length?`<div class="sec-h"><h2>Terminados</h2></div><div class="list" style="opacity:.7">${fin.map(card).join("")}</div>`:""}
  </div>`;
}
function vMetas(){
  return `<div class="list" style="gap:14px">
    <div class="card row" style="background:var(--lav-2);border-color:transparent">${cat("wow",64,"var(--lav)")}<div class="sub">Alcancías para juntar plata para algo que quieran las dos ✨</div></div>
    ${S.metas.map(g=>{const p=Math.min(100,g.ahorrado/g.objetivo*100);return `<button class="goal" data-open="m:${g.id}">
      <div class="row"><span class="ico">${esc(g.icono||"✨")}</span><div style="min-width:0;flex:1"><b>${esc(g.nombre)}</b><div class="hint">${clp(g.ahorrado)} de ${clp(g.objetivo)}</div></div><b>${Math.round(p)}%</b></div>
      <div class="prog"><i style="width:${p}%"></i></div></button>`}).join("") || `<div class="card empty">Aún no tienen metas.<br>Toca el + para crear la primera (ej: viaje al sur ✈️).</div>`}
  </div>`;
}
function vAjustes(){
  const h=S.hogar||{}, d=h.def_deuda??50;
  return `<div class="list" style="gap:14px">
    <div class="card list"><h2 style="font-size:20px">La pareja</h2>
      <div class="field"><label for="na">Nombre 1</label><input class="inp" id="na" value="${esc(nm("a"))}" maxlength="20"></div>
      <div class="field"><label for="nb">Nombre 2</label><input class="inp" id="nb" value="${esc(nm("b"))}" maxlength="20"></div>
      <div class="field"><label for="pres">Presupuesto mensual (opcional)</label><input class="inp" id="pres" inputmode="numeric" value="${h.presupuesto?Number(h.presupuesto).toLocaleString("es-CL"):""}" placeholder="Ej: 800.000"></div>
      <div class="field"><label for="defd">División por defecto de los gastos nuevos</label>
        <select class="inp" id="defd"><option value="50" ${d===50?"selected":""}>La mitad</option><option value="100" ${d===100?"selected":""}>Todo</option>
        ${[30,40,60,70].map(x=>`<option value="${x}" ${d===x?"selected":""}>${x}%</option>`).join("")}</select></div>
      <button class="btn pink full" data-act="ajustes">Guardar 🎀</button></div>
    <div class="card center"><div class="lbl">Código para invitar a tu pareja</div><div class="code">${esc(h.codigo||"······")}</div>
      <div class="hint">Ella entra con su correo, toca "Ya tengo un código" y escribe este.</div>
      <button class="btn ghost" data-act="copy">Copiar código</button></div>
    <div class="card list"><h2 style="font-size:20px">Notificaciones 🔔</h2>
      <div class="hint">${({on:"Activadas en este celular ✅",off:"Desactivadas en este celular",denied:"Bloqueadas: actívalas en los ajustes del celular → Notificaciones → Michi Cuentas",unsupported:"Este navegador no permite notificaciones","ios-browser":"En iPhone, primero instala la app (Compartir → Agregar a inicio) y ábrela desde el ícono"})[S.push]||"Revisando…"}</div>
      ${S.push==="off"?`<button class="btn pink full" data-act="push-on">Activar en este celular</button>`:S.push==="on"?`<button class="btn ghost full" data-act="push-off">Desactivar en este celular</button>`:""}
      <div class="hint">Cada una las activa en su propio celular. Así reciben los recordatorios de la otra.</div></div>
    <div class="card list"><h2 style="font-size:20px">Instalar en el celular</h2>
      <div class="hint">En Chrome toca ⋮ → "Instalar app" o "Agregar a pantalla principal". Queda con su ícono de gatito 🐈‍⬛</div></div>
    <div class="hint" style="text-align:center">Sesión: ${esc(S.user?.email||"")}</div>
    <button class="btn ghost full" data-act="logout">${DEMO?"Reiniciar el demo":"Cerrar sesión"}</button>
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
  if(!pushSupported()) throw new Error(isIOS ? "En iPhone primero instala la app (Compartir → Agregar a inicio) y ábrela desde el ícono." : "Este navegador no permite notificaciones.");
  const perm = await Notification.requestPermission();
  if(perm!=="granted") throw new Error("No se dio permiso. Puedes activarlo en los ajustes del celular → Notificaciones.");
  const {data,error} = await sb.functions.invoke("recordar",{body:{action:"key"}});
  if(error || !data?.publicKey) throw new Error("No pude preparar las notificaciones. Inténtalo de nuevo.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToBytes(data.publicKey)});
  const j = sub.toJSON();
  const {error:e2} = await sb.from("push_subs").upsert({endpoint:j.endpoint, hogar_id:S.hogar.id, p256dh:j.keys.p256dh, auth:j.keys.auth, user_id:S.user.id},{onConflict:"endpoint"});
  if(e2) throw new Error("No pude guardar este celular. Inténtalo de nuevo.");
  S.push="on";
}
async function disablePush(){
  try{ const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
    if(sub){ await sb.from("push_subs").delete().eq("endpoint",sub.endpoint); await sub.unsubscribe(); } }catch(_){}
  S.push="off";
}
const REC_PRESETS = ["Revisa Michi Cuentas 🐱","Hay que liquidar las cuentas 💸","Anoté un gasto nuevo 🧾","Recuerda pagar los fijos del mes 🏠"];
function openRecordar(){
  if(!F || F.kind!=="recordar") F={kind:"recordar", msg:REC_PRESETS[0]};
  const otra = nm(other(S.lado));
  if(F.sent){
    openSheet(`<div class="center">${cat("happy",96,"var(--mint)")}<h3>¡Enviado! 🔔</h3>
      <div class="sub">Se le envió a ${esc(otra)} este mensaje:</div></div>
      <div class="note-box" style="font-size:16px">🐾 ${esc(F.msg)}</div>
      <button class="btn pink full" data-act="close">Listo</button>
      <button class="btn ghost full" data-act="rec-otro">Enviar otro</button>`);
    return;
  }
  openSheet(`<div class="center">${cat("wow",84)}<h3>Recordarle a ${esc(otra)}</h3><div class="hint">Elige un mensaje y toca Enviar 📲</div></div>
    <div class="field"><span class="lab">Mensajes rápidos</span><div class="list" style="gap:8px">${REC_PRESETS.map(p=>{const on=F.msg===p;
      return `<button class="btn full preset ${on?"on":""}" data-preset="${esc(p)}" aria-pressed="${on}"><span>${esc(p)}</span><span class="tick">${on?"✓":""}</span></button>`;}).join("")}</div></div>
    <div class="field"><label for="r-msg">Mensaje que se enviará (puedes editarlo)</label><input class="inp" id="r-msg" maxlength="140" value="${esc(F.msg)}" placeholder="Ej: ¿me transfieres lo del súper? 💜"></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="enviar-rec">🔔 Enviar recordatorio</button>
    <button class="btn ghost full" data-act="close">Cancelar</button>`);
}
async function sendReminder(msg){
  if(DEMO) throw new Error("En el modo demo los recordatorios no se envían 🙂 Instala tu propia copia para usarlos.");
  const {data,error} = await sb.functions.invoke("recordar",{body:{mensaje:msg}});
  if(error) throw new Error("No se pudo enviar. Revisa tu conexión e inténtalo otra vez.");
  if(!data?.sent) throw new Error(`${nm(other(S.lado))} todavía no activó las notificaciones en su celular (Ajustes → Notificaciones).`);
  return data.sent;
}

/* ================= imágenes privadas ================= */
async function signed(path){
  if(!path) return null; if(S.urls[path]) return S.urls[path];
  const {data} = await sb.storage.from("recibos").createSignedUrl(path, 3600);
  if(data?.signedUrl) S.urls[path]=data.signedUrl; return S.urls[path]||null;
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
  const d=S.hogar?.def_deuda??50;
  F = edit || {kind:"gasto",tipo:"una",descr:"",monto:"",paga:S.lado,deuda:d,modo:d>=100?"todo":d===50?"mitad":"pct",icono:"🍙",fecha:today(),
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
function drawFormInner(){
  const f=F, isEdit=!!f.id;
  const perCuota = f.tipo==="cuotas" && f.montoModo==="total" && f.monto ? Math.round(+f.monto/(f.cuotas||1)) : null;
  openSheet(`<h3>${isEdit?"Editar":"Nuevo gasto"} ${f.tipo==="una"?"":f.tipo==="mensual"?"mensual":"en cuotas"}</h3>
    ${isEdit?"":`<div class="seg" role="group" aria-label="Tipo">${[["una","Una vez"],["mensual","Mensual"],["cuotas","En cuotas"]].map(([k,l])=>`<button data-tipo="${k}" aria-pressed="${f.tipo===k}">${l}</button>`).join("")}</div>`}
    <div class="field"><label for="f-desc">¿Qué fue?</label><input class="inp" id="f-desc" value="${esc(f.descr)}" placeholder="Ej: Súper del finde" maxlength="60"></div>
    <div class="field"><label for="f-monto">${f.tipo==="cuotas"?(f.montoModo==="total"?"Monto total":"Valor de cada cuota"):"Monto"}</label>
      <input class="inp money" id="f-monto" inputmode="numeric" value="${f.monto?Number(f.monto).toLocaleString("es-CL"):""}" placeholder="$0"></div>
    ${f.tipo==="cuotas"?`<div class="two"><div class="field"><label for="f-cuotas">N° de cuotas</label><input class="inp" id="f-cuotas" inputmode="numeric" value="${f.cuotas}"></div>
      <div class="field"><span class="lab">El monto es…</span><div class="seg"><button data-mm="total" aria-pressed="${f.montoModo==="total"}">Total</button><button data-mm="cuota" aria-pressed="${f.montoModo==="cuota"}">Cuota</button></div></div></div>
      ${perCuota?`<div class="hint">Serán ${f.cuotas} cuotas de ${clp(perCuota)} 🐾</div>`:""}`:""}
    <div class="field"><span class="lab">Ícono</span>
      <div class="icon-box">${ICON_GROUPS.map(([g,list])=>`<div class="icon-group">${g}</div><div class="icons">${list.map(i=>`<button type="button" data-ico="${i}" aria-pressed="${f.icono===i}" aria-label="${i}">${i}</button>`).join("")}</div>`).join("")}</div>
      <div class="row" style="gap:8px"><span class="hint">¿Otro? Escribe cualquier emoji:</span><input class="inp" id="f-emoji" maxlength="8" style="max-width:76px;text-align:center;font-size:20px;padding:8px" value="${ICONS.includes(f.icono)?"":esc(f.icono||"")}" placeholder="🙂"></div></div>
    <div class="field"><span class="lab">¿Quién pagó?</span><div class="seg"><button data-paga="a" aria-pressed="${f.paga==="a"}">${esc(nm("a"))}</button><button data-paga="b" aria-pressed="${f.paga==="b"}">${esc(nm("b"))}</button></div></div>
    <div class="field"><span class="lab">${esc(nm(other(f.paga)))} le debe a ${esc(nm(f.paga))}…</span>
      <div class="seg"><button data-modo="todo" aria-pressed="${f.modo==="todo"}">Todo</button><button data-modo="mitad" aria-pressed="${f.modo==="mitad"}">La mitad</button><button data-modo="pct" aria-pressed="${f.modo==="pct"}">Un %</button></div>
      ${f.modo==="pct"?`<div class="row"><input class="inp" id="f-pct" inputmode="numeric" value="${f.deuda}" style="max-width:110px"><b>%</b><span class="hint" id="pct-h">${f.monto?"= "+clp(+f.monto*f.deuda/100):""}</span></div>`:""}</div>
    ${f.tipo==="una"?`<div class="field"><label for="f-fecha">Fecha</label><input class="inp" type="date" id="f-fecha" value="${f.fecha}"></div>`
     :`<div class="two"><div class="field"><label for="f-ini">${f.tipo==="cuotas"?"Primera cuota":"Desde"}</label><input class="inp" type="month" id="f-ini" value="${f.inicio}" ${isEdit?"disabled":""}></div>
       <div class="field"><label for="f-dia">Día del mes</label><input class="inp" id="f-dia" inputmode="numeric" value="${f.dia}"></div></div>`}
    <div class="field"><label for="f-nota">Nota (opcional)</label><input class="inp" id="f-nota" value="${esc(f.nota||"")}" maxlength="140" placeholder="Ej: incluye lo del cumple de la mamá"></div>
    <div class="field"><span class="lab">Foto del recibo (opcional)</span><div class="photo">
      ${f.preview?`<img src="${f.preview}" alt="Recibo">`:f.foto?`<img data-path="${esc(f.foto)}" alt="Recibo">`:""}
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
  if(g("f-pct")) F.deuda=Math.min(100,Math.max(0,parseInt(g("f-pct").value)||0));
  if(g("f-fecha")) F.fecha=g("f-fecha").value||today();
  if(g("f-ini") && !g("f-ini").disabled) F.inicio=g("f-ini").value||ym(new Date());
  if(g("f-dia")) F.dia=Math.min(31,Math.max(1,parseInt(g("f-dia").value)||1));
  if(g("f-nota")) F.nota=g("f-nota").value;
}
const friendly = e => !navigator.onLine ? "Sin internet. Inténtalo cuando vuelva la conexión." : (e?.message?.includes("row-level")||e?.code==="42501") ? "No tienes permiso para esta libreta." : "No se pudo guardar. Inténtalo de nuevo.";
async function saveForm(){
  syncForm(); const f=F, err=$("#f-err");
  if(!f.monto || +f.monto<=0){err.textContent="Escribe un monto mayor a cero.";return}
  const deuda = f.modo==="todo"?100:f.modo==="mitad"?50:f.deuda;
  f.busy=true; drawForm();
  try{
    let foto=f.foto||null;
    if(f.file){
      const blob=await compress(f.file);
      const path=`${S.hogar.id}/${crypto.randomUUID()}.jpg`;
      const {error}=await sb.storage.from("recibos").upload(path, blob, {contentType:"image/jpeg"});
      if(error) throw error;
      foto=path;
    }
    const base={hogar_id:S.hogar.id, descr:f.descr.trim()||(f.tipo==="una"?"Gasto":"Gasto fijo"), paga:f.paga, deuda, icono:f.icono, foto, nota:f.nota.trim()||null};
    let t, body;
    if(f.tipo==="una"){ t="gastos"; body={...base, monto:+f.monto, fecha:f.fecha}; }
    else { t="reglas"; body={...base, monto: f.tipo==="cuotas"&&f.montoModo==="total"?Math.round(+f.monto/(f.cuotas||1)):+f.monto, tipo:f.tipo,
      cuotas:f.tipo==="cuotas"?f.cuotas:null, inicio:f.inicio, dia:f.dia}; }
    const q = f.id ? sb.from(t).update(body).eq("id",f.id) : sb.from(t).insert(body);
    const {error}=await q; if(error) throw error;
    await loadTable(t);
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
    openSheet(`<h3>💸 Pago de ${clp(x.monto)}</h3><div class="sub">${esc(nm(x.de))} le pagó a ${esc(nm(other(x.de)))} el ${fdate(x.fecha)}.</div>
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
  openSheet(`<div class="row"><span class="ico" style="width:56px;height:56px;font-size:30px">${esc(x.icono||"✨")}</span><div style="min-width:0"><h3>${esc(x.descr)}</h3><div class="hint">${desc}</div></div></div>
    <div class="card list" style="gap:6px;padding:12px"><div class="sub">Pagó ${esc(nm(x.paga))}</div>
      <div class="sub">${esc(nm(other(x.paga)))} debe: ${deudaTxt(x.deuda??50)} → ${clp(x.monto*(x.deuda??50)/100)}${kind==="regla"?(x.tipo==="cuotas"?" por cuota":" al mes"):""}</div></div>
    ${x.nota?`<div class="note-box">💬 ${esc(x.nota)}</div>`:""}
    <div class="field"><span class="lab">Reaccionar</span><div class="reacs">${REACS.map(r=>`<button data-reac="${r}" data-k="${table}:${x.id}" aria-pressed="${x.reac===r}">${r}</button>`).join("")}</div></div>
    ${x.foto?`<img class="receipt-big" data-path="${esc(x.foto)}" alt="Foto del recibo">`:""}
    <div id="cf"></div>
    <button class="btn pink full" data-act="edit" data-k="${key}">Editar</button>
    ${kind==="regla"&&x.tipo==="mensual"&&!x.fin?`<button class="btn ghost full" data-act="stop" data-k="${x.id}">Dejar de cobrarlo desde el próximo mes</button>`:""}
    <button class="btn ghost full" data-act="askdel" data-k="${table}:${x.id}">${kind==="regla"?"Borrar (también sus meses pasados)":"Borrar gasto"}</button>
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function editFrom(key){
  const {x,kind}=find(key); const d=x.deuda??50, modo=d>=100?"todo":d===50?"mitad":"pct";
  newForm(kind==="gasto"
    ? {kind,tipo:"una",id:x.id,descr:x.descr,monto:String(x.monto),paga:x.paga,deuda:d,modo,icono:x.icono,fecha:x.fecha,foto:x.foto,nota:x.nota||"",dia:1,cuotas:1,inicio:ym(new Date()),montoModo:"total"}
    : {kind,tipo:x.tipo,id:x.id,descr:x.descr,monto:String(x.monto),paga:x.paga,deuda:d,modo,icono:x.icono,inicio:x.inicio,dia:x.dia,cuotas:x.cuotas||12,foto:x.foto,nota:x.nota||"",montoModo:"cuota",fecha:today()});
}
function openSaldar(){
  const P=pending(), b=summarize(P.movs,P.pagos).net, deudor=b>0?"b":"a";
  F={kind:"pago",de:deudor};
  openSheet(`<div class="center">${cat("happy",90,"var(--mint)")}<h3>Saldar cuentas</h3><div class="sub">${esc(nm(deudor))} le transfiere a ${esc(nm(other(deudor)))}</div></div>
    <div class="field"><label for="p-monto">Monto (puede ser un abono parcial)</label><input class="inp money" id="p-monto" inputmode="numeric" value="${Math.abs(b).toLocaleString("es-CL")}"></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="pagar">Registrar pago 💸</button><button class="btn ghost full" data-act="close">Cancelar</button>`);
}
function openDetalle(){
  const P=pending(), sumHoy=summarize(P.movs,P.pagos), PM=pendingMonth(), sumM=summarize(PM.movs,PM.pagos);
  const fut=PM.movs.filter(g=>g.fecha>today()), net=sumM.net, t2=debtTxt(net);
  F={kind:"detalle"};
  openSheet(`<h3>Detalle de la deuda</h3>
    <section class="card center" style="gap:6px;background:linear-gradient(160deg,var(--pink-2),var(--lav-2));border-color:transparent;padding:20px 16px">
      <div class="lbl">${fut.length?"Este mes":"En este período"}</div>
      ${Math.abs(net)<1?`<div class="big" style="font-size:34px">¡A mano! 💕</div>`
        :`<div class="sub" style="font-size:18px">${t2.charAt(0).toUpperCase()+t2.slice(1)}</div><div class="big" style="font-size:44px;line-height:1.05">${clp(Math.abs(net))}</div>`}
      <div class="hint">Gastos del ${fut.length?"mes":"período"}: ${clp(sumM.total)} · ${P.prev?"desde el "+fdate(P.prev.corte):"desde el inicio"}</div>
      ${fut.length&&Math.round(sumHoy.net)!==Math.round(net)?`<div class="hint">Incluye ${fut.length===1?"1 fijo que vence":fut.length+" fijos y cuotas que vencen"} más adelante · solo hasta hoy: ${clp(Math.abs(sumHoy.net))}</div>`:""}
    </section>
    <button class="btn pink full" data-act="liquidar" style="font-size:17px;padding:14px">✅ Liquidar deuda</button>
    ${summaryCard(sumM, "", "Cómo se calcula", true)}
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function openLiquidar(){
  const P=pending(), sum=summarize(P.movs,P.pagos);
  const PM=pendingMonth(), sumM=summarize(PM.movs,PM.pagos);
  const fut=PM.movs.filter(g=>g.fecha>today());
  const opt = k => k==="mes" ? {net:sumM.net, movs:PM.movs, corte:endOfMonth()} : {net:sum.net, movs:P.movs, corte:today()};
  if(!F || F.kind!=="liq") F={kind:"liq", modo: fut.length?"mes":"hoy"};
  const o=opt(F.modo), b=o.net, deudor=b>0?"b":"a", acre=other(deudor), tot=o.movs.reduce((s,g)=>s+g.monto,0);
  Object.assign(F,{de:Math.abs(b)>=1?deudor:null, monto:Math.round(Math.abs(b)), total:tot, corte:o.corte});
  openSheet(`<div class="center">${cat("happy",90,"var(--mint)")}<h3>Liquidar deuda</h3></div>
    ${fut.length?`<div class="field"><span class="lab">¿Qué liquidan?</span><div class="seg">
      <button data-liq="mes" aria-pressed="${F.modo==="mes"}">Todo el mes</button><button data-liq="hoy" aria-pressed="${F.modo==="hoy"}">Solo hasta hoy</button></div>
      <div class="hint">${F.modo==="mes"?`Incluye ${fut.length===1?"el fijo que falta":"los "+fut.length+" fijos y cuotas que faltan"} de este mes; no se volverán a cobrar.`:"Los fijos que faltan este mes quedan para la próxima liquidación."}</div></div>`:""}
    <div class="center">${Math.abs(b)>=1?`<div class="sub">${deudor===S.lado?"Le transfieres a "+esc(nm(acre)):esc(nm(deudor))+" te transfiere"}</div><div class="big">${clp(Math.abs(b))}</div>`:`<div class="sub">Están a mano 💕 Solo se cierra el período.</div>`}</div>
    <div class="card list" style="gap:6px;padding:12px">
      <div class="hint">Al liquidar:</div>
      <div class="sub">✅ Se registra el pago y la deuda queda en $0</div>
      <div class="sub">🗂️ Los ${o.movs.length} gastos (${clp(tot)}) quedan guardados en Historial</div>
      <div class="sub">✨ Empieza un período nuevo en blanco</div>
      <div class="sub">🔁 Los fijos y cuotas siguen anotándose solos</div></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="liq-ok">✅ Sí, ya se transfirió: liquidar</button>
    ${Math.abs(b)>=1?`<button class="btn ghost full" data-act="saldar">Fue solo un abono parcial</button>`:""}
    <button class="btn ghost full" data-act="close">Cancelar</button>`);
}
function openCierre(i){
  const cs=sortedCierres(S.cierres), c=cs[i]; if(!c) return;
  const D=periodData(S.gastos,S.reglas,S.pagos,S.cierres,i,today());
  const sum=summarize(D.movs,D.pagos.filter(p=>!(p.de===c.de&&p.monto===c.monto&&Math.abs(ts(p.creado)-ts(c.creado))<120000)));
  F={kind:"hist", i};
  openSheet(`<h3>Liquidado el ${fdate(c.corte)}</h3>
    <div class="hint">${D.prev?"Período desde el "+fdate(D.prev.corte):"Desde el inicio"} · ${D.movs.length} gastos · ${clp(c.gastos_total)}</div>
    ${summaryCard({...sum, net:sum.net, abono:sum.abono}, "")}
    <div class="note-box">✅ ${c.de&&c.monto?`${esc(nm(c.de))} transfirió ${clp(c.monto)} para liquidar.`:"Estaban a mano."}</div>
    <div class="list">${D.movs.map(g=>itemHTML(g)).join("")||'<div class="hint">Sin gastos en este período.</div>'}</div>
    <button class="btn ghost full" data-act="csv-c" data-k="${i}">⬇️ Descargar este período para Excel</button>
    <button class="btn ghost full" data-act="close">Cerrar</button>`);
}
function openMeta(){
  F={kind:"meta",icono:"✈️"};
  const draw=()=>openSheet(`<h3>Nueva meta 🐷</h3>
    <div class="field"><label for="g-n">¿Para qué ahorran?</label><input class="inp" id="g-n" maxlength="40" placeholder="Ej: Viaje a Chiloé" value="${esc(F.nombre||"")}"></div>
    <div class="field"><label for="g-o">¿Cuánto necesitan?</label><input class="inp money" id="g-o" inputmode="numeric" placeholder="$0" value="${F.objetivo?Number(F.objetivo).toLocaleString("es-CL"):""}"></div>
    <div class="field"><span class="lab">Ícono</span><div class="icons">${GOAL_ICONS.map(i=>`<button data-gico="${i}" aria-pressed="${F.icono===i}">${i}</button>`).join("")}</div></div>
    <div id="f-err" class="hint" style="color:var(--danger)"></div>
    <button class="btn pink full" data-act="savemeta">Crear meta ✨</button><button class="btn ghost full" data-act="close">Cancelar</button>`);
  F.draw=draw; draw();
}
function downloadCSV(movsIn, pagosIn, label){
  const movs=(movsIn||monthMovs(S.month)).slice().reverse();
  const pagos=pagosIn||S.pagos.filter(p=>p.fecha.startsWith(S.month));
  const rows=[["Fecha","Detalle","Tipo","Monto","Pagó","Le debe","% que debe","Monto que debe","Nota"]];
  for(const g of movs) rows.push([g.fecha,g.descr,g.extra||"Una vez",g.monto,nm(g.paga),nm(other(g.paga)),g.deuda??50,Math.round(g.monto*(g.deuda??50)/100),g.nota||""]);
  for(const p of pagos) rows.push([p.fecha,"Pago entre ustedes","Pago",p.monto,nm(p.de),nm(other(p.de)),"","",""]);
  const csv="\ufeff"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`michi-cuentas-${label||S.month}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
let tt; function toast(m){clearTimeout(tt);let el=$(".toast");if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=m;tt=setTimeout(()=>el.remove(),2200)}

/* ================= eventos ================= */
document.addEventListener("submit", async e=>{
  e.preventDefault(); const id=e.target.id;
  const err = $("#l-err") || $("#o-err");
  try{
    if(id==="f-login"){
      S.email=$("#l-email").value.trim();
      const {error}=await sb.auth.signInWithOtp({email:S.email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
      if(error) throw error; S.view="code"; render();
    }else if(id==="f-code"){
      const {data,error}=await sb.auth.verifyOtp({email:S.email,token:digits($("#l-code").value),type:"email"});
      if(error) throw new Error("Ese código no sirve o ya venció. Pide otro.");
      await onSession(data.session);
    }else if(id==="f-link"){
      const ses=await loginWithLink($("#l-link").value);
      await onSession(ses);
    }else if(id==="f-crear"){
      const {data,error}=await sb.rpc("crear_hogar",{mi_nombre:$("#o-n1").value});
      if(error) throw error; await onSession((await sb.auth.getSession()).data.session);
    }else if(id==="f-unir"){
      const {error}=await sb.rpc("unirse_hogar",{cod:$("#o-cod").value,mi_nombre:$("#o-n2").value});
      if(error) throw error; await onSession((await sb.auth.getSession()).data.session);
    }
  }catch(ex){ if(err) err.textContent = ex.message?.includes("rate")?"Espera un minuto antes de pedir otro código.":(ex.message||"Algo falló, inténtalo otra vez."); }
});
document.addEventListener("click", async e=>{
  if(e.target.classList.contains("scrim")){closeSheet();return}
  const el=e.target.closest("button"); if(!el) return;
  const d=el.dataset;
  if(d.tab){S.tab=d.tab;S.q="";if(d.tab==="gastos")S.gview="pend";render();scrollTo(0,0);return}
  if(d.goAjustes){S.tab="ajustes";render();scrollTo(0,0);setTimeout(()=>$("#na")?.focus(),50);return}
  if(d.go){S.tab=d.go;S.gview="pend";render();scrollTo(0,0);return}
  if(d.mon){S.month=addM(S.month,+d.mon);render();return}
  if(d.gview){S.gview=d.gview;S.q="";render();return}
  if(d.open){ if(d.open.startsWith("c:")) openCierre(+d.open.slice(2)); else openDetail(d.open); return}
  if(F && F.kind!=="pago" && F.kind!=="meta"){
    if(d.tipo){syncForm();F.tipo=d.tipo;return drawForm()}
    if(d.mm){syncForm();F.montoModo=d.mm;return drawForm()}
    if(d.ico){syncForm();F.icono=d.ico;return drawForm()}
    if(d.paga){syncForm();F.paga=d.paga;return drawForm()}
    if(d.modo){syncForm();F.modo=d.modo;if(d.modo==="pct"&&(F.deuda===50||F.deuda===100))F.deuda=30;return drawForm()}
  }
  if(d.liq && F?.kind==="liq"){F.modo=d.liq;return openLiquidar()}
  if(d.preset && F?.kind==="recordar"){ F.msg=d.preset; return openRecordar(); }
  if(d.gico && F?.kind==="meta"){F.nombre=$("#g-n").value;F.objetivo=digits($("#g-o").value);F.icono=d.gico;return F.draw()}
  if(d.reac){
    const [t,id]=d.k.split(":"); const x=S[t].find(r=>r.id===id); const val=x.reac===d.reac?null:d.reac;
    const {error}=await sb.from(t).update({reac:val}).eq("id",id); if(error) return toast(friendly(error));
    await loadTable(t); openDetail((t==="gastos"?"g:":"r:")+id); return;
  }
  const a=d.act; if(!a) return;
  try{
    if(a==="close") closeSheet();
    else if(a==="save") await saveForm();
    else if(a==="saldar") openSaldar();
    else if(a==="liquidar"){ F=null; openLiquidar(); }
    else if(a==="detalle") openDetalle();
    else if(a==="recordar") openRecordar();
    else if(a==="push-on"){ el.disabled=true; try{ await enablePush(); toast("Notificaciones activadas 🔔"); }catch(err){ toast(err.message); } render(); }
    else if(a==="push-off"){ await disablePush(); toast("Notificaciones desactivadas"); render(); }
    else if(a==="enviar-rec"){
      const msg=($("#r-msg").value.trim())||REC_PRESETS[0]; F.msg=msg; el.disabled=true; el.textContent="Enviando…";
      try{ await sendReminder(msg); F.sent=true; openRecordar(); }
      catch(err){ el.disabled=false; el.textContent="🔔 Enviar recordatorio"; $("#f-err").textContent=err.message; }
    }
    else if(a==="rec-otro"){ F={kind:"recordar", msg:REC_PRESETS[0]}; openRecordar();
    }
    else if(a==="csv-c"){ const i=+d.k, c=sortedCierres(S.cierres)[i], D=periodData(S.gastos,S.reglas,S.pagos,S.cierres,i,today()); downloadCSV(D.movs,D.pagos,"liquidado-"+c.corte); }
    else if(a==="liq-ok"){
      el.disabled=true;
      if(F.de){ const {error}=await sb.from("pagos").insert({hogar_id:S.hogar.id,de:F.de,monto:F.monto,fecha:today()}); if(error) throw error; }
      const {error}=await sb.from("cierres").insert({hogar_id:S.hogar.id,de:F.de,monto:F.de?F.monto:0,corte:F.corte||today(),gastos_total:F.total}); if(error) throw error;
      await Promise.all([loadTable("pagos"),loadTable("cierres")]); S.gview="pend"; closeSheet(); toast("¡Deuda liquidada! Empieza un período nuevo 🎉");
    }
    else if(a==="edit") editFrom(d.k);
    else if(a==="csv") downloadCSV();
    else if(a==="back-login"){S.view="login";render()}
    else if(a==="logout"){ await sb.auth.signOut(); try{localStorage.removeItem("michi:last")}catch(_){} }
    else if(a==="askdel") $("#cf").innerHTML=`<div class="confirm"><div class="sub">¿Seguro? Esto no se puede deshacer.</div><button class="btn danger full" data-act="del" data-k="${esc(d.k)}">Sí, borrar</button></div>`;
    else if(a==="del"){
      const [t,id]=d.k.split(":"); const x=S[t].find(r=>r.id===id);
      const {error}=await sb.from(t).delete().eq("id",id); if(error) throw error;
      if(x?.foto) sb.storage.from("recibos").remove([x.foto]);
      await loadTable(t); closeSheet(); toast("Borrado 🗑️");
    }
    else if(a==="stop"){ const {error}=await sb.from("reglas").update({fin:ym(new Date())}).eq("id",d.k); if(error) throw error; await loadTable("reglas"); closeSheet(); toast("Listo, no se cobra más 🐾"); }
    else if(a==="pagar"){
      const m=+digits($("#p-monto").value); if(m<=0){$("#f-err").textContent="Escribe un monto mayor a cero.";return}
      const {error}=await sb.from("pagos").insert({hogar_id:S.hogar.id,de:F.de,monto:m,fecha:today()}); if(error) throw error;
      await loadTable("pagos"); closeSheet(); toast("¡Pago registrado! 💕");
    }
    else if(a==="savemeta"){
      const n=$("#g-n").value.trim(), o=+digits($("#g-o").value);
      if(!n||o<=0){$("#f-err").textContent="Ponle un nombre y un monto.";return}
      const {error}=await sb.from("metas").insert({hogar_id:S.hogar.id,nombre:n,objetivo:o,icono:F.icono}); if(error) throw error;
      await loadTable("metas"); closeSheet(); toast("Meta creada ✨");
    }
    else if(a==="abonar"){
      const m=+digits($("#m-ab").value); if(m<=0){$("#f-err").textContent="Escribe un monto.";return}
      const x=S.metas.find(g=>g.id===d.k); const nuevo=Math.max(0,x.ahorrado+m*(+d.s));
      const {error}=await sb.from("metas").update({ahorrado:nuevo}).eq("id",x.id); if(error) throw error;
      await loadTable("metas"); closeSheet(); toast(+d.s>0?"¡A la alcancía! 🐷":"Listo");
    }
    else if(a==="ajustes"){
      const body={nombre_a:$("#na").value.trim()||"Yo",nombre_b:$("#nb").value.trim()||"Mi amor",presupuesto:+digits($("#pres").value)||null,def_deuda:+$("#defd").value};
      const {error}=await sb.from("hogares").update(body).eq("id",S.hogar.id); if(error) throw error;
      await loadHogar(); render(); toast("Guardado 🎀");
    }
    else if(a==="copy"){ try{await navigator.clipboard.writeText(S.hogar.codigo);toast("Código copiado 📋")}catch(_){toast("Código: "+S.hogar.codigo)} }
  }catch(ex){ const fe=$("#f-err"); if(fe) fe.textContent=friendly(ex); else toast(friendly(ex)); }
});
$("#fab").addEventListener("click",()=> S.tab==="metas" ? openMeta() : newForm());
document.addEventListener("input", e=>{
  const id=e.target.id;
  if(["f-monto","p-monto","pres","m-ab","g-o"].includes(id)){const v=digits(e.target.value);e.target.value=v?Number(v).toLocaleString("es-CL"):""}
  if(id==="f-emoji"&&F){const v=[...e.target.value.trim()].join(""); if(v){F.icono=v; document.querySelectorAll("[data-ico]").forEach(b=>b.setAttribute("aria-pressed","false"));}}
  if(id==="r-msg"&&F?.kind==="recordar"){ F.msg=e.target.value; document.querySelectorAll("[data-preset]").forEach(b=>{const on=b.dataset.preset===F.msg; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); b.querySelector(".tick").textContent=on?"✓":"";}); }
  if(id==="f-pct"&&F){syncForm();const h=$("#pct-h");if(h&&F.monto)h.textContent="= "+clp(+F.monto*F.deuda/100)}
  if(id==="q"){S.q=e.target.value;$("#glist").innerHTML=gList()}
});
document.addEventListener("change", e=>{
  if(e.target.id==="f-file"&&F){const file=e.target.files[0]; if(!file) return; syncForm(); F.file=file; F.preview=URL.createObjectURL(file); drawForm();}
});
addEventListener("online",()=>{S.online=true; if(S.hogar){Promise.all([loadHogar(),...TABLES.map(loadTable)]).then(refresh)} refresh();});
addEventListener("offline",()=>{S.online=false;refresh();});
addEventListener("keydown",e=>{ if(e.key==="Escape" && $("#layer").innerHTML) closeSheet(); });

if(typeof window!=="undefined" && !window.__MICHI_TEST__) boot();
