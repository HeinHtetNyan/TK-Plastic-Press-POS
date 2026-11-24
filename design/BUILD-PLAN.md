# Build plan: redesign v3 into the app

Branch: `redesign-v3` (from `New_Features`). Local commits only, never pushed. One commit per step so any step can be undone.
Design source: `design/v3/DESIGN.md` section 10, `design/app-mockup.html`, `design/sheet-mockup.html`, `design/brief.md`.

## Hard rules
- The printed A5 voucher is NOT changed: `frontend/src/utils/printReceipt.js` and the print/PDF template code stay as they are. The new theme must not leak into the printed output.
- Logic, data, Dexie/IndexedDB, sync, roles and API calls do not change. Only look, layout and the new settings change.
- Every step is checked at 390 / 768 / 1024 / 1440 px, English and Myanmar, light and dark, with headless-Chrome screenshots, then `npm run build` and `npm run lint` must pass.

## What the code looks like today
- React 19 + Tailwind 4, styled with utility classes inside each page (about 7,200 lines across pages/components). No dark-mode classes exist yet.
- Biggest files: History.jsx (1098), Home.jsx (681), Voucher.jsx (647), Stock.jsx (501), Spending.jsx (407), Reports.jsx (347), Dashboard.jsx (309), Payment.jsx (302).
- Layout.jsx holds the current shell (bottom bar). Myanmar handling lives in index.css (`html.lang-mm`).

## Steps
0. **Prepare.** Create the branch, add `design/` to the repo as design docs (local commit). Add `@fontsource/public-sans` (approved).
1. **Foundation.** In `index.css`: colour tokens as CSS variables (light + dark), mapped into Tailwind 4 `@theme`; Public Sans for Latin, Noto Sans Myanmar kept for Myanmar; `--fs`/`--row-h` for Normal/Large; sentence case, weights 400/500/600, 48px targets. Small shared pieces: button, input, tag, section card, sync pill, bottom sheet / dialog.
2. **Shell.** `Layout.jsx`: bottom bar under 600px, icon rail 600-1023, labelled sidebar from 1024; page title bar; one sync pill; one offline banner. Same 5 items and role rules as today.
3. **Settings additions.** Text size (Normal/Large) and Theme (Light/Dark) in Settings, saved on the device (localStorage), applied before first paint to avoid a flash.
4. **History sheet and cards** (History.jsx, HistorySheet.jsx): pinned columns, frozen header and totals, row and column lines, full-width 15 columns on PC, cards on phone.
5. **Voucher and Payment** (Voucher.jsx, Payment.jsx): one page with sticky Save bar on phone, two columns with sticky summary on tablet/PC, payment sheet / dialog. Print button and print code untouched.
6. **Home and Customers** (Home.jsx, CustomerSearch.jsx, Dashboard.jsx, BalanceDisplay.jsx): search first, dashboard below, offline/Pending states, delete confirm sheet.
7. **Stock, Reports, Spending, Users/Audit, Login.**
8. **Final checks:** full screenshot pass, Myanmar review, contrast, keyboard focus, build + lint, update `DESIGN-STATUS.md`.

## Risks (honest)
- It is a big change: about 20 files are restyled. That is why each step is its own commit and tested before the next.
- Voucher.jsx and History.jsx mix layout with logic. I will change classes and structure carefully and keep the logic in place; I will run the app and compare numbers (totals, remaining) against the current behaviour.
- Tablet/PC layouts for Stock, Reports and Spending have no finished design yet (Stitch timed out). I will build them from the phone design plus the same sidebar/grid rules and show you screenshots.
- No automated tests exist for the UI, so checking is by screenshots and by running the app.
- Some Myanmar labels in the mock-up are drafts. The app's own Myanmar dictionary stays the source of truth; I will not rewrite existing Myanmar text without your say.

## Not in scope
Backend, Android WebView wrapper, sync logic, printed voucher template, new features beyond Text size and Dark mode.
