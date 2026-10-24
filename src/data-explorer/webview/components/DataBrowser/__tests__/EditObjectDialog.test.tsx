import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditObjectDialog } from '../EditObjectDialog';
import { postMessageToExtension } from '../../../utils/vscodeApi';
import type { WeaviateObject } from '../../../../types';

jest.mock('../../../utils/vscodeApi', () => ({
  postMessageToExtension: jest.fn(),
}));

const mockedPost = postMessageToExtension as jest.Mock;

/**
 * Tests for the EditObjectDialog (Phase 6).
 */
describe('EditObjectDialog', () => {
  const object: WeaviateObject = {
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    properties: { title: 'Hello', count: 3 },
  };

  const baseProps = {
    isOpen: true,
    onClose: jest.fn(),
    collectionName: 'Article',
    object,
    onSaved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prefills properties as JSON', () => {
    render(<EditObjectDialog {...baseProps} />);
    const area = screen.getByLabelText('Object properties as JSON') as HTMLTextAreaElement;
    expect(JSON.parse(area.value)).toEqual({ title: 'Hello', count: 3 });
  });

  test('rejects invalid JSON without posting', () => {
    render(<EditObjectDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Object properties as JSON'), {
      target: { value: '{oops' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Invalid JSON: unable to parse properties')).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('rejects non-object JSON without posting', () => {
    render(<EditObjectDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Object properties as JSON'), {
      target: { value: '[1,2]' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Properties must be a JSON object')).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('save posts updateObject with parsed properties', () => {
    render(<EditObjectDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Object properties as JSON'), {
      target: { value: '{"title":"Updated"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedPost).toHaveBeenCalledWith({
      command: 'updateObject',
      updateObjectParams: {
        collectionName: 'Article',
        uuid: object.uuid,
        properties: { title: 'Updated' },
      },
      requestId: expect.stringMatching(/^edit-/),
    });
  });

  test('objectUpdated closes and refreshes', () => {
    render(<EditObjectDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText('Object properties as JSON'), {
      target: { value: '{"title":"Updated"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const requestId = mockedPost.mock.calls[0][0].requestId;

    fireEvent(
      window,
      new MessageEvent('message', { data: { command: 'objectUpdated', requestId } })
    );

    expect(baseProps.onSaved).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  test('ignores objectUpdated messages for another request', () => {
    render(<EditObjectDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { command: 'objectUpdated', requestId: 'edit-other' },
      })
    );

    expect(baseProps.onSaved).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });
});
