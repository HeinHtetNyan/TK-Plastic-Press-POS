"""Fill a DEMO server with FAKE data (for Google Play app reviewers).

Usage:  python seed_demo.py http://localhost:8001/api
        python seed_demo.py https://tk-demo.heinh.dev/api

SAFETY: it refuses to run unless the address is localhost / 127.0.0.1 or contains "demo", so it can
never be pointed at the live shop by mistake. Run it once on an EMPTY database (it creates the first
admin through /auth/setup). Every name below is invented sample data.
"""
import datetime
import json
import random
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "").rstrip("/")
if not BASE or not any(x in BASE for x in ("localhost", "127.0.0.1", "demo")):
    sys.exit("Refusing to run: give a localhost or *demo* address (never the live server).")

ADMIN = ("demo", "TKDemo2026")
random.seed(2026)


def call(method, path, token=None, body=None, form=None):
    data, headers = None, {}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def must(res, what):
    st, out = res
    if st != 200:
        sys.exit(f"FAILED {what}: {st} {str(out)[:200]}")
    return out


# ---- first admin (only works on an empty database)
st, chk = call("GET", "/auth/check-setup")
if st == 200 and chk.get("is_setup_required"):
    must(call("POST", "/auth/setup", body={"username": ADMIN[0], "password": ADMIN[1], "role": "ADMIN"}), "setup admin")
token = must(call("POST", "/auth/login", form={"username": ADMIN[0], "password": ADMIN[1]}), "login")["access_token"]
print("admin ready")

# ---- pick-lists (the migrations already seed sizes, plastic colors and print colors)
# (a database created fresh, not by the migrations, has empty lists: add sample ones)
SAMPLE = {"SIZE": ["4x6", "5x8", "6x9", "7x12", "8x12", "9x14", "10x15", "12x18"],
          "COLOR": ["Clear", "White", "Yellow", "Blue"],
          "GATE": ["9g", "10g", "11g"],
          "PRINT": ["Red", "Green", "Black", "Blue"]}
for kind, names in SAMPLE.items():
    for n in names:
        call("POST", "/options", token, {"kind": kind, "name": n})
opts = must(call("GET", "/options", token), "options")
sizes = [o["name"] for o in opts["sizes"]][:8]
colors = [o["name"] for o in opts["colors"]][:4]
gates = ["9g", "10g", "11g"]
prints = [o["name"] for o in opts["prints"]][:4]
print("lists:", len(sizes), "sizes,", len(colors), "colors,", len(prints), "print colors")

today = datetime.date.today()
fmt = lambda d: d.strftime("%d-%m-%Y")

# ---- stock: a factory purchase for every size x color we will sell, plus an opening line
lines = [{"size": s, "color": c, "gate": random.choice(gates), "weight_lb": 600, "price_per_lb": random.choice([2800, 3000, 3200])}
         for s in sizes[:6] for c in colors[:2]]
must(call("POST", "/purchases", token, {"supplier": "Sample Factory", "purchase_number": "DEMO-P1",
                                        "purchase_date": fmt(today - datetime.timedelta(days=100)), "lines": lines}), "purchase")
print("stock added:", len(lines), "lines")

# ---- customers (invented)
names = ["U Aung (Sample)", "Daw Mya (Sample)", "Ko Zaw (Sample)", "Ma Hnin (Sample)", "U Thant (Sample)", "Daw Khin (Sample)",
         "Ko Min (Sample)", "Ma Su (Sample)", "U Kyaw (Sample)", "Daw Nu (Sample)", "Ko Htet (Sample)", "Ma Aye (Sample)"]
customers = []
for i, n in enumerate(names):
    c = must(call("POST", "/customers/", token, {"name": n, "phone_numbers": f"09-000000{i:02d}", "address": "Sample Town"}), "customer")
    customers.append(c["id"])
print("customers:", len(customers))

# ---- vouchers over the last 90 days, 1-4 items each, some with extra charge / discount / part payment
vno = 1
for day in range(90, 0, -3):
    cid = random.choice(customers)
    items = []
    for _ in range(random.randint(1, 4)):
        it = {"lb": round(random.uniform(8, 120), 2), "plastic_size": random.choice(sizes[:6]), "color": random.choice(colors[:2]),
              "plastic_price": random.choice([4500, 4900, 5200, 5600]), "color_price": random.choice([0, 1295, 1500, 1800])}
        if random.random() < 0.6:
            it["gate"] = random.choice(gates)
        if random.random() < 0.4:
            it["print_color"] = random.choice(prints)
        items.append(it)
    total = sum(i["lb"] * (i["plastic_price"] + i["color_price"]) for i in items)
    body = {"customer_id": cid, "voucher_number": f"{vno:06d}", "voucher_date": fmt(today - datetime.timedelta(days=day)), "items": items}
    if random.random() < 0.25:
        body["extra_charge_amount"] = 5000
        body["extra_charge_note"] = "Delivery"
    if random.random() < 0.2:
        body["discount_amount"] = 2000
    roll = random.random()
    if roll < 0.45:
        body["paid_amount"] = round(total)
        body["payment_method"] = random.choice(["CASH", "KBZPAY"])
    elif roll < 0.75:
        body["paid_amount"] = round(total * random.choice([0.3, 0.5, 0.7]))
        body["payment_method"] = "CASH"
    call("POST", "/vouchers", token, body)
    vno += 1
print("vouchers:", vno - 1)

# ---- some later payments on debts, and spendings
for cid in customers[:6]:
    call("POST", "/payments", token, {"customer_id": cid, "amount_paid": random.choice([20000, 50000, 100000]), "payment_method": "CASH",
                                      "payment_date": fmt(today - datetime.timedelta(days=random.randint(1, 20)))})
for d, a in (("Shop rent", 150000), ("Electricity", 62000), ("Transport", 35000), ("Staff lunch", 18000), ("Repairs", 44000), ("Packing bags", 27000)):
    call("POST", "/spendings", token, {"description": d, "amount": a, "spending_date": fmt(today - datetime.timedelta(days=random.randint(1, 60)))})
print("payments + spendings added. DONE. Login:", ADMIN[0], "/", ADMIN[1])
