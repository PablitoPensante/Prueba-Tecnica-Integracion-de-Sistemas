# Informe de traspaso a Codex en VS Code

Fecha: 2026-09-07
Rama revisada: `main`
Commit base revisado: `0984f6a`
Versión: `1.2.2`

## Estado

El alcance de la prueba técnica está implementado y la versión de Linux ya dejó
evidencia de cierre en `docs/INFORME_FINAL.md`. No se deben mezclar cambios de
copias antiguas del repositorio: GitHub `main` es la fuente de verdad.

El sistema incluye los dos servicios Express, PostgreSQL con Drizzle, carga de
archivos, envío resiliente A → B, decisiones en B, webhooks HMAC B → A,
idempotencia, reconciliación, auditoría, incidencias, Socket.IO por rooms y dos
frontends locales. Sistema B persiste sus solicitudes y la demo recorre aprobación
y rechazo sin intervención.

## Verificación conocida

En Linux, según `docs/INFORME_FINAL.md`:

- `npm run check`: 29 pruebas, TypeScript y build aprobados antes del parche
  de carga 1.2.1.
- `npm run test:integration`: 2 pruebas aprobadas contra PostgreSQL.
- `npm run demo`: aprobación y rechazo completos aprobados.
- `docker compose config --quiet`: configuración válida.

En esta copia de Windows se repitieron `npm ci` y `npm run check`:

```text
Test Files  9 passed | 1 skipped
Tests       35 passed | 2 skipped
TypeScript  aprobado
Build       aprobado
```

Las dos pruebas omitidas son las integrales y requieren PostgreSQL. Docker
Desktop no llegó a iniciar durante esta sesión, por lo que no se repitieron aquí.

## Seguridad de dependencias

`npm audit --omit=dev` informa cero vulnerabilidades de producción. La auditoría
completa informa cuatro vulnerabilidades moderadas transitivas asociadas al
tooling de desarrollo de `drizzle-kit`/`esbuild`. La corrección automática
propuesta implica un cambio incompatible y no debe aplicarse a ciegas antes de la
presentación.

## Recomendación para la presentación

1. Trabajar únicamente desde la rama actualizada de GitHub.
2. Ejecutar en EndeavourOS `npm ci` y `npm run check`.
3. Levantar PostgreSQL y los servicios.
4. Ejecutar `npm run test:integration` y `npm run demo`.
5. Abrir ambos frontends y demostrar creación, revisión, aprobación/rechazo,
   actualización en vivo, reintentos e idempotencia.
6. No ampliar el alcance salvo que aparezca un fallo reproducible.

## Archivos de referencia

- `README.md`: requisitos, arquitectura, ejecución y bitácora.
- `docs/INFORME_FINAL.md`: cierre y pruebas realizadas en Linux.
- `docs/SEGURIDAD_Y_RESILIENCIA.md`: HMAC, idempotencia, colas y DLQ.
- `scripts/demo.ts`: demostración automática.
- `tests/integration/full-flow.integration.test.ts`: recorrido PostgreSQL real.

## Pendiente opcional

- Inspección visual final de ambos frontends en el equipo de presentación.
- Validación del contenedor si se dispone de acceso al daemon de Docker.
- Crear/subir el tag `v1.2.2` únicamente si todavía no existe y el equipo decide
  marcar formalmente la entrega.
