-- The caller sets app.verify_super and app.verify_viewer inside this transaction.
-- All synthetic records and reservations are rolled back.
-- Historical verification for the original migration. After the staff-only
-- migration, use verify-staff-access.sql (anonymous inserts are now forbidden).
begin;
create temporary table smoke_results(test text, passed boolean) on commit drop;
grant insert,select on smoke_results to anon,authenticated;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  n bigint; denied boolean;
  su text:=current_setting('app.verify_super'); vu text:=current_setting('app.verify_viewer');
begin
  insert into public.orders(id,owner_name,national_id,phone,vehicle_type,submitted_at,ref_number)
  values(a,'Deployment smoke test','30001019999001','01000000000','توكتوك',0,'SMOKE-'||a),
        (b,'Deployment smoke test','30001019999002','01000000000','توكتوك',0,'SMOKE-'||b);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',su,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.assign_vehicle_code(a::text,'999999990');
  insert into smoke_results values('SUPER atomic coding',true);
  denied:=false;
  begin perform public.assign_vehicle_code(b::text,'999999990'); exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Duplicate code was accepted'; end if;
  insert into smoke_results values('Duplicate code rejected',true);
  execute 'reset role';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',vu,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin perform public.assign_vehicle_code(b::text,'999999991'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'VIEWER coding accepted'; end if;
  insert into smoke_results values('VIEWER coding denied',true);
  update public.orders set code='999999991' where id=b;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'VIEWER update accepted'; end if;
  delete from public.orders where id=b;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'VIEWER delete accepted'; end if;
  insert into smoke_results values('VIEWER update/delete denied',true);
  denied:=false;
  begin
    insert into public.orders(owner_name,national_id,phone,submitted_at,ref_number)
      values('Viewer smoke','30001019999003','01000000000',0,'SMOKE-VIEWER-'||a);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'VIEWER insert accepted'; end if;
  insert into smoke_results values('VIEWER insert denied',true);
  denied:=false;
  begin
    insert into public.supervisor_logs(id,username,user_role,action)
      values(-99990001,'Eltohamy','SUPER','Spoof attempt');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Spoofed log accepted'; end if;
  insert into smoke_results values('Log identity spoof denied',true);
  execute 'reset role';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if public.is_super() is distinct from false or public.is_admin() is distinct from false then
    raise exception 'Unknown staff helpers fail open';
  end if;
  insert into smoke_results values('Unknown staff helpers return false',true);
  execute 'reset role';

  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  execute 'set local role anon';
  denied:=false;
  begin perform public.assign_vehicle_code(b::text,'999999991'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous RPC accepted'; end if;
  insert into smoke_results values('Anonymous coding denied',true);
  denied:=false;
  begin update public.orders set code='999999991' where id=b; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous update accepted'; end if;
  insert into smoke_results values('Anonymous update denied',true);
  insert into public.orders(owner_name,national_id,phone,vehicle_type,submitted_at,ref_number,code,status)
    values('Citizen smoke','30001019999004','01000000000','توكتوك',0,'SMOKE-ANON-'||a,'999999992','coded');
  execute 'reset role';
  if exists(select 1 from public.orders where ref_number='SMOKE-ANON-'||a and (code is not null or status<>'pending')) then
    raise exception 'Citizen controlled privileged fields';
  end if;
  insert into smoke_results values('Citizen insert keeps pending defaults',true);
  if exists(select 1 from storage.buckets where id='vehicle-images' and public) then raise exception 'Images bucket public'; end if;
  insert into smoke_results values('Images bucket remains private',true);
end;
$$;
select jsonb_agg(jsonb_build_object('test',test,'passed',passed)) as results from smoke_results;
rollback;
