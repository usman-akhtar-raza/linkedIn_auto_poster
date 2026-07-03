export type PostStatus = "Draft" | "Pending approval" | "Approved" | "Scheduled" | "Published" | "Rejected";

export type AgentPost = {
  id: string;
  title: string;
  hook: string;
  content: string;
  status: PostStatus;
  scheduledFor: string;
  channel: "LinkedIn";
  metrics: {
    likes: number;
    comments: number;
    impressions: number;
    shares: number;
    clicks: number;
    engagementRate: number;
  };
};

export type QueueJob = {
  id: string;
  name: string;
  status: "Queued" | "Running" | "Retrying" | "Completed";
  runAt: string;
};
