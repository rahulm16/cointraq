"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import { CATEGORY_COLOR_HEX, type CategoryColor } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { formatDayShort, formatMonthLabel } from "@/lib/dates";

const PRIMARY = "var(--primary)";

function colorFor(color: CategoryColor | "ccbill" | "uncategorized"): string {
  if (color === "ccbill") return CATEGORY_COLOR_HEX.green.solid;
  if (color === "uncategorized") return "#8593AC";
  return CATEGORY_COLOR_HEX[color].solid;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control bg-surface border border-border px-2.5 py-1.5 shadow-[var(--shadow-card)]">
      {label && <div className="text-[11px] text-text-faint">{label}</div>}
      <div className="text-[12.5px] tnum font-medium text-text-primary">
        {payload[0].name ? `${payload[0].name}: ` : ""}
        {formatINR(payload[0].value)}
      </div>
    </div>
  );
}

export function DailyBars({ data }: { data: { date: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide />
        <Tooltip cursor={{ fill: "transparent" }} content={<TipDay />} />
        <Bar dataKey="total" fill={PRIMARY} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
function TipDay({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control bg-surface border border-border px-2.5 py-1.5 shadow-[var(--shadow-card)]">
      <div className="text-[11px] text-text-faint tnum">{label ? formatDayShort(label) : ""}</div>
      <div className="text-[12.5px] tnum font-medium text-text-primary">{formatINR(payload[0].value)}</div>
    </div>
  );
}

export function CategoryDonut({
  data,
}: {
  data: { label: string; value: number; color: CategoryColor | "ccbill" | "uncategorized" }[];
}) {
  if (data.length === 0) return <NoData />;
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={42} outerRadius={64} stroke="none" paddingAngle={1}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.color)} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 flex flex-col gap-1.5 min-w-0">
        {data.slice(0, 6).map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: colorFor(d.color) }} />
            <span className="text-text-secondary truncate flex-1">{d.label}</span>
            <span className="tnum text-text-primary">{formatINR(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendLine({ data }: { data: { month: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" tickFormatter={(m) => formatMonthLabel(m).slice(0, 3)} tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<TipMonth />} />
        <Line type="monotone" dataKey="total" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3, fill: PRIMARY }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
function TipMonth({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control bg-surface border border-border px-2.5 py-1.5 shadow-[var(--shadow-card)]">
      <div className="text-[11px] text-text-faint">{label ? formatMonthLabel(label) : ""}</div>
      <div className="text-[12.5px] tnum font-medium text-text-primary">{formatINR(payload[0].value)}</div>
    </div>
  );
}

export function MethodBars({ data }: { data: { name: string; total: number }[] }) {
  if (data.length === 0) return <NoData />;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.name} className="flex items-center gap-3">
          <span className="text-[12.5px] text-text-secondary w-20 truncate flex-none">{d.name}</span>
          <span className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${(d.total / max) * 100}%`, background: PRIMARY }} />
          </span>
          <span className="tnum text-[12.5px] text-text-primary w-16 text-right flex-none">{formatINR(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}

function NoData() {
  return <div className="text-[13px] text-text-faint py-6 text-center">No data this month.</div>;
}
