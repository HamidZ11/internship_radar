"""
Dry run: compare stored fit scores with rescoring options, without writing anything.

Runs inside a READ ONLY transaction, so the database refuses any write.
Scores compared per listing:
  A  stored     – fit_score currently in the database
  B  --b-rules  – an earlier scoring.py (default: git:0b27100, the matcher fix)
  C  --c-rules  – optional second earlier scoring.py (a git:<rev> or a file path)
  D  current    – app/services/scoring.py as it is now (what recalculate_scores.py would write)

Run from the backend/ directory:
    python scripts/dry_run_rescore.py [--c-rules path/to/scoring.py] [--out report.md]
"""
import argparse
import importlib.util
import re
import subprocess
import sys
import types
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text

from app.collectors.ratemyplacement import is_placeholder_listing
from app.db.database import engine
from app.services import scoring as current

RULE_LABEL = {
    "role": "Role type", "tech": "Tech keywords", "location": "Location",
    "requirements": "States requirements", "stack": "Modern stack",
    "graduate": "Graduate", "unpaid": "Unpaid/volunteer", "off_target": "Off-target",
}
BUCKETS = ["-100 to -41", "-40 to -21", "-20 to -11", "-10 to -1", "0", "+1 to +10", "+11 to +20", "+21 to +40", "+41 to +100"]
GROUPS = {  # report grouping only; whole-word patterns
    "Software engineering": r"\b(?:software|developer|programm\w*)\b",
    "AI / data": r"\b(?:AI|data|machine learning|natural language|analytics)\b",
    "Cyber": r"\bcyber\b",
    "Business development / presales / sales": r"\b(?:business development|presales|sales|key accounts?)\b",
    "Audit / tax / actuarial": r"\b(?:audit|tax|actuar\w*)\b",
}


def load_rules(spec: str) -> types.ModuleType:
    """scoring.py from `git:<rev>` or from a file path, imported without touching the working tree."""
    name = f"scoring_{re.sub(r'[^A-Za-z0-9]', '_', spec)}"
    if spec.startswith("git:"):
        repo = Path(__file__).resolve().parents[2]
        source = subprocess.run(["git", "show", f"{spec[4:]}:backend/app/services/scoring.py"],
                                cwd=repo, check=True, capture_output=True, text=True).stdout
        module = types.ModuleType(name)
        sys.modules[name] = module  # dataclasses resolve annotations through sys.modules
        exec(compile(source, spec, "exec"), module.__dict__)
        return module
    loader_spec = importlib.util.spec_from_file_location(name, spec)
    module = importlib.util.module_from_spec(loader_spec)
    sys.modules[name] = module
    loader_spec.loader.exec_module(module)
    return module


def rule(e, key):
    return next(r for r in e.rules if r.key == key)


def evidence(e, key: str) -> str:
    r = rule(e, key)
    if not r.evidence:
        return "—"
    return ", ".join(t if m.lower() == t else f"{t} in “{m}”" for t, m in r.evidence)


def bucket(d: int) -> str:
    if d == 0:
        return "0"
    for lo, hi in [(-100, -41), (-40, -21), (-20, -11), (-10, -1), (1, 10), (11, 20), (21, 40), (41, 100)]:
        if lo <= d <= hi:
            return f"{lo:+d} to {hi:+d}"
    return str(d)


