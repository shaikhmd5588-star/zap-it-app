# ZAP IT Admin Dashboard — Stage 4

A separate, desktop-first store operations dashboard for the ZAP IT Supabase project.

## Features
- Supabase email/password sign-in with a strict database-backed `profiles.role === 'admin'` check.
- Live order queue, customer/address snapshots, line items, order totals, payment status, and status updates.
- Product inventory and catalogue controls: stock, selling price, MRP, active listing, and featured state.
- Search/filter, summary metrics, manual refresh, responsive layout, and clear loading/error states.

## Run locally
1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using your project's public client values.
4. Run `npm install`, then `npm run dev`.

## Grant admin access safely
Do not add a public admin signup or place a service-role key in this app. First create a normal user through Supabase Auth, then run this SQL in the Supabase SQL Editor after verifying the exact email/user:

```sql
-- Replace the UUID with the verified user's auth.users.id.
update public.profiles
set role = 'admin', updated_at = now()
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

The dashboard checks the profile role and the database's RLS policies must still authorize every read/write. If the role is not admin, the dashboard will not expose store data.

## Important limits
This is an internal development dashboard, not a complete production fulfilment system. It does not integrate UPI payments, delivery-partner assignment, push/SMS notifications, or accounting. Use HTTPS and individual named admin accounts; never share credentials. Test status changes and inventory adjustments before using real orders.