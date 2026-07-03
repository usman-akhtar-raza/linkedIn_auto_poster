"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, RefreshCcw, Save, Unplug } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api/client";
import type { LinkedInStatus } from "@/lib/api/types";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["linkedin-status"],
    queryFn: () => apiRequest<LinkedInStatus>("/linkedin/status"),
  });
  const connect = useMutation({
    mutationFn: () => apiRequest<{ url: string }>("/linkedin/oauth/url"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
  const disconnect = useMutation({
    mutationFn: () => apiRequest<LinkedInStatus>("/linkedin/disconnect", { method: "DELETE" }),
    onSuccess: (data) => {
      queryClient.setQueryData(["linkedin-status"], data);
    },
  });

  const connected = status.data?.connected;

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>LinkedIn connection</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border p-4">
              <p className="font-medium">{connected ? "Connected" : "Not connected"}</p>
              <p className="text-sm text-muted-foreground">
                {status.isLoading
                  ? "Checking LinkedIn connection..."
                  : status.error
                    ? status.error.message
                    : status.data?.memberUrn ?? "OAuth stores encrypted access and refresh tokens on the backend."}
              </p>
              {status.data?.organizations?.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {status.data.organizations.map((organization) => (
                    <p key={organization.organizationId} className="text-xs text-muted-foreground">
                      {organization.localizedName ?? organization.organizationUrn} ({organization.role ?? "member"})
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connected ? <RefreshCcw data-icon="inline-start" /> : <Link data-icon="inline-start" />}
                {connected ? "Reconnect LinkedIn" : "Connect LinkedIn"}
              </Button>
              <Button variant="outline" onClick={() => disconnect.mutate()} disabled={!connected || disconnect.isPending}>
                <Unplug data-icon="inline-start" />Disconnect
              </Button>
            </div>
            {connect.error ? <p className="text-sm text-destructive">{connect.error.message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI configuration</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">OpenRouter model</Label>
              <Input id="model" defaultValue="openai/gpt-4.1-mini" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Generate images</p>
                <p className="text-xs text-muted-foreground">Create image prompts with each approved post.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Scheduling</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select defaultValue="WEEKDAYS">
                <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="WEEKDAYS">Weekdays</SelectItem>
                  <SelectItem value="CUSTOM_CRON">Custom cron</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" defaultValue="Asia/Karachi" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Prompt configuration</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea className="min-h-56" defaultValue="You are an expert LinkedIn ghostwriter specializing in software engineering, SaaS startups, AI, and entrepreneurship." />
            <Button><Save data-icon="inline-start" />Save prompt</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
