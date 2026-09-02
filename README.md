# Integración AbSign: API + Webhook

Proyecto de prueba técnica que simula dos sistemas desacoplados:

- **Sistema A:** gestor de documentos y receptor del webhook.
- **Sistema B:** plataforma de firma simulada y emisora del webhook.

## Estado del proyecto

En desarrollo activo. El seguimiento se mantiene mediante el siguiente checklist;
el historial posterior se conserva únicamente como referencia de las decisiones ya
tomadas.

### Arquitectura e integración

- [x] Separar Sistema A y Sistema B en aplicaciones Express independientes.
- [x] Configurar TypeScript estricto, Zod, Drizzle ORM y PostgreSQL.
- [x] Implementar envío A → B con timeout, reintentos y backoff exponencial.
- [x] Implementar decisiones de aprobación y rechazo en Sistema B.
- [x] Firmar webhooks B → A mediante HMAC-SHA256.
- [x] Validar la firma y rechazar webhooks inválidos con `401`.
- [x] Garantizar idempotencia por `documentId + status`.
- [x] Reintentar la entrega del webhook un mínimo de tres veces.
- [x] Exponer `GET /documents/:id/status` como respaldo en Sistema B.
- [ ] Implementar reconciliación en Sistema A cuando el webhook no sea entregado.

### Datos, archivos e incidencias

- [x] Crear tablas de documentos, eventos e incidencias y sus migraciones.
- [x] Ejecutar las migraciones correctamente en PostgreSQL local.
- [x] Subir PDF, Word, Excel, TXT y CSV con límite de 10 MB.
- [x] Eliminar documentos, archivos y registros relacionados desde Sistema A.
- [x] Persistir solicitudes de Sistema B entre reinicios.
- [x] Eliminar solicitudes almacenadas en Sistema B.
- [x] Registrar fallos de envío y firmas inválidas.
- [ ] Persistir los fallos de entrega de Sistema B en una base de datos de auditoría.

### Interfaces y tiempo real

- [x] Crear frontend local para Sistema A.
- [x] Crear frontend local para Sistema B sin login ni administración.
- [x] Incorporar carga, seguimiento, vista previa, aprobación y rechazo.
- [x] Incorporar un modal de rechazo con motivo obligatorio.
- [x] Incorporar un tema azul claro y oscuro persistente.
- [x] Permitir eliminar registros desde ambos frontends.
- [ ] Emitir `document:statusChanged` al room del documento mediante Socket.IO.
- [ ] Actualizar el frontend de Sistema A en vivo, sin polling.
- [ ] Emitir `integration:incident` para interrupciones críticas.

### Pruebas y entrega final

- [x] Cubrir flujo aprobado, firma inválida e idempotencia.
- [x] Cubrir carga multipart, reintentos, persistencia y eliminación.
- [x] Mantener 23 pruebas automatizadas aprobadas.
- [ ] Añadir pruebas de integración contra PostgreSQL real.
- [ ] Probar el flujo completo A → B → webhook → PostgreSQL → Socket.IO.
- [ ] Crear el comando `npm run demo` sin intervención manual.
- [ ] Añadir un diagrama Mermaid del flujo completo.
- [ ] Documentar HMAC, idempotencia y una evolución con colas y dead-letter queue.
- [ ] Preparar el cierre versionado y la entrega final del proyecto.

## Historial de avances

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

### 2026-09-02 — Inicio de la etapa 4: entrega resiliente de webhooks

- Sistema B permite aprobar o rechazar una solicitud recibida.
- Después de guardar la decisión, B genera un webhook firmado con HMAC-SHA256 y
  lo envía automáticamente al callback de Sistema A.
- La entrega realiza un mínimo de tres intentos con backoff exponencial y conserva
  el número de intentos, el resultado y el último error.
- Se añadió `GET /documents/:documentId/status` en Sistema B como fuente de
  respaldo para consultar la decisión y diagnosticar la entrega.
