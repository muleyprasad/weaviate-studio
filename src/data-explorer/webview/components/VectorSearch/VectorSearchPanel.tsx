/**
 * VectorSearchPanel - Main slide-out panel for vector search
 * Supports four search modes: Text (Semantic), Similar Object, Raw Vector, Hybrid
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CollectionConfig,
  WeaviateObject,
  PropertyConfig,
  JoinStrategy,
} from '../../../types';
import {
  useVectorSearchState,
  useVectorSearchActions,
  type VectorSearchMode,
  type DistanceMetric,
} from '../../context';
import { useDataState } from '../../context/DataContext';
import { SearchModeSelector } from './SearchModeSelector';
import { TextSearchInput } from './TextSearchInput';
import { ObjectSearchInput } from './ObjectSearchInput';
import { VectorInput } from './VectorInput';
import { HybridSearchInput } from './HybridSearchInput';
import { SearchResults } from './SearchResults';
import { VectorOptionsDrawer } from './VectorOptionsDrawer';
import { CopyAsCode } from './CopyAsCode';
import { useNamedVectors } from '../../hooks/useNamedVectors';
import {
  supportsMultiTargetNear,
  supportsMultiTargetHybrid,
  supportsQueryProfiling,
  supportsMMR,
} from '../../utils/versionCheck';
import { validateMultiTargetConfig } from '../../utils/multiTargetBuilder';

interface VectorSearchPanelProps {
  isOpen: boolean;
  schema: CollectionConfig | null;
  onResultSelect: (object: WeaviateObject) => void;
  onSearch: () => void;
  preSelectedObject?: WeaviateObject | null;
}

function formatProfileMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    total_took: 'Total',
    vector_search_took: 'Vector search',
    objects_took: 'Object hydration',
    filters_build_allow_list_took: 'Filter allow list',
    knn_search_rescore_took: 'Rescore',
  };

  if (labels[key]) {
    return labels[key];
  }

  const layerMatch = key.match(/^knn_search_layer_(\d+)_took$/);
  if (layerMatch) {
    return `HNSW layer ${layerMatch[1]}`;
  }

  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function QueryProfileDetails({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useVectorSearchState>>['queryProfileResult'];
}) {
  const shards = Array.isArray(profile?.shards) ? profile.shards : [];

  if (shards.length === 0) {
    return (
      <section className="query-profile-details" aria-label="Query profile details">
        <span className="codicon codicon-info" aria-hidden="true"></span>
        No per-shard timing details were returned for this query.
      </section>
    );
  }

  return (
    <section className="query-profile-details" aria-label="Query profile details">
      <div className="query-profile-details-heading">
        <span>Timing breakdown</span>
        <span>{shards.length === 1 ? '1 shard' : `${shards.length} shards`}</span>
      </div>
      {shards.map((shard) => (
        <div className="query-profile-shard" key={`${shard.name}-${shard.node}`}>
          <div className="query-profile-shard-heading">
            <span className="codicon codicon-database" aria-hidden="true"></span>
            <strong>{shard.name}</strong>
            <span>{shard.node}</span>
          </div>
          {Object.entries(shard.searches || {}).map(([searchType, search]) => (
            <div className="query-profile-search-type" key={searchType}>
              <span>{searchType === 'vector' ? 'Vector search' : `${searchType} search`}</span>
              {Object.entries(search.details || {}).map(([key, value]) => (
                <div className="query-profile-metric" key={key}>
                  <span>{formatProfileMetricLabel(key)}</span>
                  <code>{value}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

export function VectorSearchPanel({
  isOpen,
  schema,
  onResultSelect,
  onSearch,
  preSelectedObject,
}: VectorSearchPanelProps) {
  const state = useVectorSearchState();
  const actions = useVectorSearchActions();
  const dataState = useDataState();

  const {
    searchMode,
    searchParams,
    searchResults,
    isSearching,
    searchError,
    hasSearched,
    vectorOptionsExpanded,
    selectedTargetVectors,
    joinStrategy,
    vectorWeights,
    queryProfileEnabled,
    queryProfileResult,
  } = state;

  // Get named vectors from schema
  const { namedVectors, hasMultipleVectors } = useNamedVectors(schema);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);
  const [isCodeOpen, setIsCodeOpen] = useState(false);

  // Distance is edited as text so it reads as a decimal (1.00) instead of a
  // bare number; the typed text only becomes a search param on commit.
  const [distanceDraft, setDistanceDraft] = useState('');
  const [isDistanceEditing, setIsDistanceEditing] = useState(false);
  const distanceValue = isDistanceEditing ? distanceDraft : searchParams.maxDistance.toFixed(2);

  const commitDistance = (raw: string) => {
    const next = parseFloat(raw);
    if (Number.isFinite(next)) {
      handleParamChange('maxDistance', Math.min(2, Math.max(0, next)));
    }
  };

  // Steppers for the common case: nudging the threshold without typing.
  const stepDistance = (delta: number) => {
    const typed = parseFloat(distanceDraft);
    const base = isDistanceEditing && Number.isFinite(typed) ? typed : searchParams.maxDistance;
    const next = Math.min(2, Math.max(0, Number((base + delta).toFixed(2))));
    handleParamChange('maxDistance', next);
    setIsDistanceEditing(false);
  };

  // Close a previously opened profile whenever it is cleared or profiling is turned off.
  useEffect(() => {
    if (!queryProfileEnabled || !queryProfileResult) {
      setIsProfileDetailsOpen(false);
    }
  }, [queryProfileEnabled, queryProfileResult]);

  // Check version support for multi-target features
  const versionSupported = useMemo(() => {
    const serverVersion = dataState.serverVersion;
    if (!serverVersion) {
      return false;
    }

    if (searchMode === 'hybrid') {
      return supportsMultiTargetHybrid(serverVersion);
    }
    // For text, object, vector modes
    return supportsMultiTargetNear(serverVersion);
  }, [dataState.serverVersion, searchMode]);

  // Check if query profiling is supported by the server
  const queryProfilingSupported = useMemo(() => {
    const serverVersion = dataState.serverVersion;
    if (!serverVersion) {
      return false;
    }
    return supportsQueryProfiling(serverVersion);
  }, [dataState.serverVersion]);

  // Check if MMR diversity selection is supported by the server (GA in Weaviate 1.39)
  const mmrSupported = useMemo(() => {
    const serverVersion = dataState.serverVersion;
    if (!serverVersion) {
      return false;
    }
    return supportsMMR(serverVersion);
  }, [dataState.serverVersion]);

  // Handle keyboard escape to close panel (only add listener when open)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        actions.closeVectorSearchPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actions]);

  // Type for vectorizer config entries
  interface VectorizerConfigEntry {
    name?: string;
    [key: string]: unknown;
  }

  // Check if collection has a vectorizer configured
  const hasVectorizer = useMemo(() => {
    if (!schema?.vectorizerConfig) {
      return false;
    }
    // Check if vectorizer is configured and not 'none'
    const config = schema.vectorizerConfig as
      | VectorizerConfigEntry[]
      | Record<string, unknown>
      | undefined;
    if (Array.isArray(config)) {
      return config.length > 0;
    }
    return Object.keys(config || {}).length > 0;
  }, [schema]);

  // Get vectorizer name for display
  const vectorizerName = useMemo(() => {
    if (!schema?.vectorizerConfig) {
      return undefined;
    }
    const config = schema.vectorizerConfig as
      | VectorizerConfigEntry[]
      | Record<string, unknown>
      | undefined;
    if (Array.isArray(config) && config.length > 0) {
      return config[0]?.name || 'default';
    }
    return Object.keys(config || {})[0] || undefined;
  }, [schema]);

  // Get expected vector dimensions
  const expectedDimensions = useMemo(() => {
    // This would come from the schema if available
    return undefined;
  }, [schema]);

  // Extract text properties from schema for hybrid search property selector
  const textProperties = useMemo(() => {
    if (!schema?.properties) {
      return [];
    }
    return schema.properties
      .filter((prop: PropertyConfig) => {
        const dataType = prop.dataType?.[0]?.toLowerCase();
        return dataType === 'text' || dataType === 'string';
      })
      .map((prop: PropertyConfig) => prop.name);
  }, [schema]);

  // Handle search mode change
  const handleModeChange = useCallback(
    (mode: VectorSearchMode) => {
      actions.setSearchMode(mode);
    },
    [actions]
  );

  // Handle search parameter changes
  const handleParamChange = useCallback(
    (key: string, value: string | number) => {
      actions.setSearchParams({ [key]: value });
    },
    [actions]
  );

  // Handle search button click
  const handleSearch = useCallback(() => {
    onSearch();
  }, [onSearch]);

  // Handle result view
  const handleViewObject = useCallback(
    (object: WeaviateObject) => {
      onResultSelect(object);
    },
    [onResultSelect]
  );

  // Handle find similar on result
  const handleFindSimilar = useCallback(
    (objectId: string) => {
      actions.findSimilar(objectId);
    },
    [actions]
  );

  // Clear pre-selected object
  const handleClearPreSelection = useCallback(() => {
    actions.setSearchParams({ objectId: '' });
  }, [actions]);

  // Multi-target vector search handlers
  const handleToggleVectorOptions = useCallback(() => {
    actions.toggleVectorOptions();
  }, [actions]);

  const handleSelectedVectorsChange = useCallback(
    (vectors: string[]) => {
      actions.setSelectedTargetVectors(vectors);
      // Initialize weights for new vectors
      vectors.forEach((vector) => {
        if (!(vector in vectorWeights)) {
          actions.setVectorWeight(vector, 0.5);
        }
      });
    },
    [actions, vectorWeights]
  );

  const handleJoinStrategyChange = useCallback(
    (strategy: JoinStrategy) => {
      actions.setJoinStrategy(strategy);
    },
    [actions]
  );

  const handleVectorWeightChange = useCallback(
    (vectorName: string, weight: number) => {
      actions.setVectorWeight(vectorName, weight);
    },
    [actions]
  );

  const handleNormalizeWeights = useCallback(() => {
    actions.normalizeWeights();
  }, [actions]);

  // When a multi-vector collection loads, auto-select all vectors and update MUVERA flags.
  // This prevents the "no target vectors were provided" error for first-time users who
  // haven't interacted with the Target Vectors checkboxes yet.
  useEffect(() => {
    if (hasMultipleVectors && namedVectors.length > 0) {
      // Auto-select all vectors (user can deselect individually)
      actions.setSelectedTargetVectors(namedVectors.map((v) => v.name));

      // Update MUVERA flags
      const flags: Record<string, boolean> = {};
      namedVectors.forEach((vector) => {
        flags[vector.name] = vector.isMuvera;
      });
      actions.setMuveraFlags(flags);
    }
  }, [namedVectors, hasMultipleVectors, actions]);

  // Validate search can be performed
  const canSearch = useMemo(() => {
    if (isSearching) {
      return false;
    }

    // First check mode-specific validation
    let modeValid = false;
    switch (searchMode) {
      case 'text':
        modeValid = hasVectorizer && searchParams.query.trim().length > 0;
        break;
      case 'object':
        modeValid = searchParams.objectId.trim().length > 0;
        break;
      case 'vector':
        try {
          const parsed = JSON.parse(searchParams.vector);
          modeValid =
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every((n) => typeof n === 'number');
        } catch {
          modeValid = false;
        }
        break;
      case 'hybrid':
        // Hybrid search requires vectorizer and a query
        modeValid = hasVectorizer && searchParams.query.trim().length > 0;
        break;
      default:
        modeValid = false;
    }

    if (!modeValid) {
      return false;
    }

    // Multi-vector collections MUST have at least one target vector selected
    if (hasMultipleVectors && selectedTargetVectors.length === 0) {
      return false;
    }

    // If the server does not support multi-target, block searches with 2+ vectors.
    // The UI already shows a version-gate warning; the Run button should also be
    // disabled so users cannot submit a query they know will fail.
    if (selectedTargetVectors.length > 1 && !versionSupported) {
      return false;
    }

    // If multi-target is active (2+ vectors), validate the join strategy config
    if (selectedTargetVectors.length > 1) {
      const validation = validateMultiTargetConfig(
        selectedTargetVectors,
        joinStrategy,
        vectorWeights
      );
      return validation.valid;
    }

    return true;
  }, [
    searchMode,
    searchParams,
    hasVectorizer,
    hasMultipleVectors,
    versionSupported,
    isSearching,
    selectedTargetVectors,
    joinStrategy,
    vectorWeights,
  ]);

  // Distance metric options
  const distanceMetrics: { value: DistanceMetric; label: string }[] = [
    { value: 'cosine', label: 'Cosine' },
    { value: 'euclidean', label: 'Euclidean' },
    { value: 'manhattan', label: 'Manhattan' },
    { value: 'dot', label: 'Dot Product' },
  ];

  // Result limit options
  const limitOptions = [10, 25, 50, 100];

  return (
    <div
      className={`vector-search-panel ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-label="Vector Search"
    >
      {/* Backdrop */}
      <div
        className="vector-search-backdrop"
        onClick={() => actions.closeVectorSearchPanel()}
        aria-hidden="true"
      />

      {/* Panel content */}
      <div className="vector-search-content">
        {/* Header */}
        <header className="vector-search-header">
          <div className="vector-search-title">
            <span className="codicon codicon-search" aria-hidden="true"></span>
            <h2>Vector Search</h2>
          </div>
          <button
            type="button"
            className="vector-search-close"
            onClick={() => actions.closeVectorSearchPanel()}
            title="Close vector search panel"
            aria-label="Close vector search panel"
          >
            <span className="codicon codicon-close" aria-hidden="true"></span>
          </button>
        </header>

        {/* Search Mode Selector */}
        <SearchModeSelector
          activeMode={searchMode}
          onModeChange={handleModeChange}
          hasVectorizer={hasVectorizer}
        />

        {/* Scrollable Body */}
        <div className="vector-search-body">
          {/* Search Input Area */}
          <div className="search-input-area">
            {/* Mode-specific inputs */}
            {searchMode === 'text' && (
              <>
                {!hasVectorizer ? (
                  <div className="vectorizer-warning">
                    <span className="codicon codicon-warning" aria-hidden="true"></span>
                    <div>
                      <h4>Vectorizer Not Configured</h4>
                      <p>
                        Text search requires a vectorizer to be configured for this collection. Use
                        "Similar" or "Raw Vector" mode instead.
                      </p>
                    </div>
                  </div>
                ) : (
                  <TextSearchInput
                    value={searchParams.query}
                    onChange={(value) => handleParamChange('query', value)}
                    onSearch={handleSearch}
                    vectorizerName={vectorizerName}
                    isSearching={isSearching}
                  />
                )}
              </>
            )}

            {searchMode === 'object' && (
              <ObjectSearchInput
                value={searchParams.objectId}
                onChange={(value) => handleParamChange('objectId', value)}
                onSearch={handleSearch}
                selectedObject={preSelectedObject}
                isSearching={isSearching}
                onClearSelection={handleClearPreSelection}
              />
            )}

            {searchMode === 'vector' && (
              <VectorInput
                value={searchParams.vector}
                onChange={(value) => handleParamChange('vector', value)}
                onSearch={handleSearch}
                expectedDimensions={expectedDimensions}
                isSearching={isSearching}
              />
            )}

            {searchMode === 'hybrid' && (
              <>
                {!hasVectorizer ? (
                  <div className="vectorizer-warning">
                    <span className="codicon codicon-warning" aria-hidden="true"></span>
                    <div>
                      <h4>Vectorizer Not Configured</h4>
                      <p>
                        Hybrid search requires a vectorizer to be configured for this collection.
                        Use "Similar" or "Raw Vector" mode instead.
                      </p>
                    </div>
                  </div>
                ) : (
                  <HybridSearchInput
                    query={searchParams.query}
                    alpha={searchParams.hybridAlpha}
                    properties={searchParams.searchProperties}
                    enableQueryRewriting={searchParams.enableQueryRewriting}
                    availableProperties={textProperties}
                    onQueryChange={(value) => handleParamChange('query', value)}
                    onAlphaChange={(value) => actions.setSearchParams({ hybridAlpha: value })}
                    onPropertiesChange={(props) =>
                      actions.setSearchParams({ searchProperties: props })
                    }
                    onQueryRewritingToggle={() =>
                      actions.setSearchParams({
                        enableQueryRewriting: !searchParams.enableQueryRewriting,
                      })
                    }
                    vectorizerName={vectorizerName}
                    onSearch={handleSearch}
                    isSearching={isSearching}
                  />
                )}
              </>
            )}
          </div>

          {/* Multi-target Vector Options */}
          {hasMultipleVectors && (
            <VectorOptionsDrawer
              availableVectors={namedVectors}
              expanded={vectorOptionsExpanded}
              selectedVectors={selectedTargetVectors}
              joinStrategy={joinStrategy}
              vectorWeights={vectorWeights}
              onExpandedChange={handleToggleVectorOptions}
              onSelectedVectorsChange={handleSelectedVectorsChange}
              onJoinStrategyChange={handleJoinStrategyChange}
              onWeightChange={handleVectorWeightChange}
              onNormalize={handleNormalizeWeights}
              versionSupported={versionSupported}
              disabled={isSearching}
            />
          )}

          {/* Shared options: the mode-specific input above is the only difference between modes. */}
          <div className="search-options">
            <h3 className="search-options-title">Search options</h3>
            <div className="search-options-row" role="group" aria-label="Search options">
              {/* Distance Metric */}
              <div className="search-option">
                <label htmlFor="distance-metric">Metric</label>
                <select
                  id="distance-metric"
                  value={searchParams.distanceMetric}
                  onChange={(e) => handleParamChange('distanceMetric', e.target.value)}
                  disabled={isSearching}
                >
                  {distanceMetrics.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Distance */}
              <div className="search-option">
                <label htmlFor="max-distance">Max distance</label>
                <div className="distance-input-row">
                  <button
                    type="button"
                    className="distance-step"
                    onClick={() => stepDistance(-0.05)}
                    disabled={isSearching || searchParams.maxDistance <= 0}
                    aria-label="Decrease max distance"
                  >
                    <span className="codicon codicon-remove" aria-hidden="true"></span>
                  </button>
                  <input
                    id="max-distance"
                    type="text"
                    inputMode="decimal"
                    value={distanceValue}
                    onChange={(e) => setDistanceDraft(e.target.value)}
                    onFocus={() => {
                      setDistanceDraft(searchParams.maxDistance.toFixed(2));
                      setIsDistanceEditing(true);
                    }}
                    onBlur={() => {
                      setIsDistanceEditing(false);
                      commitDistance(distanceDraft);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={isSearching}
                    title="1.00 or higher disables the distance filter"
                  />
                  <button
                    type="button"
                    className="distance-step"
                    onClick={() => stepDistance(0.05)}
                    disabled={isSearching || searchParams.maxDistance >= 2}
                    aria-label="Increase max distance"
                  >
                    <span className="codicon codicon-add" aria-hidden="true"></span>
                  </button>
                </div>
              </div>

              {/* Result Limit */}
              <div className="search-option">
                <label htmlFor="result-limit">Results</label>
                <select
                  id="result-limit"
                  value={searchParams.limit}
                  onChange={(e) => handleParamChange('limit', parseInt(e.target.value, 10))}
                  disabled={isSearching}
                >
                  {limitOptions.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Search Button and Actions */}
          <div className="search-action">
            <div className="search-run-row">
              <button
                type="button"
                className="search-btn primary"
                onClick={handleSearch}
                disabled={!canSearch}
              >
                {isSearching ? (
                  <>
                    <span className="loading-spinner-small" />
                    Searching...
                  </>
                ) : (
                  <>
                    <span className="codicon codicon-search" aria-hidden="true"></span>
                    Run Vector Search
                  </>
                )}
              </button>

              <button
                type="button"
                className="search-icon-btn"
                onClick={() => setIsCodeOpen((open) => !open)}
                aria-expanded={isCodeOpen}
                aria-controls="search-code-snippet"
                title="Code snippet"
                aria-label="Code snippet"
              >
                <span className="codicon codicon-code" aria-hidden="true"></span>
              </button>
            </div>

            <div className="search-toggles">
              <label
                className={`search-toggle ${!queryProfilingSupported ? 'is-unavailable' : ''}`}
                htmlFor="query-profile-toggle"
                title={
                  queryProfilingSupported
                    ? 'Include per-shard timing data in each search. This preference is remembered.'
                    : 'Query profiling requires Weaviate 1.36.9 or newer.'
                }
              >
                <input
                  type="checkbox"
                  id="query-profile-toggle"
                  checked={queryProfileEnabled}
                  onChange={(e) => actions.setQueryProfileEnabled(e.target.checked)}
                  disabled={isSearching || !queryProfilingSupported}
                />
                <span>Profile</span>
                {!queryProfilingSupported && <span className="toggle-hint">1.36.9+</span>}
              </label>

              {queryProfileEnabled && queryProfileResult && (
                <button
                  type="button"
                  className="toggle-link"
                  onClick={() => setIsProfileDetailsOpen((open) => !open)}
                  aria-expanded={isProfileDetailsOpen}
                  aria-controls="query-profile-details"
                >
                  {isProfileDetailsOpen ? 'Hide profile' : 'View profile'}
                </button>
              )}

              {/* MMR diversity selection (near-* modes; hybrid pending client 3.15 — see #88) */}
              {searchMode !== 'hybrid' && (
                <label
                  className={`search-toggle ${!mmrSupported ? 'is-unavailable' : ''}`}
                  htmlFor="mmr-toggle"
                  title={
                    mmrSupported
                      ? 'Re-rank results with MMR to reduce redundancy. Balance trades diversity (0) against relevance (1).'
                      : 'MMR diversity selection requires Weaviate 1.39 or newer.'
                  }
                >
                  <input
                    type="checkbox"
                    id="mmr-toggle"
                    checked={searchParams.mmrEnabled}
                    onChange={(e) => actions.setSearchParams({ mmrEnabled: e.target.checked })}
                    disabled={isSearching || !mmrSupported}
                  />
                  <span>Diversify</span>
                  {!mmrSupported && <span className="toggle-hint">1.39+</span>}
                </label>
              )}

              {searchParams.mmrEnabled && mmrSupported && searchMode !== 'hybrid' && (
                <span className="mmr-balance">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={searchParams.mmrBalance}
                    onChange={(e) =>
                      actions.setSearchParams({ mmrBalance: parseFloat(e.target.value) })
                    }
                    disabled={isSearching}
                    aria-label="MMR balance (0 = most diverse, 1 = most relevant)"
                  />
                  <span className="mmr-balance-value">{searchParams.mmrBalance.toFixed(2)}</span>
                </span>
              )}

              {searchResults.length > 0 && (
                <button
                  type="button"
                  className="toggle-link"
                  onClick={() => actions.clearSearch()}
                  disabled={isSearching}
                >
                  Clear results
                </button>
              )}
            </div>

            {isCodeOpen && (
              <div id="search-code-snippet" className="search-advanced">
                <CopyAsCode
                  collectionName={schema?.name || ''}
                  searchMode={searchMode}
                  searchParams={searchParams}
                  targetVector={
                    selectedTargetVectors.length > 1
                      ? {
                          combination: joinStrategy,
                          targetVectors: selectedTargetVectors,
                          weights:
                            Object.keys(vectorWeights).length > 0 ? vectorWeights : undefined,
                        }
                      : selectedTargetVectors.length === 1
                        ? selectedTargetVectors[0]
                        : undefined
                  }
                  disabled={isSearching}
                />
              </div>
            )}
          </div>

          {/* Keep expensive diagnostic details out of the main result flow until requested. */}
          {queryProfileEnabled && queryProfileResult && isProfileDetailsOpen && (
            <div id="query-profile-details" className="query-profile-disclosure" aria-live="polite">
              <QueryProfileDetails profile={queryProfileResult} />
            </div>
          )}

          {/* Search Results */}
          <div className="search-results-container">
            <SearchResults
              results={searchResults}
              isLoading={isSearching}
              error={searchError}
              onViewObject={handleViewObject}
              onFindSimilar={handleFindSimilar}
              hasSearched={hasSearched}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
