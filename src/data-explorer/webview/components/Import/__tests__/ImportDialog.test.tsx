import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog';
import { postMessageToExtension } from '../../../utils/vscodeApi';

jest.mock('../../../utils/vscodeApi', () => ({
  postMessageToExtension: jest.fn(),
}));

const mockedPost = postMessageToExtension as jest.Mock;

/**
 * Tests for the ImportDialog (Phase 6).
 */
describe('ImportDialog', () => {
  const baseProps = {
    isOpen: true,
    onClose: jest.fn(),
    collectionName: 'Article',
    onImported: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when closed', () => {
    const { container } = render(<ImportDialog {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows source tabs and format options', () => {
    render(<ImportDialog {...baseProps} />);
    expect(screen.getByRole('tab', { name: 'File' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'URL' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.getByLabelText(/JSON/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CSV/)).toBeInTheDocument();
  });

  test('import is disabled without a payload', () => {
    render(<ImportDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: /Import/ })).toBeDisabled();
  });

  test('paste flow posts importObjects with the payload', () => {
    render(<ImportDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Paste' }));
    fireEvent.change(screen.getByLabelText('Pasted import payload'), {
      target: { value: '[{"title":"Hi"}]' },
    });

    const importBtn = screen.getByRole('button', { name: /Import/ });
    expect(importBtn).not.toBeDisabled();
    fireEvent.click(importBtn);

    expect(mockedPost).toHaveBeenCalledWith({
      command: 'importObjects',
      importParams: {
        collectionName: 'Article',
        source: 'paste',
        format: 'json',
        payload: '[{"title":"Hi"}]',
      },
      requestId: expect.stringMatching(/^import-/),
    });
  });

  test('url tab collects a url payload', () => {
    render(<ImportDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'URL' }));
    fireEvent.change(screen.getByLabelText('Import URL'), {
      target: { value: 'https://example.com/data.json' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));

    expect(mockedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'importObjects',
        importParams: expect.objectContaining({
          source: 'url',
          payload: 'https://example.com/data.json',
        }),
      })
    );
  });

  test('clean importComplete closes and refreshes', () => {
    render(<ImportDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Paste' }));
    fireEvent.change(screen.getByLabelText('Pasted import payload'), {
      target: { value: '[{"a":1}]' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
    const requestId = mockedPost.mock.calls[0][0].requestId;

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'importComplete',
          requestId,
          importResult: { importedCount: 1, failedCount: 0, errors: [] },
        },
      })
    );

    expect(baseProps.onImported).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  test('partial failure stays open with the summary', () => {
    render(<ImportDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Paste' }));
    fireEvent.change(screen.getByLabelText('Pasted import payload'), {
      target: { value: '[{"a":1}]' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
    const requestId = mockedPost.mock.calls[0][0].requestId;

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'importComplete',
          requestId,
          importResult: { importedCount: 0, failedCount: 1, errors: ['Item 1: boom'] },
        },
      })
    );

    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/0 objects, 1 failed/)).toBeInTheDocument();
    expect(screen.getByText('Item 1: boom')).toBeInTheDocument();
  });

  test('import errors are shown inline', () => {
    render(<ImportDialog {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Paste' }));
    fireEvent.change(screen.getByLabelText('Pasted import payload'), {
      target: { value: '{bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
    const requestId = mockedPost.mock.calls[0][0].requestId;

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { command: 'error', requestId, error: 'Invalid JSON: nope' },
      })
    );

    expect(screen.getByText('Invalid JSON: nope')).toBeInTheDocument();
  });

  test('ignores completion messages for another request', () => {
    const onImported = jest.fn();
    render(<ImportDialog {...baseProps} onImported={onImported} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Paste' }));
    fireEvent.change(screen.getByLabelText('Pasted import payload'), {
      target: { value: '[{"a":1}]' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'importComplete',
          requestId: 'import-other',
          importResult: { importedCount: 1, failedCount: 0, errors: [] },
        },
      })
    );

    expect(onImported).not.toHaveBeenCalled();
  });
});
