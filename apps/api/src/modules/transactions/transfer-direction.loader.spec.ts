import { mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { TransferDirectionLoader } from './transfer-direction.loader';

describe('TransferDirectionLoader', () => {
  it('resolves both sides of a transfer with a single query per request', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.transfer.findMany.mockResolvedValue([
      { id: 'tr-1', fromTxnId: 'out-1', toTxnId: 'in-1' },
    ] as never);
    const loader = new TransferDirectionLoader(prisma);
    const request = {};

    const [out, inbound, other] = await Promise.all([
      loader.load(request, 'out-1'),
      loader.load(request, 'in-1'),
      loader.load(request, 'tx-9'),
    ]);

    expect([out, inbound, other]).toEqual(['out', 'in', null]);
    expect(prisma.transfer.findMany).toHaveBeenCalledTimes(1);
    // Cached for the rest of the request.
    await expect(loader.load(request, 'out-1')).resolves.toBe('out');
    expect(prisma.transfer.findMany).toHaveBeenCalledTimes(1);
  });

  it('gives both sides the transfer they share, in the same query', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.transfer.findMany.mockResolvedValue([
      { id: 'tr-1', fromTxnId: 'out-1', toTxnId: 'in-1' },
    ] as never);
    const loader = new TransferDirectionLoader(prisma);
    const request = {};

    const [out, inbound, direction] = await Promise.all([
      loader.loadSide(request, 'out-1'),
      loader.loadSide(request, 'in-1'),
      loader.load(request, 'in-1'),
    ]);

    expect(out).toEqual({ direction: 'out', transferId: 'tr-1' });
    expect(inbound).toEqual({ direction: 'in', transferId: 'tr-1' });
    expect(direction).toBe('in');
    expect(prisma.transfer.findMany).toHaveBeenCalledTimes(1);
  });
});