- Se agregaron pruebas para firma correcta, recuperación después de errores
  transitorios y registro de una interrupción persistente.

**Pendiente:** completar la reconciliación en Sistema A cuando el webhook agote
sus intentos y no sea entregado.

**Resultado:** el primer bloque de la etapa 4 queda implementado y cubierto por
pruebas; la etapa permanece abierta hasta completar la reconciliación.

### 2026-09-02 — Interfaces locales para Sistemas A y B

- Sistema A sirve una interfaz para crear documentos y seguir sus estados.
- Sistema B sirve una bandeja de solicitudes para aprobar o rechazar documentos.
- Se añadieron consultas para recuperar documentos en A y listar solicitudes en B.
- Ambas interfaces comparten la paleta de Caja Áurea: fondo `#eef2f7`, texto
  `#111827`, borde `#d1d5db`, verde principal `#166534` y acento `#0f766e`.
- Las interfaces se ejecutan junto con las APIs, sin login ni vistas de
  administración.

**Resultado:** 17 pruebas aprobadas y frontends disponibles localmente en
`http://localhost:3000` y `http://localhost:4100`.

### 2026-09-02 — Carga real de archivos y rechazo mejorado

- Sistema A permite seleccionar y subir documentos PDF, DOC o DOCX de hasta
  10 MB, los almacena localmente y entrega a Sistema B una URL accesible.
- Los archivos se guardan con identificadores aleatorios y el contenido de
  `uploads/` permanece fuera del control de versiones.
- Sistema B reemplaza el diálogo nativo de rechazo por un modal propio con motivo
  obligatorio, contador de caracteres, cierre por fondo y foco automático.
- El modal conserva la paleta de Caja Áurea y funciona sin login ni roles.

**Resultado:** 18 pruebas aprobadas, incluyendo carga multipart y acceso al
archivo servido por Sistema A.

### 2026-09-02 — Tema azul claro y oscuro

- Se reemplazó el color principal por una identidad azul compartida entre ambos
  sistemas (`#2563eb` en claro y `#3b82f6` en oscuro).
- Se añadió un selector de tema en los dos encabezados con preferencia persistente
  y detección inicial del modo del sistema operativo.
- El modo oscuro adapta fondos, tarjetas, bordes, estados y el modal de rechazo,
  conservando contraste y una navegación consistente entre A y B.

**Resultado:** 19 pruebas aprobadas y los dos temas disponibles en ambos sistemas.

### 2026-09-02 — Revisión previa y nuevos formatos

- La bandeja de Sistema B muestra primero un único botón **Revisar documento**.
- La vista previa identifica PDF, documento de texto u hoja de cálculo y ofrece
  apertura externa para formatos que el navegador no representa directamente.
- Los botones de aceptar y rechazar aparecen dentro de la revisión, después de
  presentar el documento al usuario.
- Sistema A admite además archivos XLS, XLSX, TXT y CSV, manteniendo el límite de
  10 MB y el almacenamiento con nombre aleatorio.
- El modal de rechazo se conserva como un segundo paso con motivo obligatorio.

**Resultado:** 20 pruebas aprobadas, incluida la carga de una hoja CSV.

### 2026-09-02 — Persistencia y eliminación de registros

- Sistema B dejó de depender exclusivamente de memoria y conserva sus solicitudes
  en `data/system-b-requests.json` entre reinicios.
- Altas, decisiones, resultados de webhook y eliminaciones actualizan el archivo
  persistente; `data/` permanece fuera del repositorio.
- Ambos frontends incorporan un botón **Eliminar** con confirmación.
- Sistema A elimina el documento de PostgreSQL, sus eventos e incidencias
  relacionadas y el archivo local; Sistema B elimina su solicitud persistida.
- Se verificó el ciclo real crear → reiniciar → recuperar → eliminar en las dos
  APIs sin afectar registros del usuario.

**Resultado:** 23 pruebas aprobadas en 7 archivos y persistencia de Sistema B
confirmada después de reiniciar el proceso.

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
