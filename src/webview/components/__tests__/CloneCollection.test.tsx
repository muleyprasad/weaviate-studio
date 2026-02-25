import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the vscodeApi module BEFORE importing CloneCollection
const mockPostMessage = jest.fn();
jest.mock('../../vscodeApi', () => ({
  getVscodeApi: () => ({
    postMessage: mockPostMessage,
  }),
}));

// Now import CloneCollection after the mock is set up
import { CloneCollection } from '../CloneCollection';

describe('CloneCollection', () => {
  const mockOnSchemaLoaded = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockPostMessage.mockClear();
    mockOnSchemaLoaded.mockClear();
    mockOnBack.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders the component with title and subtitle', () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Clone Existing Collection')).toBeInTheDocument();
    expect(
      screen.getByText("Create a new collection based on an existing collection's schema")
    ).toBeInTheDocument();
  });

  it('requests collections list on mount', () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getCollections' });
  });

  it('shows loading state initially', () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });

  it('displays collections when received', async () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    // Simulate receiving collections message
    await act(async () => {
      const messageEvent = new MessageEvent('message', {
        data: {
          command: 'collections',
          collections: ['Article', 'Author', 'Category'],
        },
      });
      window.dispatchEvent(messageEvent);
    });

    await waitFor(() => {
      expect(screen.getByText('Article')).toBeInTheDocument();
      expect(screen.getByText('Author')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });

  it('shows info message when no collections available', async () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    // Simulate receiving empty collections
    await act(async () => {
      const messageEvent = new MessageEvent('message', {
        data: {
          command: 'collections',
          collections: [],
        },
      });
      window.dispatchEvent(messageEvent);
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          /No collections found. Create a collection first before you can clone one./i
        )
      ).toBeInTheDocument();
    });
  });

  it('requests schema when a collection is selected', async () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    // Simulate receiving collections
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'collections',
            collections: ['Article', 'Author'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Article')).toBeInTheDocument();
    });

    // Clear previous calls
    mockPostMessage.mockClear();

    // Select a collection
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Article' } });

    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'getSchema',
      collectionName: 'Article',
    });
  });

  it('calls onBack when clicking Back button', () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking Cancel button', () => {
    render(
      <CloneCollection
        onSchemaLoaded={mockOnSchemaLoaded}
        onBack={mockOnBack}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
