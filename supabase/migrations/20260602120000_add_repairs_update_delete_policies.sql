create policy "repairs_update_own"
  on public.repairs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "repairs_delete_own"
  on public.repairs for delete
  using (auth.uid() = user_id);
