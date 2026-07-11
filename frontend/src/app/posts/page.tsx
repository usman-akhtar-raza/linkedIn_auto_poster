"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PostEditorDialog,
  type PostEditorValues,
} from "@/components/posts/post-editor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<AgentPost | undefined>(undefined);

  const invalidatePosts = () =>
    queryClient.invalidateQueries({ queryKey: ["posts"] });

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
      void invalidatePosts();
    },
  });

  const savePost = useMutation({
    retry: false,
    mutationFn: (values: PostEditorValues) =>
      editingPost
        ? apiRequest<AgentPost>(`/posts/${editingPost.id}`, {
            method: "PATCH",
            body: JSON.stringify(values),
          })
        : apiRequest<AgentPost>("/posts", {
            method: "POST",
            body: JSON.stringify(values),
          }),
    onSuccess: () => {
      setEditorOpen(false);
      setEditingPost(undefined);
      void invalidatePosts();
    },
  });

  const deletePost = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ deleted: boolean }>(`/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidatePosts(),
  });

  const importLinkedIn = useMutation({
    // Import failures (not connected / missing scope) are permanent client
    // errors — don't retry, surface them immediately.
    retry: false,
    mutationFn: () =>
      apiRequest<{ fetched: number; imported: number; skipped: number }>(
        "/posts/import-linkedin",
        { method: "POST" },
      ),
    onSuccess: () => void invalidatePosts(),
  });

  function openCreate() {
    setEditingPost(undefined);
    savePost.reset();
    setEditorOpen(true);
  }

  function openEdit(post: AgentPost) {
    setEditingPost(post);
    savePost.reset();
    setEditorOpen(true);
  }

  function confirmDelete(post: AgentPost) {
    const message = post.linkedinPostUrn
      ? `Delete "${post.title}"? This will also permanently delete it from LinkedIn. This cannot be undone.`
      : `Delete "${post.title}"? This cannot be undone.`;
    if (window.confirm(message)) {
      deletePost.mutate(post.id);
    }
  }

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
              <Label htmlFor="draft">Latest draft preview</Label>
              <Textarea id="draft" className="min-h-72" value={query.data?.data?.[0]?.content ?? ""} readOnly />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate.mutate()} disabled={!topic || generate.isPending}>
                <Sparkles data-icon="inline-start" />
                {generate.isPending ? "Generating..." : "Generate draft"}
              </Button>
              <Button variant="outline" onClick={openCreate}>
                <Plus data-icon="inline-start" />Write manually
              </Button>
            </div>
            {generate.error ? <p className="text-sm text-destructive">{generate.error.message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Posts</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => importLinkedIn.mutate()}
                disabled={importLinkedIn.isPending}
              >
                <Download data-icon="inline-start" />
                {importLinkedIn.isPending ? "Importing..." : "Import from LinkedIn"}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus data-icon="inline-start" />New post
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {importLinkedIn.data ? (
              <p className="text-sm text-muted-foreground">
                Imported {importLinkedIn.data.imported} post(s) from LinkedIn
                {importLinkedIn.data.skipped > 0
                  ? ` (${importLinkedIn.data.skipped} already present)`
                  : ""}
                .
              </p>
            ) : null}
            {importLinkedIn.error ? (
              <p className="text-sm text-destructive">{importLinkedIn.error.message}</p>
            ) : null}
            <div className="flex flex-col gap-3 md:flex-row">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search posts" />
              <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
                <SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {query.isLoading ? <p className="text-sm text-muted-foreground">Loading posts...</p> : null}
            {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : null}
            {deletePost.error ? <p className="text-sm text-destructive">{deletePost.error.message}</p> : null}
            {!query.isLoading && (query.data?.data.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet. Generate a draft or write one manually.</p>
            ) : null}
            {(query.data?.data ?? []).map((post) => (
              <div key={post.id} className="rounded-md border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium">{post.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{post.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" aria-label="Post actions" />}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEdit(post)}
                          disabled={post.status === "PUBLISHED"}
                        >
                          <Pencil data-icon="inline-start" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => confirmDelete(post)}
                        >
                          <Trash2 data-icon="inline-start" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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

      <PostEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingPost(undefined);
        }}
        post={editingPost}
        onSave={(values) => savePost.mutateAsync(values)}
        isPending={savePost.isPending}
        error={savePost.error?.message ?? null}
      />
    </AppShell>
  );
}
