-- ProducerOS initial schema
-- Every user-owned table carries user_id and is protected by Row Level Security.
-- Subscription rows are written only by the service role (Stripe webhook).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────
create type pipeline_stage as enum (
  'new_prospect', 'researching', 'contacted', 'meeting_scheduled',
  'discovery_completed', 'quoting', 'proposal_presented', 'won', 'lost'
);
create type renewal_date_status as enum ('known', 'estimated', 'unknown');
create type data_source as enum ('user_entered', 'csv_import', 'verified_provider');
create type activity_type as enum ('call', 'email', 'meeting', 'note', 'stage_change', 'system');
create type task_priority as enum ('low', 'medium', 'high');
create type task_status as enum ('open', 'completed');
create type task_source as enum ('manual', 'renewal');
create type plan_tier as enum ('trial', 'starter', 'pro');

-- ─────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Profiles & settings
-- ─────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  agency_name text check (char_length(agency_name) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_commission_rate numeric(5,2) not null default 15 check (agency_commission_rate between 0 and 100),
  new_business_split numeric(5,2) not null default 40 check (new_business_split between 0 and 100),
  renewal_split numeric(5,2) not null default 25 check (renewal_split between 0 and 100),
  renewal_offsets int[] not null default '{120,90,60,30}',
  auto_renewal_tasks boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint renewal_offsets_valid check (
    cardinality(renewal_offsets) between 1 and 8
    and 0 < all (renewal_offsets) and 365 >= all (renewal_offsets)
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- Prospects
-- ─────────────────────────────────────────────────────────────────────
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 200),
  industry text check (char_length(industry) <= 80),
  website text check (char_length(website) <= 300),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 2),
  zip text check (zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  employee_count int check (employee_count >= 0),
  annual_revenue numeric(16,2) check (annual_revenue >= 0),
  contact_name text check (char_length(contact_name) <= 120),
  contact_title text check (char_length(contact_title) <= 120),
  contact_email text check (char_length(contact_email) <= 254),
  contact_phone text check (char_length(contact_phone) <= 40),
  current_carrier text check (char_length(current_carrier) <= 120),
  current_agency text check (char_length(current_agency) <= 120),
  renewal_date date,
  renewal_date_status renewal_date_status not null default 'unknown',
  estimated_premium numeric(14,2) check (estimated_premium >= 0),
  coverage_lines text[] not null default '{}',
  notes text check (char_length(notes) <= 10000),
  lead_source text check (char_length(lead_source) <= 120),
  data_source data_source not null default 'user_entered',
  last_contacted_at timestamptz,
  next_follow_up_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A renewal date is either present with a status of known/estimated, or absent and unknown.
  constraint renewal_date_consistent check (
    (renewal_date is null and renewal_date_status = 'unknown')
    or (renewal_date is not null and renewal_date_status in ('known', 'estimated'))
  ),
  constraint coverage_lines_valid check (
    coverage_lines <@ array['general_liability','commercial_property','workers_comp','commercial_auto',
      'umbrella','professional_liability','cyber','other']::text[]
  )
);
create index prospects_user_active_idx on public.prospects (user_id) where archived_at is null;
create index prospects_user_renewal_idx on public.prospects (user_id, renewal_date) where archived_at is null;
create index prospects_user_industry_idx on public.prospects (user_id, industry);
create index prospects_user_state_city_idx on public.prospects (user_id, state, city);
create index prospects_user_followup_idx on public.prospects (user_id, next_follow_up_date);
create index prospects_name_search_idx on public.prospects using gin (to_tsvector('simple', business_name));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  title text check (char_length(title) <= 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  created_at timestamptz not null default now()
);
create index contacts_prospect_idx on public.contacts (prospect_id);

