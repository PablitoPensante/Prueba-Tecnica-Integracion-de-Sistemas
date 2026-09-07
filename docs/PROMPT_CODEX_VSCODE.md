# Prompt para Codex en VS Code

Copia el texto siguiente en Codex con el repositorio abierto en VS Code:

---

Continúa la prueba técnica de integración API + Webhooks desde el estado actual
de GitHub. Antes de hacer cambios, lee completos `README.md`,
`docs/INFORME_FINAL.md`, `docs/INFORME_TRASPASO_VSCODE_2026-09-07.md` y
`docs/SEGURIDAD_Y_RESILIENCIA.md`. Después ejecuta `git status`,
`git log -5 --oneline` y `git fetch origin`.

Regla principal: `origin/main` es la fuente de verdad. No mezcles una copia
antigua ni reimplementes funcionalidades que ya existen. Conserva cambios del
usuario, evita comandos destructivos y no cambies arquitectura o dependencias sin
una causa reproducible.

El proyecto está en la versión 1.2.2 y su alcance figura completo. Ya incluye:

- Sistema A y Sistema B separados;
- PostgreSQL + Drizzle y migraciones;
- carga y eliminación de documentos;
- envío A → B con timeout, reintentos y backoff;
- revisión, aprobación y rechazo en B;
- webhook HMAC-SHA256 B → A;
- idempotencia y garantías de concurrencia;
- reconciliación automática;
- auditoría e incidencias;
- Socket.IO por rooms con room administrativo protegido;
- frontends para A y B;
- demo automática y pruebas PostgreSQL.

Tu objetivo es validar la entrega en EndeavourOS y dejarla lista para presentar,
no añadir alcance innecesario.

Ejecuta:

1. `npm ci`
2. `npm run check`
3. configura `.env` desde `.env.example` sin subir secretos;
4. `sudo systemctl enable --now docker.service` si Docker está detenido;
5. `docker compose up --build -d --wait`;
6. `docker compose ps` y `docker compose logs app`;
7. `npm run test:integration`;
8. `npm run demo`.

Si el puerto 5432 está ocupado, usa el puerto indicado en `.env.example`/README y
asegúrate de que `DATABASE_URL` del host apunte al puerto publicado, no al puerto
interno de Compose.

Luego abre los frontends de A y B y verifica visualmente:

- creación y carga de documento;
- vista previa en B;
- aprobación y rechazo con motivo;
- cambio inmediato en A mediante Socket.IO;
- eliminación y persistencia tras reinicio.

También comprueba con las pruebas existentes que el webhook duplicado no repita
efectos, la firma inválida produzca 401, los fallos transitorios se reintenten y
la reconciliación recupere una entrega agotada.

Si algo falla, diagnostica primero, aplica la corrección mínima y agrega una
prueba de regresión. Al finalizar ejecuta otra vez `npm run check`,
`npm run test:integration`, `npm run demo` y `git diff --check`.

No uses `npm audit fix --force`: las cuatro alertas moderadas de la auditoría
completa pertenecen al tooling de desarrollo transitivo de Drizzle/esbuild;
`npm audit --omit=dev` está limpio y el cambio automático sugerido es
incompatible. Solo actualiza dependencias si puedes demostrar y verificar una
ruta segura.

Entrega un resumen con resultados exactos, archivos modificados y riesgos. Si no
hiciste cambios funcionales, no inventes un commit. Si corregiste algo y todas las
verificaciones pasan, actualiza la bitácora y haz commit/push sin sobrescribir
historial remoto. No crees el tag `v1.2.2` sin confirmar primero que no exista y
que el usuario quiera publicar formalmente esa versión.

---