def contributions(e) -> str:
    return " ".join(f"{k}{r.points:+d}" for k in RULE_LABEL if (r := rule(e, k)).points)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--b-rules", default="git:0b27100")
    ap.add_argument("--c-rules", help="git:<rev> or path; defaults to the B rules")
    ap.add_argument("--out", help="also write the report to this file")
    ap.add_argument("--top", type=int, default=15)
    args = ap.parse_args()
    b_rules = load_rules(args.b_rules)
    c_rules = load_rules(args.c_rules) if args.c_rules else b_rules

    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(text(
            "SELECT id, title, company, location, description, role_type, fit_score FROM jobs ORDER BY id"
        )).mappings().all()
        conn.rollback()

    records = []
    for r in rows:
        job = dict(r)
        b, c, d = b_rules.explain_fit_score(job), c_rules.explain_fit_score(job), current.explain_fit_score(job)
        records.append({
            "id": r["id"], "title": r["title"], "company": r["company"],
            "placeholder": is_placeholder_listing(r["title"]),
            "A": r["fit_score"], "B": b.score, "C": c.score, "D": d.score,
            "Be": b, "Ce": c, "De": d, "category": d.category,
            "changed": [k for k in RULE_LABEL if rule(c, k).points != rule(d, k).points],
        })

    out: list[str] = []
    p = out.append
    n = len(records)
    real = [x for x in records if not x["placeholder"]]

    def summary(label: str, before: str, after: str) -> None:
        deltas = [x[after] - x[before] for x in records]
        changed = [d for d in deltas if d]
        dist = Counter(bucket(d) for d in deltas)
        p(f"- **{label}**: {len(changed)} changed ({len(changed) / n:.0%}) · up {sum(d > 0 for d in changed)}"
          f" · down {sum(d < 0 for d in changed)} · avg |Δ| {sum(map(abs, deltas)) / n:.1f}"
          f" ({sum(map(abs, changed)) / max(1, len(changed)):.1f} among changed) · "
          + ", ".join(f"{k}: {dist[k]}" for k in BUCKETS if dist.get(k)))

    def table(rows_: list[dict], cols: str = "full") -> None:
        p("| id | Role | Company | Category | A | B | C | D | Final contributions |\n|---|---|---|---|---|---|---|---|---|")
        for x in rows_:
            p(f"| {x['id']} | {x['title'][:62]} | {x['company']} | {x['category']} | {x['A']} | {x['B']} | {x['C']} | **{x['D']}** | {contributions(x['De'])} |")
        p("")

    p("# Fit score dry run\n")
    p("No rows were written: the queries ran in a READ ONLY transaction that was rolled back.  ")
    p(f"A stored · B {args.b_rules} · C {args.c_rules or args.b_rules} · D current working tree. "
      f"{n} listings, {len(real)} real (excluding {n - len(real)} placeholders).\n")
    p("Final categories: " + ", ".join(f"{k} {v}" for k, v in Counter(x["category"] for x in records).most_common()) + "\n")
    p("## Summary\n")
    summary("C → D (this pass)", "C", "D")
    summary("B → C", "B", "C")
    summary("A → D (what a rescore would write)", "A", "D")
    p("")

    p("## Rules responsible for C → D\n")
    p("| Rule | Non-zero in C | Non-zero in D | Changed C→D | Up | Down |\n|---|---|---|---|---|---|")
    for k, label in RULE_LABEL.items():
        moved = [rule(x["De"], k).points - rule(x["Ce"], k).points for x in records if k in x["changed"]]
        p(f"| {label} | {sum(rule(x['Ce'], k).points != 0 for x in records)} | {sum(rule(x['De'], k).points != 0 for x in records)} "
          f"| {len(moved)} | {sum(m > 0 for m in moved)} | {sum(m < 0 for m in moved)} |")
    p("")

    moved = sorted([x for x in records if x["changed"]], key=lambda x: (x["D"] - x["C"], x["id"]))
    p(f"## Every listing changed C → D ({len(moved)})\n")
    p("| id | Role | C → D | Rule | C evidence | D evidence |\n|---|---|---|---|---|---|")
    for x in moved:
        for k in x["changed"]:
            p(f"| {x['id']} | {x['title'][:58]} | {x['C']} → {x['D']} | {RULE_LABEL[k]} {rule(x['Ce'], k).points:+d} → {rule(x['De'], k).points:+d} "
              f"| {evidence(x['Ce'], k)} | {evidence(x['De'], k)} |")
    p("")

    by = sorted(records, key=lambda x: (x["D"] - x["A"], x["id"]))
    p(f"## Top {args.top} decreases, stored → final\n")
    table(by[: args.top])
    p(f"## Top {args.top} increases, stored → final\n")
    table(list(reversed(by[-args.top:])))

    ranked = sorted(real, key=lambda x: (-x["D"], x["id"]))
    p("## Top 20 real listings by final score\n")
    table(ranked[:20])
    p("## Bottom 20 real listings by final score\n")
    table(ranked[-20:])

    for label, pattern in GROUPS.items():
        group = [x for x in ranked if re.search(pattern, x["title"], re.IGNORECASE)]
        p(f"## {label} ({len(group)} real listings)\n")
        table(group)

    report = "\n".join(out)
    print(report)
    if args.out:
        Path(args.out).write_text(report)


if __name__ == "__main__":
    main()
