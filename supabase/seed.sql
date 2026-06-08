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
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-06-15', 'Rozrząd', 2000, 122300),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-09-10', 'Brake pads + discs (front)', 850, 125100),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-12-05', 'Winter tyres + alignment', 1400, 128000),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025-02-20', 'Oil + filter change', 250, 130500),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025-05-15', 'Clutch replacement', 3200, 133800),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025-08-01', 'AC recharge + cabin filter', 350, 136200);

-- Service thresholds: one ok, one approaching (800 km left of 10000 km interval = within 10% margin)
INSERT INTO public.service_thresholds (id, car_id, user_id, name, km_interval, last_performed_mileage, last_performed_date) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Oil Change', 10000, 130500, '2025-02-20'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Air Filter', 10000, 127000, '2024-11-01');
