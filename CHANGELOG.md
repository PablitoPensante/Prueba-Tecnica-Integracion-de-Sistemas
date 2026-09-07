# Changelog

Los cambios importantes del proyecto se documentan en este archivo.

## [1.2.3] - 2026-09-07

- Validación de la URL PostgreSQL al arrancar para detectar configuraciones mal formadas.
- Sistema B conserva las fechas originales al reiniciar, valida los datos guardados
  y escribe mediante un archivo temporal y renombrado. Un archivo inválido se
  conserva y el arranque informa del problema en lugar de vaciar las solicitudes.
- El manejador HTTP reconoce errores PostgreSQL envueltos por Drizzle y devuelve
  el diagnóstico `503` previsto para conexión o migraciones pendientes.
- La vista previa reserva espacio para los botones de decisión en escritorio y móvil.
- Pruebas de regresión, despliegue Docker, revisión con Chromium y guion de entrega.

## [1.2.2] - 2026-09-07

- El arranque local aplica las migraciones antes de servir peticiones.
- Los fallos de esquema o conexión PostgreSQL responden `503` con un diagnóstico
  accionable en lugar de `500 Internal server error`.
- Se agregó una prueba de regresión para una base con columnas pendientes.

## [1.2.1] - 2026-09-07

- Los archivos permitidos se reconocen por extensión para tolerar los MIME
  inconsistentes que envían distintos navegadores y sistemas operativos.
- Las cargas mayores de 10 MB responden `413` y los formatos no permitidos `415`,
  en lugar de terminar como `500` o un `Invalid request` ambiguo.
- Las respuestas de validación incluyen un mensaje entendible y el frontend lo
  presenta directamente al usuario.
- Los archivos temporales se eliminan si la validación o la creación en base de
  datos falla, evitando archivos huérfanos.
- Se agregaron pruebas de MIME genérico, formato inválido, tamaño máximo, campos
  inválidos y solicitudes vacías.
- El puerto PostgreSQL publicado por Compose vuelve a ser configurable mediante
  `POSTGRES_PORT`, evitando colisiones en equipos que ya usan `5432`.

## [1.2.0] - 2026-09-07

- Demo automática con PostgreSQL, servidores temporales, aprobación/rechazo,
  Socket.IO, validación de firmas, idempotencia y limpieza de datos propios.
- Documentación del contrato HMAC, garantías transaccionales y evolución con outbox,
  colas y dead-letter queue, incluyendo límites actuales.
- Bloqueo de fila para serializar decisiones concurrentes de webhook/reconciliación,
  con prueba integral de consistencia entre estado y auditoría.
- Captura de errores del ciclo de reconciliación ante fallos de base de datos.

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
