# Guion de entrega — Integración AbSign 1.2.3

## Preparación

En este equipo, `.env` ya está configurado y los servicios Docker están activos.
Para arrancarlos de nuevo desde la raíz del proyecto:

```bash
npm ci
npm run check
docker compose up --build -d --wait
docker compose ps
npm run test:integration
npm run demo
```

En otro equipo, primero crea `.env` a partir de `.env.example` y configura sus
secretos. Si 5432 está ocupado, usa `POSTGRES_PORT=5433` y actualiza la única línea
`DATABASE_URL` al mismo puerto, conservando el nombre `absign` y las credenciales.
No ejecutes simultáneamente `npm run dev` y el contenedor de la aplicación en los
mismos puertos. Para trabajar con Node local, detén solo `app` y conserva PostgreSQL:

```bash
docker compose stop app
npm run dev
```

## Recorrido de presentación (5–7 minutos)

1. Abre [Sistema A](http://localhost:3000) y [Sistema B](http://localhost:4000)
   en dos pestañas. Explica que A gestiona documentos y B simula la firma.
2. En A escribe un asunto y correo, selecciona un TXT o PDF y pulsa **Subir y
   enviar a firma**. El documento pasa a `sent` tras ser recibido por B.
3. En B espera como máximo cinco segundos y pulsa **Revisar documento**. Muestra
   la vista previa y pulsa **Aceptar documento**. Vuelve a A: su estado cambia a
   `approved` sin recargar gracias al webhook y al evento Socket.IO.
4. Repite con un segundo documento. Recházalo indicando un motivo y muestra ese
   motivo junto al estado `rejected` en A.
5. Recarga A y B para mostrar que las solicitudes siguen disponibles. Si deseas
   demostrar persistencia del servidor, ejecuta `docker compose restart app` y
   espera a que ambos `/health` respondan antes de recargar.
6. Ejecuta `npm run demo` para mostrar el recorrido automático y las comprobaciones
   de duplicados y firma inválida. Ejecuta `npm run test:integration` para mostrar
   concurrencia y recuperación por reconciliación con PostgreSQL real.
7. Elimina los documentos desde A y sus solicitudes desde B. La eliminación de
   cada sistema es independiente; A también elimina el archivo subido.

A muestra los documentos seguidos por ese navegador: usa la misma pestaña/perfil
para la demostración. La demo automática usa puertos temporales y elimina sus
propios datos, por lo que sus documentos no aparecen en estas interfaces.

## Arquitectura para explicar

```mermaid
sequenceDiagram
    participant UI as Navegador A
    participant A as Sistema A
    participant DB as PostgreSQL
    participant B as Sistema B
    UI->>A: Subir documento
    A->>DB: Crear pending
    A->>B: POST /documents (timeout y reintentos)
    B-->>A: 202 recibido
    A->>DB: Marcar sent
    Note over B: Revisión y decisión; persistencia local
    B->>A: Webhook HMAC-SHA256
    A->>DB: Transacción, bloqueo e idempotencia
    A-->>UI: Socket.IO: document:statusChanged
    Note over A,B: Si falla el webhook, A consulta el estado y reconcilia
```

La auditoría de entregas se guarda en PostgreSQL; las solicitudes de B se guardan
en un archivo persistente. La simulación aprueba o rechaza documentos; no aplica
una firma criptográfica al archivo.

## Evidencia visual

Capturas del recorrido real con Chromium, tomadas el 2026-09-07:

- [Sistema A: aprobación y rechazo](evidencias/sistema-a-resultados.png).
- [Sistema B: revisión del archivo](evidencias/sistema-b-revision.png).
- [Sistema B: resultados](evidencias/sistema-b-resultados.png).
- [Sistema A en móvil y tema oscuro](evidencias/sistema-a-movil.png).
- [Sistema B en móvil y tema oscuro](evidencias/sistema-b-movil.png).
- [Vista previa y acciones en móvil](evidencias/sistema-b-revision-movil.png).

Resultados y límites: [informe final](INFORME_FINAL.md).
