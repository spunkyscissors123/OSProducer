-- Run after migrations. Fails loudly (ON_ERROR_STOP) if any assertion is violated.
\set ON_ERROR_STOP 1
insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"full_name":"Alice Producer"}'),
  ('22222222-2222-2222-2222-222222222222', '{"full_name":"Bob Producer"}');

-- Signup trigger bootstrapped profile/settings/trial
do $$ begin
  assert (select count(*) from public.subscriptions where plan = 'trial') = 2, 'trial rows missing';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice Producer';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.prospects (id, business_name, renewal_date, renewal_date_status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Fictional Fabrication LLC', '2027-10-01', 'known');
insert into public.opportunities (id, prospect_id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'P&C package');

-- Renewal sync twice: must not duplicate
select public.sync_renewal_tasks('aaaaaaaa-0000-0000-0000-000000000001', '2027-10-01', '{120,90}',
  '[{"title":"120d","description":null,"due_date":"2027-06-03","priority":"medium","offset_days":120},
    {"title":"90d","description":null,"due_date":"2027-07-03","priority":"medium","offset_days":90}]');
select public.sync_renewal_tasks('aaaaaaaa-0000-0000-0000-000000000001', '2027-10-01', '{120,90}',
  '[{"title":"120d","description":null,"due_date":"2027-06-03","priority":"medium","offset_days":120},
    {"title":"90d","description":null,"due_date":"2027-07-03","priority":"medium","offset_days":90}]');
do $$ begin assert (select count(*) from public.tasks) = 2, 'renewal tasks duplicated'; end $$;

-- Complete one, then change renewal date: completed kept, open old-cycle removed, new cycle created
update public.tasks set status = 'completed', completed_at = now() where renewal_offset_days = 120;
select public.sync_renewal_tasks('aaaaaaaa-0000-0000-0000-000000000001', '2027-11-01', '{90}',
  '[{"title":"90d","description":null,"due_date":"2027-08-03","priority":"medium","offset_days":90}]');
do $$ begin
  assert (select count(*) from public.tasks where status = 'completed') = 1, 'completed task lost';
  assert (select count(*) from public.tasks where status = 'open' and renewal_cycle_date = '2027-11-01') = 1, 'new cycle task missing';
  assert (select count(*) from public.tasks where status = 'open' and renewal_cycle_date = '2027-10-01') = 0, 'stale task kept';
end $$;

-- Stage move logs an activity atomically; logging a call updates last_contacted_at
select stage from public.move_opportunity_stage('bbbbbbbb-0000-0000-0000-000000000001', 'won');
insert into public.activities (prospect_id, type, subject) values ('aaaaaaaa-0000-0000-0000-000000000001', 'call', 'Intro call');
do $$ begin
  assert (select count(*) from public.activities where type = 'stage_change') = 1, 'stage activity missing';
  assert (select won_at is not null and close_probability = 100 from public.opportunities), 'won fields not set';
  assert (select last_contacted_at is not null from public.prospects), 'last_contacted not touched';
end $$;

-- Unknown renewal must be unknown (constraint)
do $$ begin
  begin
    insert into public.prospects (business_name, renewal_date, renewal_date_status) values ('Bad', null, 'known');
    raise exception 'constraint did not fire';
  exception when check_violation then null; end;
end $$;

-- Users cannot write subscriptions
do $$ begin
  update public.subscriptions set plan = 'pro';
  assert (select plan from public.subscriptions) = 'trial', 'user upgraded own subscription!';
end $$;

-- ── Switch to Bob: sees nothing of Alice, cannot write into Alice's prospect ──
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.prospects) = 0, 'Bob sees Alice prospects';
  assert (select count(*) from public.tasks) = 0, 'Bob sees Alice tasks';
  assert (select count(*) from public.activities) = 0, 'Bob sees Alice activities';
  assert (select count(*) from public.subscriptions) = 1, 'Bob sees other subscriptions';
end $$;
do $$ begin
  begin
    insert into public.tasks (prospect_id, title, due_date) values ('aaaaaaaa-0000-0000-0000-000000000001', 'hijack', current_date);
    raise exception 'Bob linked a task to Alice prospect';
  exception when insufficient_privilege then null; end;
  begin
    perform public.move_opportunity_stage('bbbbbbbb-0000-0000-0000-000000000001', 'lost');
    raise exception 'Bob moved Alice opportunity';
  exception when no_data_found then null; end;
  update public.prospects set business_name = 'pwned';
end $$;
reset role;
do $$ begin assert (select business_name from public.prospects where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Fictional Fabrication LLC', 'Bob modified Alice data'; end $$;
select 'ALL RLS/RPC TESTS PASSED' as result;

-- View respects RLS (security_invoker)
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin assert (select count(*) from public.prospect_list) = 0, 'view leaks rows across users'; end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin assert (select pipeline_stage::text from public.prospect_list where business_name = 'Fictional Fabrication LLC') = 'won', 'view stage wrong'; end $$;
reset role;
select 'VIEW TESTS PASSED' as result;
