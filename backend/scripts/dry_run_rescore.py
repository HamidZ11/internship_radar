"""
Dry run: compare stored fit scores with the current matcher, without writing anything.

Runs inside a READ ONLY transaction, so the database refuses any write.
Three scores are compared per listing:
  stored  – fit_score currently in the database
  legacy  – today's rules with the previous substring matcher (isolates the matcher change)
  new     – today's rules with the current matcher (what recalculate_scores.py would write)

Run from the backend/ directory:
    python scripts/dry_run_rescore.py [--out report.md] [--examples 12]
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text

from app.collectors.ratemyplacement import is_placeholder_listing
from app.db.database import engine
from app.services.scoring import FitExplanation, explain_fit_score

RULE_LABEL = {
    "role": "Role type", "tech": "Tech keywords", "location": "Location",
    "requirements": "States requirements", "stack": "Modern stack",
    "graduate": "Graduate-scheme wording", "unpaid": "Unpaid/volunteer", "off_target": "Off-target department",
}


def legacy_find(text_value: str | None, term: str) -> str | None:
    """The previous matcher: plain substring search on lowercased text."""
    lowered = (text_value or "").lower()
    i = lowered.find(term)
    if i < 0:
        return None
    a, b = i, i + len(term)
    while a > 0 and lowered[a - 1].isalnum():
        a -= 1
    while b < len(lowered) and lowered[b].isalnum():
        b += 1
    return lowered[a:b].strip() or term.strip()


def evidence(e: FitExplanation, key: str) -> str:
    r = next(r for r in e.rules if r.key == key)
    if not r.evidence:
        return "—"
    return ", ".join(t if m.lower() == t else f"{t} in “{m}”" for t, m in r.evidence)


def points(e: FitExplanation, key: str) -> int:
    return next(r.points for r in e.rules if r.key == key)


def bucket(d: int) -> str:
    if d == 0:
        return "0"
    edges = [(-100, -41), (-40, -21), (-20, -11), (-10, -1), (1, 10), (11, 20), (21, 40), (41, 100)]
    for lo, hi in edges:
        if lo <= d <= hi:
            return f"{lo:+d} to {hi:+d}"
    return str(d)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="also write the report to this file")
    ap.add_argument("--examples", type=int, default=12)
    args = ap.parse_args()

    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(text(
            "SELECT id, title, company, location, description, role_type, fit_score FROM jobs ORDER BY id"
        )).mappings().all()
        conn.rollback()

    records = []
    for r in rows:
        job = dict(r)
        legacy = explain_fit_score(job, find=legacy_find)
        new = explain_fit_score(job)
        changed_rules = [k for k in RULE_LABEL if points(legacy, k) != points(new, k)]
        records.append({
            "id": r["id"], "title": r["title"], "company": r["company"],
            "placeholder": is_placeholder_listing(r["title"]),
            "stored": r["fit_score"], "legacy": legacy.score, "new": new.score,
            "legacy_e": legacy, "new_e": new, "changed_rules": changed_rules,
        })

    out: list[str] = []
    p = out.append
    n = len(records)

    def summary(label: str, before_key: str) -> None:
        deltas = [x["new"] - x[before_key] for x in records]
        changed = [d for d in deltas if d]
        p(f"### {label}\n")
        p(f"- Listings examined: **{n}** ({sum(x['placeholder'] for x in records)} are placeholder listings)")
        p(f"- Scores that would change: **{len(changed)}** ({len(changed) / n:.0%})")
        p(f"- Increases: {sum(d > 0 for d in changed)} · decreases: {sum(d < 0 for d in changed)}")
        p(f"- Average absolute delta (all listings): **{sum(map(abs, deltas)) / n:.1f}** points"
          f"; among changed: {sum(map(abs, changed)) / max(1, len(changed)):.1f}")
        dist = Counter(bucket(d) for d in deltas)
        order = ["-100 to -41", "-40 to -21", "-20 to -11", "-10 to -1", "0", "+1 to +10", "+11 to +20", "+21 to +40", "+41 to +100"]
        p("\n| Delta | Listings |\n|---|---|")
        for k in order:
            if dist.get(k):
                p(f"| {k} | {dist[k]} |")
        p("")

    p("# Fit score dry run\n")
    p("No rows were written: the queries ran in a READ ONLY transaction that was rolled back.\n")
    summary("Stored score → new matcher (what a rescore would write)", "stored")
    summary("Old substring matcher → new matcher (the matcher change on its own)", "legacy")

    p("### Rules whose points change (old matcher → new)\n")
    p("| Rule | Listings changed | Up | Down |\n|---|---|---|---|")
    for k, label in RULE_LABEL.items():
        moved = [points(x["new_e"], k) - points(x["legacy_e"], k) for x in records if k in x["changed_rules"]]
        if moved:
            p(f"| {label} | {len(moved)} | {sum(m > 0 for m in moved)} | {sum(m < 0 for m in moved)} |")
    p("")

    def table(title: str, rows_: list[dict]) -> None:
        p(f"### {title}\n")
        p("| # | Role | Company | Stored | Old matcher | New | Δ vs stored | Δ from matcher | Rules changed |\n|---|---|---|---|---|---|---|---|---|")
        for x in rows_:
            rules = ", ".join(RULE_LABEL[k] for k in x["changed_rules"]) or "— (stored score was stale)"
            p(f"| {x['id']} | {x['title'][:60]} | {x['company']} | {x['stored']} | {x['legacy']} | {x['new']} | "
              f"{x['new'] - x['stored']:+d} | {x['new'] - x['legacy']:+d} | {rules} |")
        p("")

    by_delta = sorted(records, key=lambda x: x["new"] - x["stored"])
    table("Largest decreases (stored → new)", by_delta[:10])
    table("Largest increases (stored → new)", list(reversed(by_delta[-10:])))

    # Examples: prefer listings where the matcher itself moved the score, then several rules, then size.
    matcher_moved = [x for x in records if x["changed_rules"]]
    matcher_moved.sort(key=lambda x: (-len(x["changed_rules"]), -abs(x["new"] - x["legacy"])))
    p(f"### Before / after examples ({min(args.examples, len(matcher_moved))} of {len(matcher_moved)} listings where at least one rule changed;"
      f" some net to zero after clamping)\n")
    for x in matcher_moved[: args.examples]:
        p(f"**{x['title']}** · {x['company']} (id {x['id']})  ")
        p(f"Stored {x['stored']} · old matcher {x['legacy']} → new {x['new']} "
          f"(Δ {x['new'] - x['legacy']:+d} from matcher, {x['new'] - x['stored']:+d} vs stored)\n")
        p("| Rule | Old points | Old evidence | New points | New evidence |\n|---|---|---|---|---|")
        for k in x["changed_rules"]:
            p(f"| {RULE_LABEL[k]} | {points(x['legacy_e'], k):+d} | {evidence(x['legacy_e'], k)} | "
              f"{points(x['new_e'], k):+d} | {evidence(x['new_e'], k)} |")
        p("")

    report = "\n".join(out)
    print(report)
    if args.out:
        Path(args.out).write_text(report)


if __name__ == "__main__":
    main()
