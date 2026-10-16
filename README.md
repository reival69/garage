# Garage

Garage — Prompt 1: Fundación

Vamos a construir Garage, un SaaS multitenant para talleres mecánicos. Este es el primer prompt: construye SOLO la fundación descrita aquí. No construyas todavía la lógica interna de los módulos (vendrá en prompts posteriores).

Contexto del producto

Garage tiene tres tipos de usuario, cada uno con su vista:

Superadmin — el dueño del SaaS. Gestiona talleres (tenants), planes y métricas globales.

Taller (tenant) — el cliente que se suscribe. Gestiona citas, clientes, vehículos, órdenes de reparación, presupuestos, facturación y servicios.

Cliente final (invitado) — el dueño del coche. Entra con un código generado, sin registro, desde el móvil, para ver el estado de su coche, fotos, inspección y aprobar presupuestos.

La pieza central de todo es la orden de reparación (WorkOrder), que conecta al taller con su cliente final.

Reglas técnicas (MUY IMPORTANTE)

Stack: React + TypeScript + Tailwind + shadcn/ui.

Esto es una demo 100% local: TODO está simulado y nada sale del navegador. Sin backend, sin Supabase, sin APIs externas, sin pasarelas de pago, sin envío real de emails/SMS/WhatsApp. Cualquier acción de ese tipo (enviar presupuesto, cobrar factura, notificar al cliente, suscripción a un plan) se simula y se registra en local.

Toda la persistencia es localStorage. Pero el acceso a datos debe pasar SIEMPRE por una capa de datos (/src/lib/db) con repositorios por entidad. Nada de leer/escribir localStorage directamente desde los componentes. Esto es para poder migrar a una base de datos real más adelante cambiando solo esa capa.

Multitenancy simulada: los datos de cada taller se guardan namespaced por su tenantId (clave talleo:{tenantId}:{collection}). Las colecciones globales (tenants, plans, users del sistema) van bajo talleo:global:{collection}.

Autenticación simulada: cualquier login entra, no hay validación real ni contraseñas reales.

Las fotos y firmas se guardan como base64 en localStorage. Limita resolución y cantidad para no reventar el límite (~5 MB).

Copy/UI en español. Identificadores de código y nombres de tipos en inglés.

Sistema de diseño

Estética monocromática, minimalista y mobile-first. Mucho espacio en blanco, bordes sutiles, sombras casi inexistentes, esquinas redondeadas medias (rounded-xl).

Tipografía: Plus Jakarta Sans (importar de Google Fonts). Títulos con peso 600–700, cuerpo 400–500.

Paleta neutra basada en la escala zinc. Fondos claros (#FAFAFA, blanco) y superficies oscuras #0A0A0A para modo oscuro más adelante.

Un único color de acento de marca, definido como variable CSS --talleo-accent en :root. Valor por defecto: #2F6FED (azul grafito sobrio). Todo el color de marca (botones primarios, enlaces activos, indicadores) usa esa variable. Cambiar de marca = cambiar esa línea.

Colores funcionales reservados exclusivamente para estados (no decorativos): verde #16A34A = ok, ámbar #D97706 = atención, rojo #DC2626 = crítico. Se usarán en el semáforo del DVI y en los badges de estado.

Logo: wordmark de texto «Garage» en Plus Jakarta Sans 700, monocromo. Crea un componente <Logo /> reutilizable.

Crea un set de componentes base reutilizables: PageHeader, EmptyState, StatCard, StatusBadge, DataCard. El StatusBadge recibe un estado y pinta color + etiqueta en español.

Modelo de datos

Crea estos tipos en /src/types/index.ts. Incluye locationId desde ya aunque aún no usemos multi-sucursal (para no refactorizar luego).

export type Role = 'superadmin' | 'owner' | 'staff' | 'mechanic';
export type PlanTier = 'basico' | 'pro' | 'premium';

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  limits: { maxOrders: number; maxUsers: number; maxPhotosPerOrder: number };
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  accentColor: string;     // sobrescribe --talleo-accent para ese taller
  planId: string;
  status: 'active' | 'suspended';
  currency: string;        // p.ej. 'EUR'
  taxRate: number;         // p.ej. 0.21
  locations: Location[];
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string | null; // null = superadmin del sistema
  name: string;
  email: string;
  role: Role;
  locationId?: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  km: number;
  vin?: string;
  color?: string;
  notes?: string;
}

