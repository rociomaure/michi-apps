// Michi Cuentas · función "recordar": envía una notificación a la pareja.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!key) { try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); key = (Object.values(k)[0] as string) || ""; } catch (_) { /* sin llave */ } }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, key);

    // Llaves propias de la app (se crean solas la primera vez)
    let { data: cfg } = await admin.from("push_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) {
      const k = webpush.generateVAPIDKeys();
      await admin.from("push_config").insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey });
      cfg = (await admin.from("push_config").select("*").eq("id", 1).single()).data;
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action === "key") return json({ publicKey: cfg.public_key });

    // Quién envía
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: "Inicia sesión de nuevo." }, 401);

    const { data: m } = await admin.from("miembros").select("hogar_id,lado").eq("user_id", user.id).maybeSingle();
    if (!m) return json({ error: "No perteneces a una libreta." }, 400);
    const { data: h } = await admin.from("hogares").select("nombre_a,nombre_b").eq("id", m.hogar_id).single();
    const yo = (m.lado === "a" ? h?.nombre_a : h?.nombre_b) || "Tu pareja";

    const { data: subs } = await admin.from("push_subs").select("*").eq("hogar_id", m.hogar_id).neq("user_id", user.id);
    webpush.setVapidDetails(Deno.env.get("SITE_URL") || "mailto:michi-cuentas@example.com", cfg.public_key, cfg.private_key);

    const msg = String(body?.mensaje || "Revisa Michi Cuentas 🐱").slice(0, 160);
    const payload = JSON.stringify({ title: `${yo} te recuerda 🐾`, body: msg, url: "/" });
    let sent = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }
    return json({ sent, total: (subs || []).length });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
