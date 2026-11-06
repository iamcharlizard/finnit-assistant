import { BFF_SECRET_HEADER, CLIENT_IP_HEADER, clientIp } from './client-ip';

describe('clientIp', () => {
  const secret = 'shared-secret';

  it('uses the forwarded IP when the web server proves who it is', () => {
    const req = {
      ip: '10.0.0.1',
      headers: {
        [CLIENT_IP_HEADER]: '203.0.113.7',
        [BFF_SECRET_HEADER]: secret,
      },
    };
    expect(clientIp(req, secret)).toBe('203.0.113.7');
  });

  it('ignores a forwarded IP without the right secret', () => {
    expect(
      clientIp(
        {
          ip: '10.0.0.1',
          headers: {
            [CLIENT_IP_HEADER]: '1.1.1.1',
            [BFF_SECRET_HEADER]: 'nope',
          },
        },
        secret,
      ),
    ).toBe('10.0.0.1');
    expect(
      clientIp(
        { ip: '10.0.0.1', headers: { [CLIENT_IP_HEADER]: '1.1.1.1' } },
        secret,
      ),
    ).toBe('10.0.0.1');
  });

  it('ignores the forwarded IP when no secret is configured', () => {
    expect(
      clientIp(
        {
          ip: '10.0.0.1',
          headers: { [CLIENT_IP_HEADER]: '1.1.1.1', [BFF_SECRET_HEADER]: '' },
        },
        undefined,
      ),
    ).toBe('10.0.0.1');
  });
});
