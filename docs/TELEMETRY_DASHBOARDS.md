# Telemetry Dashboards Guide

This guide covers the recommended Azure Application Insights dashboards for monitoring Weaviate Studio extension telemetry.

---

## Overview

| Dashboard                                                                | Purpose                        | Audience    |
| ------------------------------------------------------------------------ | ------------------------------ | ----------- |
| [Extension Health](#1-extension-health-dashboard)                        | Monitor stability and adoption | Engineering |
| [Feature Adoption](#2-feature-adoption-dashboard)                        | Track feature usage            | Product     |
| [Performance](#3-performance-dashboard)                                  | SLA monitoring                 | Engineering |
| [Error Analysis](#4-error-analysis-dashboard)                            | Debug issues                   | Engineering |
| [Business Metrics](#5-business-metrics-dashboard)                        | High-level product health      | Executive   |
| [Version & Platform Analytics](#6-version--platform-analytics-dashboard) | Track versions and platforms   | Engineering |

---

## Quick Deploy

Deploy all dashboards using the script (requires Azure CLI):

```bash
# Set your Azure subscription ID
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

# Deploy all dashboards
cd scripts/telemetry
./deploy.sh
```

The script will prompt you to:

1. **Cleanup first** - Delete all existing workbooks before deploying (prevents duplicates)
2. **Skip cleanup** - Deploy without deleting existing workbooks
3. **Use --cleanup flag** - Run cleanup and deploy non-interactively
4. **Use --skip-cleanup flag** - Skip cleanup non-interactively

---

## 1. Extension Health Dashboard

**Purpose:** Monitor extension stability and user retention.

### Key Metrics

| Metric           | Description                                 | Alert Threshold     |
| ---------------- | ------------------------------------------- | ------------------- |
| DAU              | Daily Active Users                          | < 100 (investigate) |
| Activation Rate  | % of VS Code starts that activate extension | N/A                 |
| Session Duration | Time between activate/deactivate            | < 5 min avg         |
| Error Rate       | Errors / Total events                       | > 5% (critical)     |

### Kusto Queries

```kusto
// Daily Active Users (DAU)
customEvents
| where name == "extension.activated"
| summarize DAU = dcount(tostring(customDimensions.sessionId)) by bin(timestamp, 1d)
| render timechart
```

```kusto
// Session Duration Distribution
customEvents
| where name in ("extension.activated", "extension.deactivated")
| summarize startTime = min(timestamp), endTime = max(timestamp) by tostring(customDimensions.sessionId)
| extend duration = datetime_diff('minute', endTime, startTime)
| summarize avgDuration = avg(duration), p50 = percentile(duration, 50), p95 = percentile(duration, 95) by bin(startTime, 1d)
| render timechart
```

```kusto
// Error Rate Trend
customEvents
| extend isError = name == "extension.unhandledError" or customDimensions.result == "failure"
| summarize errorRate = 100.0 * countif(isError) / count() by bin(timestamp, 1h)
| render timechart
```

```kusto
// Errors by Category (Pie Chart)
customEvents
| where name == "extension.unhandledError"
| summarize count() by tostring(customDimensions.errorCategory)
| render piechart
```

---

## 2. Feature Adoption Dashboard

**Purpose:** Understand which features users love and user journeys.

### Key Metrics

| Metric              | Description                                     |
| ------------------- | ----------------------------------------------- |
| Feature Popularity  | Ranking of `*.opened` events                    |
| User Journey Funnel | Connection → Explorer → Query Editor → RAG      |
| Feature Retention   | % of users returning to a feature within 7 days |

### Kusto Queries

```kusto
// Feature Popularity (Top 10)
customEvents
| where name endswith ".opened"
| summarize Count = count() by Feature = name
| top 10 by Count desc
| render barchart
```

```kusto
// User Journey Funnel
let steps = dynamic([
    "connection.connectCompleted",
    "dataExplorer.opened",
    "queryEditor.opened",
    "queryEditor.queryCompleted",
    "ragChat.opened",
    "ragChat.requestCompleted"
]);
customEvents
| where name in (steps)
| where customDimensions.result == "success" or customDimensions.result == ""
| summarize Users = dcount(tostring(customDimensions.sessionId)) by Step = name
| extend Order = array_index_of(steps, Step)
| order by Order asc
| project Step, Users
| render columnchart
```

```kusto
// Feature Retention (7-day)
let usersWhoOpened = customEvents
    | where name endswith ".opened"
    | summarize firstSeen = min(timestamp) by tostring(customDimensions.sessionId), feature = name;
let usersWhoReturned = customEvents
    | where name endswith ".opened"
    | join kind=inner usersWhoOpened on tostring(customDimensions.sessionId), $left.name == $right.feature
    | where timestamp > firstSeen + 7d
    | summarize returnedUsers = dcount(tostring(customDimensions.sessionId)) by feature;
usersWhoOpened
| summarize totalUsers = dcount(tostring(customDimensions.sessionId)) by feature
| join kind=leftouter usersWhoReturned on feature
| extend retentionRate = round(100.0 * returnedUsers / totalUsers, 2)
| project feature, totalUsers, returnedUsers, retentionRate
| order by retentionRate desc
```

---

## 3. Performance Dashboard

**Purpose:** Track operation speed and reliability SLAs.

### Key Metrics

| Operation         | P50 Target | P95 Target | P99 Target |
| ----------------- | ---------- | ---------- | ---------- |
| Query Execution   | < 2s       | < 10s      | < 30s      |
| RAG Chat Response | < 5s       | < 30s      | < 2min     |
| Connection        | < 1s       | < 3s       | < 5s       |
| Collection Create | < 2s       | < 5s       | < 10s      |

### Kusto Queries

```kusto
// Query Performance Trends (P50, P95, P99)
customEvents
| where name == "queryEditor.queryCompleted"
| where customDimensions.result == "success"
| extend duration = toint(customMeasurements.durationMs)
| summarize P50 = percentile(duration, 50),
            P95 = percentile(duration, 95),
            P99 = percentile(duration, 99),
            Avg = avg(duration),
            Count = count() by bin(timestamp, 1h)
| render timechart
```

```kusto
// RAG Chat Latency Distribution
customEvents
| where name == "ragChat.requestCompleted"
| where customDimensions.result == "success"
| extend duration = toint(customMeasurements.durationMs)
| summarize percentile(duration, 50), percentile(duration, 95), percentile(duration, 99), count() by bin(timestamp, 1d)
| render timechart
```

```kusto
// Connection Success Rate
customEvents
| where name == "connection.connectCompleted"
| summarize Success = countif(customDimensions.result == "success"),
            Failure = countif(customDimensions.result == "failure"),
            Total = count() by bin(timestamp, 1h)
| extend SuccessRate = round(100.0 * Success / Total, 2)
| project timestamp, SuccessRate, Failure
| render timechart
```

```kusto
// Slow Operations (>10s) - Needs Investigation
customEvents
| where toint(customMeasurements.durationMs) > 10000
| extend duration = toint(customMeasurements.durationMs)
| project timestamp, name, duration, result = customDimensions.result
| order by duration desc
| take 100
```

---

## 4. Error Analysis Dashboard

**Purpose:** Proactive issue detection and debugging.

### Key Metrics

| Metric                 | Description                       |
| ---------------------- | --------------------------------- |
| Top Failing Operations | Which events fail most frequently |
| Error Heatmap          | Error category × time of day      |
| Error Trends           | Is error rate increasing?         |
| New Error Types        | Errors never seen before          |

### Kusto Queries

```kusto
// Top Failing Operations
customEvents
| where customDimensions.result == "failure" or name == "extension.unhandledError"
| summarize ErrorCount = count(), AvgDuration = avg(toint(customMeasurements.durationMs)) by Operation = name, ErrorCategory = tostring(customDimensions.errorCategory)
| order by ErrorCount desc
| take 20
| render barchart
```

```kusto
// Error Heatmap (Hour of Day vs Day of Week)
customEvents
| where customDimensions.result == "failure" or name == "extension.unhandledError"
| extend hour = datetime_part("hour", timestamp), day = datetime_part("dayofweek", timestamp)
| summarize Errors = count() by hour, day
| render heatmap
```

```kusto
// New Error Types (Last 24h vs Previous 7d)
let baseline = customEvents
    | where timestamp between (ago(8d) .. ago(1d))
    | where name == "extension.unhandledError"
    | summarize by ErrorCategory = tostring(customDimensions.errorCategory);
customEvents
| where timestamp > ago(1d)
| where name == "extension.unhandledError"
| summarize count() by ErrorCategory = tostring(customDimensions.errorCategory)
| join kind=leftanti baseline on ErrorCategory
| project Alert = "NEW ERROR TYPE", ErrorCategory, count_
```

```kusto
// Connection Failures by Type
customEvents
| where name == "connection.connectCompleted"
| where customDimensions.result == "failure"
| summarize count() by ErrorCategory = tostring(customDimensions.errorCategory), bin(timestamp, 1h)
| render timechart
```

---

## 5. Business Metrics Dashboard

**Purpose:** High-level product health for executives.

### Key Metrics

| Metric             | Description                   | Target   |
| ------------------ | ----------------------------- | -------- |
| MAU                | Monthly Active Users          | +10% MoM |
| User Growth Rate   | Week-over-week growth         | > 0%     |
| Feature Stickiness | Avg features used per session | > 2      |
| NPS Proxy          | % of users using 3+ features  | > 40%    |

### Kusto Queries

```kusto
// Monthly Active Users (MAU)
customEvents
| where name == "extension.activated"
| summarize MAU = dcount(tostring(customDimensions.sessionId)) by Month = startofmonth(timestamp)
| render columnchart
```

```kusto
// Week-over-Week Growth Rate
customEvents
| where name == "extension.activated"
| summarize Users = dcount(tostring(customDimensions.sessionId)) by Week = startofweek(timestamp)
| order by Week asc
| extend PrevWeek = prev(Users), GrowthRate = round(100.0 * (Users - PrevWeek) / PrevWeek, 2)
| project Week, Users, GrowthRate
```

```kusto
// Feature Stickiness (Avg features per session)
customEvents
| where name endswith ".opened"
| summarize FeaturesUsed = dcount(name) by Session = tostring(customDimensions.sessionId), Day = bin(timestamp, 1d)
| summarize AvgFeatures = avg(FeaturesUsed), P50 = percentile(FeaturesUsed, 50), P90 = percentile(FeaturesUsed, 90) by Day
| render timechart
```

```kusto
// Power Users (3+ features per session)
customEvents
| where name endswith ".opened"
| summarize Features = dcount(name) by Session = tostring(customDimensions.sessionId), Day = bin(timestamp, 1d)
| extend IsPowerUser = Features >= 3
| summarize PowerUserPct = 100.0 * countif(IsPowerUser) / count() by Day
| render timechart
```

---

## Setting Up in Azure Application Insights

### Step 1: Create a Workbook

1. Go to [Azure Portal](https://portal.azure.com) → Application Insights
2. Select your Weaviate Studio resource
3. Click **Workbooks** in the left sidebar
4. Click **+ New**
5. Give it a name: "Extension Health"

### Step 2: Add a Query

1. Click **+ Add** → **Add query**
2. Paste one of the Kusto queries above
3. Select visualization: **Time chart** / **Bar chart** / **Pie chart**
4. Click **Done Editing**

### Step 3: Pin to Dashboard

1. Click the **...** menu on the query
2. Select **Pin to dashboard**
3. Choose or create an Azure Dashboard
4. Repeat for all queries

---

## Recommended Alerts

Configure these alerts in Azure Monitor (Alerts → New alert rule):

| Alert Name          | Condition                                   | Severity | Action            |
| ------------------- | ------------------------------------------- | -------- | ----------------- |
| Error Spike         | Error rate > 5% for 10 min                  | Critical | Email + PagerDuty |
| Connection Failures | `connection.connectCompleted` failure > 20% | Warning  | Email             |
| Query Slowdown      | P95 query duration > 30s                    | Warning  | Slack             |
| DAU Drop            | DAU drops > 30% day-over-day                | Info     | Email             |
| New Error Type      | New error category appears                  | Warning  | Slack             |

### Alert Query Examples

```kusto
// Error Rate > 5%
customEvents
| extend isError = name == "extension.unhandledError" or customDimensions.result == "failure"
| summarize ErrorRate = 100.0 * countif(isError) / count() by bin(timestamp, 5m)
| where ErrorRate > 5

// Connection Failure Rate > 20%
customEvents
| where name == "connection.connectCompleted"
| summarize FailureRate = 100.0 * countif(customDimensions.result == "failure") / count() by bin(timestamp, 5m)
| where FailureRate > 20
```

---

## Data Retention & Privacy

| Setting        | Value                                  |
| -------------- | -------------------------------------- |
| Data Retention | 90 days (Application Insights default) |
| Sampling       | Disabled (100% of events)              |
| PII Scrubbing  | Enabled (see `TelemetrySanitizer.ts`)  |
| IP Collection  | Disabled (scrubbed)                    |

---

## Troubleshooting

### No Data Appearing

1. Verify `APPLICATION_INSIGHTS_CONN_STRING` is set in CI/CD
2. Check VS Code telemetry is enabled (`telemetry.enableTelemetry`)
3. Check extension setting `weaviate.telemetry.enabled` is true
4. Wait 2-5 minutes for ingestion delay

### Missing Events

```kusto
// Check if events are being received at all
customEvents
| summarize count() by name
| order by count_ desc
```

### Debug Local Telemetry

Set environment variable before running extension:

```bash
export WEAVIATE_TELEMETRY_DEBUG=true
```

Then check Output panel → "Weaviate Studio" channel for telemetry debug logs.

---

## Exporting Data

### To Power BI

1. Workbook → **Export** → **Export to Excel**
2. Or use Application Insights [Query API](https://dev.applicationinsights.io/documentation/Using-the-API)

### To CSV

```bash
curl "https://api.applicationinsights.io/v1/apps/$APP_ID/query" \
  -H "X-API-Key: $API_KEY" \
  --data-urlencode "query=customEvents | where name == 'extension.activated' | take 1000"
```

---

## Next Steps

- [x] Create all dashboards (automated via `scripts/telemetry/deploy.sh`)
- [ ] Set up error rate alert
- [ ] Share dashboard with team
- [ ] Schedule weekly review of Feature Adoption dashboard
- [ ] Build Power BI dashboard for executive reporting

---

_Last updated: 2026-03-21_
_For questions, ping @muleyprasad_
