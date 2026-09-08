"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown, ImageDown, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report/ReportView";
import { useMuestra } from "@/hooks/useMuestras";
import { copyMuestraToClipboard } from "@/lib/excel";

export default function ReportePage() {
  const { id } = useParams<{ id: string }>();
  const m = useMuestra(id);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  const [copied, setCopied] = useState(false);

  async function renderCanvas() {
    const html2canvas = (await import("html2canvas")).default;
    if (!ref.current) return null;
    return html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  }

  async function exportPNG() {
    if (!m) return;
    setBusy("png");
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `Reporte_${m.codigo}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBusy(null);
    }
  }

  async function exportPDF() {
    if (!m) return;
    setBusy("pdf");
    try {
      const canvas = await renderCanvas();
      if (!canvas) return;
      const { jsPDF } = await import("jspdf");
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgW = pageW - 40;
      const imgH = imgW * ratio;
      let y = 20;
      // Si excede una página, escala para caber.
      if (imgH > pageH - 40) {
        const scaled = pageH - 40;
        pdf.addImage(img, "PNG", (pageW - scaled / ratio) / 2, 20, scaled / ratio, scaled);
      } else {
        pdf.addImage(img, "PNG", 20, y, imgW, imgH);
      }
      pdf.save(`Reporte_${m.codigo}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  async function copiar() {
    if (!m) return;
    await copyMuestraToClipboard(m);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!m) {
    return <main className="px-4 py-10 text-center text-sm text-muted">Cargando reporte…</main>;
  }

  return (
    <main className="px-4 py-4">
      {/* Barra de acciones */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/inspector/muestra/${m.id}`} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Editar muestra
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copiar}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar fila Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPNG} disabled={busy !== null}>
            {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            PNG (WhatsApp)
          </Button>
          <Button size="sm" onClick={exportPDF} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Reporte visible — responsivo, se adapta al ancho de la pantalla */}
      <div className="overflow-x-auto">
        <div className="rounded-lg border border-line shadow-sm">
          <ReportView variant="screen" muestra={m} />
        </div>
      </div>

      {/*
        Copia oculta con el ancho fijo de siempre (820px), fuera de la
        pantalla. Solo existe para que exportPNG()/exportPDF() la capturen
        con html2canvas — así el PNG/PDF compartido por WhatsApp mantiene
        siempre el mismo layout nítido, sin importar si quien exporta lo hace
        desde el celular o la computadora. No se ve en pantalla ni afecta la
        vista responsiva de arriba.
      */}
      <div aria-hidden style={{ position: "fixed", top: 0, left: -99999 }}>
        <ReportView ref={ref} variant="export" muestra={m} />
      </div>
    </main>
  );
}
