"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type AnalyticsPoint = {
  day: string;
  impressions: number;
  engagement: number;
};

const chartConfig = {
  impressions: { label: "Impressions", color: "var(--chart-1)" },
  engagement: { label: "Engagement", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ImpressionsChart({ data }: { data: AnalyticsPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="impressions" fill="var(--color-impressions)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function EngagementChart({ data }: { data: AnalyticsPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="engagement" type="monotone" stroke="var(--color-engagement)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
