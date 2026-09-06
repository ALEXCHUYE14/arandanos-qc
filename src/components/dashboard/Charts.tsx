"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { EmpacadorRow, SemanaRow } from "@/lib/analytics";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function DescarteEmpacadorChart({ data }: { data: EmpacadorRow[] }) {
  const top = data.slice(0, 10).map((d) => ({
    name: d.empacador.length > 16 ? d.empacador.slice(0, 16) + "…" : d.empacador,
    descarte: +(d.pctDescarte * 100).toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} unit="%" />
        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: "#0F172A" }} />
        <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="descarte" radius={[0, 4, 4, 0]}>
          {top.map((d, i) => (
            <Cell key={i} fill={d.descarte > 10 ? "#DC2626" : d.descarte > 5 ? "#EA580C" : "#16A34A"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TendenciaSemanalChart({ data }: { data: SemanaRow[] }) {
  const rows = data.map((d) => ({
    semana: `S${d.semana}`,
    Descarte: +(d.pctDescarte * 100).toFixed(2),
    "Cat 1": +(d.pctCat1 * 100).toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#64748B" }} />
        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} unit="%" />
        <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="Descarte" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Cat 1" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export { pct };
