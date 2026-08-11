from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, session, url_for
from flask import session, redirect, render_template, request
import json, os, datetime
from cryptography.fernet import Fernet
import qrcode

app = Flask(__name__)
app.secret_key = "vortex-secret"

DB_FILE = "database.json"
PHARMACY_FILE = "pharmacies.json"

# ===================== INIT =====================

if not os.path.exists(DB_FILE):
    open(DB_FILE, "w").write("[]")

if not os.path.exists(PHARMACY_FILE):
    open(PHARMACY_FILE, "w").write("[]")

# Encryption
if not os.path.exists("key.key"):
    key = Fernet.generate_key()
    open("key.key", "wb").write(key)
else:
    key = open("key.key", "rb").read()

cipher = Fernet(key)

# ===================== AUTH =====================

USERS = {
    "admin@gmail.com": {
        "password": "1234"
    }
}

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_email" not in session:
            return redirect("/login")
        return view(*args, **kwargs)
    return wrapped

# ===================== PAGE ROUTES (FIXED 🔥) =====================

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/login', methods=['GET', 'POST'])
def login():
    context = {"error": None, "values": {}}

    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        context["values"] = request.form

        user = USERS.get(email)

        if user and user["password"] == password:
            session["user_email"] = email   # 🔥 SAVE SESSION
            return redirect("/")            # go to home

        context["error"] = "Invalid email or password"

    return render_template("login.html", **context)

@app.route('/logout')
def logout():
    session.clear()
    return redirect("/login")

@app.route('/scan')
def scan_page():
    return render_template("scan.html")

@app.route('/register', methods=['GET'])
def register_page():
    return render_template("register.html", values={}, error=None)

@app.route('/map')
def map_page():
    return render_template("map.html")

@app.context_processor
def inject_user():
    return {
        "is_authenticated": "user_email" in session,
        "current_user": session.get("user_email")
    }

# ===================== REGISTER (POST) =====================
@app.route('/register', methods=['POST'])
def register():
    data = request.form  # 🔥 FIX

    name = data.get("name")
    batch = data.get("batch")
    expiry = data.get("expiry")
    salt = data.get("salt")

    if not all([name, batch, expiry, salt]):
        return render_template("register.html", error="All fields required", values=data)

    payload = f"{name}|{batch}|{expiry}"  # 🔥 simpler QR

    db = json.load(open(DB_FILE))
    db.append({
        "data": payload,
        "scanned": False,
        "scan_history": [],
        "reports": []
    })
    json.dump(db, open(DB_FILE, "w"), indent=4)

    os.makedirs("static/qrs", exist_ok=True)

    filename = f"{batch}.png"

    path = os.path.join("static", "qrs", filename)

    qrcode.make(payload).save(path)

    return render_template(
        "qr.html",
        qr=url_for("static", filename=f"qrs/{filename}"),
        name=name,
        batch=batch,
        expiry=expiry
    )

# ===================== VERIFY =====================

@app.route('/verify', methods=['POST'])
def verify():
    data = request.json.get("data", "").strip()

    db = json.load(open(DB_FILE))

    for item in db:
        stored = item["data"].strip()

        # 🔥 EXACT MATCH ONLY
        if stored == data:

            name, batch, expiry = stored.split("|")

            if item.get("scanned"):
                return jsonify({
                    "status": "DUPLICATE",
                    "name": name,
                    "expiry": expiry
                })

            item["scanned"] = True
            json.dump(db, open(DB_FILE, "w"), indent=4)

            return jsonify({
                "status": "GENUINE",
                "name": name,
                "expiry": expiry
            })

    # 🔥 ONLY REACH HERE IF NOT FOUND
    return jsonify({
        "status": "COUNTERFEIT"
    })
# ===================== REPORT =====================

@app.route('/report', methods=['POST'])
def report():
    encrypted = request.json.get("data")
    issue = request.json.get("issue")
    note = request.json.get("note")

    db = json.load(open(DB_FILE))

    for item in db:
        if item["data"] == encrypted:
            report = {
                "issue": issue,
                "note": note,
                "time": str(datetime.datetime.now())
            }
            item["reports"].append(report)

            json.dump(db, open(DB_FILE, "w"), indent=4)
            return jsonify({"message": "Report submitted"})

    return jsonify({"error": "Not found"}), 404

# ===================== PHARMACY =====================

@app.route('/pharmacies')
def pharmacies():
    return jsonify(json.load(open(PHARMACY_FILE)))

@app.route('/add_pharmacy', methods=['POST'])
def add_pharmacy():
    data = request.json
    db = json.load(open(PHARMACY_FILE))

    db.append({
        "name": data["name"],
        "lat": data["lat"],
        "lng": data["lng"],
        "medicines": data.get("medicines", []),
        "rating": 0,
        "reviews": []
    })

    json.dump(db, open(PHARMACY_FILE, "w"), indent=4)

    return jsonify({"message": "Pharmacy added"})

# ===================== SEARCH =====================

@app.route('/search_medicine')
def search():
    name = request.args.get("name", "").lower()

    with open("pharmacies.json") as f:
        pharmacies = json.load(f)

    result = [
        p for p in pharmacies
        if any(name in med.lower() for med in p["medicines"])
    ]

    return jsonify(result)
# ===================== RATING =====================

@app.route('/rate', methods=['POST'])
def rate():
    name = request.json.get("name")
    rating = request.json.get("rating")

    db = json.load(open(PHARMACY_FILE))

    for p in db:
        if p["name"] == name:
            p["reviews"].append(rating)
            p["rating"] = sum(p["reviews"]) / len(p["reviews"])

    json.dump(db, open(PHARMACY_FILE, "w"), indent=4)

    return jsonify({"message": "Rating added"})

# ===================== RUN =====================

@app.context_processor
def inject_user():
    return {
        "is_authenticated": "user_email" in session,
        "current_user": session.get("user_email")
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
