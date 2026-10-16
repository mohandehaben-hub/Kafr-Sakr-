-- Stage this migration before deploying the Pages API. Activation is a separate transaction.
begin;
create table app_private.citizen_otp_config (id boolean primary key default true check(id), enabled boolean not null default false);
insert into app_private.citizen_otp_config values(true,false);
create table app_private.citizen_otp (
 id uuid primary key, email text not null, purpose text not null check(purpose in ('order','complaint','order_lookup','complaint_lookup')),
 code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'), ip_hash text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
 attempts integer not null default 0, sent boolean not null default false, verified boolean not null default false,
 proof_hash text unique, proof_expires_at timestamptz, consumed boolean not null default false, uploads integer not null default 0,
 upload_bytes bigint not null default 0
);
create index citizen_otp_email_created on app_private.citizen_otp(email,created_at desc);
create index citizen_otp_ip_created on app_private.citizen_otp(ip_hash,created_at desc);
alter table app_private.citizen_otp_config enable row level security;
alter table app_private.citizen_otp enable row level security;
revoke all on app_private.citizen_otp,app_private.citizen_otp_config from public,anon,authenticated;
grant select,insert,update,delete on app_private.citizen_otp to service_role;
grant select on app_private.citizen_otp_config to service_role;
alter table public.orders add column citizen_email text;
alter table public.complaints add column citizen_email text;
create function app_private.guard_citizen_email() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.citizen_email is distinct from old.citizen_email and current_user<>'service_role' and not public.is_super() then
   raise exception 'SUPER required to associate citizen email' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function app_private.guard_citizen_email() from public,anon,authenticated;
create trigger guard_citizen_email before update on public.orders for each row execute function app_private.guard_citizen_email();
create trigger guard_citizen_email before update on public.complaints for each row execute function app_private.guard_citizen_email();

create function public.citizen_otp_enabled() returns boolean language sql security invoker set search_path='' as $$
 select enabled from app_private.citizen_otp_config where id=true
