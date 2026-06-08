create table public.service_thresholds (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  km_interval integer,
  days_interval integer,
  last_performed_date date,
  last_performed_mileage integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint at_least_one_interval check (
    km_interval is not null or days_interval is not null
  )
);

create index idx_service_thresholds_car_id on public.service_thresholds (car_id);

alter table public.service_thresholds enable row level security;

create policy service_thresholds_select_own on public.service_thresholds
  for select using (auth.uid() = user_id);

create policy service_thresholds_insert_own on public.service_thresholds
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.cars where id = car_id and user_id = auth.uid()
    )
  );

create policy service_thresholds_update_own on public.service_thresholds
  for update using (auth.uid() = user_id);

create policy service_thresholds_delete_own on public.service_thresholds
  for delete using (auth.uid() = user_id);
