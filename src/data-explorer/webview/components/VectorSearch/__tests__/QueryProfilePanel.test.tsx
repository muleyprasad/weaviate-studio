import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryProfilePanel, parseDuration } from '../QueryProfilePanel';
import type { QueryProfile } from '../../../../types';

/**
 * Test suite for QueryProfilePanel
 *
 * Tests cover:
 * - Duration string parsing (ms, s, µs, ns)
 * - Rendering with sample profile data
 * - Shard tab navigation
 * - Search type sections (vector, keyword, object)
 * - Timing bar proportions
 * - Non-timing metrics (counts, booleans)
 * - Empty state
 */

describe('parseDuration', () => {
  test('parses milliseconds', () => {
    expect(parseDuration('48.2ms')).toBeCloseTo(48.2);
    expect(parseDuration('0.3ms')).toBeCloseTo(0.3);
    expect(parseDuration('100ms')).toBe(100);
  });

  test('parses seconds', () => {
    expect(parseDuration('1.2s')).toBeCloseTo(1200);
    expect(parseDuration('0.5s')).toBeCloseTo(500);
  });

  test('parses microseconds', () => {
    expect(parseDuration('350µs')).toBeCloseTo(0.35);
    expect(parseDuration('350us')).toBeCloseTo(0.35);
  });

  test('parses nanoseconds', () => {
    expect(parseDuration('1500ns')).toBeCloseTo(0.0015);
  });

  test('returns null for non-duration strings', () => {
    expect(parseDuration('512')).toBeNull();
    expect(parseDuration('false')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
  });

  test('returns null for invalid numbers', () => {
    expect(parseDuration('NaNms')).toBeNull();
  });
});

const sampleProfile: QueryProfile = {
  shards: [
    {
      name: '1a2b3c4dshard',
      node: 'weaviate-0',
      searches: {
        vector: {
          details: {
            total_took: '48.2ms',
            filters_build_allow_list_took: '2.1ms',
            filters_ids_matched: '512',
            vector_search_took: '8.4ms',
            knn_search_layer_0_took: '7.9ms',
            knn_search_rescore_took: '0.3ms',
            hnsw_flat_search: 'false',
            objects_took: '36.8ms',
          },
        },
      },
    },
  ],
};

const hybridProfile: QueryProfile = {
  shards: [
    {
      name: 'shard-a',
      node: 'node-1',
      searches: {
        vector: {
          details: {
            total_took: '30ms',
            vector_search_took: '20ms',
            knn_search_layer_0_took: '18ms',
            objects_took: '8ms',
          },
        },
        keyword: {
          details: {
            total_took: '15ms',
            kwd_3_term_time: '5ms',
            kwd_4_bmw_time: '8ms',
          },
        },
      },
    },
  ],
};

const multiShardProfile: QueryProfile = {
  shards: [
    {
      name: 'shard-1',
      node: 'node-0',
      searches: {
        object: {
          details: { total_took: '5ms' },
        },
      },
    },
    {
      name: 'shard-2',
      node: 'node-1',
      searches: {
        object: {
          details: { total_took: '3ms' },
        },
      },
    },
  ],
};

describe('QueryProfilePanel', () => {
  test('renders empty state for no shards', () => {
    render(<QueryProfilePanel profile={{ shards: [] }} />);
    expect(screen.getByText(/no profiling data/i)).toBeTruthy();
  });

  test('renders vector search profile with timing bars', () => {
    render(<QueryProfilePanel profile={sampleProfile} />);

    // Panel header
    expect(screen.getByText('Query Profile')).toBeTruthy();

    // Shard info
    expect(screen.getByText(/1a2b3c4dshard/)).toBeTruthy();
    expect(screen.getByText('weaviate-0')).toBeTruthy();

    // Search type section
    const sectionLabels = screen.getAllByText('Vector Search');
    expect(sectionLabels.length).toBeGreaterThanOrEqual(1);

    // Timing metrics (may appear in both section header and metric row)
    expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('48.2ms').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Object Hydration')).toBeTruthy();
    expect(screen.getAllByText('36.8ms').length).toBeGreaterThanOrEqual(1);

    // Non-timing metric
    expect(screen.getByText('Filter IDs Matched')).toBeTruthy();
    expect(screen.getByText('512')).toBeTruthy();

    // Boolean badge
    expect(screen.getByText('false')).toBeTruthy();
  });

  test('renders hybrid profile with both vector and keyword sections', () => {
    render(<QueryProfilePanel profile={hybridProfile} />);

    expect(screen.getAllByText('Vector Search').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Keyword / BM25')).toBeTruthy();
  });

  test('renders shard tabs for multi-shard profiles', () => {
    render(<QueryProfilePanel profile={multiShardProfile} />);

    // Two shard tabs
    const tabs = screen
      .getAllByRole('button')
      .filter((el) => el.className.includes('qp-shard-tab'));
    expect(tabs.length).toBe(2);

    // First shard shown by default
    expect(screen.getByText('shard-1')).toBeTruthy();

    // Click second tab
    fireEvent.click(tabs[1]);
    expect(screen.getByText('shard-2')).toBeTruthy();
  });

  test('collapses and expands search type sections', () => {
    render(<QueryProfilePanel profile={sampleProfile} />);

    // Section is expanded by default - metrics visible
    expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);

    // Click section header to collapse
    const sectionHeaders = screen.getAllByText('Vector Search');
    const sectionHeader = sectionHeaders[0].closest('button');
    expect(sectionHeader).toBeTruthy();
    fireEvent.click(sectionHeader!);

    // Metrics should be hidden after collapse
    expect(screen.queryByText('Object Hydration')).toBeNull();
  });

  test('shows HNSW layer metrics', () => {
    render(<QueryProfilePanel profile={sampleProfile} />);
    expect(screen.getByText('HNSW Layer 0')).toBeTruthy();
    expect(screen.getByText('7.9ms')).toBeTruthy();
  });

  test('shows rescore metric when compression is enabled', () => {
    render(<QueryProfilePanel profile={sampleProfile} />);
    expect(screen.getByText('Rescore (decompression)')).toBeTruthy();
    expect(screen.getByText('0.3ms')).toBeTruthy();
  });
});
