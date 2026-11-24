# Design status (updated 2026-11-24)
- Phase 1 (phone) step 3: compare page built; waiting for user to pick a direction (or finish all 3).
- Done: screens.md, brief.md, v1/v2/v3 DESIGN.md, Home screen for v1 (v1/phone/01-home.png).
- Stitch projects (private): v1 Ledger 5902045151389452504, v2 Soft 13062938465193077826, v3 Structured 15589251224353993707.
- Design systems: v1 assets/fb8daddd14734a628a3cfb46a83bbf77, v2 assets/0818c305eb5248ad82396140501b4b8c (DM Sans, not Figtree), v3 assets/a2abc24462154fd291851f7003e16b84.
- Background helpers generating screens 02-14 per version into vN/phone/ (see INDEX.md in each).
- Note: list_screens returns {} even when screens exist; use get_project thumbnailScreenshot to fetch the latest screen.
- Home v1 review: good, but Stitch added invented text ("Fiscal Y2024", "Ledger POS", "Quick tap", "Cylinder printing & bag stock receipts") to remove in refinement.
- Next: build compare-phone.html, review with user, refine, then Phase 2.
- Saved (2026-11-24): v1 01-06,08,09; v2 01-10 (no 07 partial,08 desktop canvas,09 landscape),12; v3 01-09. Missing in all: 11 reports, 13 settings, 14 offline sheet; v1 07 failed; v2 11,13,14; v3 10-14.
- Stitch quirks: tables render on 2560 desktop canvas (crop by hand with System.Drawing); invents filler text; timeouts leave no findable screen; each generate ~15k tokens so use helpers with <=4 screens.
- Sheet screens from Stitch are layout references only; real sheet to be designed from the 16 real columns.
- DECISIONS (2026-11-24): user chose v3 Structured + warm background; hand-built HTML sheet mockup; finish remaining pages in Stitch (3 per round); Myanmar key screens yes.
- Next: v3 pages 10,11,12 then 13,14 in Stitch; build design/sheet-mockup.html (EN+MM, portrait+landscape); Myanmar key screens; then refine with user; then phase 2.
- 2026-11-24 later: v3 now has 01-15 incl. 11 reports, 12 spending, 13 settings, 14 offline sheet, 15 Myanmar home (short prompts work best in Stitch: ~60 words, no style essays). Hand-built sheet-mockup.html done (EN/MM, portrait/landscape, large text, dark). Phone phase awaiting user review in Stitch + approval. v1/v2 left incomplete by design.
- Findings to fix in refinement (v3): avatar/logo oddities, invented text in 03/07, History cards on desktop canvas (07, 03 uncropped), Myanmar search placeholder truncates, Reports chart y-axis starts at 150k.

## 2026-11-25 update
- User chose v3 as the single final design for ALL sizes (phone, tablet, PC). 3 helpers polishing v3 phone screens (A: 01,02,04,05; B: 03,06,07,14; C: 10,11,12,15,13).
- Phase 2 answers saved in brief.md (sidebar nav, full-width sheet on PC, two-column voucher, all devices equal).

## 2026-11-25 app-mockup.html
- Built design/app-mockup.html (vanilla, no network): shell (bottom tabs <600, rail 600-1023, labelled sidebar >=1024), Home (search, dashboard, selected customer), Create voucher (1 column + sticky Save bar on phone, 2 columns + sticky summary on larger, live totals), Add payment + One/Split method sheet (bottom sheet / dialog / side panel), History cards + sheet (laptop: all 15 columns, frozen header/footer), Customers (offline pill, banner, Pending tags, delete confirm), Settings; Stock/Reports/Spending show 'Designed separately'.
- Preview strip on top switches EN/MM, Normal/Large, Light/Dark, Admin/Staff, Online/Offline and jumps to screens. Hash params for screenshots, e.g. #bare=1&screen=history&theme=dark&lang=my&offline=1&sheet=delete.
- Screenshots in design/shots/ (<screen>-<width>-<theme>[-my].png). Headless Chrome cannot go below 500px wide, so 390px shots use an iframe wrapper and crop.
- Known weak: History sheet at 1024-1279 switches the sidebar to the icon rail so all 15 columns fit (13px text); Large text on laptop sheet will scroll sideways. Myanmar strings not in the app dictionary are drafts. Phone History hides the date-search filter. Add item, Edit customer, Edit/Delete menus are visual only.

## 2026-11-25 (later)
- User chose MIX: Stitch for Stock/Reports/Spending (phone done; tablet/PC still to make), hand-built HTML for Voucher/History/Payment/Settings/Customers (design/app-mockup.html, 47 screenshots in design/shots/, phone+tablet+laptop, light/dark, EN/MM).
- Stitch phone fixes done: 01,02,10,11,12,15 + regenerated 03,04,05,06. Timed out (superseded by HTML): 07,13,14.
- Open: 05 uppercase labels, Reports chart numbers invented by Stitch, Myanmar draft strings need native review, 15-col sheet only fits at 1024-1279 with icon rail. Tablet/PC for Stock/Reports/Spending in Stitch not yet generated.
- Printed A5 voucher: never changed.
