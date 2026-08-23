# Royal Sales AI

Asistente comercial con IA para vendedores y distribuidores de Royal Prestige que hacen visitas presenciales.

Este es el resultado de la **Fase 1**: login con correo/contraseña sobre Firebase Authentication, protección de la app para usuarios no autenticados, y recuperación de contraseña real. La demo comercial (encuesta, perfil IA, resultado, seguimiento) sigue funcionando exactamente igual que antes, ahora detrás del login.

Lo que **todavía no** está conectado a datos reales (llega en las próximas fases): crear vendedores, guardar clientes/visitas en Firestore, mover la IA al servidor, dashboard con números reales, Mi distribución.

---

## 1. Qué vas a necesitar

- Una cuenta de Google (para crear el proyecto de Firebase).
- Una cuenta de Vercel conectada a tu GitHub (ya la tienes).
- 10-15 minutos.

## 2. Crear el proyecto de Firebase

1. Entra a console.firebase.google.com
2. Clic en **Crear un proyecto** (o "Add project").
3. Ponle un nombre, por ejemplo `royal-sales-ai`.
4. Puedes desactivar Google Analytics si te lo pregunta (no lo necesitamos).
5. Espera a que termine de crearse.

## 3. Registrar la app web

1. Dentro del proyecto, clic en el ícono `</>` (Web) para agregar una app web.
2. Ponle un apodo, por ejemplo `royal-sales-ai-web`.
3. Firebase te va a mostrar un bloque de código con `apiKey`, `authDomain`, etc. **No lo cierres todavía** — esos valores son los que vas a copiar en el paso 6.

## 4. Activar Authentication

1. En el menú lateral, entra a **Authentication**.
2. Clic en **Comenzar** ("Get started").
3. En la pestaña **Sign-in method**, activa **Correo electrónico/contraseña** ("Email/Password").
4. Guarda.

## 5. Crear Firestore (base de datos)

1. En el menú lateral, entra a **Firestore Database**.
2. Clic en **Crear base de datos**.
3. Elige **Modo de producción** (no "modo de prueba").
4. Elige la región más cercana (por ejemplo `us-central` si trabajas en Texas).

## 6. Copiar las variables al proyecto

1. Abre el archivo `.env.example` de este proyecto y guárdalo como `.env.local` (mismo contenido, nombre distinto).
2. Copia los valores que Firebase te mostró en el paso 3 dentro de las variables que empiezan con `NEXT_PUBLIC_FIREBASE_`.

Ejemplo — lo que ves en Firebase vs. dónde va:

| En Firebase        | En `.env.local`                          |
|---------------------|-------------------------------------------|
| apiKey              | NEXT_PUBLIC_FIREBASE_API_KEY               |
| authDomain          | NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN           |
| projectId           | NEXT_PUBLIC_FIREBASE_PROJECT_ID            |
| storageBucket       | NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET        |
| messagingSenderId   | NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID   |
| appId               | NEXT_PUBLIC_FIREBASE_APP_ID                |

## 7. Crear las credenciales de Firebase Admin (para más adelante)

Esto no se usa todavía en la Fase 1, pero conviene generarlo ya:

1. En Firebase, clic en el engranaje (icono de configuración) → **Configuración del proyecto**.
2. Pestaña **Cuentas de servicio**.
3. Clic en **Generar nueva clave privada**. Se descarga un archivo `.json`.
4. Abre ese archivo y copia:
   - `project_id` -> `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` -> `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` -> `FIREBASE_ADMIN_PRIVATE_KEY` (cópialo completo, con los saltos de línea incluidos, entre comillas)
5. **Nunca subas ese archivo `.json` a GitHub.** Bórralo de tus descargas después de copiar los valores, o guárdalo en un lugar privado.

## 8. Crear tu primer usuario (distribuidor)

Por ahora, mientras no existe la pantalla de "crear cuenta de distribuidor" (llega en la Fase 2), crea tu usuario manualmente:

1. En Firebase -> **Authentication** -> pestaña **Users** -> **Add user**.
2. Pon tu correo y una contraseña.
3. Con eso ya puedes iniciar sesión en la app.

## 9. Publicar las reglas de Firestore

1. En Firebase -> **Firestore Database** -> pestaña **Rules**.
2. Reemplaza el contenido por el del archivo `firestore.rules` de este proyecto.
3. Clic en **Publicar**.

Estas reglas de la Fase 1 son intencionalmente restrictivas (nadie puede leer ni escribir nada todavía) — es lo correcto mientras no hay lógica de organizaciones y roles. En la Fase 2 se reemplazan por las reglas reales.

---

## 10. Subir el proyecto a GitHub

Sigue tu flujo habitual: crea un repositorio nuevo en GitHub, sube todos los archivos de esta carpeta (menos `node_modules` y `.env.local`, que ya están en `.gitignore`).

## 11. Configurar Vercel

1. Importa el repositorio en Vercel.
2. En **Environment Variables**, agrega una por una todas las variables de tu `.env.local`:
   - Las que empiezan con `NEXT_PUBLIC_FIREBASE_` (públicas).
   - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (privadas — se usarán a partir de la Fase 2/4).
   - `ANTHROPIC_API_KEY` (privada — se usará a partir de la Fase 4, cuando movamos la IA al servidor).
3. Deploy.

---

## Desarrollo local

```
npm install
npm run dev
```

## Build de producción

```
npm run build
```

## Estructura del proyecto

```
app/
  login/              -> pantalla de inicio de sesión
  (app)/              -> rutas protegidas (requieren sesión)
lib/
  firebase/
    client.ts         -> Firebase para el navegador (variables públicas)
    admin.ts          -> Firebase Admin, SOLO servidor (nunca lo importa un componente cliente)
  auth/
    AuthProvider.tsx  -> contexto de sesión (usuario actual, login, logout, recuperar contraseña)
components/
  RoyalSalesAIDemo.jsx -> la demo comercial (encuesta, perfil IA, resultado, seguimiento)
firestore.rules        -> reglas de seguridad de Firestore
```

## Próximas fases

- **Fase 2:** modelo de usuarios, organizaciones, roles, invitar vendedores, reglas reales de Firestore.
- **Fase 3:** clientes, visitas y encuesta con persistencia real (hoy la demo vive solo en memoria).
- **Fase 4:** mover la IA al servidor (/api/ai/*), perfil IA, seguimiento y fidelización conectados a Firestore.
- **Fase 5:** dashboard con datos reales, "Mi distribución", timeline por cliente.
- **Fase 6:** revisión final de seguridad y build antes de considerarlo producción.
