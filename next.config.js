/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Identificador de esta build, visible en la StatusBar (ver
  // components/StatusBar.tsx) — para poder confirmar de un vistazo (y con
  // una simple captura de pantalla) si un dispositivo está corriendo el
  // código más reciente o una versión vieja todavía sin actualizar. Antes
  // no había forma de saberlo salvo adivinar; varios reportes de bugs "ya
  // corregidos" resultaron ser el mismo navegador corriendo código viejo
  // sin refrescar de verdad. VERCEL_GIT_COMMIT_SHA lo completa Vercel solo
  // en cada deploy; en desarrollo local queda "local".
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
  },
  // El Service Worker vive en /public/sw.js y se registra desde el cliente.
  // Cabeceras para permitir el correcto funcionamiento del SW y del manifest.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
