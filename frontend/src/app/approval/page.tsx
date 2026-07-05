"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Send, X } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, type Paginated } from "@/lib/api/client";
import type { AgentPost } from "@/lib/api/types";

export default function ApprovalPage() {
  const queryClient = useQueryClient();
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["posts", { workflow: "approval-publishing" }],
    queryFn: () => apiRequest<Paginated<AgentPost>>("/posts?page=1&pageSize=50"),
  });
  const approve = useMutation({
    mutationFn: (postId: string) => apiRequest<AgentPost>(`/posts/${postId}/approve`, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  const reject = useMutation({
    mutationFn: (postId: string) =>
      apiRequest<AgentPost>(`/posts/${postId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected from approval screen" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  const publish = useMutation({
    mutationFn: (postId: string) => apiRequest<AgentPost>(`/posts/${postId}/publish`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  const schedule = useMutation({
    mutationFn: (postId: string) => {
      const value = scheduleTimes[postId];
      if (!value) {
        throw new Error("Choose a publish time first.");
      }

      return apiRequest<AgentPost>(`/posts/${postId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledFor: new Date(value).toISOString() }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const actionablePosts = (query.data?.data ?? []).filter((post) =>
    ["PENDING_APPROVAL", "APPROVED", "SCHEDULED"].includes(post.status),
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Approval</h1>
          <p className="text-muted-foreground">Review generated content before it can be published to LinkedIn.</p>
        </div>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading approvals...</p> : null}
        {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
        {actionablePosts.length === 0 && !query.isLoading ? (
          <p className="text-sm text-muted-foreground">No posts are waiting for approval or publishing.</p>
        ) : null}
        {actionablePosts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{post.title}</CardTitle>
                <Badge>{post.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="whitespace-pre-line rounded-md border bg-muted/30 p-4 text-sm leading-6">{post.content}</div>
              {post.scheduledFor ? (
                <p className="text-sm text-muted-foreground">
                  Scheduled for {new Date(post.scheduledFor).toLocaleString()}
                </p>
              ) : null}
              {post.status === "PENDING_APPROVAL" ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => approve.mutate(post.id)} disabled={approve.isPending}><Check data-icon="inline-start" />Approve</Button>
                  <Button variant="outline" onClick={() => reject.mutate(post.id)} disabled={reject.isPending}><X data-icon="inline-start" />Reject</Button>
                </div>
              ) : null}
              {post.status === "APPROVED" || post.status === "SCHEDULED" ? (
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`schedule-${post.id}`}>Publish time</Label>
                    <Input
                      id={`schedule-${post.id}`}
                      type="datetime-local"
                      value={scheduleTimes[post.id] ?? ""}
                      onChange={(event) =>
                        setScheduleTimes((current) => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button variant="outline" onClick={() => schedule.mutate(post.id)} disabled={schedule.isPending}>
                    <CalendarClock data-icon="inline-start" />Schedule
                  </Button>
                  <Button onClick={() => publish.mutate(post.id)} disabled={publish.isPending}>
                    <Send data-icon="inline-start" />Publish now
                  </Button>
                </div>
              ) : null}
              {publish.error ? <p className="text-sm text-destructive">{publish.error.message}</p> : null}
              {schedule.error ? <p className="text-sm text-destructive">{schedule.error.message}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
