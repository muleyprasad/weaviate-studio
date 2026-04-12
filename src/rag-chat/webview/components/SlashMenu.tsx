/**
 * SlashMenu - Discoverable command autocomplete popup
 *
 * Appears above the chat input when user types "/" as first character.
 * Keyboard: ↑/↓ navigate, Enter/Tab select, Esc close.
 * Click to select.
 */

import React from 'react';

export interface SlashCommand {
  command: string;
  description: string;
  template: string;
  cursorOffset?: number; // If set, cursor placed at this offset into the template
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/ask',
    description: 'Answer a question from data',
    template: '/ask ',
  },
  {
    command: '/search',
    description: 'Pure retrieval, no LLM answer',
    template: '/search ',
  },
  {
    command: '/explore',
    description: 'Discover related content',
    template: '/explore ',
  },
  {
    command: '/fetch',
    description: 'Retrieve object by ID',
    template: '/fetch id:"" ',
    cursorOffset: 11, // Position inside the quotes
  },
  {
    command: '/query',
    description: 'Run structured query',
    template: '/query ',
  },
  {
    command: '/collections',
    description: 'List all collections',
    template: '/collections',
  },
];

interface SlashMenuProps {
  open: boolean;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
}

export function SlashMenu({ open, selectedIndex, onSelect, onClose, onNavigate }: SlashMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="rag-slash-menu" role="listbox">
      {SLASH_COMMANDS.map((cmd, idx) => (
        <button
          key={cmd.command}
          type="button"
          role="option"
          aria-selected={selectedIndex === idx}
          className={`rag-slash-menu-item ${selectedIndex === idx ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => {
            // Update selected index on hover (optional enhancement)
          }}
        >
          <span className="rag-slash-menu-command">{cmd.command}</span>
          <span className="rag-slash-menu-description">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
