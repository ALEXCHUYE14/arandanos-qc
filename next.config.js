/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
