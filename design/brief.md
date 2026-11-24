# Brief (answers from question rounds, 2026-11-24)

Chosen by the user:
1. Look: calm and clean (warm greys, white cards, one blue accent)
2. Accent: deep blue (calmer than today's #2563eb-ish bright blue)
3. Phone nav: bottom bar, same items (Home, Stock, Reports + admin: Spending, Settings); EN/MM, user, logout in a profile menu at top
4. Density: medium, roomy for touch (48px targets, 16px+ text, Myanmar-safe line heights)
5. Text: sentence case, weights 400/500/600, no uppercase, no font-black
6. Voucher form: one scrolling page + sticky bottom bar (Final Total + Save), collapsible item cards
7. History phone: cards by default, but the SHEET must be designed carefully, the owner's father uses the sheet most. Sticky columns (Voucher + Date pinned left, Remaining pinned right), full-screen, landscape-friendly, zebra rows, big clear red/green Remaining.
8. Offline: one quiet sync pill + one slim banner when offline + small "Pending" tags
9. Text size: comfortable 16px (sheet 15px) AND a user-selectable Text size setting (Normal / Large)
10. Dark mode: light + dark designed now
11. 3 versions differ by card style + type + neutrals (all deep blue, all calm)
12. Home: search first, recent customers, compact summary, charts below
13. Font: friendly humanist sans (Source Sans 3 / Figtree); Myanmar = Noto Sans Myanmar
14. Logo: small TK logo + name on Home and Login only
15. Dialogs: bottom sheets for confirms (red Delete + Cancel, names the thing), toast only for errors

Defaults I applied (not asked; change if wrong):
- Status colours: muted Nord Aurora (green paid, red debt, amber pending/offline, orange extra charge)
- Payment method colours kept: Cash green, KBZPay blue, Bank purple (but purple kept desaturated, not violet-gradient)
- Icons: Lucide, 1.75 stroke, no icons in coloured tiles
- Motion: minimal 150-250ms, reduced-motion respected
- Keep from today: nav items, Owes/Credit balance, split payment flow, FIFO idea

## Phase 2 answers (tablet + laptop), 2026-11-25
- Final design: v3 Structured only (v1/v2 dropped). One design for phone, tablet, PC.
- Devices: all three equally important.
- Navigation: left sidebar on tablet and PC (same 5 items); phone keeps bottom bar.
- History on PC: full-width sheet, all 15 columns visible, frozen header/footer, filters bar above.
- Voucher on tablet/PC: two columns, form left, sticky summary + Save right.

## Phase 3 answers (build), 2026-11-25
- Git: new branch redesign-v3 from New_Features; commit locally only, never push.
- Order: foundation (tokens, fonts, shared components) -> shell (bottom bar/sidebar) -> History sheet -> Voucher + Payment -> Home + Customers -> Stock/Reports/Spending/Settings/Login.
- Font: add @fontsource/public-sans (approved). Myanmar keeps current font.
- Build Text size (Normal/Large) and Light/Dark theme in Settings, saved per device.
- Printed A5 voucher untouched.
