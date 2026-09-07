# Sistema de Control de Calidad — Arándanos (BH-F-CCA-006)

PWA offline-first para la inspección de calidad de producto terminado (P.T.) en
clamshell en planta empaquetadora de arándanos. Dos roles: **Inspector de campo**
(captura móvil) y **Jefatura de Calidad** (dashboard + reportería + sincronización
con el Excel maestro).

Construido con **Next.js 15 (App Router, TypeScript)**, **Tailwind CSS**,
**Supabase** (PostgreSQL + RLS + Realtime + Auth), **Dexie/IndexedDB** (offline),
**Zustand**, **Recharts**, y export **PDF/PNG** + **Excel**.

---

## 1. Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # (opcional) completar credenciales de Supabase
npm run dev                  # http://localhost:3000
```

> Sin credenciales de Supabase la app corre en **modo local**: todo se guarda en
> IndexedDB del dispositivo. Ideal para demo y pruebas de campo. Al configurar
> Supabase, se activa la sincronización en la nube y el tiempo real.

Comandos útiles: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`.

---

## 2. Configurar Supabase

1. Crea un proyecto en <https://supabase.com>.
2. En **SQL Editor** pega y ejecuta el archivo [`supabase/schema.sql`](supabase/schema.sql).
   Crea tablas (`muestras`, `clamshells`, `profiles`, `defect_catalog`), índices,
   políticas **RLS**, funciones **RPC** (`rendimiento_empacador`, `rendimiento_semanal`)
   y activa **Realtime**.
3. En **Project Settings → API** copia `URL` y `anon key` a tu `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Crea usuarios en **Authentication → Users → Add user** (correo + contraseña).
   No hay auto-registro: las cuentas las da de alta un administrador desde ahí.
   Cada usuario nuevo obtiene automáticamente una fila en `profiles` con
   `rol = 'inspector'` (trigger `handle_new_user`). Para marcar a alguien como
   Jefatura de Calidad:
   ```sql
   update public.profiles set rol = 'jefatura'
   where id = (select id from auth.users where email = 'betsy@empresa.com');
   ```
5. Con `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` configurados, `/login` pasa a ser
   obligatorio para entrar (lo aplica `src/middleware.ts`) y `/dashboard` queda
   restringido a perfiles `jefatura` — un `inspector` que intente entrar es
   redirigido a `/inspector`. Sin esas variables, el sistema sigue 100% abierto
   y local, como antes.

---

## 3. Despliegue en Vercel

1. Sube el proyecto a un repositorio (GitHub/GitLab).
2. En <https://vercel.com> → **Add New Project** → importa el repo. Vercel detecta
   Next.js automáticamente.
3. En **Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy**. Al terminar tendrás la URL pública (instalable como PWA desde el
   navegador: "Agregar a pantalla de inicio").

Alternativa por CLI:
```bash
npm i -g vercel
vercel            # primer deploy (preview)
vercel --prod     # producción
```

---

## 4. Modelo de datos (fiel al Excel maestro)

- **Cada fila del Excel = un clamshell.** Los clamshells se agrupan en una
  **muestra** (lote, código `ME-XXXXX`); la cabecera se repite por fila.
- **Porcentajes**: `% = conteo de bayas con defecto / N° de bayas evaluadas`
  (por clamshell), exactamente como las fórmulas del maestro.
- **KPIs de muestra**: `Descarte` = defectos críticos (cols 39–71) / total bayas;
  `Aprovechable` = defectos leves (cols 27–38) / total bayas;
  `Cat 1 = 1 − Aprovechable − Descarte`.
- **Veredicto**: `ESTÁNDAR /CLAMSHELL = CUMPLE si NOTA = 15`. La app deriva la
  NOTA/veredicto desde la hoja **Tolerancias** (umbrales por categoría + suma ≤ 10%),
  y permite que el inspector la ajuste manualmente.
- El mapa exacto de las **124 columnas** vive en [`src/lib/columns.ts`](src/lib/columns.ts).

---

## 5. Integración con el Excel maestro (sin descuadres)

- **Copiar fila para Excel Maestro**: genera los valores en las 124 columnas
  delimitados por tabulación. En la hoja `Base de Datos`, ubícate en la primera
  celda de datos de una fila nueva y pega con `Ctrl+V`: cada valor cae en su
  columna sin mover encabezados.
- **Exportar XLSX**: descarga un `.xlsx` con la hoja `Base de Datos` (124 columnas)
  y reproduce las hojas `Tolerancias` y `Control de Cambios`.

> Los porcentajes se exportan como fracción (0–1); las celdas del maestro tienen
> formato de porcentaje, por lo que se muestran correctamente al pegar.

---

## 6. Estructura del proyecto

```
src/
  middleware.ts            Protección de rutas (login obligatorio, /dashboard = jefatura)
  app/                     Rutas (Next App Router)
    page.tsx               Selector de rol
    login/                 Login (email + contraseña, Supabase Auth)
    inspector/             Lista + captura móvil
    reporte/[id]/          Reporte visual + export PDF/PNG
    dashboard/             Panel de Jefatura de Calidad
  components/
    ui/                    Primitivos (button, card, input, badge)
    inspector/             Captura (contador de defectos, formularios)
    report/                Reporte visual 1:1
    dashboard/             Gráficos (Recharts)
    StatusBar.tsx          Estado de conexión/sync + sesión activa (logout)
  lib/
    defects.ts             Catálogo de 45 defectos + tolerancias
    columns.ts             Mapa exacto de las 124 columnas
    calc.ts                Motor de cálculo (% , KPIs, CUMPLE/NO CUMPLE)
    excel.ts               Copiar TSV + export XLSX
    db.ts / sync.ts        IndexedDB (Dexie) + sincronización Supabase
    analytics.ts           Agregaciones del dashboard
    supabase.ts            Cliente de navegador (cookies vía @supabase/ssr)
    supabase-middleware.ts Cliente para middleware.ts (Edge)
  hooks/
    useMuestras.ts         Acceso a datos (dexie-react-hooks)
    useAuthSync.ts         Sincroniza sesión de Supabase Auth → store
supabase/schema.sql        Script completo de base de datos
public/                    manifest, service worker, íconos PWA
```

---

## 7. Notas de calidad / decisiones

- Los umbrales de `RESIDUOS DE COSECHA`, `DEFECTOS DE APARIENCIA` y `OTROS` se
  fijaron en 5% (inferido del layout de la hoja *Tolerancias*). Son parametrizables
  en `src/lib/defects.ts` (`TOLERANCES`).
- Para preservación 100% de formato/fórmulas del `.xlsx` original puede sustituirse
  `xlsx` (SheetJS) por `exceljs` en `src/lib/excel.ts`; el mapa de columnas ya está
  listo para ambos.
- Sin conexión, la captura sigue funcionando y se sincroniza automáticamente al
  recuperar señal (ver `src/app/providers.tsx`).
