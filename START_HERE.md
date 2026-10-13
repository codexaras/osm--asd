# START HERE — what's done and what you need to do

| Part | Status |
|---|---|
| App (React + Node + MongoDB) | ✅ built, 24 tests passing |
| Docker + Docker Compose (no Kubernetes) | ✅ `docker-compose.yml` runs 8 containers (+1 demo) |
| Prometheus + Grafana | ✅ auto-provisioned, 2 dashboards / 60 panels, 16 alert & recording rules |
| GitHub Actions | ✅ `ci.yml`, `cd.yml`, `jira.yml` — they start running once the code is on GitHub |
| **Jira** | ✅ **already live**: https://aravpalod2.atlassian.net, project **ResourceHub (ORMS)**, 7 epics, 32 stories, 118 points, Sprints 1-3 closed, Sprint 4 active |

---

## Step 1 — Run it on your laptop (5 min)

1. Install **Docker Desktop** and start it.
2. Unzip `resourcehub.zip`, open PowerShell in the `resourcehub` folder:
   ```powershell
   Copy-Item .env.example .env
   docker compose up -d --build
   docker compose --profile demo up -d
   ```
   The last command starts fake users so the graphs move.
3. Open:
   - App: http://localhost:8080 (`admin@resourcehub.com` / `Admin@123`, `employee@resourcehub.com` / `Employee@123`)
   - Grafana: http://localhost:3000 (`admin` / `admin`). The ResourceHub dashboard opens as the home page.
   - Prometheus: http://localhost:9090/targets and http://localhost:9090/alerts

## Step 2 — Put it on GitHub (10 min, one time)

1. Create an empty repo on github.com, for example `resourcehub`.
2. In the `resourcehub` folder:
   ```powershell
   git remote add origin https://github.com/<you>/resourcehub.git
   git push -u origin main
   ```
   The zip already contains the git history.
3. Open the **Actions** tab. **CI** and **CD** start automatically, and CI takes about 8 minutes.
4. Connect Jira to GitHub Actions:
   1. Create an Atlassian API token at https://id.atlassian.com/manage-profile/security/api-tokens (log in as the **aravpalod2** account).
   2. In the repo go to **Settings → Secrets and variables → Actions → New repository secret**:
      - `JIRA_BASE_URL` = `https://aravpalod2.atlassian.net`
      - `JIRA_USER_EMAIL` = the e-mail of that Atlassian account
      - `JIRA_API_TOKEN` = the token
   3. On the **Variables** tab, add `JIRA_PROJECT_KEY` = `ORMS`.

## Step 3 — Present it

Follow **[docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md)**, a 10-minute script in this order: Jira → GitHub Actions → Docker → App → Prometheus/Grafana.
Likely examiner questions with answers are in **[docs/VIVA_QA.md](docs/VIVA_QA.md)**.

### Live "wow" moment: close a Jira story from GitHub
```powershell
git checkout -b feature/ORMS-39-jira-github-integration
# make any small change, e.g. add your names to the README team table
git commit -am "ORMS-39 demo jira integration"
git push -u origin feature/ORMS-39-jira-github-integration
```
On GitHub, open a PR titled **`ORMS-39 Jira GitHub integration`**. The Jira issue gets a comment, and when you **Merge**, ORMS-39 moves to **Done** on the board by itself.

### Optional tidy-up in Jira
The site also has two template projects, **Bug Tracking System (BTS)** and **(Example) Billing System Dev (SAM1)**. BTS holds an earlier copy of the backlog. To hide them, open each one and choose **••• → Space settings → Move to trash**. Use only **ORMS** in the demo.
