import { parseCountFilter } from '../countFilter';

describe('parseCountFilter', () => {
  it('matches everything for an empty expression (including unknown counts)', () => {
    const p = parseCountFilter('');
    expect(p(0)).toBe(true);
    expect(p(100)).toBe(true);
    expect(p(null)).toBe(true);
    expect(parseCountFilter('   ')(null)).toBe(true);
  });

  it('excludes unknown counts for any non-empty expression', () => {
    expect(parseCountFilter('count>=0')(null)).toBe(false);
    expect(parseCountFilter('count=0')(null)).toBe(false);
  });

  describe('equality', () => {
    it('count=0', () => {
      const p = parseCountFilter('count=0');
      expect(p(0)).toBe(true);
      expect(p(1)).toBe(false);
    });
    it('count==0 is equivalent', () => {
      expect(parseCountFilter('count==0')(0)).toBe(true);
    });
    it('count!=0', () => {
      const p = parseCountFilter('count!=0');
      expect(p(0)).toBe(false);
      expect(p(3)).toBe(true);
    });
  });

  describe('comparisons', () => {
    it('count>1', () => {
      const p = parseCountFilter('count>1');
      expect(p(1)).toBe(false);
      expect(p(2)).toBe(true);
    });
    it('count>=10', () => {
      const p = parseCountFilter('count>=10');
      expect(p(9)).toBe(false);
      expect(p(10)).toBe(true);
    });
    it('count<50', () => {
      const p = parseCountFilter('count<50');
      expect(p(49)).toBe(true);
      expect(p(50)).toBe(false);
    });
    it('count<=50', () => {
      expect(parseCountFilter('count<=50')(50)).toBe(true);
    });
  });

  describe('reversed (number on the left)', () => {
    it('5<count means count>5', () => {
      const p = parseCountFilter('5<count');
      expect(p(5)).toBe(false);
      expect(p(6)).toBe(true);
    });
    it('0=count', () => {
      expect(parseCountFilter('0=count')(0)).toBe(true);
    });
  });

  describe('range', () => {
    it('10<count<50 (exclusive)', () => {
      const p = parseCountFilter('10<count<50');
      expect(p(10)).toBe(false);
      expect(p(11)).toBe(true);
      expect(p(49)).toBe(true);
      expect(p(50)).toBe(false);
    });
    it('10<=count<=50 (inclusive)', () => {
      const p = parseCountFilter('10<=count<=50');
      expect(p(10)).toBe(true);
      expect(p(50)).toBe(true);
      expect(p(9)).toBe(false);
    });
    it('50>count>10 (descending form)', () => {
      const p = parseCountFilter('50>count>10');
      expect(p(11)).toBe(true);
      expect(p(10)).toBe(false);
      expect(p(50)).toBe(false);
    });
  });

  describe('whitespace and case', () => {
    it('ignores spaces', () => {
      expect(parseCountFilter(' 10 < count < 50 ')(30)).toBe(true);
    });
    it('is case-insensitive on the keyword', () => {
      expect(parseCountFilter('COUNT=0')(0)).toBe(true);
    });
  });

  describe('invalid expressions throw', () => {
    it.each(['count', 'foo', 'count=abc', 'count><5', '=5', 'count=', '<count<'])(
      'throws on "%s"',
      (expr) => {
        expect(() => parseCountFilter(expr)).toThrow();
      }
    );
  });
});
