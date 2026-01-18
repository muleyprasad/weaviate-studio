# Data Explorer UI Redesign Plan

## Problem Statement

After 6 phases of rapid development, the Data Explorer UI has become cluttered with features stacked vertically, making the primary task (browsing data) difficult. Users must scroll past Schema Visualizer, Quick Insights, Filters, and Vector Search panels before seeing their data.

## Current Layout (Problematic)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Collection Name + Object Count                       │
│ [Export] [Vector Search Toggle]                              │
├─────────────────────────────────────────────────────────────┤
│ Schema Visualizer (always visible, ~150px height)           │
├─────────────────────────────────────────────────────────────┤
│ Quick Insights Panel (always visible, ~200px height)        │
├─────────────────────────────────────────────────────────────┤
│ Filter Builder (~100px height when empty)                   │
├─────────────────────────────────────────────────────────────┤
│ Vector Search Panel (when active, ~300px height)            │
├─────────────────────────────────────────────────────────────┤
│ Data Table (pushed far down, requires scrolling)            │
├─────────────────────────────────────────────────────────────┤
│ Pagination                                                   │
└─────────────────────────────────────────────────────────────┘
```

## Proposed Layout (Redesigned)

A clean, data-first layout with collapsible panels and a sidebar approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: Collection Name [Object Count badge]                         │
│ Toolbar: [🔍 Filter] [🔮 Vector Search] [📊 Insights] [📋 Schema] [📤 Export] [⟳ Refresh]
├────────────────────────────────────────────┬────────────────────────┤
│                                            │                        │
│  MAIN CONTENT (Data Table)                 │  RIGHT SIDEBAR         │
│  - Full height, primary focus              │  (Collapsible 320px)   │
│  - Data Table with all columns             │                        │
│                                            │  • Object Detail Panel │
│                                            │  • Schema Preview      │
│                                            │  • (Context-sensitive) │
│                                            │                        │
├────────────────────────────────────────────┴────────────────────────┤
│ Pagination: [< Prev] Page 1 of 45 [Next >]    [10 ▾] per page      │
└─────────────────────────────────────────────────────────────────────┘

When Filter Panel is Active (Slide-down):
┌─────────────────────────────────────────────────────────────────────┐
│ FILTER PANEL (Collapsible, max 200px)                               │
│ [Property ▾] [Operator ▾] [Value] [× Remove]                        │
│ [+ Add Filter]                        [Clear All] [Apply Filters]   │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

1. **Data-First**: Data table should be immediately visible without scrolling
2. **Progressive Disclosure**: Show tools only when needed
3. **Collapsible Panels**: All secondary panels should collapse
4. **Consistent Actions**: Toolbar with icon+text buttons for all actions
5. **Context-Sensitive Sidebar**: Right sidebar shows relevant info based on selection
6. **Visual Hierarchy**: Clear distinction between primary (data) and secondary (tools) areas

---

## Implementation Tasks

### Phase A: Core Layout Restructure ✅ COMPLETED

#### Task A1: Update DataExplorer.tsx Component Structure ✅

**Status: COMPLETED**

- Added `panels` state with `showFilters`, `showInsights`, `showSchema` toggles
- Added new reducer actions: `TOGGLE_FILTERS_PANEL`, `TOGGLE_INSIGHTS_PANEL`, `TOGGLE_SCHEMA_PANEL`
- Restructured JSX with new layout using `<main>` and `<aside>` elements
- All panels now use CollapsePanel wrapper

#### Task A2: Create Toolbar Component ✅

**Status: COMPLETED**

Created `src/data-explorer/webview/components/Toolbar.tsx`:

- Icon + text buttons with active state indicators
- Keyboard shortcut tooltips
- Buttons for: Filters, Vector Search, Insights, Schema, Export, Refresh

#### Task A3: Create CollapsePanel Component ✅

**Status: COMPLETED**

Created `src/data-explorer/webview/components/CollapsePanel.tsx`:

- Collapsible panel wrapper with header and close button
- Max-height constraint (configurable per panel)
- Visual hierarchy with panel-specific styling

#### Task A4: Update styles.css Layout ✅

**Status: COMPLETED**

Added ~290 lines of new CSS:

- Redesigned header with toolbar layout
- Object count badge styling
- Toolbar button styles with active states
- Active filters bar
- Collapsible panel styles
- Main content area with sidebar
- Responsive adjustments for smaller viewports
  {/_ Collapsible panels (slide-down) _/}
  <CollapsePanel isOpen={showFilters}>
  <FilterBuilder />
  </CollapsePanel>
    <CollapsePanel isOpen={showVectorSearch}>
      <VectorSearchPanel />
    </CollapsePanel>
    
    <CollapsePanel isOpen={showInsights}>
      <QuickInsightsPanel />
    </CollapsePanel>
    
    {/* Main content area with optional sidebar */}
    <main className="explorer-main">
      <div className="explorer-content">
        <DataTable /> or <EmptyState />
        <Pagination />
      </div>
      
      {/* Right sidebar for details/schema */}
      {(showDetailPanel || showSchema) && (
        <aside className="explorer-sidebar">
          {showDetailPanel && <ObjectDetailPanel />}
          {showSchema && <SchemaVisualizer />}
        </aside>
      )}
    </main>
    
    {/* Dialogs */}
    <ExportDialog />
  </div>

````

#### Task A2: Create Toolbar Component
**Priority: Critical**

New component: `src/data-explorer/webview/components/Toolbar.tsx`

Features:
- Icon + text buttons for: Filters, Vector Search, Insights, Schema, Export, Refresh
- Toggle state indicators (active buttons highlighted)
- Keyboard shortcuts shown in tooltips
- Compact design that doesn't take excessive space

#### Task A3: Create CollapsePanel Component
**Priority: Critical**

New component: `src/data-explorer/webview/components/CollapsePanel.tsx`

Features:
- Smooth slide-down animation
- Max-height constraint (configurable)
- Close button in header
- Title and icon

#### Task A4: Update styles.css Layout
**Priority: Critical**

Key CSS changes:
- `.data-explorer`: Flex column layout, no overflow
- `.explorer-main`: Flex row, takes remaining height
- `.explorer-content`: Flex-grow, overflow-y auto
- `.explorer-sidebar`: Fixed 320px width, collapsible
- Collapsible panels: Max-height with overflow

---

### Phase B: Panel State Management

#### Task B1: Add Toggle States to Reducer
**Priority: High**

New state properties:
```typescript
interface DataExplorerState {
  // ...existing...
  ui: {
    showFilters: boolean;
    showVectorSearch: boolean; // Rename from vectorSearch.isActive
    showInsights: boolean;
    showSchema: boolean;
    sidebarMode: 'detail' | 'schema' | null;
  }
}
````

