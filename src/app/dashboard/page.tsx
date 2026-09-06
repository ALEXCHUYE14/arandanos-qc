"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Home,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Boxes,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { DescarteEmpacadorChart, TendenciaSemanalChart } from "@/components/dashboard/Charts";
import { useMuestras } from "@/hooks/useMuestras";
import { computeMuestra } from "@/lib/calc";
import { overview, porEmpacador, porSemana } from "@/lib/analytics";
import { downloadXlsx, copyManyToClipboard } from "@/lib/excel";
import { fullSync, resolveConflictKeepLocal, resolveConflictUseServer } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fmtDateUI } from "@/lib/utils";

export default function DashboardPage() {
  const all = useMuestras() ?? [];
  const [fEmpacador, setFEmpacador] = useState("");
  const [fSemana, setFSemana] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const conflictos = useMemo(() => all.filter((m) => m.sync === "conflict").length, [all]);

  async function keepLocal(id: string) {
    setResolvingId(id);
    try {
      await resolveConflictKeepLocal(id);
    } catch (e) {
      console.error("[conflicto] no se pudo conservar la versión local", e);
    } finally {
      setResolvingId(null);
    }
  }

  async function pickServerVersion(id: string) {
    setResolvingId(id);
    try {
      await resolveConflictUseServer(id);
    } catch (e) {
      console.error("[conflicto] no se pudo traer la versión del servidor", e);
    } finally {
      setResolvingId(null);
    }
  }

  const empacadores = useMemo(
    () => Array.from(new Set(all.map((m) => m.empacador).filter(Boolean))).sort(),
    [all]
  );
  const semanas = useMemo(
    () => Array.from(new Set(all.map((m) => m.semana).filter((s): s is number => s != null))).sort((a, b) => a - b),
    [all]
  );

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (fEmpacador && m.empacador !== fEmpacador) return false;
      if (fSemana && String(m.semana) !== fSemana) return false;
      if (fEstado) {
        const cumple = computeMuestra(m).cumple;
        if (fEstado === "cumple" && !cumple) return false;
        if (fEstado === "no" && cumple) return false;
      }
      return true;
    });
  }, [all, fEmpacador, fSemana, fEstado]);

  const stats = useMemo(() => overview(filtered), [filtered]);
  const emp = useMemo(() => porEmpacador(filtered), [filtered]);
  const sem = useMemo(() => porSemana(filtered), [filtered]);

  async function copiarTodo() {
    await copyManyToClipboard(filtered);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sincronizar() {
    if (!isSupabaseConfigured) return;
    setSyncing(true);
    try {
      await fullSync();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="px-4 py-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Home className="h-3.5 w-3.5" /> Inicio
          </Link>
          <h1 className="text-xl font-bold text-ink">Jefatura de Calidad</h1>
          <p className="text-xs text-muted">Supervisión de inspección en línea de empaque</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {conflictos > 0 && (
            <Badge variant="danger">
              <AlertTriangle className="h-3 w-3" /> {conflictos} conflicto(s) de sync — ver tabla
            </Badge>
          )}
          {isSupabaseConfigured && (
            <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={copiarTodo}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            Copiar todo
          </Button>
          <Button size="sm" onClick={() => downloadXlsx(filtered)}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar XLSX
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Boxes className="h-5 w-5" />} label="Muestras" value={String(stats.totalMuestras)} sub={`${stats.totalClamshells} clamshells`} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-success" />} label="Cumplimiento" value={`${(stats.pctCumplimiento * 100).toFixed(0)}%`} sub="muestras conformes" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-danger" />} label="Descarte prom." value={`${(stats.pctDescartePromedio * 100).toFixed(1)}%`} sub="por muestra" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Cat 1 prom." value={`${(stats.pctCat1Promedio * 100).toFixed(1)}%`} sub="calidad primera" />
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <div>
            <Label>Empacador</Label>
            <Select value={fEmpacador} onChange={(e) => setFEmpacador(e.target.value)}>
              <option value="">Todos</option>
              {empacadores.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Semana</Label>
            <Select value={fSemana} onChange={(e) => setFSemana(e.target.value)}>
              <option value="">Todas</option>
              {semanas.map((s) => (
                <option key={s} value={s}>S{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="cumple">CUMPLE</option>
              <option value="no">NO CUMPLE</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => { setFEmpacador(""); setFSemana(""); setFEstado(""); }}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Descarte por empacador</h3>
            {emp.length ? <DescarteEmpacadorChart data={emp} /> : <Empty />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Tendencia semanal</h3>
            {sem.length ? <TendenciaSemanalChart data={sem} /> : <Empty />}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de muestras */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-base text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Empacador</th>
                  <th className="px-3 py-2">Variedad</th>
                  <th className="px-3 py-2">Sem.</th>
                  <th className="px-3 py-2">Empaque</th>
                  <th className="px-3 py-2 text-right">Cat 1</th>
                  <th className="px-3 py-2 text-right">Descarte</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const r = computeMuestra(m);
                  return (
                    <tr key={m.id} className="border-b border-line/60 hover:bg-base/50">
                      <td className="px-3 py-2 font-mono font-semibold text-ink">{m.codigo}</td>
                      <td className="px-3 py-2">{m.empacador || "—"}</td>
                      <td className="px-3 py-2">{m.variedad || "—"}</td>
                      <td className="px-3 py-2">{m.semana ?? "—"}</td>
                      <td className="px-3 py-2">{fmtDateUI(m.fechaEmpaque)}</td>
                      <td className="px-3 py-2 text-right text-success">{(r.pctCat1 * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-semibold text-danger">{(r.pctDescarte * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={r.cumple ? "success" : "danger"}>{r.cumple ? "CUMPLE" : "NO CUMPLE"}</Badge>
                          {m.sync === "conflict" && <Badge variant="danger">conflicto</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {m.sync === "conflict" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resolvingId === m.id}
                              onClick={() => keepLocal(m.id)}
                              title="Conservar la versión de este dispositivo"
                            >
                              Conservar la mía
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={resolvingId === m.id}
                              onClick={() => pickServerVersion(m.id)}
                              title="Descartar mis cambios y traer la versión del servidor"
                            >
                              Usar la del servidor
                            </Button>
                          </div>
                        ) : (
                          <Link href={`/reporte/${m.id}`}>
                            <Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted">
                      No hay muestras que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2 text-muted">
          {icon}
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-xs text-muted">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-[280px] items-center justify-center text-sm text-muted">Sin datos suficientes</div>;
}
