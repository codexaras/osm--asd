#!/usr/bin/env python3
"""
Dashboards-as-code: generates the Grafana dashboard JSON files that are
auto-provisioned by docker compose.

    python3 scripts/grafana/build_dashboards.py

Output -> monitoring/grafana/dashboards/*.json
Edit panels here (not in the JSON) so the dashboards stay reviewable in Git.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "monitoring" / "grafana" / "dashboards"
DS = {"type": "prometheus", "uid": "prometheus"}
APP = 'job="resourcehub-api"'


class Layout:
    """Tiny helper that places panels left-to-right on Grafana's 24-column grid."""

    def __init__(self):
        self.x = 0
        self.y = 0
        self.row_h = 0
        self.panels = []
        self.next_id = 1

    def _place(self, w, h):
        if self.x + w > 24:
            self.x = 0
            self.y += self.row_h
            self.row_h = 0
        pos = {"x": self.x, "y": self.y, "w": w, "h": h}
        self.x += w
        self.row_h = max(self.row_h, h)
        return pos

    def row(self, title):
        if self.x:
            self.y += self.row_h
        self.x, self.row_h = 0, 0
        self.panels.append({"id": self.next_id, "type": "row", "title": title, "collapsed": False,
                            "gridPos": {"x": 0, "y": self.y, "w": 24, "h": 1}, "panels": []})
        self.next_id += 1
        self.y += 1

    def add(self, panel, w, h):
        panel["id"] = self.next_id
        panel["gridPos"] = self._place(w, h)
        panel.setdefault("datasource", DS)
        self.next_id += 1
        self.panels.append(panel)


def targets(*exprs):
    out = []
    for i, e in enumerate(exprs):
        expr, legend = (e if isinstance(e, tuple) else (e, ""))
        out.append({"refId": chr(65 + i), "datasource": DS, "expr": expr, "legendFormat": legend,
                    "range": True, "instant": False})
    return out


def thresholds(*steps):
    s = [{"color": steps[0], "value": None}]
    # thresholds("green", 0.6, "orange", 0.85, "red") -> green until 0.6, orange until 0.85, then red
    for value, color in zip(steps[1::2], steps[2::2]):
        s.append({"color": color, "value": value})
    return {"mode": "absolute", "steps": s}


def stat(title, expr, unit="short", th=None, desc="", color_mode="background", mappings=None, decimals=None, text_mode="value"):
    p = {
        "type": "stat", "title": title, "description": desc, "targets": targets(expr),
        "fieldConfig": {"defaults": {"unit": unit, "thresholds": th or thresholds("blue"),
                                     "mappings": mappings or [], "color": {"mode": "thresholds"}}, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "colorMode": color_mode, "graphMode": "area", "justifyMode": "center",
                    "textMode": text_mode, "orientation": "auto", "showPercentChange": False, "wideLayout": True},
    }
    if decimals is not None:
        p["fieldConfig"]["defaults"]["decimals"] = decimals
    return p


def ts(title, *exprs, unit="short", desc="", stack=False, fill=10, draw="line", legend_calcs=None, min0=True):
    custom = {"drawStyle": draw, "lineWidth": 2, "fillOpacity": fill, "gradientMode": "opacity",
              "showPoints": "never", "spanNulls": True, "lineInterpolation": "smooth",
              "stacking": {"mode": "normal" if stack else "none", "group": "A"}}
    if draw == "bars":
        custom.update({"fillOpacity": 80, "lineWidth": 1, "gradientMode": "none"})
    d = {"unit": unit, "custom": custom, "color": {"mode": "palette-classic"}}
    if min0:
        d["min"] = 0
    return {
        "type": "timeseries", "title": title, "description": desc, "targets": targets(*exprs),
        "fieldConfig": {"defaults": d, "overrides": []},
        "options": {"legend": {"displayMode": "table" if legend_calcs else "list", "placement": "bottom",
                               "calcs": legend_calcs or [], "showLegend": True},
                    "tooltip": {"mode": "multi", "sort": "desc"}},
    }


