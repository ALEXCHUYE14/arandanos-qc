import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[72px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/**
 * Campo numérico "seguro": el número confirmado (`value`/`onCommit`) NUNCA
 * pasa por un "0" intermedio mientras el inspector borra el campo para
 * volver a tipear otro número.
 *
 * Bug real que esto corrige: un <input type="number"> controlado
 * directamente contra el estado (`value={x || ""}`,
 * `onChange={(e) => set(parseInt(e.target.value, 10) || 0)}`) confirma "0"
 * apenas el campo queda vacío a mitad de tipear (`parseInt("") || 0` es
 * `0`) — no recién cuando el inspector termina de escribir el número nuevo.
 * En "N° bayas evaluadas" eso significa que, por un instante, TODOS los
 * % del clamshell se calculan dividiendo por 0 y muestran 0.0% — y si en
 * ese instante el inspector se distrae (cambia de app, se bloquea la
 * pantalla), el guardado forzado al ocultar la pestaña (ver
 * muestra/[id]/page.tsx) confirma ESE cero como el valor real, no el que
 * pensaba escribir.
 *
 * Acá el texto que se ve mientras se tipea (`text`, estado local) está
 * desacoplado del valor confirmado: `onCommit` solo se llama con un número
 * válido de verdad (nunca con el vacío intermedio). Si el campo queda
 * vacío/ inválido al salir (blur), vuelve a mostrar el último valor
 * confirmado — no se puede "perder" el número por dejarlo a medio borrar.
 */
export const NumberInput = React.forwardRef<
  HTMLInputElement,
  {
    value: number;
    onCommit: (v: number) => void;
    min?: number;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "defaultValue">
>(({ value, onCommit, min = 0, className, ...props }, ref) => {
  const [text, setText] = React.useState(value === 0 ? "" : String(value));

  // Si el valor confirmado cambia desde AFUERA (ej. se cambió de clamshell,
  // o llegó una sincronización), se refleja acá — pero solo cuando de
  // verdad cambió, para no pisar lo que el inspector está tipeando en este
  // mismo instante con el eco de su propio onCommit.
  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      setText(value === 0 ? "" : String(value));
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setText(raw); // se ve lo tipeado siempre, aunque esté vacío o a medio escribir
    if (raw.trim() === "") return; // vacío: NO se confirma como 0 — se espera a que termine
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= min) {
      prevValue.current = n;
      onCommit(n);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const n = parseInt(text, 10);
    if (text.trim() === "" || !Number.isFinite(n) || n < min) {
      // Quedó vacío/inválido al salir del campo: vuelve a mostrar el último
      // valor confirmado en vez de dejarlo en blanco para siempre.
      setText(value === 0 ? "" : String(value));
    }
    props.onBlur?.(e);
  }

  return (
    <Input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={className}
      {...props}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});
NumberInput.displayName = "NumberInput";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1 block text-xs font-medium text-muted", className)} {...props} />
);

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  // Flecha propia (estilo filtro de Excel) en vez de la del navegador: con
  // "appearance-none" se ve igual en todos los navegadores/dispositivos, y
  // deja claro a simple vista que el campo es una lista desplegable. El
  // ícono tiene pointer-events-none, así que un toque/clic ahí cae igual
  // sobre el <select> de abajo y lo despliega — no hace falta un handler
  // aparte.
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full appearance-none rounded-md border border-line bg-surface px-3 py-2 pr-8 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
  </div>
));
Select.displayName = "Select";
