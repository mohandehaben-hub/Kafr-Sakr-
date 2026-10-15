-- Metadata and access hardening; preserves citizen INSERT and private staff reads.
begin;
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
