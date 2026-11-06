import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Row } from "@/lib/crm/schema";
import { asNumber, money, parseDate, withinRange } from "@/lib/utils";

const BRASS = "var(--color-brass)";
const FOREST = "var(--color-forest)";
const INK = "var(--color-ink)";
const CLAY = "var(--color-clay)";
const MUTED = "var(--color-muted)";
const SLICE = [FOREST, BRASS, INK, CLAY, MUTED];

function monthKey(value: unknown) {
  const d = parseDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Analytics({
  leads,
  shipments,
  financing,
  logistics,
}: {
  leads: Row[];
  shipments: Row[];
  financing: Row[];
  logistics: Row[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [focus, setFocus] = useState<"pipeline" | "freight" | "finance">("pipeline");

  const filteredLeads = useMemo(
    () => leads.filter((r) => withinRange(r.createdAt, from, to)),
    [leads, from, to],
  );
  const filteredShips = useMemo(
    () => shipments.filter((r) => withinRange(r.departure_date || r.arrival_date, from, to)),
    [shipments, from, to],
  );

  const stages = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of filteredLeads) {
      const key = String(lead.stage || "Unset");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredLeads]);

  const credit = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of filteredLeads) {
      const key = String(lead.creditStatus || "unknown").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of filteredLeads) {
      const key = monthKey(lead.createdAt);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, leads]) => ({ month, leads }));
  }, [filteredLeads]);

  const shipStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredShips) {
      const key = String(row.shipment_status || "Unset");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [filteredShips]);

  const rates = financing.map((row) => ({
    name: String(row.partner_name || row.financing_id),
    rate: asNumber(row.interest_rate) ?? 0,
  }));

  const cost = [
    { name: "Ocean", value: sum(filteredShips, "ocean_freight_cost") + sum(logistics, "ocean_freight_cost") },
    { name: "Inland", value: sum(filteredShips, "inland_transport_cost") + sum(logistics, "inland_transport_cost") },
    { name: "Clearance", value: sum(logistics, "clearance_cost") },
    { name: "Insurance", value: sum(logistics, "insurance_cost") },
  ];

  const pipeline = filteredLeads.reduce((n, row) => n + (asNumber(row.budget) ?? 0), 0);
  const activePartners = financing.filter((r) => String(r.active_status || "").toLowerCase() === "active").length;

  function preset(days: number | "ytd" | "all") {
    if (days === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    if (days === "ytd") start.setMonth(0, 1);
    else start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-2xl">Desk analytics</h2>
          <p className="text-sm text-muted">Filter by created date for leads and departure date for shipments.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {[
            ["30d", 30],
            ["90d", 90],
            ["YTD", "ytd"],
            ["All", "all"],
          ].map(([label, value]) => (
            <button
              key={label}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              onClick={() => preset(value as number | "ytd" | "all")}
            >
              {label}
            </button>
          ))}
          <label className="text-xs text-muted">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-muted">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink" />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Leads in range" value={String(filteredLeads.length)} />
        <Stat label="Numeric pipeline" value={money(pipeline)} />
        <Stat label="Shipments in range" value={String(filteredShips.length)} />
        <Stat label="Active lenders" value={String(activePartners)} />
      </div>

      <div className="flex gap-2">
        {(
          [
            ["pipeline", "Pipeline"],
            ["freight", "Freight"],
            ["finance", "Finance"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFocus(id)}
            className={`rounded-md px-3 py-2 text-sm ${focus === id ? "bg-ink text-paper" : "bg-surface text-ink border border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {focus === "pipeline" ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <ChartCard title="Leads by stage" className="lg:col-span-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stages} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill={BRASS} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Credit mix" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={credit} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {credit.map((entry, i) => (
                    <Cell key={entry.name} fill={SLICE[i % SLICE.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Leads created by month" className="lg:col-span-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="leads" stroke={FOREST} strokeWidth={2} dot={{ r: 3, fill: FOREST }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}

      {focus === "freight" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Shipments by status">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shipStatus}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill={FOREST} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Cost stack (visible rows)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cost}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={48} />
                <Tooltip />
                <Bar dataKey="value" fill={BRASS} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}

      {focus === "finance" ? (
        <ChartCard title="Partner interest rates">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rates} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="var(--color-line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="rate" fill={INK} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}

function sum(rows: Row[], key: string) {
  return rows.reduce((n, row) => n + (asNumber(row[key]) ?? 0), 0);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <h3 className="mb-2 font-display text-lg">{title}</h3>
      <div className="h-64">{children}</div>
    </section>
  );
}
