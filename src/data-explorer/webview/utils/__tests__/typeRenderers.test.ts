/**
 * Tests for type renderer utility functions
 */

import {
  formatNumber,
  formatRelativeTime,
  formatAbsoluteTime,
  truncateText,
  formatUuid,
  formatFileSize,
  formatGeoCoordinates,
  formatPhoneNumber,
  inferDataType,
  getItemCount,
  renderCellValue,
  renderVectorValue,
  renderBlobValue,
  copyToClipboard,
} from '../typeRenderers';

describe('typeRenderers', () => {
  describe('formatNumber', () => {
    it('formats positive integers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('formats negative numbers with commas', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(-1000000)).toBe('-1,000,000');
    });

    it('formats decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
      expect(formatNumber(0.123)).toBe('0.123');
    });

    it('handles zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('handles very large numbers', () => {
      expect(formatNumber(1e15)).toBe('1,000,000,000,000,000');
    });

    it('handles very small numbers', () => {
      // Very small numbers may be rounded by Intl.NumberFormat
      const result = formatNumber(0.000001);
      expect(typeof result).toBe('string');
      // Accept either the full number or rounded version
      expect(['0.000001', '0'].includes(result)).toBe(true);
    });

    it('handles NaN', () => {
      expect(formatNumber(NaN)).toBe('NaN');
    });

    it('handles Infinity', () => {
      expect(formatNumber(Infinity)).toBe('∞');
      expect(formatNumber(-Infinity)).toBe('-∞');
    });
  });

  describe('formatRelativeTime', () => {
    const now = Date.now();

    it('returns "Just now" for times less than 1 minute ago', () => {
      const thirtySecondsAgo = now - 30000;
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now');
    });

    it('returns "In the future" for future timestamps', () => {
      const future = now + 60000;
      expect(formatRelativeTime(future)).toBe('In the future');
    });

    it('formats minutes ago (singular)', () => {
      const oneMinuteAgo = now - 60000;
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('formats minutes ago (plural)', () => {
      const fiveMinutesAgo = now - 300000;
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('formats hours ago (singular)', () => {
      const oneHourAgo = now - 3600000;
      expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
    });

    it('formats hours ago (plural)', () => {
      const threeHoursAgo = now - 10800000;
      expect(formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');
    });

    it('formats days ago (singular)', () => {
      const oneDayAgo = now - 86400000;
      expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
    });

    it('formats days ago (plural)', () => {
      const threeDaysAgo = now - 259200000;
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('formats weeks ago (singular)', () => {
      const oneWeekAgo = now - 604800000;
      expect(formatRelativeTime(oneWeekAgo)).toBe('1 week ago');
    });

    it('formats weeks ago (plural)', () => {
      const twoWeeksAgo = now - 1209600000;
      expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
    });

    it('formats old dates as absolute date', () => {
      const twoMonthsAgo = now - 5184000000;
      const result = formatRelativeTime(twoMonthsAgo);
      expect(result).toMatch(/\w{3} \d{1,2}, \d{4}/); // e.g., "Nov 25, 2024"
    });

    it('handles string timestamps', () => {
      const dateString = new Date(now - 60000).toISOString();
      expect(formatRelativeTime(dateString)).toBe('1 minute ago');
    });

    it('handles ISO date strings', () => {
      const isoString = '2024-01-15T10:30:00Z';
      const result = formatRelativeTime(isoString);
      expect(result).toBeTruthy();
    });
  });

  describe('formatAbsoluteTime', () => {
    it('formats timestamp as absolute time', () => {
      const timestamp = new Date('2024-01-15T10:30:45Z').getTime();
      const result = formatAbsoluteTime(timestamp);
      expect(result).toMatch(/Jan 15, 2024/);
      // Time will vary by timezone, just check it has time components
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('handles string timestamps', () => {
      const dateString = '2024-01-15T10:30:45Z';
      const result = formatAbsoluteTime(dateString);
      expect(result).toMatch(/Jan 15, 2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('handles ISO date strings', () => {
      const isoString = '2024-12-25T12:00:00Z';
      const result = formatAbsoluteTime(isoString);
      // Date might shift by timezone, so just check it's Dec 24 or 25
      expect(result).toMatch(/Dec (24|25), 2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('truncateText', () => {
    it('returns text unchanged if shorter than max length', () => {
      expect(truncateText('Hello', 100)).toBe('Hello');
    });

    it('returns text unchanged if equal to max length', () => {
      const text = 'a'.repeat(100);
      expect(truncateText(text, 100)).toBe(text);
    });

    it('truncates text longer than max length', () => {
      const text = 'a'.repeat(150);
      expect(truncateText(text, 100)).toBe('a'.repeat(100) + '...');
    });

    it('uses default max length of 100', () => {
      const text = 'a'.repeat(150);
      expect(truncateText(text)).toBe('a'.repeat(100) + '...');
    });

    it('handles empty string', () => {
      expect(truncateText('')).toBe('');
    });

    it('handles custom max length', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });
  });

  describe('formatUuid', () => {
    it('formats standard UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(formatUuid(uuid)).toBe('123e4567-e89b...');
    });

    it('returns short strings unchanged', () => {
      expect(formatUuid('12345')).toBe('12345');
      expect(formatUuid('1234567890123')).toBe('1234567890123');
    });

    it('handles empty string', () => {
      expect(formatUuid('')).toBe('');
    });

    it('handles exactly 13 characters', () => {
      expect(formatUuid('1234567890123')).toBe('1234567890123');
    });

    it('handles 14 characters', () => {
      expect(formatUuid('12345678901234')).toBe('1234567890123...');
    });
  });

  describe('formatFileSize', () => {
    it('formats zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
      expect(formatFileSize(2147483648)).toBe('2.0 GB');
    });

    it('formats terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1.0 TB');
    });

    it('handles decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });
  });

  describe('formatGeoCoordinates', () => {
    it('formats valid coordinates', () => {
      const coords = { latitude: 40.7128, longitude: -74.006 };
      expect(formatGeoCoordinates(coords)).toBe('📍 40.7128, -74.0060');
    });

    it('formats coordinates with high precision', () => {
      const coords = { latitude: 40.712345, longitude: -74.006789 };
      expect(formatGeoCoordinates(coords)).toBe('📍 40.7123, -74.0068');
    });

    it('handles zero coordinates', () => {
      const coords = { latitude: 0, longitude: 0 };
      expect(formatGeoCoordinates(coords)).toBe('📍 0.0000, 0.0000');
    });

    it('handles negative coordinates', () => {
      const coords = { latitude: -33.8688, longitude: 151.2093 };
      expect(formatGeoCoordinates(coords)).toBe('📍 -33.8688, 151.2093');
    });

    it('returns invalid for missing latitude', () => {
      const coords = { longitude: -74.006 } as any;
      expect(formatGeoCoordinates(coords)).toBe('📍 Invalid coordinates');
    });

    it('returns invalid for missing longitude', () => {
      const coords = { latitude: 40.7128 } as any;
      expect(formatGeoCoordinates(coords)).toBe('📍 Invalid coordinates');
    });

    it('returns invalid for null coordinates', () => {
      const coords = { latitude: null, longitude: null } as any;
      expect(formatGeoCoordinates(coords)).toBe('📍 Invalid coordinates');
    });

    it('returns invalid for undefined coordinates', () => {
      const coords = { latitude: undefined, longitude: undefined } as any;
      expect(formatGeoCoordinates(coords)).toBe('📍 Invalid coordinates');
    });
  });

  describe('formatPhoneNumber', () => {
    it('formats international formatted number', () => {
      const phone = { internationalFormatted: '+1 (555) 123-4567' };
      expect(formatPhoneNumber(phone)).toBe('+1 (555) 123-4567');
    });

    it('formats national formatted number when international not available', () => {
      const phone = { nationalFormatted: '(555) 123-4567' };
      expect(formatPhoneNumber(phone)).toBe('(555) 123-4567');
    });

    it('formats input when formatted versions not available', () => {
      const phone = { input: '5551234567' };
      expect(formatPhoneNumber(phone)).toBe('5551234567');
    });

    it('prefers international over national format', () => {
      const phone = {
        internationalFormatted: '+1 (555) 123-4567',
        nationalFormatted: '(555) 123-4567',
      };
      expect(formatPhoneNumber(phone)).toBe('+1 (555) 123-4567');
    });

    it('prefers national over input', () => {
      const phone = {
        nationalFormatted: '(555) 123-4567',
        input: '5551234567',
      };
      expect(formatPhoneNumber(phone)).toBe('(555) 123-4567');
    });

    it('returns invalid for empty phone object', () => {
      const phone = {};
      expect(formatPhoneNumber(phone)).toBe('Invalid phone number');
    });

    it('handles phone with country code', () => {
      const phone = {
        internationalFormatted: '+44 20 7946 0958',
        countryCode: 44,
      };
      expect(formatPhoneNumber(phone)).toBe('+44 20 7946 0958');
    });
  });

  describe('inferDataType', () => {
    it('infers null type', () => {
      expect(inferDataType(null)).toBe('null');
      expect(inferDataType(undefined)).toBe('null');
    });

    it('infers boolean type', () => {
      expect(inferDataType(true)).toBe('boolean');
      expect(inferDataType(false)).toBe('boolean');
    });

    it('infers int type for integers', () => {
      expect(inferDataType(42)).toBe('int');
      expect(inferDataType(0)).toBe('int');
      expect(inferDataType(-10)).toBe('int');
    });

    it('infers number type for floats', () => {
      expect(inferDataType(3.14)).toBe('number');
      expect(inferDataType(0.5)).toBe('number');
    });

    it('infers text type for strings', () => {
      expect(inferDataType('hello')).toBe('text');
      expect(inferDataType('123')).toBe('text');
    });

    it('infers uuid type for UUID strings', () => {
      expect(inferDataType('123e4567-e89b-12d3-a456-426614174000')).toBe('uuid');
      expect(inferDataType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    });

    it('infers date type for date strings', () => {
      expect(inferDataType('2024-01-15')).toBe('date');
      expect(inferDataType('2024-01-15T10:30:00')).toBe('date');
      expect(inferDataType('2024-01-15T10:30:00Z')).toBe('date');
    });

    it('infers geoCoordinates type', () => {
      expect(inferDataType({ latitude: 40.7128, longitude: -74.006 })).toBe('geoCoordinates');
    });

    it('infers phoneNumber type', () => {
      expect(inferDataType({ input: '5551234567' })).toBe('phoneNumber');
      expect(inferDataType({ internationalFormatted: '+1 555 123 4567' })).toBe('phoneNumber');
    });

    it('infers object type for generic objects', () => {
      expect(inferDataType({ name: 'John', age: 30 })).toBe('object');
    });

    it('infers array type for empty arrays', () => {
      expect(inferDataType([])).toBe('array');
    });

    it('infers typed array for non-empty arrays', () => {
      expect(inferDataType([1, 2, 3])).toBe('int[]');
      expect(inferDataType(['a', 'b', 'c'])).toBe('text[]');
      expect(inferDataType([true, false])).toBe('boolean[]');
    });

    it('infers nested array types', () => {
      expect(inferDataType([{ name: 'John' }])).toBe('object[]');
    });

    it('returns unknown for unrecognized types', () => {
      expect(inferDataType(Symbol('test'))).toBe('unknown');
    });
  });

  describe('getItemCount', () => {
    it('returns array length', () => {
      expect(getItemCount([1, 2, 3])).toBe(3);
      expect(getItemCount([])).toBe(0);
    });

    it('returns object property count', () => {
      expect(getItemCount({ a: 1, b: 2, c: 3 })).toBe(3);
      expect(getItemCount({})).toBe(0);
    });

    it('returns 0 for null', () => {
      expect(getItemCount(null)).toBe(0);
    });

    it('returns 0 for primitives', () => {
      expect(getItemCount(42)).toBe(0);
      expect(getItemCount('hello')).toBe(0);
      expect(getItemCount(true)).toBe(0);
    });
  });

  describe('renderCellValue', () => {
    describe('null and undefined', () => {
      it('renders null as em dash', () => {
        const result = renderCellValue(null);
        expect(result).toEqual({
          displayValue: '—',
          fullValue: null,
          dataType: 'null',
          isExpandable: false,
        });
      });

      it('renders undefined as em dash', () => {
        const result = renderCellValue(undefined);
        expect(result).toEqual({
          displayValue: '—',
          fullValue: undefined,
          dataType: 'null',
          isExpandable: false,
        });
      });
    });

    describe('arrays', () => {
      it('renders empty array', () => {
        const result = renderCellValue([]);
        expect(result.displayValue).toBe('[0 items]');
        expect(result.isExpandable).toBe(true);
        expect(result.itemCount).toBe(0);
      });

      it('renders array with one item', () => {
        const result = renderCellValue([1]);
        expect(result.displayValue).toBe('[1 item]');
        expect(result.itemCount).toBe(1);
      });

      it('renders array with multiple items', () => {
        const result = renderCellValue([1, 2, 3]);
        expect(result.displayValue).toBe('[3 items]');
        expect(result.itemCount).toBe(3);
      });
    });

    describe('objects', () => {
      it('renders geoCoordinates', () => {
        const coords = { latitude: 40.7128, longitude: -74.006 };
        const result = renderCellValue(coords);
        expect(result.displayValue).toBe('📍 40.7128, -74.0060');
        expect(result.dataType).toBe('geoCoordinates');
        expect(result.isExpandable).toBe(false);
      });

      it('renders phoneNumber', () => {
        const phone = { internationalFormatted: '+1 (555) 123-4567' };
        const result = renderCellValue(phone);
        expect(result.displayValue).toBe('+1 (555) 123-4567');
        expect(result.dataType).toBe('phoneNumber');
        expect(result.isExpandable).toBe(false);
      });

      it('renders generic object with one property', () => {
        const obj = { name: 'John' };
        const result = renderCellValue(obj);
        expect(result.displayValue).toBe('{1 property}');
        expect(result.isExpandable).toBe(true);
        expect(result.itemCount).toBe(1);
      });

      it('renders generic object with multiple properties', () => {
        const obj = { name: 'John', age: 30, city: 'NYC' };
        const result = renderCellValue(obj);
        expect(result.displayValue).toBe('{3 properties}');
        expect(result.itemCount).toBe(3);
      });
    });

    describe('booleans', () => {
      it('renders true as checkmark', () => {
        const result = renderCellValue(true);
        expect(result.displayValue).toBe('✓');
        expect(result.dataType).toBe('boolean');
        expect(result.isExpandable).toBe(false);
      });

      it('renders false as X', () => {
        const result = renderCellValue(false);
        expect(result.displayValue).toBe('✗');
        expect(result.dataType).toBe('boolean');
      });
    });

    describe('numbers', () => {
      it('renders integers', () => {
        const result = renderCellValue(1000);
        expect(result.displayValue).toBe('1,000');
        expect(result.dataType).toBe('int');
        expect(result.isExpandable).toBe(false);
      });

      it('renders floats', () => {
        const result = renderCellValue(3.14);
        expect(result.displayValue).toBe('3.14');
        expect(result.dataType).toBe('number');
      });

      it('renders zero', () => {
        const result = renderCellValue(0);
        expect(result.displayValue).toBe('0');
        expect(result.dataType).toBe('int');
      });
    });

    describe('strings', () => {
      it('renders UUID', () => {
        const uuid = '123e4567-e89b-12d3-a456-426614174000';
        const result = renderCellValue(uuid);
        expect(result.displayValue).toBe('123e4567-e89b...');
        expect(result.dataType).toBe('uuid');
        expect(result.isExpandable).toBe(false);
      });

      it('renders date string', () => {
        const dateStr = '2024-01-15T10:30:00Z';
        const result = renderCellValue(dateStr);
        expect(result.dataType).toBe('date');
        expect(result.isExpandable).toBe(false);
      });

      it('renders short text', () => {
        const result = renderCellValue('Hello World');
        expect(result.displayValue).toBe('Hello World');
        expect(result.dataType).toBe('text');
        expect(result.isExpandable).toBe(false);
      });

      it('renders long text as truncated', () => {
        const longText = 'a'.repeat(150);
        const result = renderCellValue(longText);
        expect(result.displayValue).toBe('a'.repeat(100) + '...');
        expect(result.isExpandable).toBe(true);
      });
    });

    describe('with dataTypeHint', () => {
      it('uses dataTypeHint for rendering', () => {
        const result = renderCellValue('2024-01-15', 'date');
        expect(result.dataType).toBe('date');
      });

      it('uses dataTypeHint for UUID', () => {
        const result = renderCellValue('123e4567-e89b-12d3-a456-426614174000', 'uuid');
        expect(result.dataType).toBe('uuid');
      });
    });
  });

  describe('renderVectorValue', () => {
    it('renders empty vector as em dash', () => {
      const result = renderVectorValue([]);
      expect(result).toEqual({
        displayValue: '—',
        fullValue: null,
        dataType: 'vector',
        isExpandable: false,
      });
    });

    it('renders undefined vector as em dash', () => {
      const result = renderVectorValue(undefined);
      expect(result).toEqual({
        displayValue: '—',
        fullValue: null,
        dataType: 'vector',
        isExpandable: false,
      });
    });

    it('renders vector with dimensions', () => {
      const vector = [0.1, 0.2, 0.3];
      const result = renderVectorValue(vector);
      expect(result.displayValue).toBe('🔢 [3 dims]');
      expect(result.fullValue).toBe(vector);
      expect(result.dataType).toBe('vector');
      expect(result.isExpandable).toBe(true);
      expect(result.itemCount).toBe(3);
    });

    it('renders large vector', () => {
      const vector = new Array(1536).fill(0.5);
      const result = renderVectorValue(vector);
      expect(result.displayValue).toBe('🔢 [1536 dims]');
      expect(result.itemCount).toBe(1536);
    });
  });

  describe('renderBlobValue', () => {
    it('renders empty blob as em dash', () => {
      const result = renderBlobValue('');
      expect(result).toEqual({
        displayValue: '—',
        fullValue: null,
        dataType: 'blob',
        isExpandable: false,
      });
    });

    it('renders undefined blob as em dash', () => {
      const result = renderBlobValue(undefined);
      expect(result).toEqual({
        displayValue: '—',
        fullValue: null,
        dataType: 'blob',
        isExpandable: false,
      });
    });

    it('renders blob with estimated size', () => {
      // Base64 string representing ~100 bytes
      const blob = 'a'.repeat(136); // ~100 bytes when decoded
      const result = renderBlobValue(blob);
      // Check for file emoji and size format (e.g., "102.0 B" or "1.5 KB")
      expect(result.displayValue).toContain('📄');
      expect(result.displayValue).toMatch(/\d+\.\d+ (B|KB|MB|GB|TB)/);
      expect(result.fullValue).toBe(blob);
      expect(result.dataType).toBe('blob');
      expect(result.isExpandable).toBe(false);
    });

    it('estimates blob size correctly', () => {
      // 1KB base64 string
      const blob = 'a'.repeat(1368); // ~1KB when decoded
      const result = renderBlobValue(blob);
      expect(result.displayValue).toContain('KB');
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(),
        },
      });
    });

    it('copies text using clipboard API', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
      const result = await copyToClipboard('test text');
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('uses fallback when clipboard API fails', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Failed'));

      // Mock document methods for fallback
      const mockTextArea = {
        value: '',
        style: {} as CSSStyleDeclaration,
        select: jest.fn(),
      };
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockTextArea as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

      // Mock execCommand to succeed
      const originalExecCommand = document.execCommand;
      (document as any).execCommand = jest.fn().mockReturnValue(true);

      const result = await copyToClipboard('test text');

      // Fallback should succeed
      expect(result).toBe(true);
      expect(createElementSpy).toHaveBeenCalledWith('textarea');
      expect((document as any).execCommand).toHaveBeenCalledWith('copy');

      // Restore
      (document as any).execCommand = originalExecCommand;
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('uses fallback when clipboard API not available', async () => {
      // Remove clipboard API
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockTextArea = {
        value: '',
        style: {} as CSSStyleDeclaration,
        select: jest.fn(),
      };
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockTextArea as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

      // Mock execCommand
      const originalExecCommand = document.execCommand;
      (document as any).execCommand = jest.fn().mockReturnValue(true);

      const result = await copyToClipboard('test text');

      expect(result).toBe(true);
      expect((document as any).execCommand).toHaveBeenCalledWith('copy');

      // Restore
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
      (document as any).execCommand = originalExecCommand;
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('handles empty string', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
      const result = await copyToClipboard('');
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('handles special characters', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
      const specialText = 'Hello\nWorld\t"Test"';
      const result = await copyToClipboard(specialText);
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialText);
    });
  });
});
