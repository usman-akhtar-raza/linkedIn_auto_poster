import Link from "next/link";
import { BarChart3, CheckSquare, FileText, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/approval", label: "Approval", icon: CheckSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles data-icon="inline-start" />
          </div>
          <div>
            <p className="text-sm font-semibold">LinkedIn Agent</p>
            <p className="text-xs text-muted-foreground">AI content operations</p>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
            >
              <item.icon data-icon="inline-start" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Next scheduled post</p>
            <p className="mt-1 text-xs text-muted-foreground">Today at 4:30 PM Asia/Karachi</p>
          </div>
        </div>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-medium">Production workspace</p>
            <p className="text-xs text-muted-foreground">Research, draft, approve, publish, measure</p>
          </div>
          <Button>
            <Sparkles data-icon="inline-start" />
            Generate post
          </Button>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
