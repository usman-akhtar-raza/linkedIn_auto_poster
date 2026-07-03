"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Send } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/api/client";
import type { DashboardOverview } from "@/lib/api/types";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardOverview>("/dashboard"),
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Research, draft, approve, publish, and measure from one workspace.</p>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Published posts" value={String(data?.publishedCount ?? 0)} detail="Total published content" />
          <StatCard title="Pending approvals" value={String(data?.pendingCount ?? 0)} detail="Awaiting review" />
          <StatCard title="Recent posts" value={String(data?.recentPosts?.length ?? 0)} detail="Latest drafts and published posts" />
          <StatCard title="Queues" value={String(Object.keys(data?.queue ?? {}).length)} detail="Active BullMQ queues" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader><CardTitle>Recent posts</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentPosts ?? []).map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell><Badge variant="outline">{post.status}</Badge></TableCell>
                      <TableCell>{post.analytics?.engagementRate?.toFixed(3) ?? "0.000"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Queue health</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Object.entries(data?.queue ?? {}).map(([name, status]) => (
                <div key={name} className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <Activity data-icon="inline-start" />
                    <p className="text-sm font-medium">{name}</p>
                  </div>
                  <Badge variant="secondary">{JSON.stringify(status)}</Badge>
                </div>
              ))}
              <Progress value={data ? 100 : 10} />
              <Button variant="outline"><Send data-icon="inline-start" />Queue status</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
