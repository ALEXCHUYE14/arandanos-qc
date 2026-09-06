import type { Config } from "tailwindcss";

/**
 * Paleta "Natural / Agrónoma" — sobria, sin gradientes neón ni estética IA.
 * Fondo gris neutro claro, bordes limpios, texto gris oscuro.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Superficies
        base: "#F8FAFC", // fondo gris neutro claro
        surface: "#FFFFFF",
        line: "#E2E8F0", // bordes limpios
        ink: "#0F172A", // texto principal gris oscuro
        muted: "#64748B",
        // Estados
        success: "#16A34A", // verde éxito
        danger: "#DC2626", // rojo alerta
        warning: "#EA580C", // naranja advertencia
        // Marca agrónoma (arándano) — usada con moderación
        brand: {
          DEFAULT: "#3B4C7A", // azul arándano profundo
          soft: "#EEF2FB",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
