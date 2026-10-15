-- Production-safe code reservations preserve already-issued legacy conflicts.
-- The reservation primary key serializes all new assignments without renumbering citizens.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.vehicle_code_reservations (
  code text primary key,
  order_id uuid,
  legacy_conflict boolean not null default false,
  reserved_at timestamptz not null default now()
);
alter table app_private.vehicle_code_reservations enable row level security;
revoke all on app_private.vehicle_code_reservations from public, anon, authenticated;
insert into app_private.vehicle_code_reservations(code,order_id,legacy_conflict)
select ltrim(btrim(code),'0'),
       case when count(*)=1 then (array_agg(id order by id))[1] else null end,
       count(*)>1
from public.orders where btrim(code) ~ '^[0-9]+$'
group by ltrim(btrim(code),'0')
on conflict(code) do nothing;

create or replace function app_private.reserve_order_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare holder uuid;
begin
  if TG_OP='UPDATE' and NEW.code is not distinct from OLD.code then return NEW; end if;
  if nullif(btrim(NEW.code),'') is null then return NEW; end if;
  if NEW.code !~ '^[1-9][0-9]{0,8}$' then
    raise exception 'Invalid vehicle code' using errcode='22023';
  end if;
  insert into app_private.vehicle_code_reservations(code,order_id)
  values(NEW.code,NEW.id) on conflict(code) do nothing;
  select r.order_id into holder from app_private.vehicle_code_reservations r where r.code=NEW.code;
  if holder is distinct from NEW.id then
    raise exception 'Vehicle code already reserved' using errcode='23505';
  end if;
  return NEW;
end;
$$;
revoke all on function app_private.reserve_order_code() from public,anon,authenticated;
drop trigger if exists z_reserve_order_code on public.orders;
create trigger z_reserve_order_code before insert or update of code on public.orders
for each row execute function app_private.reserve_order_code();

-- Add the direct table index when legacy data permits it. The reservation PK is always active.
do $$ begin
  if not exists(select 1 from public.orders where btrim(code)~'^[0-9]+$'
                group by ltrim(btrim(code),'0') having count(*)>1) then
    create unique index if not exists orders_numeric_code_unique
      on public.orders ((ltrim(btrim(code),'0'))) where btrim(code)~'^[0-9]+$';
  end if;
end $$;

create or replace function public.assign_vehicle_code(p_order_id text, p_code text)
returns table(id text, code text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.orders%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.is_active and s.role in ('SUPER', 'ADMIN')
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if p_code is null or p_code !~ '^[1-9][0-9]{0,8}$' then
    raise exception 'Invalid vehicle code' using errcode = '22023';
  end if;

  -- Same code requests serialize. The unique index also protects direct writes.
  perform pg_catalog.pg_advisory_xact_lock(48102, p_code::integer);
  select o.* into target from public.orders o
    where o.id::text = p_order_id for update;
  if not found then
    raise exception 'Order unavailable' using errcode = 'P0002';
  end if;
  if nullif(btrim(target.license_plate::text), '') is not null then
    raise exception 'Only tuktuk orders can be coded' using errcode = '22023';
  end if;
  if nullif(btrim(target.code::text), '') is not null then
    raise exception 'Order already has a code' using errcode = '23505';
  end if;
  return query
    update public.orders o set code = p_code, status = 'coded',
      coded_at = (extract(epoch from now())*1000)::bigint,
      status_history = coalesce(o.status_history,'[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('status','coded','timestamp',(extract(epoch from now())*1000)::bigint,'by',auth.uid()::text))
    where o.id = target.id
    returning o.id::text, o.code::text;
  if not found then
    raise exception 'Update denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assign_vehicle_code(text, text) from public, anon;
grant execute on function public.assign_vehicle_code(text, text) to authenticated;
commit;
