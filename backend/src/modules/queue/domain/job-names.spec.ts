import { JOB_NAMES, QUEUE_NAMES } from './job-names';

describe('queue names', () => {
  it('defines production queues and job names', () => {
    expect(Object.values(QUEUE_NAMES)).toEqual([
      'ResearchQueue',
      'GeneratePostQueue',
      'GenerateImageQueue',
      'PublishQueue',
      'AnalyticsQueue',
      'RetryQueue',
    ]);
    expect(JOB_NAMES.publishPost).toBe('PublishPostJob');
  });
});
