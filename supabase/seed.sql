-- Test user: test@test.com / password123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'test@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now()
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "test@test.com"}',
  'email',
  'test@test.com',
  now(),
  now(),
  now()
);

-- Test vehicle and repairs
INSERT INTO public.cars (
  id,
  user_id,
  make,
  model,
  year,
  baseline_mileage
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Skoda',
  'Octavia',
  2018,
  120000
);

INSERT INTO public.repairs (id, car_id, user_id, repair_date, description, cost, mileage) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-03-01', 'Oil change', 200, 120500),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-06-15', 'Rozrząd', 2000, 122300);

-- Service thresholds: one ok, one approaching (700 km left of 10000 km interval = within 10% margin)
INSERT INTO public.service_thresholds (id, car_id, user_id, name, km_interval, last_performed_mileage, last_performed_date) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Oil Change', 10000, 122300, '2024-06-15'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Air Filter', 10000, 113000, '2022-05-01');
