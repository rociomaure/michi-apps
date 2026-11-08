-- Michi Cuentas · esquema de base de datos para Supabase (con cifrado de extremo a extremo)
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
--
-- Privacidad: la app cifra todo en el celular (AES-256-GCM) antes de enviarlo.
-- La llave de cada grupo viaja solo dentro del link de invitación (después del #), así que
-- esta base guarda texto ilegible: ni quien administra Supabase puede ver nombres, montos ni boletas.
-- Usa tablas propias (pareja_…), así que puede vivir en el mismo proyecto que Michi Cuentas Team.
-- Lo único legible es lo mínimo para funcionar: qué sesión pertenece a qué grupo y las fechas de creación.
--
-- Requisito: Authentication → Sign In / Providers → activar "Allow anonymous sign-ins".

-- ---------- Tablas ----------
create table if not exists public.pareja_grupos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,                 -- parte pública del link de invitación
  data text not null,                          -- cifrado: nombres, presupuesto y división por defecto
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.pareja_miembros (
  grupo_id uuid not null references public.pareja_grupos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  k text not null check (k ~ '^[ab]$'),         -- a: quien creó la libreta · b: su pareja
  creado timestamptz not null default now(),
  primary key (grupo_id, user_id),
  unique (grupo_id, k)
);

create table if not exists public.pareja_items (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.pareja_grupos(id) on delete cascade,
  tipo text not null check (tipo in ('gasto','regla','pago','meta','cierre')),
  data text not null check (length(data) < 20000),   -- cifrado
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists pareja_items_grupo on public.pareja_items(grupo_id);

create table if not exists public.pareja_push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado timestamptz not null default now()
);

create table if not exists public.push_config (
  id integer primary key,
  public_key text not null,
  private_key text not null,
  creado timestamptz not null default now()
);

-- ---------- Seguridad ----------
create or replace function public.pareja_es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pareja_miembros where grupo_id = g and user_id = auth.uid());
$$;

alter table public.pareja_grupos    enable row level security;
alter table public.pareja_miembros  enable row level security;
alter table public.pareja_items     enable row level security;
alter table public.pareja_push_subs enable row level security;
alter table public.push_config    enable row level security;   -- sin políticas: solo la función del servidor

drop policy if exists pareja_grupo_ver on public.pareja_grupos;
create policy pareja_grupo_ver on public.pareja_grupos for select using (public.pareja_es_miembro(id));
drop policy if exists pareja_grupo_editar on public.pareja_grupos;
create policy pareja_grupo_editar on public.pareja_grupos for update using (public.pareja_es_miembro(id)) with check (public.pareja_es_miembro(id));

drop policy if exists pareja_miembros_ver on public.pareja_miembros;
create policy pareja_miembros_ver on public.pareja_miembros for select using (public.pareja_es_miembro(grupo_id));

drop policy if exists pareja_items_todo on public.pareja_items;
create policy pareja_items_todo on public.pareja_items for all
  using (public.pareja_es_miembro(grupo_id)) with check (public.pareja_es_miembro(grupo_id));

drop policy if exists pareja_push_propias on public.pareja_push_subs;
create policy pareja_push_propias on public.pareja_push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Crear, ver una invitación, unirse y salir ----------
create or replace function public.pareja_crear(p_data text) returns public.pareja_grupos
language plpgsql security definer set search_path = public as $$
declare g pareja_grupos; cod text; i int;
begin
  if auth.uid() is null then raise exception 'Abre la app de nuevo'; end if;
  if length(p_data) > 20000 then raise exception 'Datos demasiado grandes'; end if;
  if (select count(*) from pareja_miembros where user_id = auth.uid()) >= 30 then raise exception 'Máximo 30 libretas por celular'; end if;
  loop
    cod := '';
    for i in 1..10 loop
      cod := cod || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1);
    end loop;
    exit when not exists (select 1 from pareja_grupos where codigo = cod);
  end loop;
  insert into pareja_grupos (codigo, data) values (cod, p_data) returning * into g;
  insert into pareja_miembros (grupo_id, user_id, k) values (g.id, auth.uid(), 'a');
  return g;
end $$;

-- Con el código del link se puede ver el grupo (cifrado) y qué integrantes ya tienen la app
create or replace function public.pareja_ver(cod text) returns table (id uuid, data text, con_app text[])
language sql stable security definer set search_path = public as $$
  select g.id, g.data, coalesce((select array_agg(m.k order by m.k) from pareja_miembros m where m.grupo_id = g.id), '{}')
  from pareja_grupos g where g.codigo = upper(trim(cod));
$$;

-- Unirse como el integrante p_k. Si ese lugar ya tenía otra sesión (por ejemplo, un celular nuevo), se traspasa.
create or replace function public.pareja_unirse(cod text, p_k text) returns public.pareja_grupos
language plpgsql security definer set search_path = public as $$
declare g pareja_grupos;
begin
  if auth.uid() is null then raise exception 'Abre la app de nuevo'; end if;
  if p_k !~ '^[ab]$' then raise exception 'Integrante no válido'; end if;
  select * into g from pareja_grupos where codigo = upper(trim(cod));
  if not found then raise exception 'Este link de invitación no existe o la libreta se borró.'; end if;
  delete from pareja_miembros where grupo_id = g.id and (user_id = auth.uid() or k = p_k);
  insert into pareja_miembros (grupo_id, user_id, k) values (g.id, auth.uid(), p_k);
  return g;
end $$;

create or replace function public.pareja_salir(g uuid) returns void
language sql security definer set search_path = public as $$
  delete from pareja_miembros where grupo_id = g and user_id = auth.uid();
$$;

grant execute on function public.pareja_es_miembro(uuid) to authenticated;
grant execute on function public.pareja_crear(text) to authenticated;
grant execute on function public.pareja_ver(text) to authenticated;
grant execute on function public.pareja_unirse(text, text) to authenticated;
grant execute on function public.pareja_salir(uuid) to authenticated;

-- ---------- Fotos de boletas (cifradas antes de subir) ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('pareja-recibos','pareja-recibos', false, 3145728)
on conflict (id) do nothing;

drop policy if exists pareja_recibos_ver on storage.objects;
create policy pareja_recibos_ver on storage.objects for select to authenticated
  using (bucket_id = 'pareja-recibos' and public.pareja_es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists pareja_recibos_subir on storage.objects;
create policy pareja_recibos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'pareja-recibos' and public.pareja_es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists pareja_recibos_borrar on storage.objects;
create policy pareja_recibos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'pareja-recibos' and public.pareja_es_miembro(((storage.foldername(name))[1])::uuid));

-- ---------- Tiempo real ----------
do $$
declare t text;
begin
  foreach t in array array['pareja_grupos','pareja_items'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
