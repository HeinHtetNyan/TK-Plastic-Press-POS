# Design System: TK Plastic Press POS, Phone v3 Structured

## 1. Visual Theme & Atmosphere
Structured and table-like: white page, strong dividers, label/value rows, dense-but-readable list rows. Feels like a printed ledger form.
Calm, trustworthy, built for all-day use by shop staff and an older owner. Money is the hero: large, steady numbers. Interface is 90-95% neutral; the single deep blue accent is used only for the one primary action per screen, the active tab, links and focus. No gradients, no glow, no emoji, no violet.

## 2. Color Palette & Roles (light)
- Background: #FFFFFF (page)
- Surface: #FFFFFF (cards, sheets, bars)
- Line: #D3D8E0 (dividers, input borders)
- Ink: #16202E (primary text, contrast 12:1+)
- Muted ink: #505B6B (labels, meta, 4.5:1+)
- Accent (deep blue): #173F8A (primary button, active tab, links, focus ring)
- On accent: #FFFFFF
- Money in / paid / Cash: #2F7D5B on #E6F2EC
- Debt / owes / delete: #B3402F on #F8E9E6
- Pending / offline: #9A6A12 on #F8EFD8
- Extra charge: #B35A1F on #F9ECE0
- KBZPay: #2C5FA8 on #E7EEF8 ; Bank transfer: #6B4F8F (muted plum, never bright violet) on #EFEAF5 ; Cash uses the money green
- Never pure #000 or #fff for text; status colours always paired with an icon or word.

## 2b. Color Palette (dark, designed now)
- Background #111419, surface #181C23, line #343A45, ink #EAEDF2, accent #86A6E8 (lighter, less saturated), shadows off, surfaces get lighter with elevation, status colours lifted +10% lightness.

## 3. Typography Rules
- Latin: Public Sans (400, 500, 600 only). Myanmar: Noto Sans Myanmar with line-height 1.7, no letter-spacing, never uppercase.
- Scale (px): 13 meta, 15 sheet text, 16 body (default), 18 section title, 22 page title, 28 key amount, 36 hero balance. Large text mode scales body to 18 and sheet to 17.
- Sentence case everywhere. Tabular numerals for all money and weights. Currency suffix "MMK" small and muted.

## 4. Component Stylings
- Cards: no card boxes: sections separated by strong 1px dividers and a light grey band header, radius 4px
- Primary button: filled accent, same radius as cards, 52px tall, full width in forms; one per screen. Secondary: outline in ink on surface. Destructive: red outline, filled only inside the confirm sheet.
- Inputs: 52px tall, visible label above, 16px text, 1px line border, accent focus ring 2px, helper/error line below.
- Bottom tab bar: 64px + safe area, 3-5 items, icon (Lucide 1.75 stroke) + label, active item accent colour with a 2px top bar.
- Top bar: 56px, page title left, sync pill + profile menu right. Logo + "TK Plastic Press" only on Home and Login.
- Sync pill: Online (green check), Syncing (blue spinner), Pending n (amber), Offline n (red). Offline also shows one slim banner under the top bar.
- Sheets: bottom sheets with 24px top radius for confirms, customer form, payment method, core history. Delete confirm names the item, red Delete + Cancel.
- Toasts: errors only.
- Payment method chips: Cash / KBZPay / Bank with their colours and icons.
- History sheet (table): full-screen, pinned left columns (Voucher, Date), pinned right column (Remaining), zebra rows, sticky header, 15px tabular numbers, Remaining as pill: red amount when owed, green 0, grey "Paid later". Landscape-friendly. Row height 52px.
- Item cards (voucher): collapsible, numbered, subtotal visible when collapsed.

## 5. Layout Principles
- 4/8 spacing scale, 16px gutters, one main job per screen, sticky bottom action bar adds its height to content padding.
- No card inside a card; two boxes deep at most.

## 6. Depth & Elevation
none; strong dividers and tinted section bands

## 7. Do's and Don'ts
Do: real Myanmar content and demo names (U Aung, Daw Mya, Ko Zaw), MMK amounts, lb weights, sizes like 6x9, 10g, Clear/White/Yellow/Blue plastic. Don't: uppercase labels, bold-black headings, coloured icon tiles, side stripes on cards, gradients, drop shadows beyond the stated one, English-only mockups.

## 8. Responsive Behavior
Phone <600: bottom bar, single column. Tablet 600-1023 and laptop >=1024: defined in phase 2 (sidebar, split views, full sheet).

## 9. Agent Prompt Guide
Always: device MOBILE 390 wide, bilingual labels where noted, bottom tab bar Home / Stock / Reports (+ Spending, Settings for admin), v3 Structured style. Mention contrast 4.5:1, 48px targets, no emoji icons.

## 10. Decision update (2026-11-24): v3 chosen, warm background
- Chosen direction: v3 Structured with a WARM page: page #F6F4EF, row surfaces #FFFFFF, section bands #EFEBE2, dividers #D9D4C8, ink #1F2430, muted #5C6270, accent deep navy #173F8A.
- Status colours unchanged. Keep strong 1px dividers, label/value rows, no shadows, radius 4px.
- History sheet is hand-designed in design/sheet-mockup.html (not from Stitch).
- Myanmar versions of key screens required (Home, Voucher, History sheet, bottom bar).