New actions:

- `TOGGLE_FILTERS`
- `TOGGLE_INSIGHTS`
- `TOGGLE_SCHEMA`
- `SET_SIDEBAR_MODE`

#### Task B2: Update Toolbar to Dispatch Toggle Actions

**Priority: High**

Wire up toolbar buttons to dispatch toggle actions.

---

### Phase C: Component Updates

#### Task C1: Make SchemaVisualizer Compact

**Priority: Medium**

Current: Full expanded view always shown
New:

- Sidebar mode: Compact list of properties
- Expand/collapse individual properties
- Max-height with scroll

#### Task C2: Make QuickInsightsPanel Compact

**Priority: Medium**

Current: Full expanded view with all statistics
New:

- Collapsible panel that slides down
- Summary view (total count + key stats)
- Expandable sections for details

#### Task C3: Make FilterBuilder More Compact

**Priority: Medium**

Current: Takes full width with long inputs
New:

- Horizontal layout for simple filters
- Active filter chips below
- Collapsible advanced filter groups

#### Task C4: Improve Data Table Styling

**Priority: Medium**

- Better cell padding
- Improved column header styling
- Sticky header on scroll
- Better empty state

---

### Phase D: Visual Polish

#### Task D1: Modernize Button Styles

**Priority: Low**

- Consistent icon + text pattern
- Hover/active states
- Focus outlines for accessibility

#### Task D2: Add Subtle Animations

**Priority: Low**

- Panel slide animations (reduced motion aware)
- Button hover effects
- Loading transitions

#### Task D3: Improve Typography & Spacing

**Priority: Low**

- Consistent heading hierarchy
- Better whitespace usage
- Improved information density

---

## Implementation Order

1. **Phase A (Critical)**: Layout restructure - this is the core fix
2. **Phase B (High)**: State management for toggles
3. **Phase C (Medium)**: Component compactness updates
4. **Phase D (Low)**: Visual polish

## Success Criteria

1. ✅ Data table is visible without scrolling on page load
2. ✅ All panels are collapsible/toggleable
3. ✅ Toolbar provides clear access to all features
4. ✅ Sidebar shows context-sensitive information
5. ✅ No functionality is lost from the redesign
6. ✅ All existing keyboard shortcuts still work
7. ✅ Accessibility (WCAG 2.1 Level A) maintained

---

## Files to Modify

### Critical Files:

1. `src/data-explorer/webview/DataExplorer.tsx` - Main component restructure
2. `src/data-explorer/webview/styles.css` - Layout CSS overhaul
3. `src/data-explorer/types/index.ts` - Add UI state types

### New Files:

1. `src/data-explorer/webview/components/Toolbar.tsx` - New toolbar component
2. `src/data-explorer/webview/components/CollapsePanel.tsx` - Collapsible panel wrapper

### Files to Update:

1. `src/data-explorer/webview/components/Schema/SchemaVisualizer.tsx` - Make compact
2. `src/data-explorer/webview/components/Insights/QuickInsightsPanel.tsx` - Make collapsible
3. `src/data-explorer/webview/components/Filters/FilterBuilder.tsx` - Make compact
4. `src/data-explorer/webview/components/DataBrowser/DataTable.tsx` - Improve styling

---

## Estimated Effort

- Phase A: 4-6 hours
- Phase B: 1-2 hours
- Phase C: 3-4 hours
- Phase D: 2-3 hours

**Total: 10-15 hours**

---

_Created: 2026-01-17_
_Last Updated: 2026-01-17_
