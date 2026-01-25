import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  FilterProvider,
  useFilterContext,
  useFilterState,
  useFilterActions,
  FilterCondition,
  FilterMatchMode,
} from '../FilterContext';

/**
 * Test suite for FilterContext
 *
 * Tests cover:
 * - Add/remove filter rules
 * - Update filter conditions
 * - AND/OR match mode logic
 * - Filter presets (save, delete, load)
 * - Pending filters workflow (panel editing)
 * - Filter panel state (open/close/toggle)
 * - State persistence across operations
 * - Validation and error handling
 */

describe('FilterContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FilterProvider>{children}</FilterProvider>
  );

  describe('Hook Usage', () => {
    test('useFilterContext returns state and actions', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      expect(result.current.state).toBeDefined();
      expect(result.current.actions).toBeDefined();
    });

    test('useFilterState returns state directly', () => {
      const { result } = renderHook(() => useFilterState(), { wrapper });

      expect(result.current.activeFilters).toEqual([]);
      expect(result.current.pendingFilters).toEqual([]);
      expect(result.current.filterPresets).toEqual([]);
      expect(result.current.isApplying).toBe(false);
      expect(result.current.showFilterPanel).toBe(false);
      expect(result.current.matchMode).toBe('AND');
    });

    test('useFilterActions returns actions directly', () => {
      const { result } = renderHook(() => useFilterActions(), { wrapper });

      expect(result.current.addFilter).toBeInstanceOf(Function);
      expect(result.current.removeFilter).toBeInstanceOf(Function);
      expect(result.current.updateFilter).toBeInstanceOf(Function);
      expect(result.current.clearAllFilters).toBeInstanceOf(Function);
    });

    test('throws error when used outside FilterProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useFilterContext());
      }).toThrow('useFilterContext must be used within a FilterProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Add/Remove Filters', () => {
    test('adds a new filter to active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      const filter: FilterCondition = {
        id: '1',
        path: 'name',
        operator: 'Equal',
        value: 'John',
        valueType: 'text',
      };

      act(() => {
        result.current.actions.addFilter(filter);
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0]).toEqual(filter);
    });

    test('adds multiple filters to active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      const filter1: FilterCondition = {
        id: '1',
        path: 'age',
        operator: 'GreaterThan',
        value: 18,
        valueType: 'number',
      };

      const filter2: FilterCondition = {
        id: '2',
        path: 'status',
        operator: 'Equal',
        value: 'active',
      };

      act(() => {
        result.current.actions.addFilter(filter1);
        result.current.actions.addFilter(filter2);
      });

      expect(result.current.state.activeFilters).toHaveLength(2);
      expect(result.current.state.activeFilters[0]).toEqual(filter1);
      expect(result.current.state.activeFilters[1]).toEqual(filter2);
    });

    test('removes a filter by ID', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      const filter1: FilterCondition = {
        id: '1',
        path: 'name',
        operator: 'Equal',
        value: 'John',
      };

      const filter2: FilterCondition = {
        id: '2',
        path: 'age',
        operator: 'GreaterThan',
        value: 18,
      };

      act(() => {
        result.current.actions.addFilter(filter1);
        result.current.actions.addFilter(filter2);
      });

      act(() => {
        result.current.actions.removeFilter('1');
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0].id).toBe('2');
    });

    test('removing non-existent filter has no effect', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      const filter: FilterCondition = {
        id: '1',
        path: 'name',
        operator: 'Equal',
        value: 'John',
      };

      act(() => {
        result.current.actions.addFilter(filter);
      });

      act(() => {
        result.current.actions.removeFilter('non-existent-id');
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0].id).toBe('1');
    });

    test('clears all active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
        result.current.actions.addFilter({
          id: '2',
          path: 'age',
          operator: 'GreaterThan',
          value: 18,
        });
      });

      expect(result.current.state.activeFilters).toHaveLength(2);

      act(() => {
        result.current.actions.clearAllFilters();
      });

      expect(result.current.state.activeFilters).toHaveLength(0);
    });

    test('sets filters replaces all active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'old',
          operator: 'Equal',
          value: 'value',
        });
      });

      const newFilters: FilterCondition[] = [
        { id: '2', path: 'new1', operator: 'Equal', value: 'value1' },
        { id: '3', path: 'new2', operator: 'Equal', value: 'value2' },
      ];

      act(() => {
        result.current.actions.setFilters(newFilters);
      });

      expect(result.current.state.activeFilters).toHaveLength(2);
      expect(result.current.state.activeFilters).toEqual(newFilters);
    });
  });

  describe('Update Filters', () => {
    test('updates filter operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'age',
          operator: 'Equal',
          value: 25,
        });
      });

      act(() => {
        result.current.actions.updateFilter('1', { operator: 'GreaterThan' });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('GreaterThan');
      expect(result.current.state.activeFilters[0].value).toBe(25);
    });

    test('updates filter value', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
      });

      act(() => {
        result.current.actions.updateFilter('1', { value: 'inactive' });
      });

      expect(result.current.state.activeFilters[0].value).toBe('inactive');
    });

    test('updates filter path', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'firstName',
          operator: 'Like',
          value: 'John*',
        });
      });

      act(() => {
        result.current.actions.updateFilter('1', { path: 'lastName' });
      });

      expect(result.current.state.activeFilters[0].path).toBe('lastName');
    });

    test('updates multiple properties at once', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'age',
          operator: 'Equal',
          value: 25,
        });
      });

      act(() => {
        result.current.actions.updateFilter('1', {
          operator: 'GreaterThan',
          value: 30,
          valueType: 'number',
        });
      });

      const filter = result.current.state.activeFilters[0];
      expect(filter.operator).toBe('GreaterThan');
      expect(filter.value).toBe(30);
      expect(filter.valueType).toBe('number');
    });

    test('updating non-existent filter has no effect', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
      });

      act(() => {
        result.current.actions.updateFilter('non-existent', { value: 'Jane' });
      });

      expect(result.current.state.activeFilters[0].value).toBe('John');
    });
  });

  describe('Match Mode (AND/OR)', () => {
    test('default match mode is AND', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      expect(result.current.state.matchMode).toBe('AND');
    });

    test('sets match mode to OR', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.setMatchMode('OR');
      });

      expect(result.current.state.matchMode).toBe('OR');
    });

    test('sets match mode to AND', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.setMatchMode('OR');
        result.current.actions.setMatchMode('AND');
      });

      expect(result.current.state.matchMode).toBe('AND');
    });

    test('match mode persists across filter operations', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.setMatchMode('OR');
      });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
      });

      expect(result.current.state.matchMode).toBe('OR');
      expect(result.current.state.activeFilters).toHaveLength(1);
    });
  });

  describe('Filter Presets', () => {
    test('saves a preset from current active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.addFilter({
          id: '2',
          path: 'age',
          operator: 'GreaterThan',
          value: 18,
        });
      });

      act(() => {
        result.current.actions.savePreset('Active Adults');
      });

      expect(result.current.state.filterPresets).toHaveLength(1);
      expect(result.current.state.filterPresets[0].name).toBe('Active Adults');
      expect(result.current.state.filterPresets[0].filters).toHaveLength(2);
      expect(result.current.state.filterPresets[0].id).toBeDefined();
      expect(result.current.state.filterPresets[0].createdAt).toBeInstanceOf(Date);
    });

    test('saves multiple presets', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.savePreset('Preset 1');
      });

      act(() => {
        result.current.actions.clearAllFilters();
        result.current.actions.addFilter({
          id: '2',
          path: 'category',
          operator: 'Equal',
          value: 'tech',
        });
        result.current.actions.savePreset('Preset 2');
      });

      expect(result.current.state.filterPresets).toHaveLength(2);
      expect(result.current.state.filterPresets[0].name).toBe('Preset 1');
      expect(result.current.state.filterPresets[1].name).toBe('Preset 2');
    });

    test('loads a preset by ID', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      let presetId: string;

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
      });

      act(() => {
        result.current.actions.savePreset('My Preset');
      });

      presetId = result.current.state.filterPresets[0].id;

      act(() => {
        result.current.actions.clearAllFilters();
      });

      expect(result.current.state.activeFilters).toHaveLength(0);

      act(() => {
        result.current.actions.loadPreset(presetId);
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0].path).toBe('status');
    });

    test('loading non-existent preset has no effect', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
      });

      act(() => {
        result.current.actions.loadPreset('non-existent-id');
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0].value).toBe('John');
    });

    test('deletes a preset by ID', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.savePreset('Preset 1');
        result.current.actions.savePreset('Preset 2');
      });

      const presetId = result.current.state.filterPresets[0].id;

      act(() => {
        result.current.actions.deletePreset(presetId);
      });

      expect(result.current.state.filterPresets).toHaveLength(1);
      expect(result.current.state.filterPresets[0].name).toBe('Preset 2');
    });

    test('deleting non-existent preset has no effect', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.savePreset('My Preset');
      });

      act(() => {
        result.current.actions.deletePreset('non-existent-id');
      });

      expect(result.current.state.filterPresets).toHaveLength(1);
    });

    test('preset captures filter state at save time', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
      });

      act(() => {
        result.current.actions.savePreset('Snapshot');
      });

      act(() => {
        result.current.actions.updateFilter('1', { value: 'inactive' });
      });

      const preset = result.current.state.filterPresets[0];
      expect(preset.filters[0].value).toBe('active'); // Unchanged in preset
      expect(result.current.state.activeFilters[0].value).toBe('inactive');
    });
  });

  describe('Filter Panel State', () => {
    test('filter panel is initially closed', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('opens filter panel', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.openFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(true);
    });

    test('closes filter panel', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.openFilterPanel();
        result.current.actions.closeFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('toggles filter panel open', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.toggleFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(true);
    });

    test('toggles filter panel closed', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.openFilterPanel();
        result.current.actions.toggleFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('opening panel copies active filters to pending', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
      });

      act(() => {
        result.current.actions.openFilterPanel();
      });

      expect(result.current.state.pendingFilters).toHaveLength(1);
      expect(result.current.state.pendingFilters[0]).toEqual(result.current.state.activeFilters[0]);
    });

    test('toggle open copies active filters to pending', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
      });

      act(() => {
        result.current.actions.toggleFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(true);
      expect(result.current.state.pendingFilters).toHaveLength(1);
    });

    test('toggle closed preserves pending filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.openFilterPanel();
        result.current.actions.addPendingFilter({
          id: '1',
          path: 'test',
          operator: 'Equal',
          value: 'value',
        });
      });

      act(() => {
        result.current.actions.toggleFilterPanel();
      });

      expect(result.current.state.showFilterPanel).toBe(false);
      expect(result.current.state.pendingFilters).toHaveLength(1);
    });
  });

  describe('Pending Filters Workflow', () => {
    test('adds pending filter', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      const filter: FilterCondition = {
        id: '1',
        path: 'status',
        operator: 'Equal',
        value: 'pending',
      };

      act(() => {
        result.current.actions.addPendingFilter(filter);
      });

      expect(result.current.state.pendingFilters).toHaveLength(1);
      expect(result.current.state.pendingFilters[0]).toEqual(filter);
      expect(result.current.state.activeFilters).toHaveLength(0);
    });

    test('removes pending filter', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addPendingFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
        result.current.actions.addPendingFilter({
          id: '2',
          path: 'age',
          operator: 'GreaterThan',
          value: 18,
        });
      });

      act(() => {
        result.current.actions.removePendingFilter('1');
      });

      expect(result.current.state.pendingFilters).toHaveLength(1);
      expect(result.current.state.pendingFilters[0].id).toBe('2');
    });

    test('updates pending filter', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addPendingFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'draft',
        });
      });

      act(() => {
        result.current.actions.updatePendingFilter('1', { value: 'published' });
      });

      expect(result.current.state.pendingFilters[0].value).toBe('published');
    });

    test('applies pending filters to active', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addPendingFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.addPendingFilter({
          id: '2',
          path: 'category',
          operator: 'Equal',
          value: 'tech',
        });
      });

      act(() => {
        result.current.actions.applyPendingFilters();
      });

      expect(result.current.state.activeFilters).toHaveLength(2);
      expect(result.current.state.activeFilters[0].id).toBe('1');
      expect(result.current.state.activeFilters[1].id).toBe('2');
      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('applying pending filters closes panel', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.openFilterPanel();
        result.current.actions.addPendingFilter({
          id: '1',
          path: 'test',
          operator: 'Equal',
          value: 'value',
        });
      });

      expect(result.current.state.showFilterPanel).toBe(true);

      act(() => {
        result.current.actions.applyPendingFilters();
      });

      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('reset pending filters reverts to active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'original',
          operator: 'Equal',
          value: 'value',
        });
      });

      act(() => {
        result.current.actions.openFilterPanel();
        result.current.actions.addPendingFilter({
          id: '2',
          path: 'new',
          operator: 'Equal',
          value: 'value',
        });
      });

      expect(result.current.state.pendingFilters).toHaveLength(2);

      act(() => {
        result.current.actions.resetPendingFilters();
      });

      expect(result.current.state.pendingFilters).toHaveLength(1);
      expect(result.current.state.pendingFilters[0].id).toBe('1');
    });

    test('pending filters independent from active filters', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'active',
          operator: 'Equal',
          value: 'value1',
        });
        result.current.actions.addPendingFilter({
          id: '2',
          path: 'pending',
          operator: 'Equal',
          value: 'value2',
        });
      });

      expect(result.current.state.activeFilters).toHaveLength(1);
      expect(result.current.state.pendingFilters).toHaveLength(1);
      expect(result.current.state.activeFilters[0].id).toBe('1');
      expect(result.current.state.pendingFilters[0].id).toBe('2');
    });
  });

  describe('Applying State', () => {
    test('isApplying is initially false', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      expect(result.current.state.isApplying).toBe(false);
    });

    test('sets isApplying to true', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.setApplying(true);
      });

      expect(result.current.state.isApplying).toBe(true);
    });

    test('sets isApplying to false', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.setApplying(true);
        result.current.actions.setApplying(false);
      });

      expect(result.current.state.isApplying).toBe(false);
    });
  });

  describe('Filter Operators', () => {
    test('supports Equal operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('Equal');
    });

    test('supports NotEqual operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'NotEqual',
          value: 'deleted',
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('NotEqual');
    });

    test('supports GreaterThan operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'age',
          operator: 'GreaterThan',
          value: 18,
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('GreaterThan');
    });

    test('supports LessThan operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'price',
          operator: 'LessThan',
          value: 100,
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('LessThan');
    });

    test('supports Like operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'email',
          operator: 'Like',
          value: '*@example.com',
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('Like');
    });

    test('supports ContainsAny operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'tags',
          operator: 'ContainsAny',
          value: ['tech', 'science'],
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('ContainsAny');
    });

    test('supports ContainsAll operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'categories',
          operator: 'ContainsAll',
          value: ['featured', 'trending'],
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('ContainsAll');
    });

    test('supports IsNull operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'description',
          operator: 'IsNull',
          value: null,
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('IsNull');
    });

    test('supports IsNotNull operator', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'metadata',
          operator: 'IsNotNull',
          value: null,
        });
      });

      expect(result.current.state.activeFilters[0].operator).toBe('IsNotNull');
    });
  });

  describe('Value Types', () => {
    test('handles text value type', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'name',
          operator: 'Equal',
          value: 'John',
          valueType: 'text',
        });
      });

      expect(result.current.state.activeFilters[0].valueType).toBe('text');
    });

    test('handles number value type', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'age',
          operator: 'GreaterThan',
          value: 25,
          valueType: 'number',
        });
      });

      expect(result.current.state.activeFilters[0].valueType).toBe('number');
    });

    test('handles boolean value type', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'isActive',
          operator: 'Equal',
          value: true,
          valueType: 'boolean',
        });
      });

      expect(result.current.state.activeFilters[0].valueType).toBe('boolean');
    });

    test('handles date value type', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'createdAt',
          operator: 'GreaterThan',
          value: '2024-01-01',
          valueType: 'date',
        });
      });

      expect(result.current.state.activeFilters[0].valueType).toBe('date');
    });

    test('handles undefined value type', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'data',
          operator: 'Equal',
          value: 'test',
        });
      });

      expect(result.current.state.activeFilters[0].valueType).toBeUndefined();
    });
  });

  describe('Complex Workflows', () => {
    test('edit filter workflow - open panel, edit pending, apply', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      // Add initial filter
      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'draft',
        });
      });

      // Open panel (copies to pending)
      act(() => {
        result.current.actions.openFilterPanel();
      });

      // Edit pending filter
      act(() => {
        result.current.actions.updatePendingFilter('1', { value: 'published' });
      });

      // Apply changes
      act(() => {
        result.current.actions.applyPendingFilters();
      });

      expect(result.current.state.activeFilters[0].value).toBe('published');
      expect(result.current.state.showFilterPanel).toBe(false);
    });

    test('cancel edit workflow - open panel, edit pending, reset', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'priority',
          operator: 'Equal',
          value: 'high',
        });
        result.current.actions.openFilterPanel();
        result.current.actions.updatePendingFilter('1', { value: 'low' });
      });

      expect(result.current.state.pendingFilters[0].value).toBe('low');

      act(() => {
        result.current.actions.resetPendingFilters();
      });

      expect(result.current.state.pendingFilters[0].value).toBe('high');
      expect(result.current.state.activeFilters[0].value).toBe('high');
    });

    test('preset workflow - create filters, save preset, clear, load preset', () => {
      const { result } = renderHook(() => useFilterContext(), { wrapper });

      let presetId: string;

      act(() => {
        result.current.actions.addFilter({
          id: '1',
          path: 'status',
          operator: 'Equal',
          value: 'active',
        });
        result.current.actions.addFilter({
          id: '2',
          path: 'category',
          operator: 'Equal',
          value: 'tech',
        });
      });

      act(() => {
        result.current.actions.savePreset('Tech Active');
      });

      presetId = result.current.state.filterPresets[0].id;

      act(() => {
        result.current.actions.clearAllFilters();
      });

      expect(result.current.state.activeFilters).toHaveLength(0);

      act(() => {
        result.current.actions.loadPreset(presetId);
      });

      expect(result.current.state.activeFilters).toHaveLength(2);
      expect(result.current.state.activeFilters[0].path).toBe('status');
      expect(result.current.state.activeFilters[1].path).toBe('category');
    });
  });
});
