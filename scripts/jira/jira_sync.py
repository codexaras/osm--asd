#!/usr/bin/env python3
"""
GitHub Actions -> Jira bridge used by .github/workflows/jira.yml

  jira_sync.py commits  ...   comment each referenced issue with the commit link
  jira_sync.py pr       ...   PR opened -> In Review / In Progress, PR merged -> Done
  jira_sync.py ci       ...   comment CI result; create a Bug when CI fails on main

Issue keys are detected anywhere in branch names, commit messages and PR titles,
e.g.  feature/ORMS-12-room-booking   or   "ORMS-12 add overlap check".
Never fails the workflow because of Jira (prints a notice instead).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from jira_client import Jira, JiraError, adf, find_keys  # noqa: E402


def notice(msg):
    print(f"::notice title=Jira::{msg}")


def warn(msg):
    print(f"::warning title=Jira::{msg}")


def safe(fn, *args):
    try:
        return fn(*args)
    except JiraError as e:
        warn(str(e))
        return None


def cmd_commits(jira, a):
    commits = json.loads(os.getenv("COMMITS_JSON") or "[]")
    branch_keys = find_keys(a.branch)
    total = 0
    for c in commits:
        keys = find_keys(c.get("message", "")) or branch_keys
        for key in keys:
            body = adf(
                [("🔗 Commit ", None), (c["id"][:7], c.get("url")), (f" pushed to {a.repo}@{a.branch} by {c.get('author', {}).get('name', '?')}", None)],
                c.get("message", "").splitlines()[0][:250],
            )
            if safe(jira.comment, key, body) is not None:
                total += 1
                print(f"commented on {key} for {c['id'][:7]}")
    notice(f"{total} Jira comment(s) added for {len(commits)} commit(s)")


def cmd_pr(jira, a):
    keys = find_keys(a.title, a.branch)
    if not keys:
        notice("No Jira key in PR title or branch - nothing to sync (use e.g. 'ORMS-12 short description')")
        return
    merged = a.merged == "true"
    for key in keys:
        if a.action == "closed" and merged:
            moved = safe(jira.transition_to, key, "Done", "Closed", "Resolved")
            safe(jira.comment, key, adf([("✅ Merged ", None), (f"PR #{a.number}", a.url), (f" into {a.base}", None)]))
        elif a.action == "closed":
            moved = None
            safe(jira.comment, key, adf([("PR ", None), (f"#{a.number}", a.url), (" was closed without merging", None)]))
        else:
            moved = safe(jira.transition_to, key, "In Review", "Code Review", "In Progress")
            safe(jira.comment, key, adf([("👀 Pull request opened: ", None), (f"#{a.number} {a.title}", a.url)]))
        print(f"{key}: {'moved to ' + moved if moved else 'no transition'}")


def cmd_ci(jira, a):
    keys = find_keys(a.title, a.branch)
    icon = {"success": "🟢", "failure": "🔴", "cancelled": "⚪"}.get(a.conclusion, "🟡")
    for key in keys:
        safe(jira.comment, key, adf([(f"{icon} CI {a.conclusion} on {a.branch} ({a.sha[:7]}) - ", None), ("view run", a.url)]))
        print(f"commented CI result on {key}")

    project = os.getenv("JIRA_PROJECT_KEY")
    if a.conclusion == "failure" and a.branch == "main":
        if not project:
            warn("CI failed on main but JIRA_PROJECT_KEY variable is not set - skipping bug creation")
            return
        summary = f"CI failure on main: {a.title[:120]}"
        # Avoid duplicates: one open CI bug per commit
        existing = safe(jira.search, f'project = {project} AND summary ~ "\\"{a.sha[:7]}\\"" AND statusCategory != Done', "summary", 5)
        if existing and existing.get("issues"):
            notice(f"Bug already exists: {existing['issues'][0]['key']}")
            return
        types = safe(jira.issue_types, project) or {}
        issue_type = "Bug" if "bug" in types else "Task"
        created = safe(jira.create_issue, {
            "project": {"key": project},
            "issuetype": {"name": issue_type},
            "summary": f"{summary} ({a.sha[:7]})",
            "labels": ["ci-failure", "github-actions"],
            "description": adf(
                "The CI pipeline failed on the main branch. Please investigate before the next release.",
                [("Workflow run: ", None), (a.url, a.url)],
                f"Commit: {a.sha}",
            ),
        })
        if created:
            notice(f"Created Jira {issue_type} {created['key']} for the failed build")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("commits")
    c.add_argument("--repo", default="")
    c.add_argument("--branch", default="")
    c.add_argument("--server", default="https://github.com")
    r = sub.add_parser("pr")
    for f in ("action", "merged", "base", "title", "branch", "url", "number"):
        r.add_argument(f"--{f}", default="")
    ci = sub.add_parser("ci")
    for f in ("conclusion", "branch", "title", "sha", "url"):
        ci.add_argument(f"--{f}", default="")
    a = p.parse_args()

    jira = Jira()
    if not jira.enabled:
        notice("JIRA_BASE_URL / JIRA_USER_EMAIL / JIRA_API_TOKEN secrets not set - skipping Jira sync")
        return 0
    {"commits": cmd_commits, "pr": cmd_pr, "ci": cmd_ci}[a.cmd](jira, a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
