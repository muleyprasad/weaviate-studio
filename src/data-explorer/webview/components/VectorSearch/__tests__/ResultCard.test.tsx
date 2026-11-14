import React from 'react';
import { render, screen } from '@testing-library/react';
import type { WeaviateObject } from '../../../../types';
import { ResultCard } from '../ResultCard';

function renderCard(properties: Record<string, unknown>) {
  const object: WeaviateObject = { uuid: '2f4b9d51-33a7-4d3b-9d0e-1f2a3b4c5d6e', properties };
  return render(
    <ResultCard
      object={object}
      distance={0.61}
      certainty={0.69}
      onView={jest.fn()}
      onFindSimilar={jest.fn()}
      rank={1}
    />
  );
}

describe('ResultCard title', () => {
  it('uses a known title property when the collection has one', () => {
    renderCard({
      title: 'Ergonomic desk chair',
      content: 'Mesh office chair',
      category: 'furniture',
    });
    expect(screen.getByText('Ergonomic desk chair')).toBeTruthy();
  });

  it('titles cards from the same property regardless of property order', () => {
    const content = 'Compact mechanical keyboard with quiet tactile switches';

    renderCard({ content, category: 'electronics' });
    expect(screen.getByText(content)).toBeTruthy();

    // The server does not promise a property order, so the reversed map used to
    // title this card with the category instead.
    renderCard({ category: 'electronics', content });
    expect(screen.getAllByText(content)).toHaveLength(2);
    expect(screen.queryByText('electronics')).toBeNull();
  });

  it('falls back to the uuid when the object has no text properties', () => {
    renderCard({ price: 129.99 });
    expect(screen.getByText('2f4b9d51-33a7-4d3b-9d0e-1f2a3b4c5d6e')).toBeTruthy();
  });
});
