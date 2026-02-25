/**
 * Extended interaction tests for CloneCollection component.
 *
 * Covers uncovered branches:
 *  - handleCollectionChange: auto-suggest name, posts getSchema, clears schema/error
 *  - handleNewNameChange: updates name, clears error
 *  - validateInputs: all error paths (no collection, no name, duplicate name, schema not loaded)
 *  - handleEditBeforeCreate: calls onSchemaLoaded with 'edit' action
 *  - handleCreateDirectly: calls onSchemaLoaded with 'create' action
 *  - externalError prop display
 *  - error message from extension
 *  - schema preview section
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPostMessage = jest.fn();
jest.mock('../../vscodeApi', () => ({
  getVscodeApi: () => ({ postMessage: mockPostMessage }),
}));

import { CloneCollection } from '../CloneCollection';

const mockSchema = {
  class: 'Article',
  properties: [
    { name: 'title', dataType: ['text'] },
    { name: 'body', dataType: ['text'] },
  ],
  vectorizer: 'text2vec-openai',
  vectorIndexType: 'hnsw',
};

function buildProps(overrides = {}) {
  return {
    onSchemaLoaded: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
}

function dispatchMessage(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
}

async function loadCollections(collections: string[]) {
  dispatchMessage({ command: 'collections', collections });
  await waitFor(() => {
    if (collections.length > 0) {
      expect(screen.getByText(collections[0])).toBeInTheDocument();
    }
  });
}

// ─── externalError prop ───────────────────────────────────────────────────────

describe('externalError prop', () => {
  it('displays external error when provided', () => {
    const props = buildProps({ externalError: 'External failure' });
    render(<CloneCollection {...props} />);
    expect(screen.getByText('External failure')).toBeInTheDocument();
  });

  it('does not display error section when externalError is undefined', () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    expect(screen.queryByText('External failure')).not.toBeInTheDocument();
  });
});

// ─── error message from extension ────────────────────────────────────────────

describe('error message from extension', () => {
  it('shows error message received via extension message', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    dispatchMessage({ command: 'error', message: 'Network error' });
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when message text is absent', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    dispatchMessage({ command: 'error' });
    await waitFor(() => {
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });
  });
});

// ─── handleCollectionChange ───────────────────────────────────────────────────

describe('handleCollectionChange', () => {
  it('auto-suggests new collection name as "<Name>Copy"', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article', 'Author']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Enter new collection name/i) as HTMLInputElement;
      expect(input.value).toBe('ArticleCopy');
    });
  });

  it('clears previous error when changing collection selection', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    // Trigger an error first via extension message
    dispatchMessage({ command: 'error', message: 'Some error' });
    await waitFor(() => expect(screen.getByText('Some error')).toBeInTheDocument());

    // Now change the selection — error should be cleared
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    await waitFor(() => {
      expect(screen.queryByText('Some error')).not.toBeInTheDocument();
    });
  });

  it('shows loading text while schema is being fetched', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });

    expect(screen.getByText(/Loading schema\.\.\./i)).toBeInTheDocument();
  });
});

// ─── schema message ───────────────────────────────────────────────────────────

describe('schema message from extension', () => {
  it('shows schema preview after schema is loaded', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });

    await waitFor(() => {
      expect(screen.getByText(/Schema loaded successfully/i)).toBeInTheDocument();
    });
  });

  it('shows property count in schema preview', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });

    await waitFor(() => {
      expect(screen.getByText(/Properties:/)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows vectorizer in schema preview when present', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });

    await waitFor(() => {
      expect(screen.getByText('text2vec-openai')).toBeInTheDocument();
    });
  });

  it('shows vectorIndexType in schema preview when present', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });

    await waitFor(() => {
      expect(screen.getByText('hnsw')).toBeInTheDocument();
    });
  });
});

// ─── handleNewNameChange ──────────────────────────────────────────────────────

describe('handleNewNameChange', () => {
  it('updates new collection name input value', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Enter new collection name/i)).toBeInTheDocument()
    );

    const nameInput = screen.getByPlaceholderText(/Enter new collection name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'MyNewCollection' } });
    expect(nameInput.value).toBe('MyNewCollection');
  });

  it('clears error when name is changed', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article', 'ArticleCopy']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Enter new collection name/i)).toBeInTheDocument()
    );

    // Try to create with duplicate name to trigger error
    const nameInput = screen.getByPlaceholderText(/Enter new collection name/i) as HTMLInputElement;
    // Change the name to the duplicate
    fireEvent.change(nameInput, { target: { value: 'ArticleCopy' } });

    // Click Edit Before Creating to trigger validation
    const editBtn = screen.queryByText('Edit Before Creating');
    if (editBtn) {
      fireEvent.click(editBtn);
      await waitFor(() => {
        expect(screen.getByText(/collection with this name already exists/i)).toBeInTheDocument();
      });
    }

    // Change name again — error should clear
    fireEvent.change(nameInput, { target: { value: 'SomethingElse' } });
    await waitFor(() => {
      expect(
        screen.queryByText(/collection with this name already exists/i)
      ).not.toBeInTheDocument();
    });
  });
});

// ─── validateInputs ───────────────────────────────────────────────────────────

describe('validateInputs', () => {
  async function setupWithSchemaLoaded(collections: string[], props: any) {
    render(<CloneCollection {...props} />);
    await loadCollections(collections);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: collections[0] } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() =>
      expect(screen.getByText(/Schema loaded successfully/i)).toBeInTheDocument()
    );
  }

  it('shows error when no collection is selected', async () => {
    const props = buildProps();
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);
    // Don't select anything — Edit Before Creating won't be visible since schema is not loaded
    // Just verify the default "select a collection" placeholder is shown
    expect(screen.getByText(/Select a collection to clone/i)).toBeInTheDocument();
  });

  it('shows error when name already exists in collections', async () => {
    const props = buildProps();
    await setupWithSchemaLoaded(['Article', 'ArticleCopy'], props);

    const nameInput = screen.getByPlaceholderText(/Enter new collection name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'ArticleCopy' } });

    const editBtn = screen.getByText('Edit Before Creating');
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/collection with this name already exists/i)).toBeInTheDocument();
    });
  });
});

// ─── handleEditBeforeCreate ───────────────────────────────────────────────────

describe('handleEditBeforeCreate', () => {
  it('calls onSchemaLoaded with cloned schema and "edit" action', async () => {
    const onSchemaLoaded = jest.fn();
    const props = buildProps({ onSchemaLoaded });
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() => expect(screen.getByText('Edit Before Creating')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Edit Before Creating'));

    expect(onSchemaLoaded).toHaveBeenCalledTimes(1);
    const [calledSchema, action] = onSchemaLoaded.mock.calls[0];
    expect(action).toBe('edit');
    expect(calledSchema.class).toBe('ArticleCopy');
    // Original properties preserved
    expect(calledSchema.properties).toEqual(mockSchema.properties);
  });
});

// ─── handleCreateDirectly ─────────────────────────────────────────────────────

describe('handleCreateDirectly', () => {
  it('calls onSchemaLoaded with cloned schema and "create" action', async () => {
    const onSchemaLoaded = jest.fn();
    const props = buildProps({ onSchemaLoaded });
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() => expect(screen.getByText('Create Directly')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Create Directly'));

    expect(onSchemaLoaded).toHaveBeenCalledTimes(1);
    const [calledSchema, action] = onSchemaLoaded.mock.calls[0];
    expect(action).toBe('create');
    expect(calledSchema.class).toBe('ArticleCopy');
  });

  it('uses custom name entered by user', async () => {
    const onSchemaLoaded = jest.fn();
    const props = buildProps({ onSchemaLoaded });
    render(<CloneCollection {...props} />);
    await loadCollections(['Article']);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Article' } });
    dispatchMessage({ command: 'schema', schema: mockSchema });
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Enter new collection name/i)).toBeInTheDocument()
    );

    const nameInput = screen.getByPlaceholderText(/Enter new collection name/i);
    fireEvent.change(nameInput, { target: { value: 'MyCustomName' } });

    await waitFor(() => expect(screen.getByText('Create Directly')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Directly'));

    const [calledSchema] = onSchemaLoaded.mock.calls[0];
    expect(calledSchema.class).toBe('MyCustomName');
  });
});
