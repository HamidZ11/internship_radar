"""
Recalculates fit_score for jobs using the current scoring logic.

Safe by default: without --apply it only reports what would change.

With --apply it:
  - scores every job first and aborts, writing nothing, if any job fails to score;
  - writes a JSON backup of (id, old score, new score) to --backup before changing anything;
  - updates only fit_score, only on rows whose score changes, in one transaction, with
    plain SQL so updated_at, status, is_saved and listing content are left untouched;
  - requires each UPDATE to hit exactly one row whose score is still the old value,
    otherwise rolls the whole transaction back.

Run from the backend/ directory:
    python scripts/recalculate_scores.py                                  # dry run
    python scripts/recalculate_scores.py --apply --backup PATH.json       # write
    python scripts/recalculate_scores.py --restore PATH.json              # put the old scores back
Add --exclude-placeholders to leave listings matched by is_placeholder_listing() untouched.
"""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text

from app.collectors.ratemyplacement import is_placeholder_listing
from app.db.database import engine
from app.services.scoring import calculate_fit_score

SELECT_JOBS = "SELECT id, title, company, location, description, role_type, fit_score FROM jobs ORDER BY id"
UPDATE_SCORE = "UPDATE jobs SET fit_score = :new WHERE id = :id AND fit_score = :old"


def plan(exclude_placeholders: bool) -> tuple[list[dict], int, int]:
    """(changes, rows scored, rows skipped). Raises on the first job that fails to score."""
    with engine.connect() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(text(SELECT_JOBS)).mappings().all()
        conn.rollback()
    changes, scored, skipped = [], 0, 0
    for r in rows:
        if exclude_placeholders and is_placeholder_listing(r["title"]):
            skipped += 1
            continue
        try:
            new = calculate_fit_score(dict(r))
        except Exception as exc:
            raise RuntimeError(f"job {r['id']} failed to score; nothing written: {exc}") from exc
        scored += 1
        if new != r["fit_score"]:
            changes.append({"id": r["id"], "title": r["title"], "old": r["fit_score"], "new": new})
    return changes, scored, skipped


def apply(changes: list[dict], backup: Path) -> None:
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(json.dumps({
        "created_at": datetime.now(timezone.utc).isoformat(),
        "changes": [{"id": c["id"], "old": c["old"], "new": c["new"]} for c in changes],
    }, indent=2))
    print(f"Backup written: {backup}")
    with engine.begin() as conn:  # one transaction: commits on success, rolls back on any exception
        for c in changes:
            hit = conn.execute(text(UPDATE_SCORE), {"id": c["id"], "old": c["old"], "new": c["new"]}).rowcount
            if hit != 1:
                raise RuntimeError(f"job {c['id']}: expected 1 row with score {c['old']}, updated {hit}; rolled back")
    print(f"Committed {len(changes)} score updates in one transaction.")


def restore(backup: Path) -> None:
    changes = json.loads(backup.read_text())["changes"]
    with engine.begin() as conn:
        for c in changes:
            hit = conn.execute(text(UPDATE_SCORE), {"id": c["id"], "old": c["new"], "new": c["old"]}).rowcount
            if hit != 1:
                raise RuntimeError(f"job {c['id']}: expected score {c['new']}, updated {hit}; rolled back")
    print(f"Restored {len(changes)} previous scores in one transaction.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write the new scores (default: dry run)")
    ap.add_argument("--backup", type=Path, help="JSON file to record old scores in; required with --apply")
    ap.add_argument("--restore", type=Path, help="put back the scores recorded in this backup file")
    ap.add_argument("--exclude-placeholders", action="store_true")
    args = ap.parse_args()

    if args.restore:
        restore(args.restore)
        return
    if args.apply and not args.backup:
        ap.error("--apply needs --backup PATH.json")

    changes, scored, skipped = plan(args.exclude_placeholders)
    deltas = Counter("up" if c["new"] > c["old"] else "down" for c in changes)
    print(f"Scored {scored} jobs ({skipped} placeholders skipped). {len(changes)} scores change "
          f"({deltas['up']} up, {deltas['down']} down); {scored - len(changes)} unchanged.")
    for c in changes:
        print(f"  {c['id']:>4}  {c['old']:>3} → {c['new']:<3}  {c['title'][:70]}")

    if not args.apply:
        print("\nDry run: nothing written. Re-run with --apply --backup PATH.json to write.")
        return
    apply(changes, args.backup)


if __name__ == "__main__":
    main()
