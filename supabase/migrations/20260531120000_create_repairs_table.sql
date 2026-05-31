create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repair_date date not null,
  description text not null,
  cost numeric(10, 2),
  mileage integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_repairs_car_id on public.repairs (car_id);

alter table public.repairs enable row level security;

create policy repairs_select_own on public.repairs
  for select using (auth.uid() = user_id);

create policy repairs_insert_own on public.repairs
  for insert with check (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.cars WHERE id = car_id AND user_id = auth.uid()
    )
  );
