# ZAP IT Store Operations Dashboard — Stage 4

Private staff-facing development dashboard for managing the catalogue and order status.

## Run locally

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Add the Supabase project URL and **publishable** key.
4. Run `npm install`, then `npm run dev`.

## Granting admin access

New accounts default to the `customer` role. Create an account through the customer app first. A trusted project owner must then promote the intended staff account to `admin` in the Supabase SQL editor, for example:

```sql
update public.profiles
set role = 'admin'
where id = 'AUTH_USER_UUID';
```

Use the actual Auth user UUID from the Supabase dashboard. Do not promote users based on a client-side form. Only a trusted project owner should run this statement.

The dashboard checks the profile role for its interface and the database RLS policies remain the real security boundary. Customers cannot access admin queries or write operations just by changing browser code.

## Scope and launch cautions

- View incoming orders and update operational status.
- Search, add, edit, activate/deactivate products, and adjust stock.
- This is a first admin foundation, not a complete fulfilment system.
- Sample catalogue records are illustrative. Verify real supplier pricing, inventory, tax, refund and delivery processes before taking real orders.
- No payment-provider integration, delivery-partner app, push/SMS notifications, audit log, or role-management screen is included.
- Never put a Supabase service-role key or database password in a browser environment variable.
