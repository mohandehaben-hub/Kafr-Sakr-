begin;
grant insert on public.orders,public.complaints to anon;
drop policy if exists "anon_upload_only" on "storage"."objects";
create policy "anon_upload_only" on "storage"."objects" as PERMISSIVE for INSERT to anon with check (((bucket_id = 'vehicle-images'::text) AND (name ~ '^images/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'::text)));
drop policy if exists "orders_insert_public" on "public"."orders";
create policy "orders_insert_public" on "public"."orders" as PERMISSIVE for INSERT to anon with check ((((length(btrim(owner_name)) >= 3) AND (length(btrim(owner_name)) <= 200)) AND (national_id ~ '^[23][0-9]{13}$'::text) AND (phone ~ '^01[0125][0-9]{8}$'::text) AND (status = 'pending'::text) AND (code IS NULL) AND (coded_at IS NULL)));
drop policy if exists "complaints_insert_public" on "public"."complaints";
create policy "complaints_insert_public" on "public"."complaints" as PERMISSIVE for INSERT to anon with check ((((length(btrim(owner_name)) >= 3) AND (length(btrim(owner_name)) <= 200)) AND (national_id ~ '^[23][0-9]{13}$'::text) AND (phone ~ '^01[0125][0-9]{8}$'::text) AND (status = 'pending'::text) AND (reply IS NULL) AND (replied_at IS NULL) AND ((length(details) >= 1) AND (length(details) <= 10000))));
CREATE OR REPLACE FUNCTION public.can_submit_complaint(p_national_id text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT (
        SELECT count(*) FROM public.complaints WHERE national_id = btrim(p_national_id)
    ) < 5;
$function$
;
alter function public.can_submit_complaint(text) set search_path='';
grant execute on function public.can_submit_complaint(text) to anon,authenticated;
CREATE OR REPLACE FUNCTION public.check_nid_available(p_national_id text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.orders WHERE national_id = btrim(p_national_id)
    );
$function$
;
alter function public.check_nid_available(text) set search_path='';
grant execute on function public.check_nid_available(text) to anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_complaints(p_national_id text, p_owner_name text, p_phone text)
 RETURNS TABLE(complaint_type text, details text, status text, reply text, submitted_at bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_national_id IS NULL OR btrim(p_national_id) !~ '^[23][0-9]{13}$'
      OR p_phone IS NULL OR btrim(p_phone) !~ '^01[0125][0-9]{8}$'
      OR p_owner_name IS NULL OR length(btrim(p_owner_name)) NOT BETWEEN 3 AND 200 THEN
      RAISE EXCEPTION 'Invalid lookup details' USING errcode='22023';
    END IF;
    RETURN QUERY
    SELECT c.complaint_type, c.details, c.status, c.reply, c.submitted_at
    FROM public.complaints c
    WHERE c.national_id = btrim(p_national_id)
      AND c.phone       = btrim(p_phone)
      AND lower(btrim(c.owner_name)) = lower(btrim(p_owner_name))
    ORDER BY c.submitted_at DESC
    LIMIT 20;
END;
$function$
;
alter function public.get_my_complaints(text,text,text) set search_path='';
grant execute on function public.get_my_complaints(text,text,text) to anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_order(p_national_id text, p_owner_name text, p_phone text)
 RETURNS TABLE(owner_name text, vehicle_type text, vehicle_year text, code text, ref_number text, status text, submitted_at bigint, coded_at bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_national_id IS NULL OR btrim(p_national_id) !~ '^[23][0-9]{13}$'
      OR p_phone IS NULL OR btrim(p_phone) !~ '^01[0125][0-9]{8}$'
      OR p_owner_name IS NULL OR length(btrim(p_owner_name)) NOT BETWEEN 3 AND 200 THEN
      RAISE EXCEPTION 'Invalid lookup details' USING errcode='22023';
    END IF;
    RETURN QUERY
    SELECT o.owner_name, o.vehicle_type, o.vehicle_year, o.code,
           o.ref_number, o.status, o.submitted_at, o.coded_at
    FROM public.orders o
    WHERE o.national_id = btrim(p_national_id)
      AND o.phone       = btrim(p_phone)
      AND lower(btrim(o.owner_name)) = lower(btrim(p_owner_name))
    ORDER BY o.submitted_at DESC
    LIMIT 1;
END;
$function$
;
alter function public.get_my_order(text,text,text) set search_path='';
grant execute on function public.get_my_order(text,text,text) to anon,authenticated;
drop policy if exists staff_session_required on storage.objects;
create policy staff_session_required on storage.objects as restrictive
for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists citizen_upload_boundary on storage.objects;
create policy citizen_upload_boundary on storage.objects as restrictive for all to anon
using (false) with check (bucket_id='vehicle-images' and name ~ '^images/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$');
create or replace function app_private.require_staff_session() returns void
language plpgsql security invoker set search_path='' as $$
declare endpoint text:=ltrim(current_setting('request.path',true),'/');
  method text:=current_setting('request.method',true);
begin
  if current_user='service_role' then return; end if;
  if auth.uid() is null then
    if method='POST' and endpoint in ('orders','complaints','rpc/get_my_order','rpc/get_my_complaints','rpc/check_nid_available','rpc/can_submit_complaint') then return; end if;
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.is_staff() then raise exception 'Approved staff session required' using errcode='42501'; end if;
end;
$$;
notify pgrst,'reload schema';
commit;
