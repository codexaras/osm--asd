#!/usr/bin/env python3
"""
Create the ResourceHub Scrum backlog (epics, stories, story points, sprints) in Jira Cloud
from jira/backlog.json.

  # 1. create a Scrum project in Jira (e.g. key ORMS), then:
  export JIRA_BASE_URL=https://your-team.atlassian.net
  export JIRA_USER_EMAIL=you@example.com
  export JIRA_API_TOKEN=...            # https://id.atlassian.com/manage-profile/security/api-tokens
  export JIRA_PROJECT_KEY=ORMS

  python3 scripts/jira/create_backlog.py --dry-run     # preview
  python3 scripts/jira/create_backlog.py --sprints     # create issues + sprints
  python3 scripts/jira/create_backlog.py --csv jira/backlog.csv   # or export a CSV for Jira's importer

Standard library only. Safe to re-run: issues whose summary already exists are skipped.
"""
import argparse
import csv
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from jira_client import Jira, JiraError, adf  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def load(path):
    data = json.loads(Path(path).read_text())
    total = sum(s["points"] for e in data["epics"] for s in e["stories"])
    return data, total


def describe(story, team):
    owner = next((m["role"] for m in team if m["id"] == story.get("owner")), "")
    paras = [f"Owner role: {owner}" if owner else "", "Acceptance criteria:"]
    paras += [f"• {a}" for a in story.get("acceptance", [])]
    return adf(*[p for p in paras if p])


def export_csv(data, out):
    """CSV for Jira's built-in importer (Settings -> System -> External system import -> CSV)."""
    rows = []
    for i, epic in enumerate(data["epics"], 1):
        epic_id = f"E{i}"
        rows.append({"Issue Id": epic_id, "Issue Type": "Epic", "Summary": epic["summary"], "Description": epic["description"],
                     "Parent": "", "Story Points": "", "Sprint": "", "Labels": "epic"})
        for j, s in enumerate(epic["stories"], 1):
            rows.append({
                "Issue Id": f"{epic_id}-S{j}",
                "Issue Type": "Story",
                "Summary": s["summary"],
                "Description": "Acceptance criteria:\n" + "\n".join(f"- {a}" for a in s.get("acceptance", [])),
                "Parent": epic_id,
                "Story Points": s["points"],
                "Sprint": data["sprints"][s["sprint"] - 1]["name"],
                "Labels": " ".join(s.get("labels", [])),
            })
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out}")


def story_points_field(jira):
    for f in jira.fields():
        if f.get("name", "").lower() in ("story point estimate", "story points"):
            return f["id"]
    return None


def existing_summaries(jira, project):
    found, start = {}, None
    res = jira.search(f"project = {project} ORDER BY created ASC", "summary,issuetype", 100)
    for issue in res.get("issues", []):
        found[issue["fields"]["summary"].strip().lower()] = issue["key"]
    return found


def create(jira, data, project, with_sprints):
    me = jira.myself()
    print(f"Authenticated as {me.get('displayName')} ({me.get('emailAddress', '')})")
    proj = jira.project(project)
    print(f"Project: {proj['name']} [{proj['key']}] style={proj.get('style', '?')}")
    types = jira.issue_types(project)
    story_type = "story" if "story" in types else "task"
    if "epic" not in types:
        sys.exit("This project has no Epic issue type - create a Scrum (software) project.")
    sp_field = story_points_field(jira)
    print(f"Story points field: {sp_field or 'not found (points will be put in the description)'}")
    have = existing_summaries(jira, project)

    created = {"epics": [], "stories": []}
    by_sprint = {}
    for epic in data["epics"]:
        key = have.get(epic["summary"].lower())
        if not key:
            key = jira.create_issue({"project": {"key": project}, "issuetype": {"id": types["epic"]["id"]},
                                     "summary": epic["summary"], "description": adf(epic["description"])})["key"]
            print(f"  + Epic  {key}  {epic['summary']}")
        else:
            print(f"  = Epic  {key}  (exists)")
        created["epics"].append({"key": key, "summary": epic["summary"]})

        for s in epic["stories"]:
            skey = have.get(s["summary"].lower())
            if not skey:
                fields = {"project": {"key": project}, "issuetype": {"id": types[story_type]["id"]}, "summary": s["summary"],
                          "description": describe(s, data["team"]), "labels": s.get("labels", []), "parent": {"key": key}}
                if sp_field:
                    fields[sp_field] = s["points"]
                try:
                    skey = jira.create_issue(fields)["key"]
                except JiraError as e:
                    if sp_field and sp_field in str(e):  # points field not on the create screen
                        fields.pop(sp_field)
                        skey = jira.create_issue(fields)["key"]
                    else:
                        raise
                print(f"      + {skey}  [{s['points']} pts]  {s['summary']}")
            else:
                print(f"      = {skey}  (exists)")
            created["stories"].append({"key": skey, "epic": key, "points": s["points"], "sprint": s["sprint"], "summary": s["summary"]})
            by_sprint.setdefault(s["sprint"], []).append(skey)

    if with_sprints:
        boards = [b for b in jira.boards(project) if b.get("type") == "scrum"] or jira.boards(project)
        if not boards:
            print("No board found for the project - skipping sprints")
        else:
            board = boards[0]
            existing = {sp["name"]: sp for sp in jira.sprints(board["id"])}
            for i, sp in enumerate(data["sprints"], 1):
                sprint = existing.get(sp["name"]) or jira.create_sprint(board["id"], sp["name"], sp["goal"])
                if by_sprint.get(i):
                    jira.move_to_sprint(sprint["id"], by_sprint[i])
                pts = sum(st["points"] for st in created["stories"] if st["sprint"] == i)
                print(f"  Sprint '{sp['name']}' (board {board['name']}): {len(by_sprint.get(i, []))} stories, {pts} pts")

    out = ROOT / "jira" / "created_issues.json"
    out.write_text(json.dumps(created, indent=2) + "\n")
    print(f"\nDone. Mapping written to {out.relative_to(ROOT)}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--backlog", default=str(ROOT / "jira" / "backlog.json"))
    p.add_argument("--project", default=os.getenv("JIRA_PROJECT_KEY"))
    p.add_argument("--sprints", action="store_true", help="also create the 4 sprints on the Scrum board and assign stories")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--csv", metavar="FILE", help="write a Jira CSV import file instead of calling the API")
    a = p.parse_args()

    data, total = load(a.backlog)
    n_stories = sum(len(e["stories"]) for e in data["epics"])
    print(f"Backlog: {len(data['epics'])} epics, {n_stories} stories, {total} story points, {len(data['sprints'])} sprints")
    for i, sp in enumerate(data["sprints"], 1):
        pts = sum(s["points"] for e in data["epics"] for s in e["stories"] if s["sprint"] == i)
        print(f"  {sp['name']:<48} {pts:>3} pts")

    if a.csv:
        return export_csv(data, a.csv)
    if a.dry_run:
        return None
    if not a.project:
        sys.exit("Set JIRA_PROJECT_KEY or pass --project")
    jira = Jira()
    if not jira.enabled:
        sys.exit("Set JIRA_BASE_URL, JIRA_USER_EMAIL and JIRA_API_TOKEN")
    try:
        create(jira, data, a.project, a.sprints)
    except JiraError as e:
        sys.exit(f"Jira error: {e}")
    return None


if __name__ == "__main__":
    main()
