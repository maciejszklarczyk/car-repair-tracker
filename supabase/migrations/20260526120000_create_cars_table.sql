create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year integer not null,
  current_mileage integer not null,
  baseline_mileage integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cars_user_id on public.cars (user_id);

alter table public.cars enable row level security;

create policy cars_select_own on public.cars
  for select using (auth.uid() = user_id);

create policy cars_insert_own on public.cars
  for insert with check (auth.uid() = user_id);
