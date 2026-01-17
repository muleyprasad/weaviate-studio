# Phase 6: Polish & Performance - Implementation Plan

**Goal:** Production-ready quality
**Status:** Planning

---

## Phase 6 Deliverables (from spec)

1. Virtual scrolling for large datasets
2. Loading skeletons
3. Error boundaries
4. Comprehensive error handling
5. Performance optimizations (memoization, debouncing)
6. User preferences persistence
7. Keyboard shortcuts
8. Accessibility (ARIA labels, keyboard navigation)

## Success Criteria

- ✅ Can handle 10,000+ object result sets smoothly
- ✅ All error cases handled gracefully
- ✅ Meets WCAG 2.1 Level A accessibility
- ✅ User preferences saved between sessions

---

## Current State Analysis

### ✅ Already Implemented

#### User Preferences Persistence (Partial)
**Location:** `src/data-explorer/webview/DataExplorer.tsx:594-610`

**Saved preferences:**
- ✅ Visible columns
- ✅ Pinned columns
- ✅ Page size
- ✅ Sort configuration
- ✅ Active filters

**Missing:**
- ❌ Insights panel configuration
- ❌ Filter templates
- ❌ Schema visualizer expansion state
- ❌ Panel visibility toggles (if we add them)

#### Basic Loading Skeletons
**Location:** `src/data-explorer/webview/DataExplorer.tsx:705-709`

**Current:**
```tsx
<div className="loading-skeleton">
  <div className="skeleton-row"></div>
  <div className="skeleton-row"></div>
  <div className="skeleton-row"></div>
</div>
```

**Needs enhancement:**
- More realistic table skeleton
- Skeletons for all major components
- Smooth transitions

#### Basic Accessibility
**Current ARIA labels:**
- ✅ Screen reader announcements (aria-live)
- ✅ Button labels
- ✅ Error dismissal
- ✅ Panel expansion states

**Missing:**
- ❌ Table navigation ARIA roles
- ❌ Form field labels
- ❌ Keyboard navigation
- ❌ Focus management
- ❌ Keyboard shortcuts

#### Basic Error Handling
**Location:** `src/data-explorer/webview/DataExplorer.tsx:640-652`

**Current:**
- ✅ Global error banner
- ✅ Error state management
- ✅ Per-feature error states (insights, export, vector search)

**Missing:**
- ❌ Error boundaries for component crashes
- ❌ Retry mechanisms
- ❌ Connection error handling
- ❌ Query timeout handling
- ❌ Empty state handling with helpful messages

### ❌ Not Yet Implemented

1. **Virtual scrolling** - Need to implement
2. **Performance optimizations** - Need debouncing, memoization
3. **Keyboard shortcuts** - Need global shortcut handler
4. **Error boundaries** - Need React error boundaries
5. **Comprehensive error scenarios** - Need all error cases covered

---

## Implementation Plan

### Task 1: Virtual Scrolling for Large Datasets

**Priority:** HIGH
**Estimated effort:** Medium
**Dependencies:** None

**Approach:**
- Use `react-window` or implement custom virtualization
- Apply to DataTable component
- Render only visible rows (~50 at a time)
- Maintain scroll position on updates

**Files to modify:**
- `src/data-explorer/webview/components/DataBrowser/DataTable.tsx`

**Success metric:** Smooth scrolling with 10,000+ rows

---

### Task 2: Comprehensive Loading Skeletons

**Priority:** MEDIUM
**Estimated effort:** Low
**Dependencies:** None

**Components needing skeletons:**
1. DataTable - realistic table skeleton with columns
2. FilterBuilder - skeleton for filter rules
3. VectorSearchPanel - skeleton for search config
4. QuickInsightsPanel - skeleton for aggregations
5. SchemaVisualizer - skeleton for properties list
6. ObjectDetailPanel - skeleton for property details

**Files to modify:**
- Each component file
- `src/data-explorer/webview/styles.css` (skeleton styles)

**Success metric:** All loading states show appropriate skeletons

---

### Task 3: Error Boundaries

**Priority:** HIGH
**Estimated effort:** Low
**Dependencies:** None

**Implementation:**
- Create `ErrorBoundary` component
- Wrap major features (DataTable, Filters, VectorSearch, etc.)
- Show friendly error UI with recovery options
- Log errors to console for debugging

**Files to create:**
- `src/data-explorer/webview/components/ErrorBoundary.tsx`

**Files to modify:**
- `src/data-explorer/webview/DataExplorer.tsx` (wrap components)

**Success metric:** Component crashes don't break entire UI

---

### Task 4: Comprehensive Error Handling

**Priority:** HIGH
**Estimated effort:** Medium
**Dependencies:** None

**Error scenarios to handle:**

1. **Connection Errors**
   - Show error banner with retry button
   - Link to connection settings
   - Preserve user state

2. **Query Errors**
   - Inline errors near problematic filters
   - Plain language explanations
   - Suggest fixes

3. **Empty States**
   - "No objects match your filters"
   - Suggest removing filters
   - Show active filters
   - "Create first object" for empty collections

4. **Missing Features**
   - Disable vector search if no vectorizer
   - Show info message with docs link

5. **Timeout Errors**
   - Detect long-running queries
   - Show progress indicator
   - Allow cancellation

**Files to modify:**
- All component files
- `src/data-explorer/types/index.ts` (error types)
- `src/data-explorer/webview/DataExplorer.tsx` (error handling)

**Success metric:** All error scenarios handled gracefully

---

### Task 5: Performance Optimizations

**Priority:** HIGH
**Estimated effort:** Medium
**Dependencies:** None

**Optimizations needed:**