-- ─────────────────────────────────────────────────────────────────────
-- Opportunities (pipeline)
-- ─────────────────────────────────────────────────────────────────────
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  stage pipeline_stage not null default 'new_prospect',
  estimated_premium numeric(14,2) check (estimated_premium >= 0),
  close_probability int not null default 10 check (close_probability between 0 and 100),
  coverage_lines text[] not null default '{}',
  expected_close_date date,
  stage_changed_at timestamptz not null default now(),
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text check (char_length(lost_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_user_stage_idx on public.opportunities (user_id, stage);
create index opportunities_prospect_idx on public.opportunities (prospect_id);
create index opportunities_user_won_idx on public.opportunities (user_id, won_at) where won_at is not null;

-- ─────────────────────────────────────────────────────────────────────
-- Activities
-- ─────────────────────────────────────────────────────────────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  type activity_type not null,
  subject text not null check (char_length(subject) between 1 and 200),
  body text check (char_length(body) <= 10000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index activities_user_time_idx on public.activities (user_id, occurred_at desc);
create index activities_prospect_idx on public.activities (prospect_id, occurred_at desc);

-- Logging a call, email or meeting updates the prospect's last-contacted date.
create or replace function public.touch_last_contacted()
returns trigger language plpgsql as $$
begin
  if new.type in ('call', 'email', 'meeting') then
    update public.prospects
       set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
     where id = new.prospect_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger activities_touch_last_contacted
  after insert on public.activities
  for each row execute function public.touch_last_contacted();

-- ─────────────────────────────────────────────────────────────────────
-- Renewal schedules & tasks
-- ─────────────────────────────────────────────────────────────────────
create table public.renewal_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid not null unique references public.prospects (id) on delete cascade,
  cycle_date date not null,
  offsets int[] not null,
  last_synced_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid references public.prospects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  due_date date not null,
  priority task_priority not null default 'medium',
  status task_status not null default 'open',
  completed_at timestamptz,
  source task_source not null default 'manual',
  renewal_cycle_date date,
  renewal_offset_days int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint renewal_task_fields check (
    (source = 'manual' and renewal_cycle_date is null and renewal_offset_days is null)
    or (source = 'renewal' and prospect_id is not null and renewal_cycle_date is not null and renewal_offset_days is not null)
  ),
  constraint completed_consistent check ((status = 'completed') = (completed_at is not null))
);
create index tasks_user_due_idx on public.tasks (user_id, status, due_date);
create index tasks_prospect_idx on public.tasks (prospect_id);
-- Guarantees a renewal schedule can never create the same task twice.
create unique index tasks_renewal_unique_idx
  on public.tasks (prospect_id, renewal_cycle_date, renewal_offset_days)
  where source = 'renewal';

-- ─────────────────────────────────────────────────────────────────────
-- AI generation history (also the source of truth for AI usage limits)
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prospect_id uuid references public.prospects (id) on delete set null,
  kind text not null check (char_length(kind) <= 40),
  tone text check (char_length(tone) <= 20),
  output text not null check (char_length(output) <= 20000),
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index ai_generations_user_time_idx on public.ai_generations (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- Subscriptions (written by service role only) & Stripe idempotency
-- ─────────────────────────────────────────────────────────────────────
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan plan_tier not null default 'trial',
  status text not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- Audit log (append-only for users)
-- ─────────────────────────────────────────────────────────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null check (char_length(action) <= 60),
  entity_type text check (char_length(entity_type) <= 40),
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_user_time_idx on public.audit_logs (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger prospects_updated before update on public.prospects for each row execute function public.set_updated_at();
create trigger opportunities_updated before update on public.opportunities for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- New user bootstrap: profile, settings, 14-day trial
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.user_settings (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.prospects enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.renewal_schedules enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_generations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own settings" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own prospects" on public.prospects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Child rows must belong to the user AND reference a prospect the user owns.
create policy "own contacts" on public.contacts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.prospects p where p.id = prospect_id and p.user_id = auth.uid()));
create policy "own opportunities" on public.opportunities
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.prospects p where p.id = prospect_id and p.user_id = auth.uid()));
create policy "own activities" on public.activities
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.prospects p where p.id = prospect_id and p.user_id = auth.uid()));
create policy "own renewal schedules" on public.renewal_schedules
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.prospects p where p.id = prospect_id and p.user_id = auth.uid()));
create policy "own tasks" on public.tasks
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and (prospect_id is null or exists (
    select 1 from public.prospects p where p.id = prospect_id and p.user_id = auth.uid())));

-- AI history: users may read and insert their own rows; no edits or deletes (usage accounting).
create policy "read own ai" on public.ai_generations for select using (user_id = auth.uid());
create policy "insert own ai" on public.ai_generations for insert with check (user_id = auth.uid());

-- Subscriptions: read-only for users. No insert/update/delete policies → only service role writes.
create policy "read own subscription" on public.subscriptions for select using (user_id = auth.uid());

-- stripe_events: no policies → service role only.

-- Audit log: append + read own; no update/delete.
create policy "read own audit" on public.audit_logs for select using (user_id = auth.uid());
create policy "insert own audit" on public.audit_logs for insert with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Transactional RPCs (SECURITY INVOKER → RLS still applies)
-- ─────────────────────────────────────────────────────────────────────

