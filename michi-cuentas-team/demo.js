// Michi Cuentas Team · modo demo
// Imita lo justo de Supabase para probar la app sin configurar nada.
// Los datos viven solo en este navegador (localStorage).

const KEY = "michi-team-demo-v2";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const pad = n => String(n).padStart(2, "0");
const ymOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const dayOf = (d, day) => { const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return ymOf(d) + "-" + pad(Math.min(day, last)); };

function seed() {
  const now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), hoy = now.getDate();
  const t = d => new Date(d + "T12:00:00").toISOString();
  const viaje = "demo-viaje", depto = "demo-depto";
  const g = (grupo_id, descr, monto, paga, reparto, icono, fecha, extra = {}) => ({ id: uid(), grupo_id, descr, monto, paga, reparto, icono, fecha, creado: t(fecha), ...extra });
  const d = n => dayOf(now, Math.max(1, hoy - n));
  const todas = { a: 1, b: 1, c: 1, d: 1 };
  const cierre = dayOf(prev, 28);
  return {
    user: { id: "demo-luna", email: "luna@ejemplo.cl" },
    team_grupos: [
      { id: viaje, codigo: "PUCON4DEMO", nombre: "Viaje a Pucón", icono: "🏔️", presupuesto: null,
        integrantes: [{ k: "a", n: "Luna" }, { k: "b", n: "Sol" }, { k: "c", n: "Amaru" }, { k: "d", n: "Rayén" }] },
      { id: depto, codigo: "DEPTO3DEMO", nombre: "Depto Ñuñoa", icono: "🏠", presupuesto: 1200000,
        integrantes: [{ k: "a", n: "Luna" }, { k: "b", n: "Mar" }, { k: "c", n: "Isi" }] }
    ],
    team_miembros: [
      { grupo_id: viaje, user_id: "demo-luna", k: "a" }, { grupo_id: viaje, user_id: "demo-sol", k: "b" }, { grupo_id: viaje, user_id: "demo-amaru", k: "c" },
      { grupo_id: depto, user_id: "demo-luna", k: "a" }, { grupo_id: depto, user_id: "demo-mar", k: "b" }
    ],
    team_gastos: [
      g(viaje, "Cabaña 3 noches", 240000, "a", todas, "🏨", d(6), { reac: "😻", nota: "Con tinaja incluida" }),
      g(viaje, "Bencina ida y vuelta", 68000, "b", todas, "⛽", d(6)),
      g(viaje, "Súper para la cabaña", 54300, "c", todas, "🛒", d(5)),
      g(viaje, "Termas Geométricas", 96000, "d", { a: 1, b: 1, d: 1 }, "♨️", d(4), { nota: "Amaru no fue 😴" }),
      g(viaje, "Asado de la última noche", 47800, "a", todas, "🍖", d(3), { reac: "❤️" }),
      g(viaje, "Kayak en el lago", 36000, "b", { a: 18000, b: 18000 }, "🛶", d(3)),
      g(depto, "Súper del mes", 86400, "b", { a: 1, b: 1, c: 1 }, "🛒", d(2)),
      g(depto, "Pizza viernes", 21900, "c", { a: 1, b: 1, c: 1 }, "🍕", d(1)),
      g(depto, "Útiles de aseo", 18700, "a", { a: 1, b: 1, c: 1 }, "🧹", dayOf(prev, 14))
    ],
    team_reglas: [
      { id: uid(), grupo_id: depto, descr: "Arriendo", monto: 750000, paga: "a", reparto: { a: 300000, b: 225000, c: 225000 }, icono: "🏠", tipo: "mensual", inicio: ymOf(new Date(now.getFullYear(), now.getMonth() - 3, 1)), dia: 5, creado: t(dayOf(prev, 1)), nota: "Luna tiene la pieza grande" },
      { id: uid(), grupo_id: depto, descr: "Internet", monto: 25990, paga: "b", reparto: { a: 1, b: 1, c: 1 }, icono: "📶", tipo: "mensual", inicio: ymOf(prev), dia: 12, creado: t(dayOf(prev, 1)) },
      { id: uid(), grupo_id: depto, descr: "Tele nueva", monto: 33325, paga: "c", reparto: { a: 1, b: 1, c: 1 }, icono: "📺", tipo: "cuotas", cuotas: 12, inicio: ymOf(prev), dia: 22, creado: t(dayOf(prev, 1)) }
    ],
    team_pagos: [
      { id: uid(), grupo_id: depto, de: "b", para: "a", monto: 214000, fecha: cierre, creado: t(cierre) },
      { id: uid(), grupo_id: depto, de: "c", para: "a", monto: 236000, fecha: cierre, creado: t(cierre) }
    ],
    team_cierres: [
      { id: uid(), grupo_id: depto, corte: cierre, gastos_total: 840000, detalle: [{ de: "b", para: "a", monto: 214000 }, { de: "c", para: "a", monto: 236000 }],
        creado: new Date(new Date(cierre + "T12:00:00").getTime() + 60000).toISOString() }
    ],
    team_metas: [
      { id: uid(), grupo_id: viaje, nombre: "Próximo viaje: San Pedro", icono: "🏜️", objetivo: 1600000, ahorrado: 420000 },
      { id: uid(), grupo_id: depto, nombre: "Sillón para el living", icono: "🛋️", objetivo: 450000, ahorrado: 310000 }
    ],
    team_push_subs: []
  };
}

