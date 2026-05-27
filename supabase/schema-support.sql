-- Support Tickets (Realtime enabled)
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  subject text not null,
  category text not null default 'General',
  priority text not null default 'medium', -- low | medium | high | urgent
  status text not null default 'open',     -- open | in_progress | resolved | closed
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

-- Support Messages (Supabase Realtime enabled on this table)
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references support_tickets(id) on delete cascade not null,
  sender_role text not null, -- 'user' | 'admin'
  sender_name text,
  content text not null,
  created_at timestamptz default now()
);

-- User Subscriptions
create table if not exists user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  plan_type text not null default 'free',       -- free | lifetime | monthly | yearly
  status text not null default 'active',         -- active | cancelled | expired | paused
  razorpay_subscription_id text,
  razorpay_plan_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Realtime on support_messages
alter publication supabase_realtime add table support_messages;
alter publication supabase_realtime add table support_tickets;

-- RLS policies
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table user_subscriptions enable row level security;

-- Users can see their own tickets
create policy "Users view own tickets" on support_tickets
  for select using (auth.uid() = user_id);

create policy "Users create own tickets" on support_tickets
  for insert with check (auth.uid() = user_id);

-- Users can see messages in their own tickets
create policy "Users view messages in own tickets" on support_messages
  for select using (
    exists (select 1 from support_tickets where id = ticket_id and user_id = auth.uid())
  );

create policy "Users send messages in own tickets" on support_messages
  for insert with check (
    exists (select 1 from support_tickets where id = ticket_id and user_id = auth.uid())
    and sender_role = 'user'
  );

-- Users see own subscription
create policy "Users view own subscription" on user_subscriptions
  for select using (auth.uid() = user_id);