-- Moves an opportunity to a new stage and logs the change atomically.
create or replace function public.move_opportunity_stage(p_opportunity_id uuid, p_stage pipeline_stage, p_lost_reason text default null)
returns public.opportunities
language plpgsql security invoker set search_path = public as $$
declare
  v_old public.opportunities;
  v_new public.opportunities;
  v_labels jsonb := '{"new_prospect":"New Prospect","researching":"Researching","contacted":"Contacted",
    "meeting_scheduled":"Meeting Scheduled","discovery_completed":"Discovery Completed","quoting":"Quoting",
    "proposal_presented":"Proposal Presented","won":"Won","lost":"Lost"}';
begin
  select * into v_old from public.opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'Opportunity not found' using errcode = 'P0002';
  end if;
  if v_old.stage = p_stage then
    return v_old;
  end if;

  update public.opportunities set
    stage = p_stage,
    stage_changed_at = now(),
    won_at = case when p_stage = 'won' then now() else null end,
    lost_at = case when p_stage = 'lost' then now() else null end,
    lost_reason = case when p_stage = 'lost' then p_lost_reason else null end,
    close_probability = case when p_stage = 'won' then 100 when p_stage = 'lost' then 0 else close_probability end
  where id = p_opportunity_id
  returning * into v_new;

  insert into public.activities (user_id, prospect_id, opportunity_id, type, subject)
  values (v_old.user_id, v_old.prospect_id, v_old.id, 'stage_change',
          format('Stage: %s → %s', v_labels ->> v_old.stage::text, v_labels ->> p_stage::text));

  return v_new;
end;
$$;

-- Replaces a prospect's open renewal tasks for a new cycle without ever duplicating.
-- p_tasks: [{"title","description","due_date","priority","offset_days"}]
-- Completed renewal tasks are preserved as history. Open tasks from an outdated cycle,
-- or for offsets no longer configured, are removed. Existing identical tasks are left as-is.
create or replace function public.sync_renewal_tasks(p_prospect_id uuid, p_cycle_date date, p_offsets int[], p_tasks jsonb)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid;
  v_inserted int;
begin
  select user_id into v_user from public.prospects where id = p_prospect_id for update;
  if not found then
    raise exception 'Prospect not found' using errcode = 'P0002';
  end if;

  delete from public.tasks
   where prospect_id = p_prospect_id and source = 'renewal' and status = 'open'
     and (p_cycle_date is null
          or renewal_cycle_date <> p_cycle_date
          or not (renewal_offset_days = any (
              select (t ->> 'offset_days')::int from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) t)));

  if p_cycle_date is null then
    delete from public.renewal_schedules where prospect_id = p_prospect_id;
    return 0;
  end if;

  insert into public.renewal_schedules (user_id, prospect_id, cycle_date, offsets, last_synced_at)
  values (v_user, p_prospect_id, p_cycle_date, p_offsets, now())
  on conflict (prospect_id) do update
    set cycle_date = excluded.cycle_date, offsets = excluded.offsets, last_synced_at = now();

  insert into public.tasks (user_id, prospect_id, title, description, due_date, priority, source,
                            renewal_cycle_date, renewal_offset_days)
  select v_user, p_prospect_id, t ->> 'title', t ->> 'description', (t ->> 'due_date')::date,
         (t ->> 'priority')::task_priority, 'renewal', p_cycle_date, (t ->> 'offset_days')::int
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) t
  on conflict (prospect_id, renewal_cycle_date, renewal_offset_days) where source = 'renewal' do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.move_opportunity_stage(uuid, pipeline_stage, text) to authenticated;
grant execute on function public.sync_renewal_tasks(uuid, date, int[], jsonb) to authenticated;
revoke execute on function public.move_opportunity_stage(uuid, pipeline_stage, text) from anon;
revoke execute on function public.sync_renewal_tasks(uuid, date, int[], jsonb) from anon;

-- ─────────────────────────────────────────────────────────────────────
-- Prospect list view: prospect + its latest opportunity's stage.
-- security_invoker = on → RLS of the querying user applies to underlying tables.
-- ─────────────────────────────────────────────────────────────────────
create view public.prospect_list with (security_invoker = on) as
select p.*,
       extract(month from p.renewal_date)::int as renewal_month,
       o.id as opportunity_id,
       o.stage as pipeline_stage
  from public.prospects p
  left join lateral (
    select id, stage from public.opportunities o
     where o.prospect_id = p.id
     order by o.created_at desc
     limit 1
  ) o on true;

grant select on public.prospect_list to authenticated;
