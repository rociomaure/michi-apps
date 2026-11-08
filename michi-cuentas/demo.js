// Michi Cuentas · modo demo
// Imita lo justo de Supabase para probar la app sin configurar nada.
// Los datos viven solo en este navegador (localStorage).

const KEY = "michi-demo-v2";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const pad = n => String(n).padStart(2, "0");
const ymOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const dayOf = (d, day) => { const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return ymOf(d) + "-" + pad(Math.min(day, last)); };

function seed() {
  const now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const hoy = now.getDate();
  const h = "demo-hogar", t = (d) => new Date(d + "T12:00:00").toISOString();
  const g = (descr, monto, paga, deuda, icono, fecha, extra = {}) => ({ id: uid(), hogar_id: h, descr, monto, paga, deuda, icono, fecha, creado: t(fecha), ...extra });
  const cierreFecha = dayOf(prev, 28);
  return {
    user: { id: "demo-luna", email: "luna@ejemplo.cl" },
    hogares: [{ id: h, codigo: "MIAU42DEMO", nombre_a: "Luna", nombre_b: "Sol", presupuesto: 900000, def_deuda: 50 }],
    miembros: [{ hogar_id: h, user_id: "demo-luna", lado: "a" }, { hogar_id: h, user_id: "demo-sol", lado: "b" }],
    gastos: [
      g("Comida para los michis", 32990, "a", 50, "🐾", dayOf(prev, 12)),
      g("Cine", 15600, "b", 50, "🎬", dayOf(prev, 20)),
      g("Súper del finde", 68450, "a", 50, "🛒", dayOf(now, Math.max(1, hoy - 3)), { reac: "😻", nota: "Incluye la arena de los michis" }),
      g("Sushi de aniversario", 42900, "b", 50, "🍣", dayOf(now, Math.max(1, hoy - 2)), { reac: "❤️" }),
      g("Uber al aeropuerto", 18300, "a", 100, "🚕", dayOf(now, Math.max(1, hoy - 1))),
      g("Bubble tea", 7800, "b", 50, "🧋", dayOf(now, hoy))
    ],
    reglas: [
      { id: uid(), hogar_id: h, descr: "Arriendo", monto: 520000, paga: "a", deuda: 50, icono: "🏠", tipo: "mensual", inicio: ymOf(new Date(now.getFullYear(), now.getMonth() - 3, 1)), dia: 5, creado: t(dayOf(prev, 1)) },
      { id: uid(), hogar_id: h, descr: "Internet + streaming", monto: 34990, paga: "b", deuda: 50, icono: "📺", tipo: "mensual", inicio: ymOf(prev), dia: 15, creado: t(dayOf(prev, 1)) },
      { id: uid(), hogar_id: h, descr: "Sillón nuevo", monto: 37492, paga: "a", deuda: 40, icono: "🛋️", tipo: "cuotas", cuotas: 12, inicio: ymOf(prev), dia: 20, creado: t(dayOf(prev, 1)) },
      { id: uid(), hogar_id: h, descr: "Celular", monto: 24990, paga: "b", deuda: 0, icono: "📱", tipo: "cuotas", cuotas: 24, inicio: ymOf(prev), dia: 25, creado: t(dayOf(prev, 1)) }
    ],
    pagos: [{ id: uid(), hogar_id: h, de: "b", monto: 250000, fecha: cierreFecha, creado: t(cierreFecha) }],
    cierres: [{ id: uid(), hogar_id: h, de: "b", monto: 250000, corte: cierreFecha, gastos_total: 980000, creado: new Date(new Date(cierreFecha + "T12:00:00").getTime() + 60000).toISOString() }],
    metas: [
      { id: uid(), hogar_id: h, nombre: "Viaje a Japón", icono: "✈️", objetivo: 3000000, ahorrado: 1140000 },
      { id: uid(), hogar_id: h, nombre: "Rascador gigante", icono: "🐾", objetivo: 120000, ahorrado: 95000 }
    ],
    push_subs: []
  };
}

export function createDemoDB() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
  save();
  const TABLES = ["gastos", "reglas", "pagos", "metas", "cierres"];
  const blobs = {};
  const copy = o => JSON.parse(JSON.stringify(o));
  const code = () => Array.from({ length: 10 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  const hOf = id => db.hogares.find(h => h.id === id);
  return {
    demo: true,
    async ensureSession() { return { user: db.user }; },
    async misGrupos(uid) { return db.miembros.filter(m => m.user_id === uid).map(m => { const h = hOf(m.hogar_id); return { id: h.id, k: m.lado, codigo: h.codigo, grupo: copy(h), sinLlave: false }; }); },
    async grupo(gid) { return { grupo: copy(hOf(gid)), miembros: db.miembros.filter(m => m.hogar_id === gid).map(m => ({ k: m.lado })) }; },
    async items(gid) { const out = {}; for (const t of TABLES) out[t] = copy((db[t] || []).filter(r => r.hogar_id === gid)); return out; },
    async insert(gid, t, objs) {
      const list = (Array.isArray(objs) ? objs : [objs]).map(o => ({ ...copy(o), id: uid(), hogar_id: gid, creado: new Date().toISOString() }));
      db[t] = (db[t] || []).concat(list); save();
    },
    async update(gid, t, full) { db[t] = db[t].map(r => r.id === full.id ? { ...copy(full), hogar_id: gid } : r); save(); },
    async remove(t, id) { db[t] = db[t].filter(r => r.id !== id); save(); },
    async saveGrupo(gid, g) { Object.assign(hOf(gid), copy(g), { id: gid }); save(); },
    async crear(g) { const h = { ...copy(g), id: uid(), codigo: code() }; db.hogares.push(h); db.miembros.push({ hogar_id: h.id, user_id: db.user.id, lado: "a" }); save(); return h.id; },
    async ver(inv) {
      const h = db.hogares.find(x => x.codigo === inv.codigo);
      if (!h) throw new Error("Este link de invitación no existe o la libreta se borró.");
      return { id: h.id, grupo: copy(h), conApp: db.miembros.filter(m => m.hogar_id === h.id).map(m => m.lado) };
    },
    async unirse(inv, k) {
      const h = db.hogares.find(x => x.codigo === inv.codigo);
      db.miembros = db.miembros.filter(m => !(m.hogar_id === h.id && (m.user_id === db.user.id || m.lado === k)));
      db.miembros.push({ hogar_id: h.id, user_id: db.user.id, lado: k }); save(); return h.id;
    },
    async salir(gid) { db.miembros = db.miembros.filter(m => !(m.hogar_id === gid && m.user_id === db.user.id)); save(); },
    async upload(gid, blob) { const path = gid + "/" + uid(); blobs[path] = URL.createObjectURL(blob); return path; },
    async fileURL(gid, path) { return blobs[path] || null; },
    removeFile() {}, subscribe() {},
    async pushKey() { throw new Error("demo"); }, async savePush() {}, async deletePush() {},
    async remind() { return { sent: 0, personas: 0, demo: true }; },
    async reset() { try { localStorage.removeItem(KEY); localStorage.removeItem("michi:last"); } catch (_) {} }
  };
}
