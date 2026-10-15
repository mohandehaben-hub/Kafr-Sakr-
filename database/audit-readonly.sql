-- Read-only metadata queries. These do not return citizen records or secrets.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name in ('orders','complaints','staff','supervisor_logs')
order by table_name, ordinal_position;

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r';

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

select p.proname, p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'get_my_order','get_my_complaints','get_staff_list',
  'create_supervisor_account','delete_staff_account','assign_vehicle_code'
);
