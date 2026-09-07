# Integración AbSign

Prueba técnica con dos sistemas desacoplados mediante API y webhooks:

- **Sistema A:** carga documentos y recibe el resultado de la firma.
- **Sistema B:** simula la revisión, aprobación o rechazo del documento.

Stack: Node.js, TypeScript, Express, Drizzle ORM, PostgreSQL, Zod, Vitest,
Socket.IO y HMAC-SHA256. Versión actual: **1.2.3**.

## Requisitos

- Node.js 20 o superior.
- npm.
- Docker con Docker Compose.

## Despliegue con Docker

```bash
git clone https://github.com/PablitoPensante/Prueba-Tecnica-Integracion-de-Sistemas.git
cd Prueba-Tecnica-Integracion-de-Sistemas || exit 1
cp .env.example .env
docker compose up --build -d --wait
docker compose ps
```

Antes de exponer el proyecto fuera de un entorno local, reemplaza en `.env` los
valores de `HMAC_SECRET`, `ADMIN_SOCKET_TOKEN` y `POSTGRES_PASSWORD`.

Si el puerto `5432` está ocupado, cambia estas líneas en `.env`:

```dotenv
POSTGRES_PORT=5433
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/absign
```

Compose aplica las migraciones antes de iniciar la aplicación. Las interfaces
quedan disponibles en:

- Sistema A: http://localhost:3000
- Sistema B: http://localhost:4000
- Salud de A: http://localhost:3000/health
- Salud de B: http://localhost:4000/health

Si ya tienes `.env`, conserva sus secretos y edítalo en lugar de volver a copiar
el ejemplo. Define `DATABASE_URL` una sola vez, con el prefijo `postgresql://`
y el nombre de base `absign` (o el valor que hayas elegido en `POSTGRES_DB`).
El puerto de esta URL debe coincidir con `POSTGRES_PORT` cuando ejecutes Node en
el host. Dentro de Docker, Compose configura la conexión a `postgres:5432`.

Para revisar los logs o detener el proyecto:

```bash
docker compose logs -f app
docker compose down
```

`docker compose down` conserva los datos. Para eliminar también los volúmenes de
PostgreSQL, archivos y solicitudes usa conscientemente `docker compose down -v`.

## Ejecución para desarrollo

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run dev
```

Si PostgreSQL se publica en `5433`, asegúrate de que `DATABASE_URL` también use
`127.0.0.1:5433` al ejecutar Node desde el host.
`npm run dev` aplica las migraciones antes de iniciar los servidores.

## Pruebas y demostración

```bash
npm run check
npm run test:integration
npm run demo
```

- `npm run check` ejecuta TypeScript, pruebas normales y build.
- `npm run test:integration` prueba el flujo completo con PostgreSQL.
- `npm run demo` ejecuta automáticamente casos aprobados y rechazados, webhook
  HMAC, Socket.IO, idempotencia y persistencia.

La demo y las pruebas integrales necesitan PostgreSQL activo y accesible mediante
`DATABASE_URL`.

## Archivos admitidos

Sistema A acepta PDF, DOC, DOCX, XLS, XLSX, TXT y CSV de hasta 10 MB.

- `400`: faltan campos o contienen valores inválidos.
- `413`: el archivo supera 10 MB.
- `415`: la extensión no está permitida.
- `502`: Sistema B no pudo recibir la solicitud.
- `503`: PostgreSQL no está disponible o necesita migraciones.

## Documentación adicional

- [Informe final](docs/INFORME_FINAL.md)
- [Guion de presentación y evidencia visual](docs/ENTREGA.md)
- [Seguridad, resiliencia y escalabilidad](docs/SEGURIDAD_Y_RESILIENCIA.md)
- [Historial de versiones](CHANGELOG.md)
