"""
Minimal Jira Cloud REST client (Python standard library only - no pip install needed).

Auth: Atlassian account e-mail + API token (Basic auth), read from env vars:
    JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN
"""
import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

KEY_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,9}-\d+)\b")


def find_keys(*texts):
    """Return unique Jira issue keys (e.g. ORMS-12) found in the given strings, in order.
    If JIRA_PROJECT_KEY is set, only keys of that project are returned (so "UTF-8" is ignored)."""
    project = os.getenv("JIRA_PROJECT_KEY", "").strip().upper()
    seen = []
    for t in texts:
        for k in KEY_RE.findall(t or ""):
            if project and not k.startswith(f"{project}-"):
                continue
            if k not in seen:
                seen.append(k)
    return seen


def adf(*paragraphs):
    """Build an Atlassian Document Format body. Each paragraph is str or list of (text, href) tuples."""
    content = []
    for p in paragraphs:
        if isinstance(p, str):
            p = [(p, None)]
        nodes = []
        for text, href in p:
            node = {"type": "text", "text": text}
            if href:
                node["marks"] = [{"type": "link", "attrs": {"href": href}}]
            nodes.append(node)
        content.append({"type": "paragraph", "content": nodes})
    return {"type": "doc", "version": 1, "content": content}


class JiraError(Exception):
    pass


class Jira:
    def __init__(self, base_url=None, email=None, token=None):
        self.base = (base_url or os.getenv("JIRA_BASE_URL", "")).rstrip("/")
        email = email or os.getenv("JIRA_USER_EMAIL", "")
        token = token or os.getenv("JIRA_API_TOKEN", "")
        self.enabled = bool(self.base and email and token)
        self._auth = base64.b64encode(f"{email}:{token}".encode()).decode() if self.enabled else ""

    def request(self, method, path, body=None):
        if not self.enabled:
            raise JiraError("Jira credentials not configured")
        req = urllib.request.Request(
            f"{self.base}{path}",
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={
                "Authorization": f"Basic {self._auth}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            raise JiraError(f"{method} {path} -> HTTP {e.code}: {detail}") from None

    # ---- issues -----------------------------------------------------------
    def myself(self):
        return self.request("GET", "/rest/api/3/myself")

    def project(self, key):
        return self.request("GET", f"/rest/api/3/project/{key}")

    def issue(self, key, fields="summary,status"):
        return self.request("GET", f"/rest/api/3/issue/{key}?fields={fields}")

    def comment(self, key, body_adf):
        return self.request("POST", f"/rest/api/3/issue/{key}/comment", {"body": body_adf})

    def create_issue(self, fields):
        return self.request("POST", "/rest/api/3/issue", {"fields": fields})

    def search(self, jql, fields="summary,status", max_results=100):
        q = urllib.parse.urlencode({"jql": jql, "fields": fields, "maxResults": max_results})
        return self.request("GET", f"/rest/api/3/search/jql?{q}")

    def transitions(self, key):
        return self.request("GET", f"/rest/api/3/issue/{key}/transitions").get("transitions", [])

    def transition_to(self, key, *names):
        """Move an issue to the first transition/status whose name matches any of `names` (case-insensitive)."""
        wanted = [n.lower() for n in names]
        options = self.transitions(key)
        for name in wanted:
            for t in options:
                if t["name"].lower() == name or t.get("to", {}).get("name", "").lower() == name:
                    self.request("POST", f"/rest/api/3/issue/{key}/transitions", {"transition": {"id": t["id"]}})
                    return t.get("to", {}).get("name", t["name"])
        return None

    def issue_types(self, project_key):
        data = self.request("GET", f"/rest/api/3/issue/createmeta/{project_key}/issuetypes")
        return {t["name"].lower(): t for t in data.get("issueTypes", data.get("values", []))}

    def fields(self):
        return self.request("GET", "/rest/api/3/field")

    # ---- agile (boards & sprints) -----------------------------------------
    def boards(self, project_key):
        return self.request("GET", f"/rest/agile/1.0/board?projectKeyOrId={project_key}").get("values", [])

    def sprints(self, board_id):
        return self.request("GET", f"/rest/agile/1.0/board/{board_id}/sprint?state=future,active,closed").get("values", [])

    def create_sprint(self, board_id, name, goal=""):
        return self.request("POST", "/rest/agile/1.0/sprint", {"name": name, "originBoardId": board_id, "goal": goal})

    def move_to_sprint(self, sprint_id, keys):
        for i in range(0, len(keys), 50):
            self.request("POST", f"/rest/agile/1.0/sprint/{sprint_id}/issue", {"issues": keys[i:i + 50]})

