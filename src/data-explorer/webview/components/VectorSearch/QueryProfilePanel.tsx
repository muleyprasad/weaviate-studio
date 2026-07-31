/**
 * QueryProfilePanel - Visualizes query profiling data from Weaviate
 * Shows per-shard timing breakdowns for vector, keyword, and object searches
 * Requires Weaviate ≥ 1.36.9
 */

import React, { useState, useMemo } from 'react';
import type { QueryProfile, ShardProfile, SearchProfile } from '../../../types';
import './QueryProfilePanel.css';

interface QueryProfilePanelProps {
  profile: QueryProfile;
}

/** Parse a duration string like "48.2ms", "1.2s", "350µs" into milliseconds */
export function parseDuration(value: string): number | null {
  const match = value.match(/^([\d.]+)\s*(ms|s|µs|us|ns)$/);
  if (!match) {
    return null;
  }
  const num = parseFloat(match[1]);
  if (isNaN(num)) {
    return null;
  }
  switch (match[2]) {
    case 's':
      return num * 1000;
    case 'ms':
      return num;
    case 'µs':
    case 'us':
      return num / 1000;
    case 'ns':
      return num / 1_000_000;
    default:
      return null;
  }
}

/** Format milliseconds into a human-readable duration string */
function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(1)}ms`;
  }
  if (ms >= 0.001) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  return `${(ms * 1_000_000).toFixed(0)}ns`;
}

/** Determine bar color based on proportion of total time */
function getBarColorClass(proportion: number): string {
  if (proportion > 0.66) {
    return 'bar-high';
  }
  if (proportion > 0.33) {
    return 'bar-medium';
  }
  return 'bar-low';
}

/** Known timing metric keys that should be rendered as bars */
const TIMING_METRIC_KEYS = [
  'total_took',
  'vector_search_took',
  'objects_took',
  'filters_build_allow_list_took',
  'knn_search_rescore_took',
];

/** Pattern for HNSW layer timing keys */
const KNN_LAYER_PATTERN = /^knn_search_layer_(\d+)_took$/;

/** Pattern for keyword timing keys */
const KWD_PATTERN = /^kwd_/;

interface MetricEntry {
  key: string;
  label: string;
  rawValue: string;
  ms: number | null;
  isTiming: boolean;
  indent: number;
}

/** Build a structured list of metrics from a search profile's details */
function buildMetricEntries(details: Record<string, string>): MetricEntry[] {
  const entries: MetricEntry[] = [];
  const totalMs = parseDuration(details['total_took'] || '') ?? 0;

  // Top-level timing metrics
  for (const key of TIMING_METRIC_KEYS) {
    if (details[key] === undefined) {
      continue;
    }
    const ms = parseDuration(details[key]);
    entries.push({
      key,
      label: formatMetricLabel(key),
      rawValue: details[key],
      ms,
      isTiming: true,
      indent: key === 'total_took' ? 0 : 1,
    });
  }

  // HNSW layer metrics (nested under vector_search_took)
  const layerKeys = Object.keys(details)
    .filter((k) => KNN_LAYER_PATTERN.test(k))
    .sort((a, b) => {
      const layerA = parseInt(a.match(KNN_LAYER_PATTERN)![1], 10);
      const layerB = parseInt(b.match(KNN_LAYER_PATTERN)![1], 10);
      return layerA - layerB;
    });

  for (const key of layerKeys) {
    const ms = parseDuration(details[key]);
    entries.push({
      key,
      label: formatMetricLabel(key),
      rawValue: details[key],
      ms,
      isTiming: true,
      indent: 2,
    });
  }

  // Keyword/BM25 metrics
  const kwdKeys = Object.keys(details)
    .filter((k) => KWD_PATTERN.test(k))
    .sort();

  for (const key of kwdKeys) {
    const ms = parseDuration(details[key]);
    entries.push({
      key,
      label: formatMetricLabel(key),
      rawValue: details[key],
      ms,
      isTiming: ms !== null,
      indent: 1,
    });
  }

  // Non-timing metrics (counts, booleans)
  const nonTimingKeys = Object.keys(details).filter(
    (k) => !TIMING_METRIC_KEYS.includes(k) && !KNN_LAYER_PATTERN.test(k) && !KWD_PATTERN.test(k)
  );

  for (const key of nonTimingKeys) {
    entries.push({
      key,
      label: formatMetricLabel(key),
      rawValue: details[key],
      ms: null,
      isTiming: false,
      indent: 1,
    });
  }

  return entries;
}

/** Convert snake_case metric key to a readable label */
function formatMetricLabel(key: string): string {
  // Special cases
  const specialLabels: Record<string, string> = {
    total_took: 'Total',
    vector_search_took: 'Vector Search',
    objects_took: 'Object Hydration',
    filters_build_allow_list_took: 'Filter Allow List',
    filters_ids_matched: 'Filter IDs Matched',
    knn_search_rescore_took: 'Rescore (decompression)',
    hnsw_flat_search: 'Flat Search (brute-force)',
  };

  if (specialLabels[key]) {
    return specialLabels[key];
  }

  // HNSW layer keys
  const layerMatch = key.match(KNN_LAYER_PATTERN);
  if (layerMatch) {
    return `HNSW Layer ${layerMatch[1]}`;
  }

  // Generic: replace underscores with spaces, title-case
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render a single shard's profile */
function ShardProfileCard({ shard }: { shard: ShardProfile }) {
  const searchTypes = Object.keys(shard.searches);

  return (
    <div className="qp-shard-card">
      <div className="qp-shard-header">
        <span className="qp-shard-name" title={shard.name}>
          <span className="codicon codicon-database" aria-hidden="true"></span>
          {shard.name.length > 16 ? `${shard.name.slice(0, 16)}…` : shard.name}
        </span>
        <span className="qp-shard-node">
          <span className="codicon codicon-server" aria-hidden="true"></span>
          {shard.node}
        </span>
      </div>

      {searchTypes.map((searchType) => (
        <SearchTypeSection
          key={searchType}
          searchType={searchType}
          profile={shard.searches[searchType]}
        />
      ))}
    </div>
  );
}

/** Render a collapsible section for a search type (vector, keyword, object) */
function SearchTypeSection({
  searchType,
  profile,
}: {
  searchType: string;
  profile: SearchProfile;
}) {
  const [expanded, setExpanded] = useState(true);

  const entries = useMemo(() => buildMetricEntries(profile.details), [profile.details]);
  const totalMs = parseDuration(profile.details['total_took'] || '') ?? 0;

  const icon =
    searchType === 'vector'
      ? 'symbol-variable'
      : searchType === 'keyword'
        ? 'symbol-keyword'
        : 'symbol-object';
  const label =
    searchType === 'vector'
      ? 'Vector Search'
      : searchType === 'keyword'
        ? 'Keyword / BM25'
        : searchType.charAt(0).toUpperCase() + searchType.slice(1);

  return (
    <div className="qp-search-section">
      <button
        className="qp-section-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span
          className={`codicon codicon-chevron-${expanded ? 'down' : 'right'}`}
          aria-hidden="true"
        ></span>
        <span className={`codicon codicon-${icon}`} aria-hidden="true"></span>
        <span className="qp-section-label">{label}</span>
        {totalMs > 0 && <span className="qp-section-total">{formatMs(totalMs)}</span>}
      </button>

      {expanded && (
        <div className="qp-section-body">
          {entries.map((entry) => (
            <MetricRow key={entry.key} entry={entry} totalMs={totalMs} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Render a single metric row with optional timing bar */
function MetricRow({ entry, totalMs }: { entry: MetricEntry; totalMs: number }) {
  const indentStyle = { paddingLeft: `${entry.indent * 16 + 8}px` };

  if (!entry.isTiming || entry.ms === null) {
    // Non-timing metric: show as label + value
    const isBoolean = entry.rawValue === 'true' || entry.rawValue === 'false';
    return (
      <div className="qp-metric-row qp-metric-static" style={indentStyle}>
        <span className="qp-metric-label">{entry.label}</span>
        {isBoolean ? (
          <span
            className={`qp-badge ${entry.rawValue === 'true' ? 'qp-badge-warn' : 'qp-badge-ok'}`}
          >
            {entry.rawValue}
          </span>
        ) : (
          <span className="qp-metric-value">{entry.rawValue}</span>
        )}
      </div>
    );
  }

  // Timing metric: show bar
  const proportion = totalMs > 0 ? entry.ms / totalMs : 0;
  const barWidth = Math.max(2, Math.min(100, proportion * 100));
  const colorClass = getBarColorClass(proportion);

  return (
    <div className="qp-metric-row" style={indentStyle}>
      <div className="qp-metric-info">
        <span className="qp-metric-label">{entry.label}</span>
        <span className="qp-metric-value">{entry.rawValue}</span>
      </div>
      <div className="qp-metric-bar-track">
        <div
          className={`qp-metric-bar-fill ${colorClass}`}
          style={{ width: `${barWidth}%` }}
          title={`${(proportion * 100).toFixed(1)}% of total`}
        />
      </div>
      <span className="qp-metric-pct">{(proportion * 100).toFixed(1)}%</span>
    </div>
  );
}

/** Main panel component */
export function QueryProfilePanel({ profile }: QueryProfilePanelProps) {
  const [activeShard, setActiveShard] = useState(0);

  if (!profile.shards || profile.shards.length === 0) {
    return (
      <div className="qp-panel">
        <div className="qp-empty">
          <span className="codicon codicon-info" aria-hidden="true"></span>
          No profiling data returned for this query.
        </div>
      </div>
    );
  }

  const shard = profile.shards[Math.min(activeShard, profile.shards.length - 1)];

  return (
    <div className="qp-panel">
      <div className="qp-panel-header">
        <span className="codicon codicon-pulse" aria-hidden="true"></span>
        <span className="qp-panel-title">Query Profile</span>
        {profile.shards.length > 1 && (
          <div className="qp-shard-tabs">
            {profile.shards.map((s, i) => (
              <button
                key={s.name}
                className={`qp-shard-tab ${i === activeShard ? 'active' : ''}`}
                onClick={() => setActiveShard(i)}
                title={`Shard: ${s.name} | Node: ${s.node}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <ShardProfileCard shard={shard} />
    </div>
  );
}
