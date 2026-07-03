"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, type Paginated } from "@/lib/api/client";
import type { AgentPost } from "@/lib/api/types";

export default function ApprovalPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["posts", { status: "PENDING_APPROVAL" }],
    queryFn: () => apiRequest<Paginated<AgentPost>>("/posts?status=PENDING_APPROVAL&page=1&pageSize=20"),
  });
  const approve = useMutation({
    mutationFn: (postId: string) => apiRequest<AgentPost>(`/posts/${postId}/approve`, { method: "POST" }),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      queryClient.setQueryData<Paginated<AgentPost>>(["posts", { status: "PENDING_APPROVAL" }], (old) =>
        old ? { ...old, data: old.data.filter((post) => post.id !== postId), total: old.total - 1 } : old,
      );
    },
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

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Approval</h1>
          <p className="text-muted-foreground">Review generated content before it can be published to LinkedIn.</p>
        </div>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading approvals...</p> : null}
        {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
        {(query.data?.data ?? []).map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{post.title}</CardTitle>
                <Badge>{post.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="whitespace-pre-line rounded-md border bg-muted/30 p-4 text-sm leading-6">{post.content}</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => approve.mutate(post.id)} disabled={approve.isPending}><Check data-icon="inline-start" />Approve</Button>
                <Button variant="outline" onClick={() => reject.mutate(post.id)} disabled={reject.isPending}><X data-icon="inline-start" />Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
