# Cierre de la prueba técnica

Fecha: 2026-09-07  
Versión: 1.2.3

## Entrega

Se revisaron los cinco documentos de `docs` y el README, y se contrastó la copia
local con `origin/main` mediante `git fetch`: ambos partían de `33ba842`, sin
cambios locales. El alcance de integración ya estaba implementado; este cierre
corrige fallos reproducibles y completa la validación de presentación en Linux.

El proyecto incluye carga de documentos, envío A → B con timeout y reintentos,
aprobación/rechazo, webhooks HMAC, idempotencia transaccional, reconciliación,
auditoría PostgreSQL, notificaciones Socket.IO y dos interfaces web.

## Correcciones de este cierre

- La configuración local tenía `DATABASE_URL` duplicada. La última definición
  estaba mal formada y usaba `absing` en lugar de `absign`. Se dejó una sola URL
  válida hacia `127.0.0.1:5433/absign`, conservando las credenciales fuera de Git.
  La validación de entorno ahora rechaza URLs sin protocolo PostgreSQL, servidor
  o nombre de base antes de intentar conectarse.
- Sistema B reconstruía las solicitudes usando la hora de cada reinicio. Ahora
  restaura las fechas originales, el motivo y los resultados de entrega. Valida
  el archivo antes de cargarlo, conserva un archivo inválido y escribe mediante
  un temporal y renombrado para evitar truncar el archivo anterior.
- Los errores PostgreSQL envueltos en `cause` por Drizzle seguían respondiendo
  `500`. Ahora se reconocen y responden `503` con el diagnóstico correspondiente.
- La vista previa de B recortaba parcialmente los botones de decisión. Su
  distribución ahora reserva espacio para cabecera y acciones en ambos tamaños.

Las regresiones de fechas, archivo dañado y errores envueltos se reprodujeron con
pruebas fallidas antes de aplicar sus correcciones.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Instalación completada desde el lockfile |
| `npm run check` | TypeScript, 46 pruebas y compilación aprobados |
| `npm run test:integration` | 2 pruebas aprobadas con PostgreSQL real |
| `npm run demo` | Aprobación y rechazo, HMAC, Socket.IO, duplicados y firma inválida aprobados |
| `docker compose up --build -d --wait` | Imagen construida; aplicación y PostgreSQL saludables |
| `npm audit --omit=dev` | Cero vulnerabilidades de producción |
| `docker compose config --quiet` | Configuración válida |
| `git diff --check` | Sin errores de espacios |

Las dos pruebas integrales se omiten intencionalmente en `check` y se ejecutan
por separado: **48 pruebas aprobadas en total**. Cubren además la concurrencia de
decisiones, auditoría de entrega fallida y recuperación por reconciliación.

En Chromium se comprobó carga multipart de TXT, vista previa real del archivo,
aprobación, rechazo con motivo, actualización de A sin recargar, conservación del
seguimiento al recargar A, temas claro/oscuro y vistas a 1440 y 390 píxeles sin
desbordamiento horizontal. Se verificó el espacio de los botones de decisión.
No se detectaron errores JavaScript en los recorridos.

Tras reconstruir el contenedor se contrastaron estados, fecha de recepción,
motivo, resultados de entrega y disponibilidad de los archivos. Después se
verificó la eliminación desde ambas interfaces y la respuesta `404` del documento
y archivo eliminados. Se retiraron los documentos creados para estas pruebas.
Las fechas de decisión también están cubiertas por la prueba de persistencia.

## Ejecución y presentación

Los servicios quedan activos en http://localhost:3000 y http://localhost:4000;
PostgreSQL se publica en el puerto 5433 para conservar el servicio existente en
5432. El contenedor usa Node.js 22 y PostgreSQL 17. Las verificaciones del host se
ejecutaron con Node.js 26.4.0 y npm 12.0.1.

El [guion de entrega](ENTREGA.md) incluye comandos, recorrido y capturas reales.
Los archivos históricos de etapa y traspaso describen versiones anteriores;
este informe refleja la validación actual. Los cambios de esta sesión se dejan
en la copia local para revisión; no se publicó un commit ni un tag remoto.

## Límites

El alcance sigue siendo una simulación local. B usa un archivo para una única
instancia; A conserva en el navegador los IDs de los documentos que sigue.
No hay autenticación general ni colas/DLQ. Estos límites y su evolución se
explican en [Seguridad y resiliencia](SEGURIDAD_Y_RESILIENCIA.md).

La auditoría completa conserva cuatro alertas moderadas de herramientas de
desarrollo transitivas; no se aplicaron actualizaciones incompatibles. Compose
advirtió la ausencia de Buildx, pero completó la construcción con el constructor
clásico. La inspección visual se realizó en Chromium, no en todos los navegadores.
