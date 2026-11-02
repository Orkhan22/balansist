-- Supabase > SQL Editor-də bir dəfə işə salın (təkrar işə salmaq təhlükəsizdir)

create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  fin text not null,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists store_platform text,
  add column if not exists product_note text,
  add column if not exists customer_phone text,
  add column if not exists recipient_id uuid references public.recipients(id) on delete set null,
  add column if not exists status text not null default 'Sifariş gözləyir',
  add column if not exists sell_price numeric(12,2) not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists cost_price numeric(12,2) not null default 0,
  add column if not exists cargo_fee numeric(12,2) not null default 0,
  add column if not exists cargo_currency text not null default 'USD';

alter table public.expenses add column if not exists category text not null default '⚙️ Digər Xərclər';

alter table public.recipients enable row level security;
drop policy if exists "recipients: own rows" on public.recipients;
create policy "recipients: own rows" on public.recipients for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