export type WorkOrderStatus =
  | 'recibido'
  | 'diagnostico'
  | 'presupuesto_enviado'
  | 'aprobado'
  | 'en_reparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export interface QuoteItem {
  id: string;
  type: 'labor' | 'part';
  description: string;
  qty: number;
  unitPrice: number;
  approval: 'pending' | 'approved' | 'rejected';
}

export interface Photo {
  id: string;
  url: string; // base64
  label: 'recepcion' | 'antes' | 'despues' | 'detalle';
  note?: string;
  createdAt: string;
}

export interface BodyDamageMark { x: number; y: number; note?: string }

export interface CheckIn {
  km: number;
  fuelLevel: number; // 0–100
  bodyDamage: BodyDamageMark[];
  customerSignature?: string; // base64 de la firma
  createdAt: string;
}

export interface InspectionItem {
  id: string;
  name: string;            // p.ej. 'Pastillas de freno'
  status: 'ok' | 'atencion' | 'critico';
  note?: string;
  photoId?: string;
}

export interface Inspection {
  items: InspectionItem[];
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  from: 'shop' | 'customer';
  text: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  locationId: string;
  customerId: string;
  vehicleId: string;
  mechanicId?: string;
  status: WorkOrderStatus;
  problemDescription: string;
  internalNotes?: string;          // NO visible al cliente
  accessCode: string;              // código de 6 caracteres para la vista invitada
  items: QuoteItem[];
  photos: Photo[];
  checkIn?: CheckIn;
  inspection?: Inspection;
  messages: OrderMessage[];
  estimatedReadyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  workOrderId: string;
  number: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'partial';
  createdAt: string;
}

export type AppointmentStatus =
  | 'programada' | 'confirmada' | 'en_taller' | 'completada' | 'no_show';

export interface Appointment {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string;
  vehicleId?: string;
  serviceIds: string[];
  scheduledAt: string;
  status: AppointmentStatus;
  source: 'manual' | 'online';
  notes?: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  basePrice: number;
  estimatedMinutes: number;
}

export interface Part {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  sku?: string;
}

export interface AppNotification {
  id: string;
  tenantId: string;
  type: 'cita' | 'presupuesto' | 'estado' | 'recordatorio';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}


Capa de datos (/src/lib/db)

Un módulo storage.ts con helpers genéricos: read<T>(collection, tenantId), write<T>(collection, tenantId, items), usando las claves namespaced descritas arriba (talleo:{tenantId}:{collection} y talleo:global:{collection}).

Un conjunto de repositorios por entidad (tenantsRepo, usersRepo, customersRepo, vehiclesRepo, workOrdersRepo, invoicesRepo, appointmentsRepo, servicesRepo, partsRepo, notificationsRepo) con CRUD básico (list, getById, create, update, remove). El consumo desde componentes SIEMPRE pasa por estos repos.

Helper findWorkOrderByAccessCode(code) que busca en todos los talleres la orden cuyo accessCode coincida (para la vista invitada).

Función seedIfEmpty() que rellena los datos semilla la primera vez. Llámala en el arranque de la app.

Función resetDemo() que borra todo y vuelve a sembrar (la usaremos desde el conmutador de demo).

Datos semilla

Crea datos realistas para que la app se vea viva desde el primer arranque:

3 planes: Básico, Pro, Premium con límites distintos.

1 superadmin del sistema.

2 talleres: «Taller García» (Madrid) y «AutoNorte» (A Coruña), cada uno con su accentColor y 1 location.

Por cada taller: 2–3 usuarios (owner, recepción, mecánico), 5–6 clientes, 6–8 vehículos, un catálogo de 6 servicios y 6 repuestos.

8–10 órdenes de reparación por taller repartidas por TODOS los estados del pipeline (recibido, diagnóstico, presupuesto_enviado, aprobado, en_reparación, listo, entregado), cada una con su accessCode único de 6 caracteres, algunas con items de presupuesto, fotos (usa 1–2 imágenes placeholder en base64 pequeñas) y mensajes.

Algunas citas para hoy y los próximos días.

Algunas notificaciones.

Autenticación simulada + conmutador de demo

Pantalla /login simple (logo, email, contraseña) que NO valida de verdad: cualquier login entra. Debajo, accesos rápidos para entrar como cada rol semilla.

Un AuthContext que guarda el usuario actual y el tenant actual en localStorage.

Un conmutador de demo flotante (botón fijo abajo a la derecha, etiqueta «Demo») que abre un panel para:

