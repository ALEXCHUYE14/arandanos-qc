"use client";

import Link from "next/link";
import { ClipboardCheck, LayoutDashboard, Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-brand text-white">
            <Leaf className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Control de Calidad — Arándanos</h1>
          <p className="mt-1 text-sm text-muted">
            Inspección de P.T. en clamshell · Línea de empaque · BH-F-CCA-006
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            href="/inspector"
            icon={<ClipboardCheck className="h-8 w-8" />}
            title="Inspector Calidad línea"
            desc="Captura rápida de muestras y clamshells, offline en línea de empaque."
          />
          <RoleCard
            href="/dashboard"
            icon={<LayoutDashboard className="h-8 w-8" />}
            title="Coordinador de Calidad"
            desc="Supervisión en tiempo real, reportes ejecutivos y sincronización con Excel."
          />
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Progressive Web App · Funciona sin conexión · Sincroniza al recuperar señal
        </p>
      </div>
    </main>
  );
}

function RoleCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-soft text-brand">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