$$;
create function public.citizen_otp_issue(p_id uuid,p_email text,p_purpose text,p_code_hash text,p_ip_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_email<>lower(btrim(p_email)) or length(p_email)>254 or p_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
   or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid verification request' using errcode='22023'; end if;
 -- Serializes reservation of the free daily quota and all per-email/IP counters.
 perform pg_advisory_xact_lock(728419610);
 delete from app_private.citizen_otp c where created_at<now()-interval '2 days'
   and (consumed or not exists(select 1 from storage.objects o where o.bucket_id='vehicle-images' and o.name like 'images/citizen/'||c.id::text||'/%'));
 if (select count(*) from app_private.citizen_otp where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=250
 or (select count(*) from app_private.citizen_otp where email=p_email and created_at>now()-interval '1 hour')>=5
 or exists(select 1 from app_private.citizen_otp where email=p_email and created_at>now()-interval '60 seconds')
 or (select count(*) from app_private.citizen_otp where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=20 then
 return jsonb_build_object('ok',false,'reason','rate_limited'); end if;
 insert into app_private.citizen_otp(id,email,purpose,code_hash,ip_hash) values(p_id,p_email,p_purpose,p_code_hash,p_ip_hash);
 return jsonb_build_object('ok',true);
end $$;
create function public.citizen_otp_mark_sent(p_id uuid,p_sent boolean) returns void language sql security invoker set search_path='' as $$
 update app_private.citizen_otp set sent=p_sent where id=p_id and not verified
$$;
create function public.citizen_otp_verify(p_id uuid,p_code_hash text,p_ip_hash text,p_proof_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c app_private.citizen_otp;
begin
 select * into c from app_private.citizen_otp where id=p_id for update;
 if not found or not c.sent or c.verified or c.attempts>=5 or c.expires_at<=now() or c.ip_hash<>p_ip_hash
 or p_proof_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false); end if;
 update app_private.citizen_otp set attempts=attempts+1 where id=c.id;
 if c.code_hash<>p_code_hash then return jsonb_build_object('ok',false); end if;
 update app_private.citizen_otp set verified=true,proof_hash=p_proof_hash,proof_expires_at=now()+interval '15 minutes' where id=c.id;
 return jsonb_build_object('ok',true,'purpose',c.purpose,'id',c.id);
end $$;

-- Only the trusted Pages server can call this RPC; all fields are explicitly selected.
create function public.citizen_action(p_proof_hash text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
<<citizen>>
declare c app_private.citizen_otp; result jsonb; nid text:=btrim(p_payload->>'national_id');
 owner_name text:=btrim(p_payload->>'owner_name'); phone text:=btrim(p_payload->>'phone'); images jsonb:=p_payload->'images';
 image_path text; paths text[]; new_id uuid; reference text;
begin
 select * into c from app_private.citizen_otp where proof_hash=p_proof_hash for update;
 if not found or not c.verified or c.consumed or c.proof_expires_at<=now() then
 raise exception 'Email verification required' using errcode='42501'; end if;
 if p_action='upload' and c.purpose in ('order','complaint') then
   if c.uploads>=6 then raise exception 'Upload limit reached' using errcode='22023'; end if;
   if coalesce((p_payload->>'size')::bigint,0) not between 4 and 1572864 then raise exception 'Invalid upload size' using errcode='22023'; end if;
   perform pg_advisory_xact_lock(728419610);
   if (select coalesce(sum(upload_bytes),0) from app_private.citizen_otp where created_at>now()-interval '24 hours')+(p_payload->>'size')::bigint>67108864
     or (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id='vehicle-images')+(p_payload->>'size')::bigint>838860800 then
     raise exception 'Storage quota reached' using errcode='22023'; end if;
   update app_private.citizen_otp set uploads=uploads+1,upload_bytes=upload_bytes+(p_payload->>'size')::bigint where id=c.id;
   return jsonb_build_object('prefix','images/citizen/'||c.id::text||'/');
 end if;
 if p_action not in (c.purpose,'check_nid_available','can_submit_complaint') then
 raise exception 'Verification purpose mismatch' using errcode='42501'; end if;
 if nid is null or nid !~ '^[23][0-9]{13}$' then raise exception 'Invalid national ID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(nid,781));
 if p_action='check_nid_available' and c.purpose='order' then
   return to_jsonb(not exists(select 1 from public.orders o where o.national_id=nid));
 elsif p_action='can_submit_complaint' and c.purpose='complaint' then
   return to_jsonb((select count(*) from public.complaints o where o.national_id=nid)<5);
 end if;
 if p_action<>c.purpose or owner_name is null or length(owner_name) not between 3 and 200
 or phone is null or phone !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid citizen details' using errcode='22023'; end if;
 if p_action='order_lookup' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (
     select o.owner_name,o.vehicle_type,o.vehicle_year,o.code,o.ref_number,o.status,o.submitted_at,o.coded_at
     from public.orders o where o.national_id=nid and o.phone=citizen.phone and lower(btrim(o.owner_name))=lower(citizen.owner_name)
       and o.citizen_email=c.email order by o.submitted_at desc limit 1
   ) t;
 elsif p_action='complaint_lookup' then
   select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (
     select o.complaint_type,o.details,o.status,o.reply,o.submitted_at
     from public.complaints o where o.national_id=nid and o.phone=citizen.phone and lower(btrim(o.owner_name))=lower(citizen.owner_name)
       and o.citizen_email=c.email order by o.submitted_at desc limit 20
   ) t;
 else
   if p_action='order' then
     if jsonb_typeof(images) is distinct from 'array' or jsonb_array_length(images) not between 1 and 6 then
       raise exception 'Images required' using errcode='22023'; end if;
     select array_agg(v) into paths from jsonb_array_elements_text(images) v;
   elsif p_action='complaint' then
     if jsonb_typeof(images) is distinct from 'object' or jsonb_typeof(images->'problemImages') is distinct from 'array'
       or jsonb_array_length(images->'problemImages')>3 or nullif(images->>'selfie','') is null
       or nullif(images->>'idCard','') is null or nullif(images->>'vehicleImage','') is null
       or length(coalesce(p_payload->>'details','')) not between 1 and 10000 then
       raise exception 'Complaint details or images missing' using errcode='22023'; end if;
     select array[images->>'selfie',images->>'idCard',images->>'vehicleImage']||coalesce(array_agg(v),'{}'::text[])
       into paths from jsonb_array_elements_text(images->'problemImages') v;
   end if;
   foreach image_path in array paths loop
     if image_path !~ ('^images/citizen/'||c.id::text||'/[a-f0-9-]{36}\.jpg$')
       or not exists(select 1 from storage.objects o where o.bucket_id='vehicle-images' and o.name=image_path) then
       raise exception 'Attachment does not belong to this verification' using errcode='42501'; end if;
   end loop;
   if length(coalesce(p_payload->>'vehicle_type','')) not between 1 and 100 then raise exception 'Vehicle type required' using errcode='22023'; end if;
   if p_action='order' then
     if length(coalesce(p_payload->>'vehicle_year','')) not between 4 and 10 or length(coalesce(p_payload->>'address',''))>1000 then raise exception 'Invalid vehicle details' using errcode='22023'; end if;
     reference:='KS-'||upper(replace(gen_random_uuid()::text,'-',''));
     insert into public.orders(owner_name,national_id,phone,vehicle_type,vehicle_year,address,images,status,code,submitted_at,ref_number,citizen_email)
       values(owner_name,nid,phone,p_payload->>'vehicle_type',p_payload->>'vehicle_year',p_payload->>'address',images,'pending',null,
         (extract(epoch from now())*1000)::bigint,reference,c.email) returning id into new_id;
     result:=jsonb_build_object('id',new_id,'ref_number',reference);
   else
     if length(coalesce(p_payload->>'vehicle_id','')) not between 1 and 100 or length(coalesce(p_payload->>'complaint_type','')) not between 1 and 200 then raise exception 'Invalid complaint details' using errcode='22023'; end if;
     insert into public.complaints(owner_name,national_id,phone,vehicle_type,vehicle_id,complaint_type,details,images,status,submitted_at,citizen_email)
       values(owner_name,nid,phone,p_payload->>'vehicle_type',p_payload->>'vehicle_id',p_payload->>'complaint_type',p_payload->>'details',images,'pending',
         (extract(epoch from now())*1000)::bigint,c.email) returning id into new_id;
     result:=jsonb_build_object('id',new_id);
   end if;
 end if;
 update app_private.citizen_otp set consumed=true where id=c.id;
 return result;
end $$;

create function public.citizen_orphan_uploads() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(t.name),'[]'::jsonb) from (
   select o.name from storage.objects o join app_private.citizen_otp c on o.name like 'images/citizen/'||c.id::text||'/%'
   where o.bucket_id='vehicle-images' and not c.consumed and c.created_at<now()-interval '1 day' limit 20
 ) t
$$;
revoke all on function public.citizen_orphan_uploads() from public,anon,authenticated;
grant execute on function public.citizen_orphan_uploads() to service_role;

-- Staff must establish the citizen's identity before associating an old record.
create function public.link_citizen_email(p_table text,p_id uuid,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if not public.is_super() then raise exception 'SUPER required' using errcode='42501'; end if;
 if p_email<>lower(btrim(p_email)) or length(p_email)>254 or p_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
   or p_table not in ('orders','complaints') then raise exception 'Invalid email association' using errcode='22023'; end if;
 execute format('update public.%I set citizen_email=$1 where id=$2',p_table) using p_email,p_id;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Record not found'; end if;
 insert into public.supervisor_logs(username,user_role,action,details,record_uuid)
 select s.username,s.role::text,'link_citizen_email','Verified citizen email associated with '||p_table,p_id
 from public.staff s where s.user_id=auth.uid();
end $$;
revoke all on function public.citizen_otp_enabled(),public.citizen_otp_issue(uuid,text,text,text,text),
 public.citizen_otp_mark_sent(uuid,boolean),public.citizen_otp_verify(uuid,text,text,text),public.citizen_action(text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.citizen_otp_enabled(),public.citizen_otp_issue(uuid,text,text,text,text),
 public.citizen_otp_mark_sent(uuid,boolean),public.citizen_otp_verify(uuid,text,text,text),public.citizen_action(text,text,jsonb) to service_role;
revoke all on function public.link_citizen_email(text,uuid,text) from public,anon;
grant execute on function public.link_citizen_email(text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