Cambiar de rol: Superadmin / Taller / Cliente.

Si es Taller: elegir cuál de los talleres semilla.

Si es Cliente: elegir un código de acceso existente (lista los accessCode de las órdenes) y navegar a /c/:code.

Botón «Reiniciar demo» que llama a resetDemo().

Rutas y shells de navegación

Configura el router con estas rutas. Cada página de módulo es por ahora un placeholder con su PageHeader y un EmptyState («Próximamente»). NO implementes la lógica interna todavía.

/ — Landing pública de Garage: hero con el wordmark, propuesta de valor en 1 frase, 3 features destacadas (gestión de órdenes, comunicación con el cliente por código, inspección digital), un bloque «Pedir cita» (solo maqueta visual por ahora) y botón «Acceder» que va a /login. Mobile-first.

/login — descrita arriba.

Superadmin /admin: layout propio simple con sidebar. Páginas: Dashboard (con StatCards de talleres activos, MRR simulado, órdenes totales), Talleres (lista placeholder), Planes (placeholder).

Taller /app: layout responsive y mobile-first. En móvil, barra de navegación inferior con los accesos clave (Inicio, Órdenes, Citas, Clientes, Más); en escritorio, sidebar lateral con todos los módulos. Páginas placeholder: Dashboard /app, Citas /app/citas, Clientes /app/clientes, Vehículos /app/vehiculos, Órdenes /app/ordenes, Presupuestos /app/presupuestos, Facturación /app/facturacion, Servicios /app/servicios, Equipo /app/equipo, Configuración /app/configuracion. El Dashboard sí puede mostrar ya StatCards reales leyendo de los repos (coches en taller, citas de hoy, presupuestos pendientes, ingresos del mes).

Cliente invitado /c/:code — layout 100% mobile-first, sin navegación de app. Por ahora muestra: branding del taller (logo + acento del tenant), matrícula y modelo del coche, y una línea de tiempo del estado de la orden resaltando el paso actual del pipeline. El resto de bloques (fotos, inspección, presupuesto, aprobar) los rellenamos en el siguiente prompt; deja sus secciones como placeholders. Si el código no existe, muestra un estado de «código no válido».

Qué NO construir todavía

No implementes aún: la creación/edición real de órdenes, el editor de presupuestos, el DVI, el check-in con firma, la facturación con PDF, ni la aprobación desde la vista cliente. Solo la fundación: tipos, capa de datos, semilla, diseño, auth simulada, conmutador de demo y los shells de navegación con placeholders.

Recuerda: todo es local y simulado, nada de backend ni servicios externos. Cuando termines, dime qué quedó construido y confirma que el conmutador de demo permite saltar entre las tres vistas con los datos semilla.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://talleo-garage-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9e32b0e9-f0c6-436e-b643-13bc5811fdee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Publicar en un servidor propio (Clouding.io, talleo.es)

Como root en un servidor Ubuntu 24.04 nuevo:

```bash
curl -fsSL https://raw.githubusercontent.com/reival69/garage/main/deploy/clouding-setup.sh | EMAIL=tu@correo.com bash
```

El script instala Node.js 22 y Nginx, compila la app (`deploy/build.sh`), la deja corriendo como servicio
(`systemctl status garage`), revisa GitHub cada 10 minutos y recompila si hay cambios (`deploy/update.sh`,
registro en `/var/log/garage-update.log`) y activa HTTPS cuando talleo.es ya apunta al servidor.

### Base de datos, usuarios y copias de seguridad

- Los datos se guardan en PostgreSQL en el mismo servidor (base `garage`). La conexión está en
  `/etc/garage.env` (solo lo lee root), junto con `UPLOAD_DIR`, la carpeta de fotos y firmas
  (`/var/lib/garage/uploads`).
- Crear el superadmin, o cambiarle la contraseña:

  ```bash
  sudo bash /opt/garage/deploy/create-superadmin.sh tu@email.com "Tu nombre"
  ```

- El superadmin crea cada taller con el email y la contraseña inicial de su responsable; el
  responsable da de alta a su equipo en «Equipo». Cada persona cambia su contraseña desde su nombre,
  abajo en el menú lateral.
- Cada noche se guarda una copia de la base de datos y de las fotos en `/var/backups/garage`
  (se conservan 14 días).
- Para probar en local: `DATABASE_URL=postgres://usuario:clave@127.0.0.1:5432/garage npm run dev`.
