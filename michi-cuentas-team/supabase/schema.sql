-- Michi Cuentas Team · esquema de base de datos para Supabase (con cifrado de extremo a extremo)
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
--
-- Privacidad: la app cifra todo en el celular (AES-256-GCM) antes de enviarlo.
-- La llave de cada grupo viaja solo dentro del link de invitación (después del #), así que
-- esta base guarda texto ilegible: ni quien administra Supabase puede ver nombres, montos ni boletas.
-- Lo único legible es lo mínimo para funcionar: qué sesión pertenece a qué grupo y las fechas de creación.
--
-- Requisito: Authentication → Sign In / Providers → activar "Allow anonymous sign-ins".

-- ---------- Tablas ----------
create table if not exists public.team_grupos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,                 -- parte pública del link de invitación
  data text not null,                          -- cifrado: nombre, ícono, integrantes, presupuesto
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.team_miembros (
  grupo_id uuid not null references public.team_grupos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  k text not null check (k ~ '^[a-l]$'),       -- qué integrante del grupo es esta sesión
  creado timestamptz not null default now(),
  primary key (grupo_id, user_id),
  unique (grupo_id, k)
);

create table if not exists public.team_items (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.team_grupos(id) on delete cascade,
  tipo text not null check (tipo in ('gasto','regla','pago','meta','cierre')),
  data text not null check (length(data) < 20000),   -- cifrado
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists team_items_grupo on public.team_items(grupo_id);

create table if not exists public.team_push_subs (
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
create or replace function public.team_es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_miembros where grupo_id = g and user_id = auth.uid());
$$;

alter table public.team_grupos    enable row level security;
alter table public.team_miembros  enable row level security;
alter table public.team_items     enable row level security;
alter table public.team_push_subs enable row level security;
alter table public.push_config    enable row level security;   -- sin políticas: solo la función del servidor

drop policy if exists team_grupo_ver on public.team_grupos;
create policy team_grupo_ver on public.team_grupos for select using (public.team_es_miembro(id));
drop policy if exists team_grupo_editar on public.team_grupos;
create policy team_grupo_editar on public.team_grupos for update using (public.team_es_miembro(id)) with check (public.team_es_miembro(id));

drop policy if exists team_miembros_ver on public.team_miembros;
create policy team_miembros_ver on public.team_miembros for select using (public.team_es_miembro(grupo_id));

drop policy if exists team_items_todo on public.team_items;
create policy team_items_todo on public.team_items for all
  using (public.team_es_miembro(grupo_id)) with check (public.team_es_miembro(grupo_id));

drop policy if exists team_push_propias on public.team_push_subs;
create policy team_push_propias on public.team_push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Crear, ver una invitación, unirse y salir ----------
create or replace function public.team_crear(p_data text) returns public.team_grupos
language plpgsql security definer set search_path = public as $$
declare g team_grupos; cod text; i int;
begin
  if auth.uid() is null then raise exception 'Abre la app de nuevo'; end if;
  if length(p_data) > 20000 then raise exception 'Datos demasiado grandes'; end if;
  if (select count(*) from team_miembros where user_id = auth.uid()) >= 30 then raise exception 'Máximo 30 grupos por celular'; end if;
  loop
    cod := '';
    for i in 1..10 loop
      cod := cod || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1);
    end loop;
    exit when not exists (select 1 from team_grupos where codigo = cod);
  end loop;
  insert into team_grupos (codigo, data) values (cod, p_data) returning * into g;
  insert into team_miembros (grupo_id, user_id, k) values (g.id, auth.uid(), 'a');
  return g;
end $$;

-- Con el código del link se puede ver el grupo (cifrado) y qué integrantes ya tienen la app
create or replace function public.team_ver(cod text) returns table (id uuid, data text, con_app text[])
language sql stable security definer set search_path = public as $$
  select g.id, g.data, coalesce((select array_agg(m.k order by m.k) from team_miembros m where m.grupo_id = g.id), '{}')
  from team_grupos g where g.codigo = upper(trim(cod));
$$;

-- Unirse como el integrante p_k. Si ese lugar ya tenía otra sesión (por ejemplo, un celular nuevo), se traspasa.
create or replace function public.team_unirse(cod text, p_k text) returns public.team_grupos
language plpgsql security definer set search_path = public as $$
declare g team_grupos;
begin
  if auth.uid() is null then raise exception 'Abre la app de nuevo'; end if;
  if p_k !~ '^[a-l]$' then raise exception 'Integrante no válido'; end if;
  select * into g from team_grupos where codigo = upper(trim(cod));
  if not found then raise exception 'Este link de invitación no existe o el grupo se borró.'; end if;
  delete from team_miembros where grupo_id = g.id and (user_id = auth.uid() or k = p_k);
  insert into team_miembros (grupo_id, user_id, k) values (g.id, auth.uid(), p_k);
  return g;
end $$;

create or replace function public.team_salir(g uuid) returns void
language sql security definer set search_path = public as $$
  delete from team_miembros where grupo_id = g and user_id = auth.uid();
$$;

grant execute on function public.team_es_miembro(uuid) to authenticated;
grant execute on function public.team_crear(text) to authenticated;
grant execute on function public.team_ver(text) to authenticated;
grant execute on function public.team_unirse(text, text) to authenticated;
grant execute on function public.team_salir(uuid) to authenticated;

-- ---------- Fotos de boletas (cifradas antes de subir) ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('team-recibos','team-recibos', false, 3145728)
on conflict (id) do nothing;

drop policy if exists team_recibos_ver on storage.objects;
create policy team_recibos_ver on storage.objects for select to authenticated
  using (bucket_id = 'team-recibos' and public.team_es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists team_recibos_subir on storage.objects;
create policy team_recibos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'team-recibos' and public.team_es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists team_recibos_borrar on storage.objects;
create policy team_recibos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'team-recibos' and public.team_es_miembro(((storage.foldername(name))[1])::uuid));

-- ---------- Tiempo real ----------
do $$
declare t text;
begin
  foreach t in array array['team_grupos','team_items'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
