import { MemoryRepository } from '../src/repository';

describe('MemoryRepository (unit)', () => {
  it('createSession delegates to prisma.session.create', async () => {
    const prisma = {
      session: {
        create: jest.fn().mockResolvedValue({ id: 's1' }),
      },
    } as unknown as never;

    const repo = new MemoryRepository(prisma);
    const out = await repo.createSession();

    expect(out).toEqual({ id: 's1' });
    expect((prisma as any).session.create).toHaveBeenCalledWith({ data: {} });
  });
});

