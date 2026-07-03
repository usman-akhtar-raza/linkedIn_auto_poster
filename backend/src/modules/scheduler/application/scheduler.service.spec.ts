import { SchedulerService } from './scheduler.service';

describe('SchedulerService', () => {
  it('persists timezone-aware next run metadata when updating a schedule', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const service = new SchedulerService(prisma as never, {} as never);

    await service.updateSchedule('user-1', {
      scheduleFrequency: 'DAILY',
      timezone: 'Asia/Karachi',
      scheduleTime: '09:30',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        scheduleFrequency: 'DAILY',
        timezone: 'Asia/Karachi',
        scheduleTime: '09:30',
        nextScheduledRunAt: expect.any(Date),
      }),
    });
  });
});
