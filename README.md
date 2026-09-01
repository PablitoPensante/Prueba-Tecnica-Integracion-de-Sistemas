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
