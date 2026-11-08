<div align="center">

<img src="icons/icon-192.png" width="96" alt="Gatito negro de Michi Cuentas">

# Michi Cuentas

**Las cuentas de la pareja, con un gatito que te dice quién le debe a quién.** 🐈‍⬛💜

[🎮 Probar el demo](https://rociomaure.github.io/michi-apps/michi-cuentas/) · [⬇️ Instálala gratis](#instálala-gratis) · [💌 Volver a Michi Apps](../README.md)

<img src="docs/portada.png" alt="Pantallas de Michi Cuentas: inicio, detalle de la deuda y gastos fijos" width="100%">

</div>

## ¿Qué es?

Una app para llevar los gastos compartidos en pareja (o con tu roomie), hecha para el celular. Se instala desde el navegador, queda con su ícono de gatito y se sincroniza en vivo entre los dos teléfonos. Es como Splitwise, pero sin límites diarios, sin anuncios y mucho más cute.

## Lo que hace

- 🔁 **Gastos fijos y en cuotas que se anotan solos**: el arriendo cada mes, el sillón en 12 cuotas, el celular en 24
- ⚖️ **Cada gasto se divide como quieras**: todo, la mitad o un %
- 🐱 **Te dice clarito quién debe**: "Sol te debe $284.677" en un celular y "Le debes a Luna" en el otro
- ✅ **Liquidar deuda**: cuando transfieren, un toque cierra el período, lo guarda en el historial y deja todo en blanco
- 🔔 **Recordatorios**: "¡Hay que liquidar las cuentas! 💸" le llega como notificación al celular de tu pareja
- 📸 **Foto del recibo**, notas y reacciones 😻 en cada gasto
- 🎨 **90 íconos** (comida, casa y muebles, suscripciones, mascotas…) o cualquier emoji
- 🎯 **Presupuesto mensual** con aviso al 80 %
- 🐷 **Metas de ahorro** compartidas
- 🔎 Buscador, gráfico de 6 meses y descarga para Excel
- 📴 Funciona sin internet para mirar
- 🔒 Cada pareja ve solo lo suyo (lo controla la base de datos, no solo la app)

<table>
<tr>
<td><img src="docs/gastos.png" alt="Gastos con historial de liquidaciones"></td>
<td><img src="docs/metas.png" alt="Metas de ahorro"></td>
<td><img src="docs/nuevo.png" alt="Agregar un gasto con íconos"></td>
</tr>
</table>

## Pruébala en 10 segundos

Abre el **[demo](https://rociomaure.github.io/michi-apps/michi-cuentas/)** en tu celular. Viene con datos de ejemplo de Luna y Sol, y puedes anotar, liquidar y jugar con todo: lo que hagas se guarda solo en tu navegador.

## Instálala gratis

Tu propia copia, para ti y tu pareja, en unos 10 minutos. Todo con planes gratuitos.

### 1. Base de datos (Supabase)

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (plan Free)
2. **SQL Editor → New query** → pega todo [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. **Edge Functions → Deploy a new function → Via editor** → llámala `recordar` → pega [`supabase/functions/recordar/index.ts`](supabase/functions/recordar/index.ts) → **Deploy**
4. En la función, **Settings** → desactiva **Verify JWT with legacy secret** → **Save** (la función ya revisa quién envía)
5. **Project Settings → API Keys** → copia la *Project URL* y la *publishable key*

### 2. Conecta la app

Abre [`config.js`](config.js) y pega tu URL y tu publishable key. Esa llave es pública por diseño: la seguridad la dan las reglas de la base de datos.

### 3. Publícala (Vercel)

1. Crea una cuenta en [vercel.com](https://vercel.com)
2. **Add New → Project** → arrastra la carpeta `michi-cuentas` → **Deploy**
3. Copia tu link (ej: `mi-michi-cuentas.vercel.app`)
4. En Supabase → **Authentication → URL Configuration**: pon ese link en *Site URL* y agrega `https://tu-link/**` en *Redirect URLs*

### 4. Instálala en los celulares

- **Android:** abre tu link en Chrome → ⋮ → **Instalar app**
- **iPhone:** abre tu link en Safari → Compartir → **Agregar a inicio**
- Una entra con su correo → **Crear nuestra libreta** → en **Ajustes** aparece un código de 6 letras
- La otra entra con su correo → **Ya tengo un código** → escribe el código
- Cada una activa las notificaciones en **Ajustes → Notificaciones** 🔔

> 💡 En iPhone, para entrar, copia el link del correo (mantenlo presionado → Copiar) y pégalo en la app en vez de tocarlo.

## Cómo está hecha

- HTML, CSS y JavaScript sin frameworks, instalable como PWA
- [Supabase](https://supabase.com) para la base de datos, el inicio de sesión sin contraseña, las fotos y el tiempo real
- Notificaciones Web Push con una Edge Function
- Sin pasos de compilación: los archivos se publican tal cual

## Contacto

💌 rocio.maure@gmail.com · [Más Michi Apps](https://github.com/rociomaure/michi-apps)

## Licencia

[MIT](../LICENSE) © 2026 Rocío Maure. Úsala, cámbiala y compártela; solo mantén el crédito. 🐾
