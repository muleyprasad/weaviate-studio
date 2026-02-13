import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectCreateMode } from '../SelectCreateMode';

describe('SelectCreateMode', () => {
  const mockOnSelectMode = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with title and subtitle', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Create Collection')).toBeInTheDocument();
    expect(
      screen.getByText('Choose how you want to create your new collection')
    ).toBeInTheDocument();
  });

  it('renders all three creation mode options', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('From Scratch')).toBeInTheDocument();
    expect(screen.getByText('Clone Existing Collection')).toBeInTheDocument();
    expect(screen.getByText('Import from File')).toBeInTheDocument();
  });

  it('calls onSelectMode with "fromScratch" when clicking From Scratch option', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const fromScratchCard = screen.getByText('From Scratch').closest('.option-card');
    fireEvent.click(fromScratchCard!);

    expect(mockOnSelectMode).toHaveBeenCalledWith('fromScratch');
    expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectMode with "cloneExisting" when clicking Clone option', () => {
    render(
      <SelectCreateMode
        hasCollections={true}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const cloneCard = screen.getByText('Clone Existing Collection').closest('.option-card');
    fireEvent.click(cloneCard!);

    expect(mockOnSelectMode).toHaveBeenCalledWith('cloneExisting');
    expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectMode with "importFromFile" when clicking Import option', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const importCard = screen.getByText('Import from File').closest('.option-card');
    fireEvent.click(importCard!);

    expect(mockOnSelectMode).toHaveBeenCalledWith('importFromFile');
    expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard interaction with Enter key on From Scratch option', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const fromScratchCard = screen.getByText('From Scratch').closest('.option-card');
    fireEvent.keyPress(fromScratchCard!, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockOnSelectMode).toHaveBeenCalledWith('fromScratch');
  });

  it('renders options with proper accessibility attributes', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const options = screen.getAllByRole('button');

    // Should have 3 buttons total (3 options)
    expect(options).toHaveLength(3);

    // Check that option cards have tabIndex
    const fromScratchCard = screen.getByText('From Scratch').closest('.option-card');
    expect(fromScratchCard).toHaveAttribute('tabindex', '0');
  });

  it('displays all options regardless of hasCollections prop', () => {
    const { rerender } = render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Clone Existing Collection')).toBeInTheDocument();

    rerender(
      <SelectCreateMode
        hasCollections={true}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Clone Existing Collection')).toBeInTheDocument();
  });

  it('disables clone option when hasCollections is false', () => {
    render(
      <SelectCreateMode
        hasCollections={false}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const cloneCard = screen.getByText('Clone Existing Collection').closest('.option-card');

    // Should have disabled class
    expect(cloneCard).toHaveClass('option-card-disabled');

    // Should have aria-disabled
    expect(cloneCard).toHaveAttribute('aria-disabled', 'true');

    // Should have tabindex -1
    expect(cloneCard).toHaveAttribute('tabindex', '-1');

    // Should not call onSelectMode when clicked
    fireEvent.click(cloneCard!);
    expect(mockOnSelectMode).not.toHaveBeenCalled();

    // Should show appropriate message
    expect(screen.getByText(/No collections available to clone/i)).toBeInTheDocument();
  });

  it('enables clone option when hasCollections is true', () => {
    render(
      <SelectCreateMode
        hasCollections={true}
        onSelectMode={mockOnSelectMode}
        onCancel={mockOnCancel}
      />
    );

    const cloneCard = screen.getByText('Clone Existing Collection').closest('.option-card');

    // Should not have disabled class
    expect(cloneCard).not.toHaveClass('option-card-disabled');

    // Should have aria-disabled false
    expect(cloneCard).toHaveAttribute('aria-disabled', 'false');

    // Should have tabindex 0
    expect(cloneCard).toHaveAttribute('tabindex', '0');

    // Should call onSelectMode when clicked
    fireEvent.click(cloneCard!);
    expect(mockOnSelectMode).toHaveBeenCalledWith('cloneExisting');
    expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
  });
});
