-- Runs entirely inside a rolled-back transaction, including temporary rows and object metadata.
begin;
create temporary table otp_test_results(test text,passed boolean);
create function pg_temp.otp_assert(label text,condition boolean) returns void language plpgsql as $$
begin if condition is not true then raise exception 'OTP test failed: %',label; end if;
 insert into otp_test_results values(label,true); end $$;
select pg_temp.otp_assert('private OTP table has RLS',(select relrowsecurity from pg_class where oid='app_private.citizen_otp'::regclass));
select pg_temp.otp_assert('anon cannot read OTP rows',not has_table_privilege('anon','app_private.citizen_otp','select'));
select pg_temp.otp_assert('authenticated cannot read OTP rows',not has_table_privilege('authenticated','app_private.citizen_otp','select'));
select pg_temp.otp_assert('anon cannot issue OTP',not has_function_privilege('anon','public.citizen_otp_issue(uuid,text,text,text,text)','execute'));
select pg_temp.otp_assert('staff cannot bypass citizen verification',not has_function_privilege('authenticated','public.citizen_action(text,text,jsonb)','execute'));

select pg_temp.otp_assert('OTP reservation succeeds',(public.citizen_otp_issue('11111111-1111-4111-8111-111111111111','otp-test@example.invalid','order',repeat('a',64),repeat('b',64))->>'ok')::boolean);
select pg_temp.otp_assert('email cooldown applies atomically',not (public.citizen_otp_issue('22222222-2222-4222-8222-222222222222','otp-test@example.invalid','order',repeat('a',64),repeat('b',64))->>'ok')::boolean);
select pg_temp.otp_assert('unsent code is rejected',not (public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64))->>'ok')::boolean);
select public.citizen_otp_mark_sent('11111111-1111-4111-8111-111111111111',true);
select pg_temp.otp_assert('different IP cannot redeem code',not (public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('d',64),repeat('c',64))->>'ok')::boolean);
do $$ begin for i in 1..5 loop perform public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('d',64),repeat('b',64),repeat('c',64)); end loop; end $$;
select pg_temp.otp_assert('five wrong codes lock challenge',not (public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64))->>'ok')::boolean);

insert into app_private.citizen_otp(id,email,purpose,code_hash,ip_hash,sent,verified,proof_hash,proof_expires_at)
values('22222222-2222-4222-8222-222222222222','citizen@example.invalid','order',repeat('a',64),repeat('b',64),true,true,repeat('c',64),now()+interval '15 minutes');
insert into storage.objects(bucket_id,name,metadata) values('vehicle-images','images/citizen/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg','{"size":100,"mimetype":"image/jpeg"}');
do $$ begin
 begin perform public.citizen_action(repeat('c',64),'order_lookup','{}');raise exception 'Purpose bypass accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.otp_assert('purpose mismatch rejected',true);
 begin perform public.citizen_action(repeat('c',64),'order','{"owner_name":"OTP Test Citizen","national_id":"29901018888888","phone":"01000000001","vehicle_type":"توكتوك","vehicle_year":"2024","images":["images/other.jpg"]}');raise exception 'Foreign attachment accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.otp_assert('foreign attachment rejected',true);
end $$;
select public.citizen_action(repeat('c',64),'order','{"owner_name":"OTP Test Citizen","national_id":"29901018888888","phone":"01000000001","vehicle_type":"توكتوك","vehicle_year":"2024","code":"999999999","status":"approved","citizen_email":"attacker@example.invalid","images":["images/citizen/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg"]}');
select pg_temp.otp_assert('verified email is server assigned',exists(select 1 from public.orders where national_id='29901018888888' and citizen_email='citizen@example.invalid' and code is null and status='pending'));
do $$ begin
 begin perform public.citizen_action(repeat('c',64),'check_nid_available','{"national_id":"29901018888888"}');raise exception 'Replay accepted';exception when insufficient_privilege then null;end;
 perform pg_temp.otp_assert('consumed proof cannot be replayed',true);
end $$;
insert into app_private.citizen_otp(id,email,purpose,code_hash,ip_hash,sent,verified,proof_hash,proof_expires_at)
values('44444444-4444-4444-8444-444444444444','other@example.invalid','order_lookup',repeat('a',64),repeat('b',64),true,true,repeat('e',64),now()+interval '15 minutes'),
('55555555-5555-4555-8555-555555555555','citizen@example.invalid','order_lookup',repeat('a',64),repeat('b',64),true,true,repeat('f',64),now()+interval '15 minutes');
select pg_temp.otp_assert('verified stranger cannot see citizen record',public.citizen_action(repeat('e',64),'order_lookup','{"owner_name":"OTP Test Citizen","national_id":"29901018888888","phone":"01000000001"}')='[]'::jsonb);
select pg_temp.otp_assert('matching verified owner can inquire',jsonb_array_length(public.citizen_action(repeat('f',64),'order_lookup','{"owner_name":"OTP Test Citizen","national_id":"29901018888888","phone":"01000000001"}'))=1);

update app_private.citizen_otp set attempts=0,verified=false,expires_at=now()-interval '1 minute' where id='11111111-1111-4111-8111-111111111111';
select pg_temp.otp_assert('expired code rejected',not (public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('9',64))->>'ok')::boolean);
update app_private.citizen_otp set expires_at=now()+interval '5 minutes' where id='11111111-1111-4111-8111-111111111111';
select pg_temp.otp_assert('correct code grants a proof',(public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('9',64))->>'ok')::boolean);
select pg_temp.otp_assert('OTP redemption cannot be repeated',not (public.citizen_otp_verify('11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('8',64))->>'ok')::boolean);
insert into app_private.citizen_otp(id,email,purpose,code_hash,ip_hash,sent,verified,proof_hash,proof_expires_at)
values('66666666-6666-4666-8666-666666666666','complainant@example.invalid','complaint',repeat('a',64),repeat('b',64),true,true,repeat('7',64),now()+interval '15 minutes');
insert into storage.objects(bucket_id,name,metadata) select 'vehicle-images','images/citizen/66666666-6666-4666-8666-666666666666/'||v||'.jpg','{"size":100,"mimetype":"image/jpeg"}'::jsonb
from unnest(array['77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999']) v;
select public.citizen_action(repeat('7',64),'complaint',jsonb_build_object('owner_name','OTP Test Complainant','national_id','29901018888887','phone','01000000001','vehicle_type','توكتوك','vehicle_id','1234','complaint_type','أخرى','details','Temporary SQL verification','status','approved','reply','forged','citizen_email','attacker@example.invalid','images',jsonb_build_object(
'selfie','images/citizen/66666666-6666-4666-8666-666666666666/77777777-7777-4777-8777-777777777777.jpg',
'idCard','images/citizen/66666666-6666-4666-8666-666666666666/88888888-8888-4888-8888-888888888888.jpg',
'vehicleImage','images/citizen/66666666-6666-4666-8666-666666666666/99999999-9999-4999-8999-999999999999.jpg','problemImages','[]'::jsonb)));
select pg_temp.otp_assert('complaint email and pending defaults are server assigned',exists(select 1 from public.complaints where national_id='29901018888887' and citizen_email='complainant@example.invalid' and status='pending' and reply is null));
select * from otp_test_results;
rollback;
