-- Run only after verifying the deployed Pages API and transactional email delivery.
begin;
revoke insert on public.orders,public.complaints from anon;
revoke execute on function public.get_my_order(text,text,text),public.get_my_complaints(text,text,text),
 public.check_nid_available(text),public.can_submit_complaint(text) from anon;
drop policy if exists orders_insert_public on public.orders;
drop policy if exists complaints_insert_public on public.complaints;
drop policy if exists anon_upload_only on storage.objects;
drop policy if exists citizen_upload_boundary on storage.objects;
create policy citizen_upload_boundary on storage.objects as restrictive for all to anon using(false) with check(false);
create or replace function app_private.require_staff_session() returns void
language plpgsql security invoker set search_path='' as $$
begin
 if current_user='service_role' then return; end if;
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.is_staff() then raise exception 'Approved staff session required' using errcode='42501'; end if;
end $$;
update app_private.citizen_otp_config set enabled=true where id=true;
notify pgrst,'reload schema';
commit;
