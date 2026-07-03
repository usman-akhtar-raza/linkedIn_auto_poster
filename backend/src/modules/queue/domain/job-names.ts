export const QUEUE_NAMES = {
  research: 'ResearchQueue',
  generatePost: 'GeneratePostQueue',
  generateImage: 'GenerateImageQueue',
  publish: 'PublishQueue',
  analytics: 'AnalyticsQueue',
  retry: 'RetryQueue',
} as const;

export const JOB_NAMES = {
  research: 'ResearchJob',
  generatePost: 'GeneratePostJob',
  generateImage: 'GenerateImageJob',
  publishPost: 'PublishPostJob',
  analytics: 'AnalyticsJob',
} as const;
