import { parentWouldCycle } from './location-tree';

describe('parentWouldCycle', () => {
  it('blocks assigning a location as its own parent', () => {
    expect(parentWouldCycle('a', 'a', ['a'])).toBe(true);
  });

  it('blocks assigning a descendant as parent', () => {
    expect(parentWouldCycle('store', 'display', ['store', 'display'])).toBe(
      true,
    );
  });

  it('allows a parent outside the subtree', () => {
    expect(parentWouldCycle('display', 'warehouse', ['display'])).toBe(false);
  });

  it('allows clearing the parent', () => {
    expect(parentWouldCycle('store', null, ['store', 'display'])).toBe(false);
  });
});