def gauge(title, expr, unit="percentunit", th=None, desc="", mx=1):
    return {
        "type": "gauge", "title": title, "description": desc, "targets": targets(expr),
        "fieldConfig": {"defaults": {"unit": unit, "min": 0, "max": mx,
                                     "thresholds": th or thresholds("green", 0.6, "orange", 0.85, "red"),
                                     "color": {"mode": "thresholds"}}, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "showThresholdLabels": False, "showThresholdMarkers": True},
    }


def pie(title, expr, legend, desc="", colors=None):
    overrides = [
        {"matcher": {"id": "byName", "options": name},
         "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": c}}]}
        for name, c in (colors or {}).items()
    ]
    t = targets((expr, legend))
    t[0].update({"instant": True, "range": False})
    return {
        "type": "piechart", "title": title, "description": desc, "targets": t,
        "fieldConfig": {"defaults": {"unit": "short", "color": {"mode": "palette-classic"}}, "overrides": overrides},
        "options": {"pieType": "donut", "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "legend": {"displayMode": "table", "placement": "right", "values": ["value", "percent"], "showLegend": True},
                    "tooltip": {"mode": "single"}, "displayLabels": []},
    }


def bargauge(title, expr, legend, unit="short", desc="", th=None):
    t = targets((expr, legend))
    t[0].update({"instant": True, "range": False})
    return {
        "type": "bargauge", "title": title, "description": desc, "targets": t,
        "fieldConfig": {"defaults": {"unit": unit, "min": 0, "thresholds": th or thresholds("blue"),
                                     "color": {"mode": "thresholds"}}, "overrides": []},
        "options": {"orientation": "horizontal", "displayMode": "gradient", "showUnfilled": True,
                    "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "valueMode": "color", "namePlacement": "auto", "sizing": "auto"},
    }


def table(title, expr, desc=""):
    t = targets(expr)
    t[0].update({"instant": True, "range": False, "format": "table"})
    return {
        "type": "table", "title": title, "description": desc, "targets": t,
        "fieldConfig": {"defaults": {"custom": {"align": "auto", "cellOptions": {"type": "color-background"}},
                                     "mappings": [{"type": "value", "options": {
                                         "0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}],
                                     "thresholds": thresholds("red", 1, "green")}, "overrides": []},
        "transformations": [{"id": "organize", "options": {
            "excludeByName": {"Time": True, "__name__": True, "environment": True, "project": True},
            "renameByName": {"Value": "State", "job": "Job", "instance": "Instance"}}}],
        "options": {"showHeader": True, "cellHeight": "sm"},
    }


def dashboard(uid, title, desc, layout, tags, refresh="10s", time_from="now-30m"):
    return {
        "uid": uid, "title": title, "description": desc, "tags": tags,
        "timezone": "browser", "editable": True, "graphTooltip": 1, "refresh": refresh,
        "schemaVersion": 39, "version": 1, "fiscalYearStartMonth": 0, "liveNow": False,
        "time": {"from": time_from, "to": "now"},
        "timepicker": {"refresh_intervals": ["5s", "10s", "30s", "1m", "5m"]},
        "templating": {"list": []},
        "annotations": {"list": [{"builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                                  "enable": True, "hide": True, "iconColor": "rgba(0, 211, 255, 1)",
                                  "name": "Annotations & Alerts", "type": "dashboard"}]},
        "links": [
            {"title": "Application overview", "type": "link", "url": "/d/resourcehub-overview", "icon": "dashboard"},
            {"title": "Infrastructure", "type": "link", "url": "/d/resourcehub-infra", "icon": "dashboard"},
            {"title": "Prometheus alerts", "type": "link", "url": "http://localhost:9090/alerts", "targetBlank": True, "icon": "bolt"},
        ],
        "panels": layout.panels,
    }


UPDOWN = [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red", "index": 0},
                                         "1": {"text": "UP", "color": "green", "index": 1}}}]


# =============================================================================
# 1) Application overview
# =============================================================================
def overview():
    L = Layout()
    L.row("Service health")
    L.add(stat("API status", f"up{{{APP}}}", th=thresholds("red", 1, "green"), mappings=UPDOWN,
               desc="Is Prometheus able to scrape the backend?"), 3, 4)
    L.add(stat("MongoDB", "rh_db_up", th=thresholds("red", 1, "green"), mappings=UPDOWN,
               desc="API's live connection to MongoDB (rh_db_up)"), 3, 4)
    L.add(stat("Uptime", "time() - rh_process_start_time_seconds", unit="s", color_mode="none", decimals=0), 3, 4)
    L.add(stat("Requests / sec", "sum(rate(rh_http_requests_total[1m]))", unit="reqps", decimals=2,
               th=thresholds("blue")), 3, 4)
    L.add(stat("5xx error rate", '(sum(rate(rh_http_requests_total{status_code=~"5.."}[5m])) or vector(0)) / clamp_min(sum(rate(rh_http_requests_total[5m])), 0.0001)',
               unit="percentunit", decimals=2, th=thresholds("green", 0.01, "orange", 0.05, "red")), 3, 4)
    L.add(stat("p95 latency", "histogram_quantile(0.95, sum by (le) (rate(rh_http_request_duration_seconds_bucket[5m])))",
               unit="s", decimals=3, th=thresholds("green", 0.25, "orange", 0.5, "red")), 3, 4)
    L.add(stat("In-flight requests", "sum(rh_http_requests_in_flight)", color_mode="none"), 3, 4)
    L.add(stat("Total requests served", "sum(rh_http_requests_total)", color_mode="none", decimals=0), 3, 4)

    L.row("Traffic, latency & errors (golden signals)")
    L.add(ts("Request rate by route", ('sum by (route) (rate(rh_http_requests_total{route!="unmatched"}[1m]))', "{{route}}"),
             unit="reqps", legend_calcs=["mean", "max"], desc="Requests per second per API route"), 12, 9)
    L.add(ts("Responses by status code", ("sum by (status_code) (rate(rh_http_requests_total[1m]))", "HTTP {{status_code}}"),
             unit="reqps", stack=True, fill=40, desc="2xx success, 4xx client errors (401/403/409), 5xx server errors"), 12, 9)
    L.add(ts("Latency percentiles",
             ("histogram_quantile(0.50, sum by (le) (rate(rh_http_request_duration_seconds_bucket[1m])))", "p50"),
             ("histogram_quantile(0.95, sum by (le) (rate(rh_http_request_duration_seconds_bucket[1m])))", "p95"),
             ("histogram_quantile(0.99, sum by (le) (rate(rh_http_request_duration_seconds_bucket[1m])))", "p99"),
             unit="s", legend_calcs=["mean", "max"]), 12, 9)
    L.add(ts("p95 latency by route",
             ('histogram_quantile(0.95, sum by (le, route) (rate(rh_http_request_duration_seconds_bucket{route!="unmatched"}[5m])))', "{{route}}"),
             unit="s", legend_calcs=["mean", "max"]), 12, 9)
    L.add(ts("Client & server errors by route",
             ('sum by (route, status_code) (rate(rh_http_requests_total{status_code=~"[45]..", route!="unmatched"}[1m]))', "{{status_code}} {{route}}"),
             unit="reqps", draw="bars", desc="401 = not logged in, 403 = RBAC denied, 409 = booking/allocation conflict"), 24, 8)

    L.row("Business KPIs (live from MongoDB)")
    L.add(stat("Total resources", "sum(rh_resources)", color_mode="none"), 4, 4)
    L.add(stat("Available", 'sum(rh_resources{status="AVAILABLE"}) or vector(0)', th=thresholds("green")), 4, 4)
    L.add(stat("Allocated", 'sum(rh_resources{status="ALLOCATED"}) or vector(0)', th=thresholds("blue")), 4, 4)
    L.add(stat("Under maintenance", 'sum(rh_resources{status="UNDER_MAINTENANCE"}) or vector(0)', th=thresholds("green", 1, "orange", 5, "red")), 4, 4)
    L.add(stat("Pending requests", 'rh_resource_requests{status="PENDING"}', th=thresholds("green", 5, "orange", 10, "red")), 4, 4)
    L.add(stat("Bookings today", "rh_bookings_today", th=thresholds("purple")), 4, 4)

    L.add(gauge("Asset utilisation", "rh_asset_utilization_ratio",
                desc="Allocated / allocatable (non-shared, non-retired) assets"), 6, 8)
    L.add(pie("Resources by status", "sum by (status) (rh_resources)", "{{status}}",
              colors={"AVAILABLE": "green", "ALLOCATED": "blue", "UNDER_MAINTENANCE": "orange", "RETIRED": "gray"}), 9, 8)
    L.add(bargauge("Resources by category", "sum by (category) (rh_resources)", "{{category}}"), 9, 8)

    L.add(ts("Booking attempts", ('sum by (outcome) (increase(rh_bookings_total[5m]))', "{{outcome}}"),
             draw="bars", desc="Confirmed vs rejected-for-overlap (conflict) vs cancelled, per 5 min"), 8, 8)
    L.add(ts("Logins", ('sum by (result) (increase(rh_logins_total[5m]))', "{{result}}"), draw="bars",
             desc="Successful vs failed logins per 5 min (watch for brute force)"), 8, 8)
    L.add(ts("Request workflow events", ('sum by (action) (increase(rh_resource_requests_total[5m]))', "{{action}}"),
             draw="bars", desc="Requests created / approved / rejected / cancelled per 5 min"), 8, 8)

    L.add(ts("Open requests & allocations over time",
             ('rh_resource_requests{status="PENDING"}', "pending requests"),
             ('rh_allocations{status="ACTIVE"}', "active allocations"),
             ('rh_allocations{status="RETURN_REQUESTED"}', "awaiting return"),
             ("rh_bookings_upcoming", "upcoming bookings")), 12, 8)
    L.add(bargauge("Open maintenance tickets by priority",
                   'sum by (priority) (rh_maintenance_tickets{status!="RESOLVED"})', "{{priority}}",
                   th=thresholds("green", 1, "orange", 3, "red")), 12, 8)

    L.row("Node.js runtime")
    L.add(ts("Heap memory", ("rh_nodejs_heap_size_used_bytes", "heap used"), ("rh_nodejs_heap_size_total_bytes", "heap total"),
             ("rh_process_resident_memory_bytes", "RSS"), unit="bytes"), 8, 8)
    L.add(ts("CPU usage", ("rate(rh_process_cpu_seconds_total[1m])", "API process CPU"), unit="percentunit"), 8, 8)
    L.add(ts("Event loop lag", ("rh_nodejs_eventloop_lag_p99_seconds", "p99"), ("rh_nodejs_eventloop_lag_mean_seconds", "mean"), unit="s"), 8, 8)
    L.add(ts("Active handles & requests", ("sum(rh_nodejs_active_handles_total)", "handles"),
             ("sum(rh_nodejs_active_requests_total)", "requests")), 12, 7)
    L.add(ts("Garbage collection time", ("sum by (kind) (rate(rh_nodejs_gc_duration_seconds_sum[1m]))", "{{kind}}"), unit="s"), 12, 7)

    return dashboard("resourcehub-overview", "ResourceHub - Application Overview",
                     "Golden signals, business KPIs and Node.js runtime for the ResourceHub API", L,
                     ["resourcehub", "application", "prometheus"])


# =============================================================================
# 2) Infrastructure & containers
# =============================================================================
def infra():
    L = Layout()
    L.row("Scrape targets")
    L.add(table("Prometheus targets", "up", desc="1 = UP, 0 = DOWN for every scrape job"), 12, 8)
    L.add(stat("Targets up", "sum(up)", th=thresholds("blue"), color_mode="background"), 4, 8)
    L.add(stat("Targets down", "count(up == 0) or vector(0)", th=thresholds("green", 1, "red")), 4, 8)
    L.add(stat("Firing alerts", 'count(ALERTS{alertstate="firing"}) or vector(0)', th=thresholds("green", 1, "orange", 3, "red")), 4, 8)

    L.row("Host (node-exporter)")
    L.add(gauge("CPU busy", '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m]))'), 6, 7)
    L.add(gauge("Memory used", "1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes"), 6, 7)
    L.add(gauge("Root disk used", '1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}'), 6, 7)
    L.add(stat("CPU cores", 'count(count by (cpu) (node_cpu_seconds_total{mode="idle"}))', color_mode="none"), 3, 7)
    L.add(stat("Total RAM", "node_memory_MemTotal_bytes", unit="bytes", color_mode="none"), 3, 7)
    L.add(ts("CPU by mode", ('sum by (mode) (rate(node_cpu_seconds_total{mode!="idle"}[1m]))', "{{mode}}"),
             unit="short", stack=True, fill=40), 8, 8)
    L.add(ts("Load average", ("node_load1", "1m"), ("node_load5", "5m"), ("node_load15", "15m")), 8, 8)
    L.add(ts("Network traffic", ('sum(rate(node_network_receive_bytes_total{device!="lo"}[1m]))', "rx"),
             ('sum(rate(node_network_transmit_bytes_total{device!="lo"}[1m]))', "tx"), unit="Bps"), 8, 8)

    L.row("Containers (cAdvisor)")
    c = 'container_label_com_docker_compose_service!=""'
    L.add(ts("Container CPU", (f"sum by (container_label_com_docker_compose_service) (rate(container_cpu_usage_seconds_total{{{c}}}[1m]))",
                               "{{container_label_com_docker_compose_service}}"), unit="percentunit", legend_calcs=["mean", "max"]), 12, 9)
    L.add(ts("Container memory", (f"sum by (container_label_com_docker_compose_service) (container_memory_working_set_bytes{{{c}}})",
                                  "{{container_label_com_docker_compose_service}}"), unit="bytes", legend_calcs=["lastNotNull", "max"]), 12, 9)
    L.add(ts("Container network in", (f"sum by (container_label_com_docker_compose_service) (rate(container_network_receive_bytes_total{{{c}}}[1m]))",
                                      "{{container_label_com_docker_compose_service}}"), unit="Bps"), 12, 8)
    L.add(bargauge("Running containers by service", f"count by (container_label_com_docker_compose_service) (container_last_seen{{{c}}})",
                   "{{container_label_com_docker_compose_service}}"), 12, 8)

    L.row("MongoDB (mongodb-exporter)")
    L.add(stat("MongoDB exporter", 'up{job="mongodb"}', th=thresholds("red", 1, "green"), mappings=UPDOWN), 4, 7)
    L.add(stat("Current connections", 'mongodb_ss_connections{conn_type="current"}', color_mode="none"), 4, 7)
    L.add(ts("Operations / sec", ('sum by (legacy_op_type) (rate(mongodb_ss_opcounters[1m]))', "{{legacy_op_type}}"), unit="ops"), 8, 7)
    L.add(ts("MongoDB resident memory", ('mongodb_ss_mem_resident * 1024 * 1024', "resident"), unit="bytes"), 8, 7)

    return dashboard("resourcehub-infra", "ResourceHub - Infrastructure & Containers",
                     "Host, container and database health for the Docker Compose deployment", L,
                     ["resourcehub", "infrastructure", "docker"], refresh="30s", time_from="now-1h")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, d in (("resourcehub-overview.json", overview()), ("resourcehub-infra.json", infra())):
        (OUT / name).write_text(json.dumps(d, indent=2) + "\n")
        print(f"wrote {OUT / name}  ({len(d['panels'])} panels)")
