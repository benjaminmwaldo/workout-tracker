"""Parse Benjamin's Workouting.xlsx recent sheets into a clean seed JSON
for the workout tracker app.

Set-string grammar (column B):
  groups separated by spaces; each group = WEIGHT 'x' REPS ['x' REPS ...]
  each REPS in a group is a separate set at WEIGHT.
  e.g. "380x8 430x8 470x8" -> 3 sets; "560x4x4x4x4" -> 4 sets of 560x4.
Column A on a date row = the session date; other rows = exercise name (A) + sets (B).
Body-weight rows carry "NNN lbs" in column B on a date row.
"""
import openpyxl, re, datetime, json, sys

SRC = r"C:\Users\benja\Downloads\Workouting.xlsx"
OUT = r"C:\Users\benja\Claude\projects\workout-tracker\src\data\seed.json"

SHEETS = ["Spr-Dec25", "Dec25 - Sum26"]  # 2025 -> mid 2026, most relevant recent history

def is_date(v):
    return isinstance(v, (datetime.datetime, datetime.date))

def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

# Light normalization of near-duplicate names -> canonical
ALIAS = {
    "bp": "Bench press",
    "bench press": "Bench press",
    "incline db press": "Incline db press",
    "incline db chest press": "Incline db press",
    "bicep curl alt": "Bicep curl alt",
    "bicep curls alt": "Bicep curl alt",
    "bicep curl alt db": "Bicep curl alt",
    "bicep curl alt dbs": "Bicep curl alt",
    "db lat raises": "Db lateral raise",
    "db lateral raise": "Db lateral raise",
    "lateral raise dbs": "Db lateral raise",
    "lateral raise machine": "Lateral raise mach",
    "lateral raise mach": "Lateral raise mach",
    "shrugs dbs": "Shrugs dbs",
    "skullcrushers ss1": "Skullcrushers",
    "tricep pushdown ss1": "Tricep pushdown",
    "egyptian lateral raise ss1": "Egyptian lateral raise",
}

def canon(name):
    key = name.strip().lower()
    if key in ALIAS:
        return ALIAS[key]
    # Title-ish: keep original casing but strip
    return name.strip()

# crude muscle-group guess from name keywords
def guess_group(name):
    n = name.lower()
    def has(*w): return any(x in n for x in w)
    if has("calf", "calve"): return "Calves"
    if has("leg press", "squat", "leg ext", "leg curl", "rdl", "hack", "lunge", "adduct", "linear leg"): return "Legs"
    if has("bicep", "curl", "preacher"): return "Biceps"
    if has("tricep", "skullcrush", "pushdown", "dips", "extension mach") : return "Triceps"
    if has("lateral", "shoulder press", "shrug", "delt", "arnold", "egyptian", "military", "ohp"): return "Shoulders"
    if has("pulldown", "row", "pullup", "pull up", "lat "): return "Back"
    if has("bp", "bench", "chest", "pec", "incline", "decline", "fly"): return "Chest"
    if has("wrist", "forearm"): return "Forearms"
    if has("ab", "crunch", "core", "plank"): return "Core"
    if has("neck"): return "Neck"
    return "Other"

def parse_sets(s):
    sets = []
    for group in s.split():
        parts = group.lower().split("x")
        # weight = first part; may have decimals
        try:
            w = float(parts[0])
        except ValueError:
            continue
        reps_parts = parts[1:]
        if not reps_parts or reps_parts == [""]:
            continue  # incomplete like "290x"
        for rp in reps_parts:
            rp = rp.strip()
            if rp == "":
                continue
            m = re.match(r"(\d+)", rp)
            if not m:
                continue
            reps = int(m.group(1))
            if reps <= 0 or reps > 100:
                continue
            sets.append({"weight": w, "reps": reps})
    return sets

def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
    exercises = {}   # canonical name -> {id,name,group}
    sessions = {}    # date -> {date, entries:{exId:[sets]}, bodyweight}
    order = []

    for sheet in SHEETS:
        ws = wb[sheet]
        cur = None
        for row in ws.iter_rows(values_only=True):
            a = row[0] if len(row) > 0 else None
            b = row[1] if len(row) > 1 else None
            if is_date(a):
                cur = a.date().isoformat()
                if cur not in sessions:
                    sessions[cur] = {"date": cur, "entries": {}, "bodyweight": None}
                    order.append(cur)
                # bodyweight in col B on date row
                if isinstance(b, str):
                    m = re.search(r"(\d{2,3}(?:\.\d)?)\s*(?:lbs)?", b)
                    if m and 100 < float(m.group(1)) < 400:
                        sessions[cur]["bodyweight"] = float(m.group(1))
                elif isinstance(b, (int, float)) and 100 < b < 400:
                    sessions[cur]["bodyweight"] = float(b)
                continue
            if cur and a and b and isinstance(a, str) and isinstance(b, str) and re.search(r"\d+x\d+", b):
                name = canon(a)
                sets = parse_sets(b)
                if not sets:
                    continue
                if name not in exercises:
                    exercises[name] = {"id": slug(name), "name": name, "muscleGroup": guess_group(name)}
                ex = exercises[name]["id"]
                sessions[cur]["entries"].setdefault(ex, []).extend(sets)

    # Build final structures
    ex_list = sorted(exercises.values(), key=lambda e: e["name"].lower())
    sess_list = []
    for d in order:
        s = sessions[d]
        entries = [{"exerciseId": ex, "sets": sets} for ex, sets in s["entries"].items() if sets]
        if not entries and s["bodyweight"] is None:
            continue
        sess_list.append({
            "id": "seed-" + d,
            "date": d,
            "entries": entries,
            "bodyweight": s["bodyweight"],
            "notes": "",
        })
    sess_list.sort(key=lambda x: x["date"])

    seed = {"exercises": ex_list, "sessions": sess_list}
    import os
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(seed, f, indent=1)
    print(f"exercises: {len(ex_list)}  sessions: {len(sess_list)}")
    total_sets = sum(len(e['sets']) for s in sess_list for e in s['entries'])
    print(f"total logged sets: {total_sets}")
    print("date range:", sess_list[0]['date'], "->", sess_list[-1]['date'])

if __name__ == "__main__":
    main()
