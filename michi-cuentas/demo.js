// Michi Cuentas · modo demo
// Imita lo justo de Supabase para probar la app sin configurar nada.
// Los datos viven solo en este navegador (localStorage).

const KEY = "michi-demo-v1";
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
    hogares: [{ id: h, codigo: "MIAU42", nombre_a: "Luna", nombre_b: "Sol", presupuesto: 900000, def_deuda: 50 }],
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

export function createDemoClient() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
  save();
  const blobs = {};
  const session = { user: db.user, access_token: "demo" };

  function query(table) {
    let op = "select", payload = null, filters = [], one = null;
    const rows = () => (db[table] ||= []);
    const match = r => filters.every(([k, v, neg]) => neg ? r[k] !== v : r[k] === v);
    const b = {
      select() { return b; },
      order() { return b; },
      eq(k, v) { filters.push([k, v, false]); return b; },
      neq(k, v) { filters.push([k, v, true]); return b; },
      single() { one = "single"; return b; },
      maybeSingle() { one = "maybe"; return b; },
      insert(o) { op = "insert"; payload = o; return b; },
      update(o) { op = "update"; payload = o; return b; },
      upsert(o) { op = "upsert"; payload = o; return b; },
      delete() { op = "delete"; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); }
    };
    function run() {
      let data = null;
      if (op === "insert" || op === "upsert") {
        const list = (Array.isArray(payload) ? payload : [payload]).map(o => ({ id: uid(), creado: new Date().toISOString(), ...o }));
        db[table] = rows().filter(r => !list.some(n => n.endpoint && r.endpoint === n.endpoint)).concat(list);
        data = list;
      } else if (op === "update") {
        db[table] = rows().map(r => match(r) ? { ...r, ...payload } : r);
        data = db[table].filter(match);
      } else if (op === "delete") {
        db[table] = rows().filter(r => !match(r));
      } else {
        data = rows().filter(match).map(r => ({ ...r }));
        if (one) data = data[0] || null;
      }
      if (op !== "select") save();
      return { data, error: null };
    }
    return b;
  }

  return {
    demo: true,
    from: query,
    rpc: async () => ({ data: db.hogares[0], error: null }),
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => { try { localStorage.removeItem(KEY); localStorage.removeItem("michi:last"); } catch (_) {} location.reload(); return { error: null }; },
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async () => ({ data: { session }, error: null }),
      setSession: async () => ({ data: { session }, error: null })
    },
    storage: {
      from: () => ({
        upload: async (path, blob) => { blobs[path] = URL.createObjectURL(blob); return { data: { path }, error: null }; },
        createSignedUrl: async (path) => ({ data: { signedUrl: blobs[path] || null } }),
        remove: async () => ({ data: null, error: null })
      })
    },
    functions: { invoke: async () => ({ data: { sent: 0, demo: true }, error: null }) },
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: () => {}
  };
}
