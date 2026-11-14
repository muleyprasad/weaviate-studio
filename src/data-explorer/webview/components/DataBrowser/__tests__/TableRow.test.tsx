import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableRow } from '../TableRow';
import type { WeaviateObject } from '../../../../types';

/**
 * Tests for TableRow edit/delete actions (Phase 6).
 */
describe('TableRow - row actions', () => {
  const object: WeaviateObject = {
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    properties: { title: 'Hello' },
  };

  const baseProps = {
    object,
    isSelected: false,
    displayedColumns: ['uuid', 'title'],
    schema: null,
    pinnedColumns: [],
    columnWidths: {},
    onSelect: jest.fn(),
    onRowClick: jest.fn(),
  };

  function renderRow(overrides: Record<string, unknown> = {}) {
    return render(
      <table>
        <tbody>
          <TableRow {...baseProps} {...(overrides as any)} />
        </tbody>
      </table>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows edit and delete buttons when handlers are provided', () => {
    renderRow({ onEdit: jest.fn(), onDelete: jest.fn() });
    expect(screen.getByLabelText('Edit object')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete object')).toBeInTheDocument();
  });

  test('hides edit/delete buttons when handlers are absent', () => {
    renderRow({});
    expect(screen.queryByLabelText('Edit object')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete object')).not.toBeInTheDocument();
  });

  test('edit click calls onEdit with the uuid', () => {
    const onEdit = jest.fn();
    renderRow({ onEdit, onDelete: jest.fn() });
    fireEvent.click(screen.getByLabelText('Edit object'));
    expect(onEdit).toHaveBeenCalledWith(object.uuid);
  });

  test('delete requires two-step confirmation', () => {
    const onDelete = jest.fn();
    renderRow({ onEdit: jest.fn(), onDelete });

    // First click arms confirmation instead of deleting
    fireEvent.click(screen.getByLabelText('Delete object'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Confirm delete')).toBeInTheDocument();

    // Confirm deletes
    fireEvent.click(screen.getByLabelText('Confirm delete'));
    expect(onDelete).toHaveBeenCalledWith(object.uuid);
  });

  test('cancel resets the delete confirmation', () => {
    const onDelete = jest.fn();
    renderRow({ onEdit: jest.fn(), onDelete });

    fireEvent.click(screen.getByLabelText('Delete object'));
    fireEvent.click(screen.getByLabelText('Cancel delete'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Delete object')).toBeInTheDocument();
  });

  test('readOnly disables edit and delete with explanatory titles', () => {
    renderRow({ onEdit: jest.fn(), onDelete: jest.fn(), readOnly: true });

    const editBtn = screen.getByLabelText('Edit object');
    const deleteBtn = screen.getByLabelText('Delete object');
    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn).toHaveAttribute('title', expect.stringContaining('read-only'));
    expect(deleteBtn).toHaveAttribute('title', expect.stringContaining('read-only'));
  });
});
