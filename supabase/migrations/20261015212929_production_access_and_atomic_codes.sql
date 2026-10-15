begin;
-- Production-safe code reservations preserve already-issued legacy conflicts.
-- The reservation primary key serializes all new assignments without renumbering citizens.
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
-- Metadata and access hardening; preserves citizen INSERT and private staff reads.
-- Boolean helpers must be FALSE for non-staff; NULL made IF NOT checks fail open.
create or replace function public.is_admin() returns boolean language sql stable
set search_path='' as $$ select coalesce(public.current_staff_role() in ('ADMIN','SUPER'),false) $$;
create or replace function public.is_super() returns boolean language sql stable
set search_path='' as $$ select coalesce(public.current_staff_role()='SUPER',false) $$;
alter function public.current_staff_role() set search_path='';
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',t.tablename);
    execute format('revoke truncate,references,trigger on public.%I from anon,authenticated',t.tablename);
  end loop;
end $$;

drop policy if exists orders_insert_public on public.orders;
create policy orders_insert_public on public.orders for insert to anon with check (
  length(btrim(owner_name)) between 3 and 200 and national_id ~ '^[23][0-9]{13}$'
  and phone ~ '^01[0125][0-9]{8}$' and status='pending' and code is null and coded_at is null
);
drop policy if exists orders_insert_admin on public.orders;
create policy orders_insert_admin on public.orders for insert to authenticated with check (public.is_admin());

drop policy if exists complaints_insert_public on public.complaints;
create policy complaints_insert_public on public.complaints for insert to anon with check (
  length(btrim(owner_name)) between 3 and 200 and national_id ~ '^[23][0-9]{13}$'
  and phone ~ '^01[0125][0-9]{8}$' and status='pending' and reply is null and replied_at is null
  and length(details) between 1 and 10000
);
drop policy if exists complaints_insert_admin on public.complaints;
create policy complaints_insert_admin on public.complaints for insert to authenticated with check (public.is_admin());

drop policy if exists supervisor_logs_insert_staff on public.supervisor_logs;
create policy supervisor_logs_insert_staff on public.supervisor_logs for insert to authenticated with check (
  public.is_staff()
  and username=(select s.username from public.staff s where s.user_id=auth.uid() and s.is_active)
  and user_role=public.current_staff_role()::text
);
drop policy if exists admin_logs_insert_staff on public.admin_logs;
create policy admin_logs_insert_staff on public.admin_logs for insert to authenticated with check (
  public.is_staff()
  and username=(select s.username from public.staff s where s.user_id=auth.uid() and s.is_active)
  and role=public.current_staff_role()::text
);

-- Remove broad policies for this bucket; preserve any policies for unrelated buckets.
drop policy if exists auth_delete_images on storage.objects;
drop policy if exists "Allow authenticated read images ur1et5_0" on storage.objects;
drop policy if exists auth_read_images on storage.objects;
drop policy if exists "Allow authenticated read vehicle-images" on storage.objects;
drop policy if exists auth_upload_images on storage.objects;
drop policy if exists anon_upload_only on storage.objects;
drop policy if exists vehicle_images_read_staff on storage.objects;
create policy vehicle_images_read_staff on storage.objects for select to authenticated
  using (bucket_id='vehicle-images' and public.is_staff());
drop policy if exists vehicle_images_delete_super on storage.objects;
create policy vehicle_images_delete_super on storage.objects for delete to authenticated
  using (bucket_id='vehicle-images' and public.is_super());
create policy auth_upload_images on storage.objects for insert to authenticated
  with check (bucket_id='vehicle-images' and public.is_admin()
    and name ~ '^images/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$');
create policy anon_upload_only on storage.objects for insert to anon
  with check (bucket_id='vehicle-images'
    and name ~ '^images/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$');

-- Public trigger functions do not need to be RPC endpoints.
revoke execute on function public.force_citizen_order_defaults() from public,anon,authenticated;
revoke execute on function public.force_citizen_complaint_defaults() from public,anon,authenticated;
revoke execute on function public.check_duplicate_national_id() from public,anon,authenticated;
revoke execute on function public.check_complaint_limit() from public,anon,authenticated;
revoke execute on function public.enforce_complaint_limit() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
