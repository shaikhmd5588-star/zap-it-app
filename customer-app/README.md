# ZAP IT Customer App — Stage 1

This folder is the new mobile-first React/Vite customer app. The repository-root `index.html` remains the original GitHub Pages concept preview.

## Current Stage 1 prototype

- Responsive customer home screen and category browsing
- Sample product catalogue and search
- Add/remove quantities, favourites and a client-side cart
- Delivery-address toggle using demo addresses
- Checkout UI with COD and UPI demo selection
- Local demo order confirmation
- Bottom navigation for Home, Categories, Cart, Orders and Account

**Important:** This is a frontend prototype. It does not yet use a database, authentication, real inventory, a real payment provider, or a live order service. Sample product data and prices are illustrative. Do not use it to accept real orders or payments.

## Run locally

Requires Node.js 22 or newer.

```bash
cd customer-app
npm install
npm run dev
```

To test a production build:

```bash
npm run build
npm run preview
```

## Android packaging (later step)

Capacitor configuration is included. Android platform generation and APK build are deliberately not part of this first web-interface stage. They require adding the Android platform, Android build tooling, and testing the generated app on a real device.

## Next stages

1. Review and refine the mobile interface.
2. Add Supabase/PostgreSQL with secure policies and authenticated admin access.
3. Implement server-validated order creation and stock checks.
4. Add a computer-first admin dashboard.
5. Integrate COD and a verified UPI payment flow.
6. Package and test Android builds before any public release.
