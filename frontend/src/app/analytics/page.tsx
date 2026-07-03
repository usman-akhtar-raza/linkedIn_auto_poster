"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api/client";
import type { AgentPost } from "@/lib/api/types";

export default function AnalyticsPage() {
  const query = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiRequest<AgentPost[]>("/analytics"),
  });
  const posts = query.data ?? [];
  const totals = posts.reduce(
    (acc, post) => ({
      impressions: acc.impressions + (post.analytics?.impressions ?? 0),
      likes: acc.likes + (post.analytics?.likes ?? 0),
      clicks: acc.clicks + (post.analytics?.clicks ?? 0),
      engagement: acc.engagement + (post.analytics?.engagementRate ?? 0),
    }),
    { impressions: 0, likes: 0, clicks: 0, engagement: 0 },
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Track impressions, likes, comments, shares, clicks, CTR, and engagement rate.</p>
        </div>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading analytics...</p> : null}
        {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Impressions" value={totals.impressions.toLocaleString()} detail="Published posts" />
          <StatCard title="Likes" value={totals.likes.toLocaleString()} detail="Collected from LinkedIn" />
          <StatCard title="Clicks" value={totals.clicks.toLocaleString()} detail="Tracked clicks" />
          <StatCard title="Avg engagement" value={(posts.length ? totals.engagement / posts.length : 0).toFixed(3)} detail="Engagement rate" />
        </div>
        <Card>
          <CardHeader><CardTitle>Published posts</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-md border p-4">
                <p className="font-medium">{post.title}</p>
                <p className="text-sm text-muted-foreground">
                  {(post.analytics?.impressions ?? 0).toLocaleString()} impressions · {(post.analytics?.likes ?? 0).toLocaleString()} likes
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
