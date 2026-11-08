-- Michi Cuentas · esquema de base de datos para Supabase
-- Pégalo completo en Supabase → SQL Editor → New query → Run.

-- ---------- Tablas ----------
create table if not exists public.hogares (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nombre_a text not null default 'Yo',
  nombre_b text not null default 'Mi amor',
  presupuesto integer,
  def_deuda integer not null default 50 check (def_deuda between 0 and 100),
  creado timestamptz not null default now()
);

create table if not exists public.miembros (
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lado text not null check (lado in ('a','b')),
  creado timestamptz not null default now(),
  primary key (hogar_id, user_id),
  unique (hogar_id, lado)
);
create unique index if not exists miembros_un_hogar_por_usuario on public.miembros(user_id);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  descr text not null default 'Gasto',
  monto integer not null check (monto > 0),
  paga text not null check (paga in ('a','b')),
  deuda integer not null default 50 check (deuda between 0 and 100),
  icono text,
  fecha date not null default current_date,
  foto text,
  nota text,
  reac text,
  creado_por uuid default auth.uid(),
  creado timestamptz not null default now()
);

create table if not exists public.reglas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  descr text not null default 'Gasto fijo',
  monto integer not null check (monto > 0),
  paga text not null check (paga in ('a','b')),
  deuda integer not null default 50 check (deuda between 0 and 100),
  icono text,
  tipo text not null check (tipo in ('mensual','cuotas')),
  cuotas integer check (cuotas is null or cuotas > 0),
  inicio text not null,               -- 'YYYY-MM'
  dia integer not null default 1 check (dia between 1 and 31),
  fin text,                           -- 'YYYY-MM' último mes cobrado (solo mensual)
  foto text,
  nota text,
  reac text,
  creado_por uuid default auth.uid(),
  creado timestamptz not null default now()
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  de text not null check (de in ('a','b')),
  monto integer not null check (monto > 0),
  fecha date not null default current_date,
  creado timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  nombre text not null,
  icono text,
  objetivo integer not null check (objetivo > 0),
  ahorrado integer not null default 0,
  creado timestamptz not null default now()
);

-- ---------- Seguridad: cada pareja solo ve lo suyo ----------
create or replace function public.es_miembro(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where hogar_id = h and user_id = auth.uid());
$$;

alter table public.hogares  enable row level security;
alter table public.miembros enable row level security;
alter table public.gastos   enable row level security;
alter table public.reglas   enable row level security;
alter table public.pagos    enable row level security;
alter table public.metas    enable row level security;

drop policy if exists hogar_ver on public.hogares;
create policy hogar_ver on public.hogares for select using (public.es_miembro(id));
drop policy if exists hogar_editar on public.hogares;
create policy hogar_editar on public.hogares for update using (public.es_miembro(id)) with check (public.es_miembro(id));

drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select using (public.es_miembro(hogar_id));

do $$
declare t text;
begin
  foreach t in array array['gastos','reglas','pagos','metas'] loop
    execute format('drop policy if exists %I_todo on public.%I', t, t);
    execute format('create policy %I_todo on public.%I for all using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id))', t, t);
  end loop;
end $$;

-- ---------- Crear hogar y unirse con código ----------
create or replace function public.crear_hogar(mi_nombre text) returns public.hogares
language plpgsql security definer set search_path = public as $$
declare h hogares; cod text; i int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  select hg.* into h from hogares hg join miembros m on m.hogar_id = hg.id where m.user_id = auth.uid();
  if found then return h; end if;
  loop
    cod := '';
    for i in 1..6 loop
      cod := cod || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1);
    end loop;
    exit when length(cod) = 6 and not exists (select 1 from hogares where codigo = cod);
  end loop;
  insert into hogares (codigo, nombre_a) values (cod, coalesce(nullif(trim(mi_nombre),''),'Yo')) returning * into h;
  insert into miembros (hogar_id, user_id, lado) values (h.id, auth.uid(), 'a');
  return h;
end $$;

create or replace function public.unirse_hogar(cod text, mi_nombre text) returns public.hogares
language plpgsql security definer set search_path = public as $$
declare h hogares;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  select * into h from hogares where codigo = upper(trim(cod));
  if not found then raise exception 'Ese código no existe. Revísalo con tu pareja.'; end if;
  if exists (select 1 from miembros where hogar_id = h.id and user_id = auth.uid()) then return h; end if;
  if exists (select 1 from miembros where user_id = auth.uid()) then raise exception 'Ya perteneces a otra libreta.'; end if;
  if exists (select 1 from miembros where hogar_id = h.id and lado = 'b') then raise exception 'Esta libreta ya tiene a sus dos integrantes.'; end if;
  insert into miembros (hogar_id, user_id, lado) values (h.id, auth.uid(), 'b');
  update hogares set nombre_b = coalesce(nullif(trim(mi_nombre),''),'Mi amor') where id = h.id returning * into h;
  return h;
end $$;

grant execute on function public.crear_hogar(text) to authenticated;
grant execute on function public.unirse_hogar(text, text) to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;

-- ---------- Fotos de recibos (privadas) ----------
insert into storage.buckets (id, name, public) values ('recibos','recibos', false)
on conflict (id) do nothing;

drop policy if exists recibos_ver on storage.objects;
create policy recibos_ver on storage.objects for select to authenticated
  using (bucket_id = 'recibos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists recibos_subir on storage.objects;
create policy recibos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'recibos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists recibos_borrar on storage.objects;
create policy recibos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'recibos' and public.es_miembro(((storage.foldername(name))[1])::uuid));

-- ---------- Tiempo real (los cambios de una aparecen en el celu de la otra) ----------
do $$
declare t text;
begin
  foreach t in array array['gastos','reglas','pagos','metas','hogares'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
create table if not exists public.cierres (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  de text check (de in ('a','b')),          -- quién transfirió (null si estaban a mano)
  monto integer not null default 0,         -- monto transferido para liquidar
  corte date not null default current_date, -- fijos y cuotas hasta esta fecha quedan liquidados
  gastos_total integer not null default 0,  -- suma de gastos del período (informativo)
  creado_por uuid default auth.uid(),
  creado timestamptz not null default now()
);

alter table public.cierres enable row level security;
drop policy if exists cierres_todo on public.cierres;
create policy cierres_todo on public.cierres for all
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));

do $$
begin
  execute 'alter publication supabase_realtime add table public.cierres';
exception when duplicate_object then null;
end $$;
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hogar_id uuid not null references public.hogares(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists push_subs_propias on public.push_subs;
create policy push_subs_propias on public.push_subs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.es_miembro(hogar_id));

-- Llaves de notificación: solo las lee la función del servidor (sin políticas = nadie más)
create table if not exists public.push_config (
  id integer primary key,
  public_key text not null,
  private_key text not null,
  creado timestamptz not null default now()
);
alter table public.push_config enable row level security;
