# Seguridad y resiliencia de la integración

## Contrato HMAC-SHA256

A y B comparten `HMAC_SECRET` (mínimo 16 caracteres). B construye una cadena JSON
UTF-8 con las propiedades en este orden: `documentId`, `status`, `reason` (solo si
no está vacío) y `timestamp`. Calcula HMAC-SHA256 y lo codifica en hexadecimal.
La firma se envía tanto en `X-Signature` como en `signature` dentro del JSON.
El campo `signature` no participa del material firmado.

Ejemplo del material firmado:

```json
{"documentId":"b25bfa39-b8e7-41d0-a552-46647aeb9a34","status":"rejected","reason":"Falta información","timestamp":"2026-09-07T12:00:00.000Z"}
```

A valida el contrato con Zod, exige coincidencia entre cabecera y payload,
reconstruye el material y compara los bytes con `timingSafeEqual`. Una firma
inválida produce `401` y una incidencia; no modifica el documento. Un cuerpo que
no cumple el contrato produce `400`.

Este contrato firma los campos normalizados, no el cuerpo HTTP crudo: cambiar
espacios u orden de propiedades en el transporte no cambia su significado.
`src/shared/webhook-signature.ts` es la implementación compartida de referencia.

La firma autentica e identifica alteraciones; no cifra el contenido. En un despliegue
real se requiere HTTPS y secretos administrados fuera del repositorio. Actualmente
no se valida la antigüedad del timestamp: la idempotencia limita los efectos de
reenvíos, pero no sustituye una ventana temporal contra replay. Una evolución debe
incorporar tolerancia de reloj, identificador de evento y rotación de claves.

## Idempotencia y concurrencia

El documento sigue `pending → sent → approved | rejected`. Solo se acepta una
resolución desde `sent`; un estado definitivo no puede reemplazarse por el opuesto.
Repetir el mismo estado devuelve éxito con `processed: false, duplicate: true`.

PostgreSQL procesa cada webhook y reconciliación en una transacción:

1. Bloquea la fila del documento con `SELECT … FOR UPDATE`.
2. Valida el estado actual.
3. Inserta la auditoría en `webhook_events`, protegida por una restricción única
   sobre `(document_id, status)` y `ON CONFLICT DO NOTHING`.
4. Actualiza el documento y confirma ambos cambios juntos.

El bloqueo serializa decisiones opuestas concurrentes y evita registrar como
procesado un evento que no llegó a modificar el documento. Solo el procesamiento
nuevo emite la actualización Socket.IO. Esto proporciona efectos idempotentes en
la base de datos, no entrega exactamente una vez a través de la red.

## Reintentos y recuperación actuales

- A envía a B con timeout y backoff exponencial. Reintenta errores de red, `429` y
  `5xx`; un fallo definitivo conserva `pending` y registra una incidencia.
- B persiste la decisión antes de entregar el webhook. Realiza al menos tres
  intentos y registra en PostgreSQL el resultado, número de intentos y último error.
- A revisa periódicamente documentos `sent` mediante `GET /documents/:id/status`.
  Si B tiene una decisión, la aplica con las mismas garantías transaccionales y
  publica la recuperación por Socket.IO.
- Los errores generales del ciclo de reconciliación se capturan y registran en la
  consola para que una caída temporal de PostgreSQL no genere un rechazo de promesa
  sin manejar.

Limitaciones actuales: las entregas se ejecutan dentro de la petición HTTP; las
solicitudes de B se guardan en un JSON local, adecuado para una única instancia;
el archivo se reemplaza mediante renombrado tras escribir un temporal, conserva
las fechas al restaurar y un contenido inválido detiene el arranque sin sobrescribirlo;
los documentos `pending` cuyo envío falló no se reenvían automáticamente. Los
frontends y APIs son una simulación local sin autenticación general; únicamente
el room administrativo de Socket.IO exige token. No se presenta como servicio
listo para exposición pública.

## Evolución propuesta: outbox, cola y dead-letter queue

Esta sección describe trabajo futuro, no funcionalidad ya implementada.

1. Llevar las solicitudes de B a una base de datos transaccional. Guardar la decisión
   y un registro outbox en la misma transacción, eliminando la ventana entre persistir
   la decisión y programar su notificación.
2. Un publicador lee el outbox y coloca el evento en una cola durable. Usar un ID de
   evento estable y confirmaciones del broker; marcar como publicado tras confirmar.
3. Workers entregan webhooks con timeout, backoff exponencial, jitter y límite de
   intentos. Confirmar el mensaje únicamente después del resultado duradero.
4. Llevar eventos agotados o errores permanentes a una dead-letter queue (DLQ), con
   ID, destino, intentos, fechas y motivo, sin exponer secretos en registros.
5. Alertar por mensajes en DLQ, edad del evento más antiguo y tasa de fallos. Permitir
   inspección y reenvío autorizado conservando el ID original para evitar duplicados.
6. Mantener la reconciliación como verificación independiente. Aplicar también outbox
   al envío de A y a notificaciones si se necesita recuperación durable de esos pasos.

La cola entrega al menos una vez; A conserva su idempotencia. Añadir pruebas de caída
entre commit/publicación, mensajes duplicados, reinicio del worker, expiración y
reenvío desde DLQ antes de adoptar múltiples instancias.
