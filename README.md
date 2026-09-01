# Integración AbSign: API + Webhook

Proyecto de prueba técnica que simula dos sistemas desacoplados:

- **Sistema A:** gestor de documentos y receptor del webhook.
- **Sistema B:** plataforma de firma simulada y emisora del webhook.

## Estado del proyecto

En construcción por etapas. La primera etapa prepara TypeScript, Express, Drizzle,
PostgreSQL, Zod, Vitest y la separación entre ambos sistemas.

## Bitácora de desarrollo

### 2026-09-01 — Inicio y arquitectura base

- Se analizaron los requisitos de la prueba técnica y se dividió el trabajo en
  siete etapas.
- Se crearon dos aplicaciones Express independientes dentro del mismo repositorio:
  Sistema A y Sistema B.
- Se configuraron TypeScript en modo estricto, Zod, Drizzle ORM, PostgreSQL,
  Vitest, Supertest y Socket.IO.
- Se definieron las tablas `documents`, `webhook_events` e
  `integration_incidents`.
- Se agregó una restricción única sobre `documentId + status` para respaldar la
  idempotencia desde la base de datos.
- Se generó la primera migración SQL.
- Se añadieron y ejecutaron dos pruebas iniciales de disponibilidad de los
  servicios.
- Se actualizó Vitest para corregir una vulnerabilidad crítica reportada por la
  auditoría de dependencias.

**Resultado:** TypeScript compila, las dos pruebas pasan y la migración se genera
correctamente. La aplicación de la migración queda pendiente de disponer del
motor local de Docker.

### 2026-09-01 — Recepción de documentos en Sistema B

- Se implementó `POST /documents` con el contrato solicitado para recibir
  `documentId`, correo del tercero, URL del archivo y URL de callback.
- Se agregó validación con Zod y respuestas `400` para entradas inválidas.
- Se creó un repositorio en memoria desacoplado de Express para simular el estado
  de las solicitudes de firma mientras se construye el mock.
- Se devuelve `409 Conflict` cuando el mismo documento se envía nuevamente.
- Se agregaron pruebas para recepción exitosa, validación y duplicados.

**Resultado:** Sistema B ya puede recibir y conservar solicitudes válidas. El
cliente HTTP del Sistema A y su política de reintentos quedan para el siguiente
avance.

### 2026-09-01 — Envío resiliente desde Sistema A

- Se agregó `POST /documents` en Sistema A para crear el registro local y enviarlo
  a Sistema B.
- Se implementó un cliente HTTP con timeout, máximo de intentos configurable y
  backoff exponencial.
- Los errores HTTP permanentes no se reintentan; los fallos de red, respuestas
  `429` y errores `5xx` sí se consideran transitorios.
- El documento cambia de `pending` a `sent` solamente después de que Sistema B
  confirma la recepción.
- Si todos los intentos fallan, el documento permanece `pending` y se registra una
  incidencia.
- Se separó el acceso a documentos mediante una interfaz con implementaciones para
  Drizzle/PostgreSQL y memoria, facilitando las pruebas aisladas.

**Resultado:** La etapa 2 queda completa y cubierta por pruebas de envío exitoso,
fallo, reintentos y errores permanentes.

### 2026-09-01 — Webhook seguro e idempotente en Sistema A

- Se implementó `POST /webhooks/absign` para recibir decisiones de aprobación o
  rechazo.
- Sistema B y Sistema A comparten un contrato de firma HMAC-SHA256 basado en un
  secreto configurado mediante `HMAC_SECRET`.
- La firma recibida en `X-Signature` se compara en tiempo constante y también debe
  coincidir con la firma incluida en el payload.
- Los webhooks con firma inválida se rechazan con `401` y generan una incidencia
  sin modificar el documento.
- El procesamiento en PostgreSQL se ejecuta dentro de una transacción: primero se
  registra el evento de auditoría y después se actualiza el documento.
- La restricción única `documentId + status` y `ON CONFLICT DO NOTHING` impiden
  efectos duplicados aunque el mismo webhook llegue varias veces.
- Se añadieron los tests obligatorios de flujo aprobado, firma inválida e
  idempotencia.

**Resultado:** La etapa 3 queda completa con 12 pruebas aprobadas. Los reintentos
de entrega del webhook y la reconciliación pertenecen a la etapa 4 y siguen
pendientes.

### 2026-09-01 — Migraciones compatibles con Linux

- Se reemplazó la ejecución de migraciones mediante la CLI de Drizzle Kit por un
  script que usa directamente el migrador PostgreSQL de Drizzle ORM.
- El cambio evita un bloqueo conocido de `drizzle-kit migrate` y conserva el
  historial normal de migraciones en la base de datos.
- El nuevo script siempre cierra el pool de conexiones y muestra el error real si
  una migración falla.

**Resultado:** `npm run db:migrate` puede ejecutarse en entornos Linux donde la
CLI permanecía congelada después de cargar el driver `pg`.

### Convención de la bitácora

Cada avance funcional incluirá la fecha, las decisiones tomadas, las pruebas
realizadas y cualquier pendiente o riesgo conocido. La misma unidad de trabajo
se registrará mediante un commit descriptivo y se publicará en GitHub.

## Inicio local

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

Sistema A queda disponible en `http://localhost:3000` y Sistema B en
`http://localhost:4000`.

## Comandos

- `npm run dev`: inicia ambos sistemas en modo desarrollo.
- `npm run typecheck`: verifica los tipos sin generar archivos.
- `npm test`: ejecuta las pruebas.
- `npm run db:generate`: genera migraciones desde el esquema de Drizzle.
- `npm run db:migrate`: aplica migraciones pendientes.
