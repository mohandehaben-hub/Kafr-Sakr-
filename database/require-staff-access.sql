-- Supersedes the public citizen access in production-hardening.sql.
-- Apply after the original production migration. No citizen data is changed.
begin;

drop policy if exists orders_insert_public on public.orders;
drop policy if exists complaints_insert_public on public.complaints;
drop policy if exists anon_upload_only on storage.objects;

revoke all privileges on all tables in schema public from public, anon;
revoke all privileges on all sequences in schema public from public, anon;
revoke create on schema public from public, anon, authenticated;
-- New objects must be explicitly exposed in their own migration.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Active membership and a real, unexpired server-side session are both required.
create or replace function public.current_staff_role()
returns public.staff_role language sql stable security definer set search_path='' as $$
  select s.role from public.staff s
  where s.user_id=auth.uid() and s.is_active
    and exists (
      select 1 from auth.sessions a
      where a.id=nullif(auth.jwt()->>'session_id','')::uuid and a.user_id=s.user_id
        and (a.not_after is null or a.not_after>now())
    )
$$;

-- These read helpers now use the caller's RLS, rather than bypassing it.
alter function public.get_my_order(text,text,text) security invoker;
alter function public.get_my_complaints(text,text,text) security invoker;
alter function public.check_nid_available(text) security invoker;
alter function public.can_submit_complaint(text) security invoker;
alter function public.get_staff_list() security invoker;

-- Default-deny all RPCs. Internal triggers and obsolete maintenance RPCs
-- are deliberately absent from this small allowlist.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
    execute format('alter function %s set search_path=''''',f.signature);
  end loop;
end $$;
grant execute on function public.current_staff_role(),public.is_staff(),public.is_admin(),public.is_super(),
  public.assign_vehicle_code(text,text),public.get_my_order(text,text,text),
  public.get_my_complaints(text,text,text),public.check_nid_available(text),
  public.can_submit_complaint(text),public.get_staff_list(),
  public.create_supervisor_account(text,text,text,text),public.delete_staff_account(uuid)
to authenticated;

-- Auth hooks retain the existing supabase_auth_admin grant; API clients
-- cannot spoof their arguments. Session protection covers Storage as well.
drop policy if exists staff_session_required on storage.objects;
create policy staff_session_required on storage.objects as restrictive
for all to anon,authenticated
using (case when (select auth.uid()) is null then false else public.is_staff() end)
with check (case when (select auth.uid()) is null then false else public.is_staff() end);

CREATE OR REPLACE FUNCTION public.create_supervisor_account(p_username text, p_password text, p_full_name text DEFAULT ''::text, p_role text DEFAULT 'VIEWER'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    DECLARE
        v_clean_username text;
        v_email text;
        v_user_id uuid;
        v_encrypted_pw text;
        v_role public.staff_role;
    BEGIN
        IF NOT public.is_super() THEN
            RAISE EXCEPTION 'غير مصرح: هذه العملية خاصة بالمدير العام فقط.';
        END IF;

        v_clean_username := lower(trim(p_username));
        IF v_clean_username IS NULL OR v_clean_username !~ '^[a-z][a-z0-9._-]{2,63}$' THEN
            RAISE EXCEPTION 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.';
        END IF;

        IF p_password IS NULL OR length(p_password) < 12 OR length(p_password) > 72
          OR p_password !~ '[a-z]' OR p_password !~ '[A-Z]' OR p_password !~ '[0-9]' THEN
            RAISE EXCEPTION 'كلمة المرور تحتاج 12 إلى 72 خانة وحروفًا كبيرة وصغيرة وأرقامًا.';
        END IF;

        IF EXISTS (SELECT 1 FROM public.staff WHERE lower(username) = v_clean_username) THEN
            RAISE EXCEPTION 'اسم المستخدم موجود بالفعل، يرجى اختيار اسم آخر.';
        END IF;

        v_email := v_clean_username || '@gmail.com';

        IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
            RAISE EXCEPTION 'البريد أو اسم المستخدم مسجل مسبقاً.';
        END IF;

        BEGIN
            v_role := upper(trim(p_role))::public.staff_role;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'VIEWER'::public.staff_role;
        END;

        v_user_id := gen_random_uuid();
        v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change, email_change_token_new
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
            v_email, v_encrypted_pw, now(),
            jsonb_build_object('username', v_clean_username, 'full_name', p_full_name, 'email_verified', true),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            now(), now(),
            '', '', '', ''
        );

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            'email', v_user_id::text, now(), now(), now()
        );

        INSERT INTO public.staff (
            user_id, username, full_name, role, is_active, created_at, created_by
        ) VALUES (
            v_user_id, v_clean_username, coalesce(nullif(trim(p_full_name), ''), v_clean_username),
            v_role, true, now(), auth.uid()
        );

        RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'username', v_clean_username, 'role', v_role);
    END;
    $function$
;
-- Reject unauthenticated and non-staff requests before PostgREST dispatch.
-- Storage and Realtime still rely on their own RLS policies.
create or replace function app_private.require_staff_session() returns void
language plpgsql security invoker set search_path='' as $$
begin
  if current_user='service_role' then return; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.is_staff() then raise exception 'Approved staff session required' using errcode='42501'; end if;
end;
$$;
revoke all on function app_private.require_staff_session() from public;
grant usage on schema app_private to anon,authenticated,service_role;
grant execute on function app_private.require_staff_session() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request='app_private.require_staff_session';
notify pgrst,'reload config';

notify pgrst,'reload schema';
commit;
