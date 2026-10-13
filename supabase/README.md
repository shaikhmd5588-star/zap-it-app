# ZAP IT — Stage 2 database foundation

This folder contains the first real backend foundation for the Nandurbar quick-commerce app.

## What is included

- PostgreSQL schema for customer profiles, categories, products, addresses, orders and order items.
- Supabase Auth profile trigger; new accounts default to the `customer` role.
- Row Level Security (RLS) policies for customer-owned data and admin-only catalogue/order management.
- A server-side `create_order()` database function that reads authoritative prices, checks stock, calculates the delivery fee, snapshots the address and creates order records in a single database transaction.
- Illustrative seed products for development.

## Important current status

**This is not yet a live backend.** The SQL has been committed to the repository but has not been run against a Supabase project or tested against a live database. The Stage 1 customer UI is not yet connected to these tables. Seed prices and stock values are examples, not confirmed store inventory. Do not take real customer orders or payments yet.

## Setup

1. Create a new project at https://supabase.com/ (keep project credentials private).
2. Open the project's **SQL Editor**.
3. Open `migrations/202610130001_stage2_core.sql` in this repository, copy its contents into the SQL Editor and run it.
4. Check the Table Editor for `profiles`, `categories`, `products`, `addresses`, `orders` and `order_items`.
5. In **Authentication → Users**, create your own test account. The trigger should create a `profiles` row with role `customer`.
6. To grant admin access to that account, first copy its Auth user UUID. Then run this in the SQL Editor, replacing the placeholder with your own UUID:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'REPLACE-WITH-YOUR-AUTH-USER-UUID';
   ```

   Do not add any public sign-up option that lets a user select the admin role. Do not expose the database service-role key in browser/mobile code.

## Order function contract

After authentication and address creation are connected in the app, an authenticated client can call the Supabase RPC `create_order` with:
- `p_address_id`: UUID for an address owned by the signed-in user.
- `p_items`: JSON array such as `[{"product_id":"PRODUCT_UUID","quantity":2}]`.
- `p_payment_method`: `cod` or `upi`.
- `p_customer_note`: optional note.

The function intentionally has no anonymous execution grant. It verifies the signed-in user and address, validates item quantities, reads prices from the database, locks product rows, checks stock and reduces inventory. UPI is only a recorded payment-method choice here; **no payment is collected or verified**. A real UPI provider integration and verified payment webhooks are a later stage.

## Before launch

- Connect the customer app to Supabase using only the project URL and anon/publishable key; never use the service-role key in the app.
- Add sign-in/OTP, address management and order history UI.
- Create a desktop-first admin dashboard and test admin permissions.
- Confirm local supplier inventory, pricing, delivery fee, service area and return policy.
- Test RLS and order creation under separate customer accounts.
- Add a verified payment provider before accepting online payments.
- Add server-side operational monitoring, backups, privacy terms and support workflow.

The Stage 1 concept page and customer UI remain unchanged on this branch.
