"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentPost } from "@/lib/api/types";

export type PostEditorValues = {
  title: string;
  hook?: string;
  content: string;
  hashtags?: string[];
};

type PostEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: AgentPost;
  onSave: (values: PostEditorValues) => Promise<unknown>;
  isPending?: boolean;
  error?: string | null;
};

export function PostEditorDialog({
  open,
  onOpenChange,
  post,
  onSave,
  isPending,
  error,
}: PostEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? (
          // Remount per open/post so fields seed from the latest values
          // without a setState-in-effect.
          <PostEditorForm
            key={post?.id ?? "new"}
            post={post}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
            isPending={isPending}
            error={error}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PostEditorForm({
  post,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  post?: AgentPost;
  onSave: (values: PostEditorValues) => Promise<unknown>;
  onCancel: () => void;
  isPending?: boolean;
  error?: string | null;
}) {
  const isEdit = Boolean(post);
  const [title, setTitle] = useState(post?.title ?? "");
  const [hook, setHook] = useState(post?.hook ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [hashtags, setHashtags] = useState((post?.hashtags ?? []).join(", "));

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !isPending;

  async function handleSave() {
    await onSave({
      title: title.trim(),
      hook: hook.trim() || undefined,
      content,
      hashtags: hashtags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit post" : "New post"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Editing an approved or scheduled post sends it back to pending approval."
            : "This publishes straight to your LinkedIn profile. Requires LinkedIn to be connected."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A short title for internal reference"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-hook">Hook (optional)</Label>
          <Input
            id="post-hook"
            value={hook}
            onChange={(event) => setHook(event.target.value)}
            placeholder="Defaults to the first line of the content"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-content">Content</Label>
          <Textarea
            id="post-content"
            className="min-h-64"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your LinkedIn post..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-hashtags">Hashtags (comma separated)</Label>
          <Input
            id="post-hashtags"
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
            placeholder="AI, SaaS, SoftwareEngineering"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={!canSave}>
          {isPending
            ? isEdit
              ? "Saving..."
              : "Publishing..."
            : isEdit
              ? "Save changes"
              : "Publish to LinkedIn"}
        </Button>
      </DialogFooter>
    </>
  );
}
