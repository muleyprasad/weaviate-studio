import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CollectionConfig } from '../../../../types';
import { VectorSearchPanel } from '../VectorSearchPanel';
import { useVectorSearchActions, useVectorSearchState } from '../../../context';
import { useDataState } from '../../../context/DataContext';
import { useNamedVectors } from '../../../hooks/useNamedVectors';

jest.mock('../../../context', () => ({
  useVectorSearchActions: jest.fn(),
  useVectorSearchState: jest.fn(),
}));

jest.mock('../../../context/DataContext', () => ({
  useDataState: jest.fn(),
}));

jest.mock('../../../hooks/useNamedVectors', () => ({
  useNamedVectors: jest.fn(),
}));

jest.mock('../SearchModeSelector', () => ({ SearchModeSelector: () => null }));
jest.mock('../TextSearchInput', () => ({ TextSearchInput: () => null }));
jest.mock('../ObjectSearchInput', () => ({ ObjectSearchInput: () => null }));
jest.mock('../VectorInput', () => ({ VectorInput: () => null }));
jest.mock('../HybridSearchInput', () => ({ HybridSearchInput: () => null }));
jest.mock('../SearchResults', () => ({ SearchResults: () => null }));
jest.mock('../VectorOptionsDrawer', () => ({ VectorOptionsDrawer: () => null }));
jest.mock('../CopyAsCode', () => ({ CopyAsCode: () => null }));

const schema: CollectionConfig = {
  name: 'ProfileTest',
  properties: [],
  vectorizerConfig: { default: {} },
};

const actions = {
  clearSearch: jest.fn(),
  closeVectorSearchPanel: jest.fn(),
  findSimilar: jest.fn(),
  normalizeWeights: jest.fn(),
  setJoinStrategy: jest.fn(),
  setMuveraFlags: jest.fn(),
  setQueryProfileEnabled: jest.fn(),
  setSearchMode: jest.fn(),
  setSearchParams: jest.fn(),
  setSelectedTargetVectors: jest.fn(),
  setVectorWeight: jest.fn(),
  toggleVectorOptions: jest.fn(),
};

function createState(overrides: Record<string, unknown> = {}) {
  return {
    searchMode: 'text',
    searchParams: {
      query: 'independence day of india',
      objectId: '',
      vector: '',
      hybridAlpha: 0.5,
      searchProperties: [],
      enableQueryRewriting: false,
      distanceMetric: 'cosine',
      maxDistance: 1,
      limit: 25,
    },
    searchResults: [],
    isSearching: false,
    searchError: null,
    hasSearched: false,
    vectorOptionsExpanded: false,
    selectedTargetVectors: [],
    joinStrategy: 'minimum',
    vectorWeights: {},
    queryProfileEnabled: false,
    queryProfileResult: null,
    ...overrides,
  };
}

function renderPanel(stateOverrides: Record<string, unknown> = {}) {
  (useVectorSearchState as jest.Mock).mockReturnValue(createState(stateOverrides));
  (useVectorSearchActions as jest.Mock).mockReturnValue(actions);
  (useDataState as jest.Mock).mockReturnValue({ serverVersion: '1.38.8' });
  (useNamedVectors as jest.Mock).mockReturnValue({ namedVectors: [], hasMultipleVectors: false });

  return render(
    <VectorSearchPanel
      isOpen
      schema={schema}
      onResultSelect={jest.fn()}
      onSearch={jest.fn()}
      preSelectedObject={null}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VectorSearchPanel query profiling', () => {
  it('keeps Profile adjacent to the primary action and forwards preference changes', () => {
    renderPanel();

    const profileToggle = screen.getByLabelText('Profile');
    expect(profileToggle).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Run Vector Search' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View profile' })).toBeNull();

    fireEvent.click(profileToggle);
    expect(actions.setQueryProfileEnabled).toHaveBeenCalledWith(true);
  });

  it('shows timing details only after View profile is requested', () => {
    renderPanel({
      queryProfileEnabled: true,
      queryProfileResult: {
        shards: [
          {
            name: 'profiletest_shard',
            node: 'node1',
            searches: {
              vector: {
                details: {
                  total_took: '477.248µs',
                  vector_search_took: '278.091µs',
                  objects_took: '176.52µs',
                },
              },
            },
          },
        ],
      },
    });

    expect(screen.getByRole('button', { name: 'View profile' })).toBeTruthy();
    expect(screen.queryByLabelText('Query profile details')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View profile' }));

    expect(screen.getByRole('button', { name: 'Hide profile' })).toBeTruthy();
    expect(screen.getByLabelText('Query profile details')).toBeTruthy();
    expect(screen.getByText('Timing breakdown')).toBeTruthy();
    expect(screen.getByText('profiletest_shard')).toBeTruthy();
    expect(screen.getByText('Object hydration')).toBeTruthy();
    expect(screen.getByText('477.248µs')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide profile' }));
    expect(screen.queryByLabelText('Query profile details')).toBeNull();
  });
});
