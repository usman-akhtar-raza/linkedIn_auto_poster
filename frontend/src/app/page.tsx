"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const response = await fetch(`${apiUrl}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined, email, password }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ message: "Could not create account." }));
          throw new Error(typeof body.message === "string" ? body.message : "Could not create account.");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email or password.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="space-y-5">
          <div className="inline-flex items-center rounded-md border px-3 py-1 text-sm text-muted-foreground">
            Production LinkedIn content operations
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Research, draft, approve, publish, and measure LinkedIn posts.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Sign in to manage your AI content pipeline, LinkedIn connection, queues, schedules, and analytics.
            </p>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Access your workspace</CardTitle>
            <CardDescription>Use your account credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")}>
              <TabsList className="mb-5 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value={mode}>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {mode === "signup" ? (
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Usman Akhtar"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button className="w-full" type="submit" disabled={isSubmitting || status === "loading"}>
                    {isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : mode === "signin" ? <LogIn data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
