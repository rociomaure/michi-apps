// Michi Apps · capa de datos con cifrado de extremo a extremo (la usan Michi Cuentas y Michi Cuentas Team).
// Todo lo que sale del celular va cifrado con la llave del grupo (AES-256-GCM).
// La llave vive en este celular y en el link de invitación (después del #, que nunca llega al servidor).

const TIPOS = { gastos: "gasto", reglas: "regla", pagos: "pago", metas: "meta", cierres: "cierre" };
const LISTA = Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [v, k]));


export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));

let KEYS = "michiteam:keys";
function readKeys() { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch (_) { return {}; } }
function writeKeys(o) { try { localStorage.setItem(KEYS, JSON.stringify(o)); } catch (_) {} }
export const keyFor = gid => readKeys()[gid] || null;
export function rememberKey(gid, k) { const o = readKeys(); o[gid] = k; writeKeys(o); }
export function forgetKey(gid) { const o = readKeys(); delete o[gid]; writeKeys(o); }
export function newKey() { return b64u(crypto.getRandomValues(new Uint8Array(32))); }

const cache = {};
async function cryptoKey(k) {
  if (!cache[k]) cache[k] = crypto.subtle.importKey("raw", unb64u(k), "AES-GCM", false, ["encrypt", "decrypt"]);
  return cache[k];
}
export async function encBytes(k, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(k), bytes);
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return out;
}
export async function decBytes(k, bytes) {
  const b = new Uint8Array(bytes);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await cryptoKey(k), b.slice(12)));
}
export async function enc(k, obj) { return "v1." + b64u(await encBytes(k, new TextEncoder().encode(JSON.stringify(obj)))); }
export async function dec(k, str) {
  try { if (!k || !String(str).startsWith("v1.")) return null; return JSON.parse(new TextDecoder().decode(await decBytes(k, unb64u(str.slice(3))))); }
  catch (_) { return null; }
}
// Link de invitación: …#g=CODIGO.LLAVE
export function parseInvite(raw) {
  const m = String(raw || "").match(/[#&?]g=([A-Z0-9]{6,12})\.([A-Za-z0-9_-]{40,})/i);
  return m ? { codigo: m[1].toUpperCase(), key: m[2] } : null;
}

export function createRealDB(sb, opts = {}) {
  const P = opts.prefix || "team", BUCKET = opts.bucket || "team-recibos", FN = opts.fn || "recordar-team";
  if (opts.keys) KEYS = opts.keys;
  const tb = n => `${P}_${n}`;
  const strip = o => { const { id, creado, actualizado, grupo_id, ...rest } = o; return rest; };
  let channel;
  return {
    demo: false,
    async ensureSession() {
      let { data: { session } } = await sb.auth.getSession();
      if (session) { // ¿sigue siendo válida? (si no, se crea una nueva y el link de invitación devuelve el acceso)
        try {
          const { error } = await sb.auth.getUser();
          if (error && (error.status === 401 || error.status === 403 || /not.*exist|invalid|expired/i.test(error.message || ""))) { await sb.auth.signOut().catch(() => {}); session = null; }
        } catch (_) { /* sin internet: se sigue con la sesión guardada */ }
      }
      if (!session) {
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      return session;
    },
    async misGrupos(uid) {
      const { data, error } = await sb.from(tb("miembros")).select(`grupo_id,k,${tb("grupos")}(codigo,data)`).eq("user_id", uid);
      if (error) throw error;
      const out = [];
      for (const m of data || []) {
        const k = keyFor(m.grupo_id), g = m[tb("grupos")] ? await dec(k, m[tb("grupos")].data) : null;
        out.push({ id: m.grupo_id, k: m.k, codigo: m[tb("grupos")]?.codigo, grupo: g, sinLlave: !g });
      }
      return out;
    },
    async grupo(gid) {
      const [{ data: g, error }, { data: ms }] = await Promise.all([
        sb.from(tb("grupos")).select("id,codigo,data").eq("id", gid).single(),
        sb.from(tb("miembros")).select("k").eq("grupo_id", gid)
      ]);
      if (error) throw error;
      const plain = await dec(keyFor(gid), g.data);
      if (!plain) throw new Error("sin-llave");
      return { grupo: { id: g.id, codigo: g.codigo, ...plain }, miembros: ms || [] };
    },
    async items(gid) {
      const { data, error } = await sb.from(tb("items")).select("id,tipo,data,creado").eq("grupo_id", gid).order("creado", { ascending: true });
      if (error) throw error;
      const out = { gastos: [], reglas: [], pagos: [], metas: [], cierres: [] }, k = keyFor(gid);
      await Promise.all((data || []).map(async r => { const o = await dec(k, r.data); if (o && LISTA[r.tipo]) out[LISTA[r.tipo]].push({ ...o, id: r.id, creado: r.creado }); }));
      for (const l of Object.values(out)) l.sort((a, b) => new Date(a.creado) - new Date(b.creado));
      return out;
    },
    async insert(gid, t, objs) {
      const k = keyFor(gid), list = Array.isArray(objs) ? objs : [objs];
      const rows = await Promise.all(list.map(async o => ({ grupo_id: gid, tipo: TIPOS[t], data: await enc(k, strip(o)) })));
      const { error } = await sb.from(tb("items")).insert(rows); if (error) throw error;
    },
    async update(gid, t, full) {
      const { error } = await sb.from(tb("items")).update({ data: await enc(keyFor(gid), strip(full)), actualizado: new Date().toISOString() }).eq("id", full.id);
      if (error) throw error;
    },
    async remove(t, id) { const { error } = await sb.from(tb("items")).delete().eq("id", id); if (error) throw error; },
    async saveGrupo(gid, g) {
      const { id, codigo, ...datos } = g;   // todo lo demás va cifrado
      const { error } = await sb.from(tb("grupos")).update({ data: await enc(keyFor(gid), datos), actualizado: new Date().toISOString() }).eq("id", gid);
      if (error) throw error;
    },
    async crear(g) {
      const key = newKey();
      const { data, error } = await sb.rpc(tb("crear"), { p_data: await enc(key, g) });
      if (error) throw error;
      rememberKey(data.id, key);
      return data.id;
    },
    async ver(inv) {
      const { data, error } = await sb.rpc(tb("ver"), { cod: inv.codigo });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Este link de invitación no existe o el grupo se borró.");
      const g = await dec(inv.key, row.data);
      if (!g) throw new Error("El link está incompleto: pídele a alguien del grupo que te lo mande de nuevo.");
      return { id: row.id, grupo: g, conApp: row.con_app || [] };
    },
    async unirse(inv, k) {
      const { data, error } = await sb.rpc(tb("unirse"), { cod: inv.codigo, p_k: k });
      if (error) throw error;
      rememberKey(data.id, inv.key);
      return data.id;
    },
    async salir(gid) { const { error } = await sb.rpc(tb("salir"), { g: gid }); if (error) throw error; forgetKey(gid); },
    async upload(gid, blob) {
      const bytes = await encBytes(keyFor(gid), new Uint8Array(await blob.arrayBuffer()));
      const path = `${gid}/${crypto.randomUUID()}.bin`;
      const { error } = await sb.storage.from(BUCKET).upload(path, new Blob([bytes], { type: "application/octet-stream" }), { contentType: "application/octet-stream" });
      if (error) throw error;
      return path;
    },
    async fileURL(gid, path) {
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      try { return URL.createObjectURL(new Blob([await decBytes(keyFor(gid), await data.arrayBuffer())], { type: "image/jpeg" })); } catch (_) { return null; }
    },
    removeFile(path) { sb.storage.from(BUCKET).remove([path]); },
    subscribe(gid, onItems, onGrupo) {
      if (channel) sb.removeChannel(channel);
      channel = sb.channel(P + "-" + gid)
        .on("postgres_changes", { event: "*", schema: "public", table: tb("items"), filter: "grupo_id=eq." + gid }, onItems)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: tb("grupos"), filter: "id=eq." + gid }, onGrupo)
        .subscribe();
    },
    async pushKey() { const { data, error } = await sb.functions.invoke(FN, { body: { action: "key" } }); if (error || !data?.publicKey) throw error || new Error("sin llave"); return data.publicKey; },
    async savePush(uid, j) { const { error } = await sb.from(tb("push_subs")).upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: uid }, { onConflict: "endpoint" }); if (error) throw error; },
    async deletePush(endpoint) { await sb.from(tb("push_subs")).delete().eq("endpoint", endpoint); },
    async remind(gid, body) { const { data, error } = await sb.functions.invoke(FN, { body: { ...body, grupo_id: gid } }); if (error) throw error; return data; },
    async reset() { try { await sb.auth.signOut(); } catch (_) {} }
  };
}
