import {
  assertImportUrlScheme,
  assertPublicImportHost,
  isPrivateOrLocalAddress,
  setHostResolverForTesting,
} from '../importUrlGuard';

/**
 * Tests for importUrlGuard: URL imports must never reach the local machine,
 * a private network, or a cloud metadata endpoint.
 */
describe('importUrlGuard', () => {
  afterEach(() => {
    setHostResolverForTesting(undefined);
  });

  test.each([
    '127.0.0.1',
    '127.10.20.30',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
  ])('treats %s as private or local', (address) => {
    expect(isPrivateOrLocalAddress(address)).toBe(true);
  });

  test.each(['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111'])(
    'allows the public address %s',
    (address) => {
      expect(isPrivateOrLocalAddress(address)).toBe(false);
    }
  );

  test('rejects non-http schemes', () => {
    expect(() => assertImportUrlScheme(new URL('file:///etc/passwd'))).toThrow('http');
  });

  test('rejects localhost and private IP literals', async () => {
    await expect(assertPublicImportHost(new URL('http://localhost/data.json'))).rejects.toThrow(
      'public host'
    );
    await expect(assertPublicImportHost(new URL('http://127.0.0.1/data.json'))).rejects.toThrow(
      'public host'
    );
    await expect(assertPublicImportHost(new URL('http://[::1]/data.json'))).rejects.toThrow(
      'public host'
    );
  });

  test('rejects hostnames that resolve to a private address', async () => {
    setHostResolverForTesting(async () => ['10.0.0.5']);
    await expect(
      assertPublicImportHost(new URL('https://cdn.example.com/data.json'))
    ).rejects.toThrow('public host');
  });

  test('allows hostnames that resolve to a public address', async () => {
    setHostResolverForTesting(async () => ['93.184.216.34']);
    await expect(
      assertPublicImportHost(new URL('https://cdn.example.com/data.json'))
    ).resolves.toBeUndefined();
  });

  test('rejects hostnames that do not resolve', async () => {
    setHostResolverForTesting(async () => {
      throw new Error('ENOTFOUND');
    });
    await expect(
      assertPublicImportHost(new URL('https://nope.example.com/data.json'))
    ).rejects.toThrow('could not be resolved');
  });
});
