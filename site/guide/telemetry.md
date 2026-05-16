# Telemetry

Weaviate Studio collects anonymous usage telemetry to help improve the extension. This page explains what's collected, how it works, and how to opt out.

## Privacy First

We **never** collect:

- Prompts, queries, or data
- Credentials or API keys
- Collection names or schemas
- Personally identifiable information

## What We Collect

| Event Category    | Examples                                                           |
| ----------------- | ------------------------------------------------------------------ |
| **Lifecycle**     | Extension activation, deactivation                                 |
| **Feature Usage** | Panel opens (Query Editor, Data Explorer, Generative Search, etc.) |
| **Operations**    | Query completions, backup operations, connection events            |
| **Errors**        | Unhandled error categories (not full error messages)               |

All collected events are documented in [`telemetry.json`](https://github.com/muleyprasad/weaviate-studio/blob/main/telemetry.json).

## How It Works

- Uses **Azure Application Insights** for telemetry storage
- Event queue with **batching and automatic retries**
- **IP address scrubbing** and PII sanitization
- Connection string injected at **build time** via CI/CD secrets
- **Gracefully disabled** for local development (no connection string → no telemetry)

## Opting Out

Telemetry requires **dual consent** — both must be enabled:

1. **VS Code telemetry** must be enabled (`telemetry.enableTelemetry`)
2. **Weaviate Studio telemetry** must be enabled (`weaviate.telemetry.enabled`)

Disable either setting to opt out completely.

To disable Weaviate Studio telemetry:

1. Open VS Code Settings (`Cmd+,`)
2. Search for "weaviate.telemetry.enabled"
3. Uncheck the setting

## Data Retention

| Setting        | Value                                  |
| -------------- | -------------------------------------- |
| Data Retention | 90 days (Application Insights default) |
| Sampling       | Disabled (100% of events)              |
| PII Scrubbing  | Enabled                                |
| IP Collection  | Disabled (scrubbed)                    |

## Local Testing

To test telemetry locally during development:

```bash
export APPLICATION_INSIGHTS_CONN_STRING="your-connection-string"
npm install && npm run compile && npm run build:webview && npm run build:add-collection
```

## Dashboards

Pre-built Azure dashboards are available for monitoring:

| Dashboard          | Purpose                        |
| ------------------ | ------------------------------ |
| Extension Health   | Monitor stability and adoption |
| Feature Adoption   | Track feature usage            |
| Performance        | SLA monitoring                 |
| Error Analysis     | Debug issues                   |
| Business Metrics   | High-level product health      |
| Version & Platform | Track versions and platforms   |

Deploy dashboards:

```bash
cd scripts/telemetry
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
./deploy.sh
```

See the [full Telemetry Dashboards Guide](https://github.com/muleyprasad/weaviate-studio/blob/main/docs/TELEMETRY_DASHBOARDS.md) for detailed Kusto queries and setup instructions.
