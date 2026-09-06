import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StatusBar } from "@/components/StatusBar";

export const metadata: Metadata = {
  title: "Control de Calidad — Arándanos | BH-F-CCA-006",
  description:
    "Sistema de inspección de calidad en planta empaquetadora de arándanos. Captura móvil offline-first y reportabilidad ejecutiva.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "QC Arándanos" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3B4C7A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-base font-sans antialiased">
        <Providers>
          <StatusBar />
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
