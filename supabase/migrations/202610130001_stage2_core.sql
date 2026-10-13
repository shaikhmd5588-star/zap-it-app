-- ZAP IT Stage 2: Supabase/PostgreSQL foundation
-- Apply in a NEW Supabase project via SQL Editor. Never put service-role keys in the app.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.order_status as enum ('placed', 'confirmed', 'packing', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_method as enum ('cod', 'upi');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  emoji text not null default '🛍️',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  unit text not null,
  price_paise integer not null check (price_paise >= 0),
  mrp_paise integer check (mrp_paise is null or mrp_paise >= price_paise),
  image_url text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  landmark text,
  area text not null,
  city text not null default 'Nandurbar',
  state text not null default 'Maharashtra',
  pincode text,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ZP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references auth.users(id),
  address_id uuid references public.addresses(id) on delete set null,
  -- Snapshot delivery address so an edited/deleted address cannot rewrite order history.
  delivery_address jsonb not null,
  status public.order_status not null default 'placed',
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'pending',
  subtotal_paise integer not null check (subtotal_paise >= 0),
  delivery_fee_paise integer not null default 0 check (delivery_fee_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_paise integer not null check (line_total_paise >= 0)
);

create index products_active_category_idx on public.products (is_active, category_id);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index addresses_user_idx on public.addresses (user_id);

-- Keep profile creation tied to Supabase Auth. Users cannot choose their own role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER avoids profile-policy recursion. The role itself remains writable only by admins.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Profiles: read own or admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Profiles: update own basic fields" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Profiles: admin full access" on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active categories are public" on public.categories
for select to anon, authenticated using (is_active or public.is_admin());
create policy "Admins manage categories" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Active products are public" on public.products
for select to anon, authenticated using (is_active or public.is_admin());
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Customers manage their addresses" on public.addresses
for all to authenticated using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

create policy "Customers read own orders; admins read all" on public.orders
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins update orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Intentionally no client INSERT/DELETE policies on orders/order_items.
-- Order creation must go through create_order() to validate prices and stock atomically.

create policy "Customers read own order items; admins read all" on public.order_items
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = (select auth.uid())
  )
);
create policy "Admins manage order items" on public.order_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Create an order using database prices and inventory locks; never trust totals from the phone.
-- p_items format: [{"product_id":"uuid","quantity":2}, ...]
create or replace function public.create_order(
  p_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'cod',
  p_customer_note text default null
)
returns table (id uuid, order_number text, total_paise integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_line integer;
  v_items_count integer := 0;
  v_address_json jsonb;
begin
  if v_user_id is null then raise exception 'Sign in before placing an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'Too many distinct items'; end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value ->> 'product_id') from jsonb_array_elements(p_items)) then
    raise exception 'Cart contains a duplicate product';
  end if;

  select * into v_address from public.addresses
  where addresses.id = p_address_id and addresses.user_id = v_user_id;
  if not found then raise exception 'Choose a valid delivery address'; end if;

  v_address_json := jsonb_build_object(
    'label', v_address.label, 'recipient_name', v_address.recipient_name,
    'phone', v_address.phone, 'address_line', v_address.address_line,
    'landmark', v_address.landmark, 'area', v_address.area,
    'city', v_address.city, 'state', v_address.state, 'pincode', v_address.pincode
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then
      raise exception 'Each item needs product_id and quantity';
    end if;
    if (v_item ->> 'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity'; end if;
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Quantity must be between 1 and 50'; end if;

    select * into v_product from public.products
    where products.id = (v_item ->> 'product_id')::uuid and products.is_active = true
    for update;
    if not found then raise exception 'A product is no longer available'; end if;
    if v_product.stock_quantity < v_qty then
      raise exception 'Not enough stock for %', v_product.name;
    end if;

    v_line := v_product.price_paise * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_items_count := v_items_count + 1;
    if v_items_count > 40 then raise exception 'Too many distinct items'; end if;
  end loop;

  -- Demo launch policy: ₹25 below ₹199, free delivery at/above ₹199.
  v_delivery_fee := case when v_subtotal = 0 or v_subtotal >= 19900 then 0 else 2500 end;
  v_total := v_subtotal + v_delivery_fee;

  insert into public.orders (
    user_id, address_id, delivery_address, payment_method,
    subtotal_paise, delivery_fee_paise, total_paise, customer_note
  ) values (
    v_user_id, p_address_id, v_address_json, coalesce(p_payment_method, 'cod'),
    v_subtotal, v_delivery_fee, v_total, nullif(trim(p_customer_note), '')
  ) returning orders.id, orders.order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into v_product from public.products
    where products.id = (v_item ->> 'product_id')::uuid and products.is_active = true
    for update;
    update public.products set stock_quantity = stock_quantity - v_qty, updated_at = now()
    where products.id = v_product.id;
    v_line := v_product.price_paise * v_qty;
    insert into public.order_items (
      order_id, product_id, product_name, unit, unit_price_paise, quantity, line_total_paise
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.unit, v_product.price_paise, v_qty, v_line
    );
  end loop;

  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, public.payment_method, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, public.payment_method, text) to authenticated;

-- Seed categories and illustrative products for development only.
insert into public.categories (name, slug, emoji, sort_order) values
  ('Fruits & Veg', 'fruits-veg', '🥦', 1),
  ('Dairy', 'dairy', '🥛', 2),
  ('Staples', 'staples', '🌾', 3),
  ('Snacks', 'snacks', '🍪', 4),
  ('Beverages', 'beverages', '🧃', 5),
  ('Bakery', 'bakery', '🍞', 6),
  ('Home Care', 'home-care', '🧼', 7)
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, unit, price_paise, mrp_paise, stock_quantity, is_featured)
select c.id, x.name, x.slug, x.unit, x.price, x.mrp, x.stock, x.featured
from (values
  ('Dairy', 'Amul Taaza Milk', 'amul-taaza-milk', '500 ml', 2900, 3200, 80, true),
  ('Fruits & Veg', 'Farm Fresh Bananas', 'farm-fresh-bananas', '6 pieces', 3900, 4500, 50, true),
  ('Fruits & Veg', 'Potatoes', 'potatoes-1kg', '1 kg', 3200, null, 70, true),
  ('Fruits & Veg', 'Red Tomatoes', 'red-tomatoes', '500 g', 2400, null, 40, false),
  ('Staples', 'Aashirvaad Atta', 'aashirvaad-atta-5kg', '5 kg', 24500, 26900, 25, false),
  ('Staples', 'Basmati Rice', 'basmati-rice-1kg', '1 kg', 11900, null, 25, false),
  ('Snacks', 'Instant Noodles', 'instant-noodles-pack-4', 'Pack of 4', 5600, null, 45, true),
  ('Home Care', 'Laundry Detergent', 'laundry-detergent-1kg', '1 kg', 10500, null, 20, false),
  ('Bakery', 'Brown Bread', 'brown-bread-400g', '400 g', 4200, null, 20, false),
  ('Dairy', 'Fresh Eggs', 'fresh-eggs-6', '6 pieces', 4800, null, 30, false),
  ('Beverages', 'Orange Juice', 'orange-juice-1l', '1 L', 8900, null, 15, false),
  ('Snacks', 'Potato Chips', 'potato-chips', 'Pack', 2000, null, 60, false)
) as x(category_name, name, slug, unit, price, mrp, stock, featured)
join public.categories c on c.name = x.category_name
on conflict (slug) do nothing;
