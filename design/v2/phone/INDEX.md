# Phone v2 Soft: generated screens (Stitch project 13062938465193077826)

| File | Screen | Notes |
|---|---|---|
| 01-home.png | Home | Existing screen (project thumbnail). Broken logo image. |
| 02-login.png | Login | Rendered on a 2560x2048 desktop canvas (phone column in the middle). |
| 03-customer-selected.png | Customer U Aung | Invented text: "Customer profile", "Unpaid balance", "Last recorded order was 3 days ago". |
| 04-voucher-top.png | Create voucher (top) | 2560x2236 desktop canvas, phone column in the middle. Text matches the brief. |
| 05-voucher-bottom.png | Create voucher (lower) | "Create Voucher" and "Online" in title case. |
| 06-payment-split.png | Add payment, split | Title says "Create Voucher" (wrong), "Online" capitalised. |
| 10-stock.png | Stock | Copied the Home header (broken logo, "Home" subtitle). Invented "Across 24 items", "Pending orders 12 lb". |
| 12-spending.png | Spending | Home header again; "stock" tab marked active (wrong); lowercase "add spending"; invented "4 records", "current operational period". |

Not retrievable (generation timed out, list_screens returns {} and the project thumbnail never changes, so the screen id is unknown):
07-history-cards, 08-history-sheet-portrait, 13-settings-users.

Not attempted (stopped after repeated timeouts): 09-history-sheet-landscape, 11-reports, 14-offline-delete-sheet.

Update:
| 07-history-cards.png | History cards | Found existing screen "History - U Aung" (780x2024). Header says "Customer" with online pill and avatar (not back arrow + History); chip is "U Aung"; "Date range" instead of Specific date search with Clear; no Reprint-expanded Products/Note; "Pending sync" tag; tab bar shown. Partial match. |
| 09-history-sheet-landscape.png | History sheet landscape | Generated OK but on a 2560x2048 desktop canvas (screen id ec2c57c4bda946a7b3b5d3026c14967e), not 844x390. Not yet visually checked. |

08-history-sheet-portrait: generation timed out again, no new screen in list_screens. Existing "History sheet - U Aung" (id 7b7f9ffdc5994fabab18bcde02574759) is a 2560x2048 desktop canvas, not saved.
