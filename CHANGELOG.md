# Changelog

Los cambios importantes del proyecto se documentan en este archivo.

## [1.1.0] - 2026-09-03

### Añadido

- Campo `subject` persistido y visible en los Sistemas A y B.
- Reconciliación automática desde Sistema A mediante el estado de Sistema B.
- Auditoría PostgreSQL de intentos de entrega de webhooks.
- Eventos `document:statusChanged` e `integration:incident` mediante Socket.IO.
- Rooms por documento y room administrativo protegido por token.
- Suite integral contra PostgreSQL real y flujo completo con Socket.IO.
- Build reproducible, comando `npm run check`, Dockerfile y healthcheck de Compose.

### Seguridad y resiliencia

- Se conservan la firma HMAC-SHA256, comparación en tiempo constante e idempotencia por documento y estado.
- La reconciliación solo permite pasar de `sent` a un estado definitivo y evita regresiones.
- El frontend vuelve a suscribirse al reconectar sin registrar listeners duplicados.

## [1.0.0] - 2026-09-02

- Integración inicial A → B, webhook firmado, persistencia, carga de archivos y frontends locales.
