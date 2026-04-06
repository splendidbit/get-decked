import { buildDeck, shuffleDeck } from '../src/cards';
import { CardType } from '../src/types';

describe('buildDeck', () => {
  const deck = buildDeck();

  test('contains exactly 80 cards', () => {
    expect(deck).toHaveLength(80);
  });

  test('all cards have unique ids', () => {
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(80);
  });

  test('contains 14 stress+1 cards', () => {
    const s1 = deck.filter(c => c.type === CardType.Stress && c.value === 1);
    expect(s1).toHaveLength(14);
  });

  test('contains 10 stress+2 cards', () => {
    const s2 = deck.filter(c => c.type === CardType.Stress && c.value === 2);
    expect(s2).toHaveLength(10);
  });

  test('contains 6 stress+3 cards', () => {
    const s3 = deck.filter(c => c.type === CardType.Stress && c.value === 3);
    expect(s3).toHaveLength(6);
  });

  test('contains 4 stress+4 cards', () => {
    const s4 = deck.filter(c => c.type === CardType.Stress && c.value === 4);
    expect(s4).toHaveLength(4);
  });

  test('contains 34 total stress cards', () => {
    const stress = deck.filter(c => c.type === CardType.Stress);
    expect(stress).toHaveLength(34);
  });

  test('contains 8 chill-1, 6 chill-2, 4 chill-3 cards', () => {
    const c1 = deck.filter(c => c.type === CardType.Chill && c.value === 1);
    const c2 = deck.filter(c => c.type === CardType.Chill && c.value === 2);
    const c3 = deck.filter(c => c.type === CardType.Chill && c.value === 3);
    expect(c1).toHaveLength(8);
    expect(c2).toHaveLength(6);
    expect(c3).toHaveLength(4);
  });

  test('contains 18 total chill cards', () => {
    const chill = deck.filter(c => c.type === CardType.Chill);
    expect(chill).toHaveLength(18);
  });

  test('contains correct special card counts', () => {
    expect(deck.filter(c => c.type === CardType.Zen)).toHaveLength(2);
    expect(deck.filter(c => c.type === CardType.Dump)).toHaveLength(6);
    expect(deck.filter(c => c.type === CardType.Shield)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Deflect)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Snap)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.ChainReaction)).toHaveLength(4);
    expect(deck.filter(c => c.type === CardType.Swap)).toHaveLength(2);
    expect(deck.filter(c => c.type === CardType.Peek)).toHaveLength(2);
  });

  test('all cards have non-empty name and description', () => {
    for (const card of deck) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
    }
  });
});

describe('shuffleDeck', () => {
  test('returns same number of cards', () => {
    const deck = buildDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(80);
  });

  test('does not mutate original', () => {
    const deck = buildDeck();
    const firstId = deck[0].id;
    shuffleDeck(deck);
    expect(deck[0].id).toBe(firstId);
  });

  test('changes card order (statistical — may rarely fail)', () => {
    const deck = buildDeck();
    const shuffled = shuffleDeck(deck);
    const samePosition = deck.filter((c, i) => c.id === shuffled[i].id).length;
    expect(samePosition).toBeLessThan(10);
  });
});
