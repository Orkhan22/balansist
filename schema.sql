-- Supabase > SQL Editor-də bir dəfə işə salın

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seq bigint generated always as identity,
  product_name text not null,
  customer_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists expenses_user_idx on public.expenses (user_id, created_at desc);

alter table public.orders enable row level security;
alter table public.expenses enable row level security;

create policy "orders: own rows" on public.orders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "expenses: own rows" on public.expenses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