export function createDemoDB() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
  save();
  const T = { gastos: "team_gastos", reglas: "team_reglas", pagos: "team_pagos", metas: "team_metas", cierres: "team_cierres" };
  const blobs = {};
  const copy = o => JSON.parse(JSON.stringify(o));
  const code = () => Array.from({ length: 10 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  const gOf = id => db.team_grupos.find(g => g.id === id);
  const plainGrupo = g => ({ nombre: g.nombre, icono: g.icono, integrantes: g.integrantes, presupuesto: g.presupuesto });
  return {
    demo: true,
    async ensureSession() { return { user: db.user }; },
    async misGrupos(uid) {
      return db.team_miembros.filter(m => m.user_id === uid).map(m => { const g = gOf(m.grupo_id); return { id: m.grupo_id, k: m.k, codigo: g.codigo, grupo: copy(plainGrupo(g)), sinLlave: false }; });
    },
    async grupo(gid) { const g = gOf(gid); return { grupo: copy({ id: g.id, codigo: g.codigo, ...plainGrupo(g) }), miembros: db.team_miembros.filter(m => m.grupo_id === gid).map(m => ({ k: m.k })) }; },
    async items(gid) {
      const out = {};
      for (const [t, table] of Object.entries(T)) out[t] = copy((db[table] || []).filter(r => r.grupo_id === gid));
      return out;
    },
    async insert(gid, t, objs) {
      const list = (Array.isArray(objs) ? objs : [objs]).map(o => ({ ...copy(o), id: uid(), grupo_id: gid, creado: new Date().toISOString() }));
      db[T[t]] = (db[T[t]] || []).concat(list); save();
    },
    async update(gid, t, full) { db[T[t]] = db[T[t]].map(r => r.id === full.id ? { ...copy(full), grupo_id: gid } : r); save(); },
    async remove(t, id) { db[T[t]] = db[T[t]].filter(r => r.id !== id); save(); },
    async saveGrupo(gid, g) { Object.assign(gOf(gid), copy(plainGrupo(g))); save(); },
    async crear(g) {
      const n = { id: uid(), codigo: code(), ...copy(g), creado: new Date().toISOString() };
      db.team_grupos.push(n); db.team_miembros.push({ grupo_id: n.id, user_id: db.user.id, k: "a" }); save();
      return n.id;
    },
    async ver(inv) {
      const g = db.team_grupos.find(x => x.codigo === inv.codigo);
      if (!g) throw new Error("Este link de invitación no existe o el grupo se borró.");
      return { id: g.id, grupo: copy(plainGrupo(g)), conApp: db.team_miembros.filter(m => m.grupo_id === g.id).map(m => m.k) };
    },
    async unirse(inv, k) {
      const g = db.team_grupos.find(x => x.codigo === inv.codigo);
      db.team_miembros = db.team_miembros.filter(m => !(m.grupo_id === g.id && (m.user_id === db.user.id || m.k === k)));
      db.team_miembros.push({ grupo_id: g.id, user_id: db.user.id, k }); save();
      return g.id;
    },
    async salir(gid) { db.team_miembros = db.team_miembros.filter(m => !(m.grupo_id === gid && m.user_id === db.user.id)); save(); },
    async upload(gid, blob) { const path = gid + "/" + uid(); blobs[path] = URL.createObjectURL(blob); return path; },
    async fileURL(gid, path) { return blobs[path] || null; },
    removeFile() {},
    subscribe() {},
    async pushKey() { throw new Error("demo"); },
    async savePush() {}, async deletePush() {},
    async remind() { return { sent: 0, personas: 0, demo: true }; },
    async reset() { try { localStorage.removeItem(KEY); localStorage.removeItem("michiteam:last"); } catch (_) {} }
  };
}
