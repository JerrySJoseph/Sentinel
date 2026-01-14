import { MemoryRepository } from '../src/repository';

describe('MemoryRepository (unit)', () => {
  it('createSession delegates to prisma.session.create', async () => {
    const sessionCreate = jest.fn().mockResolvedValue({ id: 's1' });
    const prisma = {
      session: {
        create: sessionCreate,
      },
    } as unknown as never;

    const repo = new MemoryRepository(prisma);
    const out = await repo.createSession();

    expect(out).toEqual({ id: 's1' });
    expect(sessionCreate).toHaveBeenCalledWith({ data: {} });
  });
});
