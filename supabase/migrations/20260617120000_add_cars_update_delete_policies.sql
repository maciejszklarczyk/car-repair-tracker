create policy cars_update_own on public.cars
  for update using (auth.uid() = user_id);

create policy cars_delete_own on public.cars
  for delete using (auth.uid() = user_id);
