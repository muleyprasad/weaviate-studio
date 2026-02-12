import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileUpload } from '../FileUpload';

describe('FileUpload', () => {
  const mockOnSchemaLoaded = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with title and subtitle', () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Import Collection Schema')).toBeInTheDocument();
    expect(
      screen.getByText('Upload a JSON file or paste your collection schema')
    ).toBeInTheDocument();
  });

  it('renders browse button and textarea', () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('📁 Browse Files')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste your collection schema here/i)).toBeInTheDocument();
  });

  it('shows error for invalid JSON in textarea', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: 'invalid json' } });

    await waitFor(() => {
      // Error message includes the full JSON parse error
      expect(screen.getByText(/not valid JSON/i)).toBeInTheDocument();
    });
  });

  it('validates schema has class or name property', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: '{"properties": []}' } });

    await waitFor(() => {
      expect(
        screen.getByText(/Schema must have a "class" or "name" property/i)
      ).toBeInTheDocument();
    });
  });

  it('accepts valid schema and shows action buttons', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const validSchema = JSON.stringify({ class: 'Article', properties: [] });
    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: validSchema } });

    await waitFor(() => {
      expect(screen.getByText(/Valid schema loaded: Article/i)).toBeInTheDocument();
      expect(screen.getByText('Edit Before Creating')).toBeInTheDocument();
      expect(screen.getByText('Create Directly')).toBeInTheDocument();
    });
  });

  it('calls onSchemaLoaded with "edit" action when clicking Edit Before Creating', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const validSchema = { class: 'Article', properties: [] };
    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: JSON.stringify(validSchema) } });

    await waitFor(() => {
      expect(screen.getByText('Edit Before Creating')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit Before Creating');
    fireEvent.click(editButton);

    expect(mockOnSchemaLoaded).toHaveBeenCalledWith(validSchema, 'edit');
  });

  it('calls onSchemaLoaded with "create" action when clicking Create Directly', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const validSchema = { class: 'Article', properties: [] };
    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: JSON.stringify(validSchema) } });

    await waitFor(() => {
      expect(screen.getByText('Create Directly')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create Directly');
    fireEvent.click(createButton);

    expect(mockOnSchemaLoaded).toHaveBeenCalledWith(validSchema, 'create');
  });

  it('calls onBack when clicking Back button', () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking Cancel button', () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('accepts schema with "name" property instead of "class"', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const validSchema = JSON.stringify({ name: 'Article', properties: [] });
    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);
    fireEvent.change(textarea, { target: { value: validSchema } });

    await waitFor(() => {
      expect(screen.getByText(/Valid schema loaded: Article/i)).toBeInTheDocument();
    });
  });

  it('clears previous validation when textarea is cleared', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const textarea = screen.getByPlaceholderText(/Paste your collection schema here/i);

    // Add valid schema
    fireEvent.change(textarea, { target: { value: '{"class": "Article"}' } });
    await waitFor(() => {
      expect(screen.getByText(/Valid schema loaded/i)).toBeInTheDocument();
    });

    // Clear textarea
    fireEvent.change(textarea, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText(/Valid schema loaded/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Edit Before Creating')).not.toBeInTheDocument();
    });
  });

  it('handles file upload with valid JSON file', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const validSchema = { class: 'Article', properties: [] };
    const file = new File([JSON.stringify(validSchema)], 'schema.json', {
      type: 'application/json',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
      result: JSON.stringify(validSchema),
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Simulate FileReader load event
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: JSON.stringify(validSchema) } } as any);
    }

    await waitFor(() => {
      expect(screen.getByText(/Valid schema loaded: Article/i)).toBeInTheDocument();
    });
  });

  it('shows error for non-JSON file upload', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const file = new File(['some content'], 'schema.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Please select a JSON file/i)).toBeInTheDocument();
    });
  });

  it('disables buttons while loading', async () => {
    render(
      <FileUpload onSchemaLoaded={mockOnSchemaLoaded} onBack={mockOnBack} onCancel={mockOnCancel} />
    );

    const file = new File([JSON.stringify({ class: 'Article' })], 'schema.json', {
      type: 'application/json',
    });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
      result: '',
    };

    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // During loading, buttons should be disabled
    await waitFor(() => {
      const backButton = screen.getByText('Back');
      const cancelButton = screen.getByText('Cancel');
      expect(backButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });
  });
});
