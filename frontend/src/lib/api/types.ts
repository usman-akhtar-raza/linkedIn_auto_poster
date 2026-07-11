export type LinkedInStatus = {
  connected: boolean;
  status: string;
  linkedinUserId?: string;
  memberUrn?: string;
  vanityName?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  profilePictureUrl?: string;
  expiresAt?: string;
  scope?: string;
  organizations: Array<{
    organizationId: string;
    organizationUrn: string;
    localizedName?: string;
    role?: string;
  }>;
};

export type AgentPost = {
  id: string;
  title: string;
  hook: string;
  content: string;
  hashtags?: string[];
  status: string;
  scheduledFor?: string;
  linkedinPostUrn?: string;
  analytics?: {
    likes: number;
    comments: number;
    impressions: number;
    shares: number;
    clicks: number;
    engagementRate: number;
  };
};

export type DashboardOverview = {
  recentPosts: AgentPost[];
  todaysPost?: AgentPost;
  queue: Record<string, unknown>;
  publishedCount: number;
  pendingCount: number;
};
