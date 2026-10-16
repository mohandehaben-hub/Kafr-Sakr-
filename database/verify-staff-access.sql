-- Run inside a transaction; every synthetic account/session/order is rolled back.
begin;
create temporary table staff_access_results(test text, passed boolean) on commit drop;
grant insert,select on staff_access_results to anon,authenticated;
do $$
declare
  su uuid; vu uuid; sid uuid:=gen_random_uuid(); vsid uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); uid uuid; asid uuid:=gen_random_uuid();
  denied boolean; n bigint; account jsonb;
begin
  select user_id into strict su from public.staff where role='SUPER' and is_active limit 1;
  select user_id into strict vu from public.staff where role='VIEWER' and is_active limit 1;
  insert into auth.sessions(id,user_id) values(sid,su),(vsid,vu);
  insert into public.orders(id,owner_name,national_id,phone,vehicle_type,submitted_at,ref_number)
  values(a,'Auth security smoke','30001019999001','01000000000','توكتوك',0,'AUTH-SMOKE-'||a),
        (b,'Auth security smoke','30001019999002','01000000000','توكتوك',0,'AUTH-SMOKE-'||b);

  if exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname='public' and has_function_privilege('anon',p.oid,'execute')
    ) then
    raise exception 'Anonymous administrative RPC access remains';
  end if;
  insert into staff_access_results values('Anonymous direct RPC access fully closed',true);
  if exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname='public' and c.relkind in ('r','v','m','p')
    and has_table_privilege('anon',c.oid,'SELECT,UPDATE,DELETE,TRUNCATE')) then
    raise exception 'Anonymous private table privilege remains';
  end if;
  insert into staff_access_results values('Anonymous cannot read or modify existing table data',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  perform set_config('request.path','/orders',true);
  perform set_config('request.method','GET',true);
  execute 'set local role anon';
  denied:=false;
  begin perform app_private.require_staff_session(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous admin read guard bypass'; end if;
  insert into staff_access_results values('Anonymous table read blocked before dispatch',true);
  perform set_config('request.path','/rpc/get_my_order',true);
  perform set_config('request.method','POST',true);
  denied:=false;
  begin perform app_private.require_staff_session(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Legacy citizen route bypass'; end if;
  insert into staff_access_results values('Legacy citizen paths require server verification',true);
  denied:=false;
  begin perform public.get_my_order('30001019999001','Auth security smoke','01000000000'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct citizen lookup accepted'; end if;
  insert into staff_access_results values('Direct anonymous lookup denied',true);
  denied:=false;
  begin insert into public.orders(owner_name,national_id,submitted_at) values('Citizen smoke','30001019999004',0); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct citizen insert accepted'; end if;
  insert into staff_access_results values('Direct anonymous registration denied',true);
  denied:=false;
  begin insert into public.complaints(owner_name,national_id,submitted_at) values('Citizen smoke','30001019999004',0); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct complaint accepted'; end if;
  insert into staff_access_results values('Direct anonymous complaint denied',true);
  denied:=false;
  begin insert into storage.objects(bucket_id,name) values('vehicle-images','images/security-smoke-'||a||'.jpg'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Direct anonymous image upload accepted'; end if;
  insert into staff_access_results values('Direct image upload requires verified server route',true);
  execute 'reset role';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',su,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  perform app_private.require_staff_session();
  if public.current_staff_role()<>'SUPER' then raise exception 'SUPER access broken'; end if;
  perform public.assign_vehicle_code(a::text,'999999990');
  insert into staff_access_results values('Valid SUPER session can code',true);
  perform public.link_citizen_email('orders',a,'verified-citizen@example.invalid');
  insert into staff_access_results values('SUPER can associate legacy citizen email',true);
  denied:=false;
  begin perform public.assign_vehicle_code(b::text,'999999990'); exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Duplicate accepted'; end if;
  insert into staff_access_results values('Duplicate code denied',true);
  denied:=false;
  begin perform public.create_supervisor_account('security-smoke','123456','Smoke','VIEWER'); exception when others then denied:=true; end;
  if not denied then raise exception 'Weak password accepted'; end if;
  insert into staff_access_results values('Weak staff password denied',true);
  account:=public.create_supervisor_account('security-smoke-'||substr(a::text,1,8),'Smoke-Only-Strong-123!','Smoke','ADMIN');
  uid:=(account->>'user_id')::uuid;
  if uid is null then raise exception 'Strong account creation broken'; end if;
  insert into staff_access_results values('SUPER can create staff with strong password',true);
  execute 'reset role';
  insert into auth.sessions(id,user_id) values(asid,uid);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',asid)::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin update public.orders set citizen_email='attacker@example.invalid' where id=a; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'ADMIN reassigned citizen email'; end if;
  insert into staff_access_results values('ADMIN cannot change citizen email directly',true);
  denied:=false;
  begin perform public.link_citizen_email('orders',a,'attacker@example.invalid'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'ADMIN reassigned email via RPC'; end if;
  insert into staff_access_results values('ADMIN cannot associate citizen email via RPC',true);
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',su,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  perform public.delete_staff_account(uid);
  insert into staff_access_results values('SUPER staff deletion works',true);
  execute 'reset role';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',vu,'role','authenticated','session_id',vsid)::text,true);
  execute 'set local role authenticated';
  perform app_private.require_staff_session();
  select count(*) into n from public.orders where id=a;
  if n<>1 then raise exception 'VIEWER read broken'; end if;
  insert into staff_access_results values('Valid VIEWER can read',true);
  denied:=false;
  begin perform public.assign_vehicle_code(b::text,'999999991'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'VIEWER coding accepted'; end if;
  update public.orders set code='999999991' where id=b;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'VIEWER update accepted'; end if;
  insert into staff_access_results values('VIEWER write and coding denied',true);
  denied:=false;
  begin perform public.link_citizen_email('orders',a,'attacker@example.invalid'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'VIEWER reassigned citizen email'; end if;
  insert into staff_access_results values('VIEWER cannot associate citizen email',true);
  denied:=false;
  begin perform public.create_supervisor_account('security-smoke','Strong-Smoke-123!','Smoke','SUPER'); exception when others then denied:=true; end;
  if not denied then raise exception 'VIEWER created account'; end if;
  insert into staff_access_results values('VIEWER account creation denied',true);
  select count(*) into n from public.get_staff_list();
  if n<>0 then raise exception 'VIEWER listed staff'; end if;
  insert into staff_access_results values('VIEWER staff list restricted',true);
  execute 'reset role';

  delete from auth.sessions where id=vsid;
  execute 'set local role authenticated';
  if public.is_staff() then raise exception 'Deleted session still accepted'; end if;
  denied:=false;
  begin perform app_private.require_staff_session(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Revoked session guard bypass'; end if;
  insert into staff_access_results values('Revoked session denied',true);
  execute 'reset role';
  update public.staff set is_active=false where user_id=su;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',su,'role','authenticated','session_id',sid)::text,true);
  execute 'set local role authenticated';
  if public.is_super() then raise exception 'Disabled staff still SUPER'; end if;
  insert into staff_access_results values('Disabled staff denied immediately',true);
  execute 'reset role';

  if exists(select 1 from storage.buckets where id='vehicle-images' and public) then raise exception 'Images public'; end if;
  insert into staff_access_results values('Private images preserved',true);
end $$;
select jsonb_agg(jsonb_build_object('test',test,'passed',passed)) as results from staff_access_results;
rollback;
