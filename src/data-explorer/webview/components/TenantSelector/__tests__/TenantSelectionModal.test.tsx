import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantSelectionModal } from '../TenantSelectionModal';
import { useDataState, useDataActions } from '../../../context';

jest.mock('../../../context', () => ({
  useDataState: jest.fn(),
  useDataActions: jest.fn(),
}));

const mockPostMessage = jest.fn();
jest.mock('../../../utils/vscodeApi', () => ({
  getVSCodeAPI: () => ({ postMessage: mockPostMessage }),
}));

const mockSetLoading = jest.fn();

const TENANTS = [
  { name: 'TenantAlpha', activityStatus: 'ACTIVE' },
  { name: 'TenantBeta', activityStatus: 'COLD' },
  { name: 'TenantGamma', activityStatus: 'ACTIVE' },
];

function setup(stateOverrides: Record<string, unknown> = {}) {
  (useDataState as jest.Mock).mockReturnValue({
    isMultiTenant: true,
    availableTenants: TENANTS,
    selectedTenant: null,
    loading: false,
    ...stateOverrides,
  });
  (useDataActions as jest.Mock).mockReturnValue({ setLoading: mockSetLoading });
  return render(<TenantSelectionModal />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Visibility guards
// ---------------------------------------------------------------------------

describe('visibility', () => {
  it('does not render when isMultiTenant is false', () => {
    setup({ isMultiTenant: false });
    expect(screen.queryByText('Select Tenant')).toBeNull();
  });

  it('does not render when availableTenants is empty', () => {
    setup({ availableTenants: [] });
    expect(screen.queryByText('Select Tenant')).toBeNull();
  });

  it('does not render when a tenant is already selected', () => {
    setup({ selectedTenant: 'TenantAlpha' });
    expect(screen.queryByText('Select Tenant')).toBeNull();
  });

  it('renders when conditions are met', () => {
    setup();
    expect(screen.getByText('Select Tenant')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tenant list rendering
// ---------------------------------------------------------------------------

describe('tenant list', () => {
  it('renders all tenants', () => {
    setup();
    TENANTS.forEach(({ name }) => {
      expect(screen.getByText(name)).toBeTruthy();
    });
  });

  it('renders activity status badges', () => {
    setup();
    // ACTIVE appears for TenantAlpha and TenantGamma, COLD for TenantBeta
    expect(screen.getAllByText('ACTIVE')).toHaveLength(2);
    expect(screen.getByText('COLD')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

describe('search', () => {
  it('filters tenants by name (case-insensitive)', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Search by name or status...'), {
      target: { value: 'alpha' },
    });
    expect(screen.getByText('TenantAlpha')).toBeTruthy();
    expect(screen.queryByText('TenantBeta')).toBeNull();
    expect(screen.queryByText('TenantGamma')).toBeNull();
  });

  it('filters tenants by status (case-insensitive)', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Search by name or status...'), {
      target: { value: 'cold' },
    });
    expect(screen.getByText('TenantBeta')).toBeTruthy();
    expect(screen.queryByText('TenantAlpha')).toBeNull();
    expect(screen.queryByText('TenantGamma')).toBeNull();
  });

  it('shows all tenants when search is cleared', () => {
    setup();
    const input = screen.getByPlaceholderText('Search by name or status...');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.change(input, { target: { value: '' } });
    TENANTS.forEach(({ name }) => {
      expect(screen.getByText(name)).toBeTruthy();
    });
  });

  it('shows "no results" message when no tenants match', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Search by name or status...'), {
      target: { value: 'zzz-no-match' },
    });
    expect(screen.getByText('No tenants match your search.')).toBeTruthy();
  });

  it('hides "no results" message when tenants match', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Search by name or status...'), {
      target: { value: 'TenantAlpha' },
    });
    expect(screen.queryByText('No tenants match your search.')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection behaviour
// ---------------------------------------------------------------------------

describe('selection', () => {
  it('"Load Tenant Data" button is disabled when no tenant is selected', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Load Tenant Data' })).toBeDisabled();
  });

  it('clicking a tenant enables the "Load Tenant Data" button', () => {
    setup();
    fireEvent.click(screen.getByText('TenantAlpha'));
    expect(screen.getByRole('button', { name: 'Load Tenant Data' })).not.toBeDisabled();
  });

  it('clicking "Load Tenant Data" posts setTenant with the selected tenant', () => {
    setup();
    fireEvent.click(screen.getByText('TenantAlpha'));
    fireEvent.click(screen.getByRole('button', { name: 'Load Tenant Data' }));

    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'setTenant', tenant: 'TenantAlpha' });
  });

  it('double-clicking a tenant posts setTenant immediately without needing the button', () => {
    setup();
    fireEvent.doubleClick(screen.getByText('TenantBeta'));

    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'setTenant', tenant: 'TenantBeta' });
  });
});

// ---------------------------------------------------------------------------
// Refresh button
// ---------------------------------------------------------------------------

describe('refresh button', () => {
  it('renders a refresh button', () => {
    setup();
    expect(screen.getByTitle('Refresh tenant list')).toBeTruthy();
  });

  it('clicking refresh posts getTenants and sets loading', () => {
    setup();
    fireEvent.click(screen.getByTitle('Refresh tenant list'));

    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getTenants' });
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

describe('keyboard navigation', () => {
  it('pressing Enter on a tenant item posts setTenant immediately', () => {
    setup();
    const item = screen.getByText('TenantAlpha').closest('[role="button"]')!;
    fireEvent.keyDown(item, { key: 'Enter' });

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'setTenant', tenant: 'TenantAlpha' });
  });

  it('pressing Space on a tenant item selects it (single-click behaviour)', () => {
    setup();
    const item = screen.getByText('TenantAlpha').closest('[role="button"]')!;
    fireEvent.keyDown(item, { key: ' ' });

    // Space only selects, does not immediately post
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Load Tenant Data' })).not.toBeDisabled();
  });
});
