# JAYACUCI — Project Memory

## TL;DR
Sales page cuci tangki air. Brand: JAYACUCI (Jaya Bina Services). Single page + booking + admin panel. Free.

## URLs
| Page | URL |
|------|-----|
| Sales page | https://cuci.jayabina.com |
| Editor | https://cuci.jayabina.com/editor |
| Admin panel | https://cuci.jayabina.com/admin |
| Test calendar | https://cuci.jayabina.com/test-cal.html |
| GitHub repo | https://github.com/banktif/jayaclean-salespage |

## Tech Stack (RM0)
- Hosting: GitHub Pages + Cloudflare CDN/DNS (proxy ON, orange cloud)
- Backend: Supabase (PostgreSQL + REST API)
- Images: Cloudinary (dkibczut)
- Payment: Bayarcash (not integrated — CORS blocked, needs proxy)
- Editor: GrapesJS 0.21.13 + preset-webpage 1.0.3 (CDN)
- Fonts: Plus Jakarta Sans (admin) / Poppins (sales page)

## Credentials Location
All API keys, tokens, passwords are in the chat history. Ask user to re-provide or check dashboards:
- Supabase: https://thbscwlcyhcnqsppoyfn.supabase.co
- Bayarcash: https://console.bayar.cash
- Cloudinary: https://console.cloudinary.com (dkibczut)
- GitHub: account banktif, repo jayaclean-salespage

## Database (Supabase)
- Tables: bookings, slots
- RPC Functions: get_available_slots, check_slot, create_booking, create_bayarcash_payment (may need reload)
- PostgREST schema cache needs `NOTIFY pgrst, 'reload schema'` after migrations

## Admin Panel
- Password: Salman43! (hash: 6e5574b72c57535f)
- Brand: JAYACUCI, logo: JC
- Theme: light/dark/system, responsive (mobile <1024px, desktop >=1024px)
- Mobile: hamburger drawer + bottom nav 4 tabs
- Desktop: 260px sidebar + data table

## Sales Page (10 sections)
Hero (wudhu) → Masalah → Edukasi → Solusi → Proses (4 steps) → Kenapa Kami → Booking Form → FAQ → Tentang Kami → Final CTA
- 10 image placeholders [GAMBAR 1-10]
- Pricing: RM300 (deposit RM150, baki RM150)
- Coverage: Lembah Klang, max 4 slots/day (9am,11am,2pm,4pm)

## Colors
- Primary: #2E7D32 / #1B5E20
- Admin accent: #0ea364 (light) / #1db974 (dark)
- Yellow: #FFC107
- Admin BG: #f2f4f8 (light) / #0f1218 (dark)

## Pending Tasks
1. Bayarcash auto-payment (needs server-side proxy — Supabase Edge Function or Cloudflare Worker)
2. Replace 10 image placeholders with real photos
3. Replace WhatsApp placeholder number (60000000000)
4. Enable HTTPS enforcement on GitHub Pages

## File Structure (cuci-tangki/)
index.html, editor.html, admin.html, success.html, test-cal.html, CNAME, manifest.json, migration.sql, supabase/migrations/*.sql
