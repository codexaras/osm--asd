# Jira — planning and GitHub integration

There are four parts to the Jira setup. Do them in order.

## 1. Create the Jira project

1. Go to https://www.atlassian.com/software/jira/free and sign up (free for up to 10 users).
2. **Create project → Software development → Scrum**. Choose *Team-managed* or *Company-managed* (either works).
3. Name it `ResourceHub` with the key **`ORMS`**. Any key works, but use the same one everywhere below.
4. Add your teammates under **Project settings → Access**.

## 2. Load the backlog (7 epics · 32 stories · 118 points · 4 sprints)

Choose one of the three options.

**Option A — script (recommended):**
```bash
# API token: https://id.atlassian.com/manage-profile/security/api-tokens
export JIRA_BASE_URL=https://<your-site>.atlassian.net
export JIRA_USER_EMAIL=<your atlassian e-mail>
export JIRA_API_TOKEN=<token>
export JIRA_PROJECT_KEY=ORMS
python3 scripts/jira/create_backlog.py --dry-run      # preview
python3 scripts/jira/create_backlog.py --sprints      # create epics, stories, story points, sprints
```
On Windows PowerShell, set the variables with `$env:JIRA_BASE_URL="https://..."` and so on.
The script uses only the Python standard library and is safe to re-run, because it skips issues that already exist.

**Option B — CSV import:** in Jira go to *Settings → System → External system import → CSV*, upload `jira/backlog.csv`, and map *Issue Id*, *Parent*, *Story Points* and *Sprint*.

**Option C — Claude with the Atlassian MCP connector:** with the connector enabled in the chat, ask Claude to create the backlog from `jira/backlog.json`.

Then run the sprints on the board: start **Sprint 1**, move cards To Do → In Progress → Done, complete the sprint, and repeat. Show the **burndown chart** and **velocity report** in the viva.

## 3. Connect GitHub Actions to Jira (`.github/workflows/jira.yml`)

In the GitHub repo, go to **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|---|---|---|
| Secret | `JIRA_BASE_URL` | `https://<your-site>.atlassian.net` |
| Secret | `JIRA_USER_EMAIL` | your Atlassian e-mail |
| Secret | `JIRA_API_TOKEN` | the API token |
| Variable | `JIRA_PROJECT_KEY` | `ORMS` |

What the workflow does:

| GitHub event | Jira effect |
|---|---|
| Push with `ORMS-12` in the commit message or branch name | Comment on ORMS-12 with the commit link and message |
| PR opened with the key in the title or branch | Transition to **In Review** (or *In Progress* if that column doesn't exist), plus a comment with the PR link |
| PR merged | Transition to **Done**, plus a comment |
| CI finished | Comment 🟢/🔴 with a link to the run |
| CI **failed on `main`** | Auto-create a **Bug** labelled `ci-failure` (one per commit) |

If the secrets are missing, the workflow logs a notice and stays green.

**Naming conventions**
```
branch:  feature/ORMS-15-booking-overlap      bugfix/ORMS-31-fix-return-date
commit:  ORMS-15 reject overlapping bookings with 409
PR:      ORMS-15 Booking overlap detection
```

## 4. (Optional) GitHub for Jira app — development panel

Install **GitHub for Jira** from the Atlassian Marketplace (Apps → Explore more apps) and connect your GitHub organisation or account. Branches, commits, PRs, builds and deployments then also appear in the **Development** panel of each issue. Our workflow and the app complement each other: the app shows the links, and our workflow moves the cards and raises bugs.

### Smart commits (works with the app)
`ORMS-15 #comment fixed edge case #time 1h #done` adds a comment, logs time and transitions the issue, straight from the commit message.