1. **Debouncing**
   - Filter input: 300ms debounce before query
   - Search input: 300ms debounce
   - Pagination: Immediate (no debounce)

2. **Memoization**
   - Use `useMemo` for expensive calculations
   - Use `useCallback` for stable function references
   - Memoize filter transformations
   - Memoize data table rows

3. **Query Cancellation**
   - Cancel pending requests when new query starts
   - Use AbortController

4. **Caching**
   - Cache recent query results (LRU cache)
   - Cache schema and metadata (5-minute TTL)

**Files to create:**
- `src/data-explorer/utils/debounce.ts`
- `src/data-explorer/utils/cache.ts`

**Files to modify:**
- All component files (add memoization)
- `src/data-explorer/webview/DataExplorer.tsx` (debouncing, caching)

**Success metric:** UI responds in <100ms to user actions

---

### Task 6: Enhanced User Preferences Persistence

**Priority:** MEDIUM
**Estimated effort:** Low
**Dependencies:** None

**Additional preferences to save:**
1. Insights panel configuration
2. Filter templates (already in state)
3. Schema visualizer expansion state
4. Panel visibility states

**Files to modify:**
- `src/data-explorer/webview/DataExplorer.tsx` (save more preferences)
- `src/data-explorer/types/index.ts` (preference types)

**Success metric:** All user customizations persist between sessions

---

### Task 7: Keyboard Shortcuts

**Priority:** MEDIUM
**Estimated effort:** Medium
**Dependencies:** None

**Shortcuts to implement:**
- `Tab`: Navigate between elements
- `Enter`: Activate buttons, open details
- `Space`: Toggle checkboxes, expand/collapse
- `Escape`: Close modals, clear selection
- `Arrow Keys`: Navigate table cells
- `Ctrl+F`: Focus quick search
- `Ctrl+E`: Open export dialog
- `Ctrl+R`: Refresh data

**Files to create:**
- `src/data-explorer/webview/hooks/useKeyboardShortcuts.ts`

**Files to modify:**
- `src/data-explorer/webview/DataExplorer.tsx` (global shortcuts)
- Component files (local shortcuts)

**Success metric:** All listed shortcuts work correctly

---

### Task 8: Enhanced Accessibility

**Priority:** MEDIUM
**Estimated effort:** Medium
**Dependencies:** None

**Improvements needed:**

1. **Keyboard Navigation**
   - Full keyboard support for all controls
   - Proper focus management
   - Skip links for screen readers

2. **ARIA Labels**
   - Table headers with proper roles
   - Form fields with labels
   - Status messages announced
   - Loading states announced

3. **Visual**
   - Focus indicators on all interactive elements
   - High contrast support
   - Respect VS Code theme
   - 4.5:1 contrast ratio minimum

**Files to modify:**
- All component files (ARIA attributes)
- `src/data-explorer/webview/styles.css` (focus styles)

**Success metric:** Passes WCAG 2.1 Level A

---

## Implementation Order (Recommended)

### Week 1: Core Performance & Stability
1. ✅ Error Boundaries (Day 1)
2. ✅ Comprehensive Error Handling (Days 2-3)
3. ✅ Performance Optimizations - Debouncing (Day 4)
4. ✅ Performance Optimizations - Memoization (Day 5)

### Week 2: UX Polish
5. ✅ Loading Skeletons (Days 1-2)
6. ✅ Virtual Scrolling (Days 3-4)
7. ✅ Enhanced Preferences Persistence (Day 5)

### Week 3: Accessibility
8. ✅ Keyboard Shortcuts (Days 1-2)
9. ✅ Enhanced Accessibility (Days 3-5)

---

## Testing Checklist

### Performance
- [ ] Test with 10,000+ row dataset
- [ ] Verify smooth scrolling
- [ ] Verify <100ms response time
- [ ] Test query cancellation
- [ ] Test cache effectiveness

### Error Handling
- [ ] Test connection errors
- [ ] Test query errors
- [ ] Test empty states
- [ ] Test missing vectorizer
- [ ] Test timeout scenarios
- [ ] Verify error boundaries catch crashes

### Accessibility
- [ ] Test all keyboard shortcuts
- [ ] Test screen reader navigation
- [ ] Test keyboard-only navigation
- [ ] Verify ARIA labels
- [ ] Test focus management
- [ ] Test with VS Code high contrast theme

### Preferences
- [ ] Verify all preferences save
- [ ] Verify preferences load on reopen
- [ ] Test with multiple collections

---

## Out of Scope for Phase 6

These are Phase 6 items from the code review, but not in the core spec:

- Collapsible Schema/Insights panels (UX improvement)
- Property icons in Schema Visualizer (cosmetic)
- True .xlsx export with multiple sheets (requires library)
- Custom numeric distribution buckets (Phase 5 nice-to-have)
- Visual arrows for cross-references (Phase 5 nice-to-have)

**Recommendation:** Address if time permits after core deliverables

---

## Success Metrics

At the end of Phase 6, the Data Explorer should:

1. ✅ Handle 10,000+ objects smoothly (virtual scrolling)
2. ✅ Show appropriate skeletons during all loading states
3. ✅ Handle all error scenarios gracefully with helpful messages
4. ✅ Respond to user input in <100ms (debouncing, memoization)
5. ✅ Save all user preferences between sessions
6. ✅ Support full keyboard navigation
7. ✅ Meet WCAG 2.1 Level A accessibility standards
8. ✅ Never crash the UI (error boundaries)

---

## Next Steps

1. Review and approve this plan
2. Start with Error Boundaries (quick win, high impact)
3. Follow recommended implementation order
4. Test continuously
5. Document as we go
