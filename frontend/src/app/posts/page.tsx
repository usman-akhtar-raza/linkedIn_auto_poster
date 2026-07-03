"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, type Paginated } from "@/lib/api/client";
import type { AgentPost } from "@/lib/api/types";

export default function PostsPage() {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["posts", { search, status, page }],
    queryFn: () =>
      apiRequest<Paginated<AgentPost>>(
        `/posts?page=${page}&pageSize=10${search ? `&search=${encodeURIComponent(search)}` : ""}${status !== "ALL" ? `&status=${status}` : ""}`,
      ),
  });
  const generate = useMutation({
    mutationFn: () =>
      apiRequest<AgentPost>("/posts/drafts", {
        method: "POST",
        body: JSON.stringify({ topic, includeImage: true }),
      }),
    onSuccess: () => {
      setTopic("");
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>AI post editor</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="AI agents for content operations" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="draft">Draft preview</Label>
              <Textarea id="draft" className="min-h-72" value={query.data?.data?.[0]?.content ?? ""} readOnly />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate.mutate()} disabled={!topic || generate.isPending}>
                <Sparkles data-icon="inline-start" />Generate draft
              </Button>
              <Button variant="outline" disabled><ImagePlus data-icon="inline-start" />Image prompt</Button>
              <Button variant="secondary" disabled><Send data-icon="inline-start" />Send to approval</Button>
            </div>
            {generate.error ? <p className="text-sm text-destructive">{generate.error.message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Generated posts</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search posts" />
              <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
                <SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {query.isLoading ? <p className="text-sm text-muted-foreground">Loading posts...</p> : null}
            {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
            {(query.data?.data ?? []).map((post) => (
              <div key={post.id} className="rounded-md border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">{post.title}</p>
                  <Badge variant="outline">{post.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{post.hook}</p>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{query.data?.total ?? 0} posts</p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <Button variant="outline" disabled={(query.data?.data.length ?? 0) < 10} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
