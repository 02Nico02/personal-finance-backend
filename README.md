# Personal Finance Backend

Backend personal para finanzas, inversiones e importacion de datos desde Excel.

Esta pensado como base para un futuro frontend Angular, con persistencia en PostgreSQL y una API NestJS como nucleo del sistema.

## Estado actual

El proyecto esta en etapa inicial y por ahora solo incluye:

- setup NestJS
- Docker Compose
- PostgreSQL
- Prisma
- Healthcheck

## Objetivo del backend

Este backend sera la base para:

- finanzas personales
- inversiones
- importacion inicial desde Excel
- persistencia en PostgreSQL
- API para un futuro frontend Angular

## Stack

- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- Jest
- Zod

## Levantar el entorno

```bash
docker compose up --build
```

Cuando la base de datos esta vacia, el contenedor `api` aplica las migraciones automaticamente al arrancar.

## Reiniciar Docker desde cero

Si queres borrar contenedores, imagenes y la base de datos local persistida:

```bash
docker compose down --rmi all -v --remove-orphans
docker compose up --build
```

Si solo queres borrar la imagen de la API y recrearla:

```bash
docker compose down
docker compose images
# luego borrar la imagen correcta con docker image rm <IMAGE ID>
docker compose up --build
```

Si queres borrar solo la base de datos y mantener la imagen:

```bash
docker compose down -v
docker compose up --build
```

Si despues de borrar el volumen queres aplicar migraciones sin reiniciar todo:

```bash
docker compose exec api npx prisma migrate deploy
```

## Prisma

```bash
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma generate
docker compose exec api npx prisma studio
```

## Tests y build

```bash
docker compose exec api npm test
docker compose exec api npm run build
```

## Healthcheck

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

## Importador Excel v1

Esta primera version del importador solo guarda filas crudas y trazables en `ImportBatch` e `ImportedRow`.

- Endpoint: `POST /imports/excel`
- Formato: `multipart/form-data`
- Campo: `file`

Ejemplo:

```bash
curl -X POST http://localhost:3000/imports/excel \
  -F "file=@./Historial Sueldo.xlsm"
```

Esta etapa no normaliza todavia a entidades de inversiones.

## Diagnostico de importaciones

Para generar un diagnostico Markdown de un batch ya importado:

```bash
docker compose exec api npm run import:diagnostics -- <importBatchId>
```

Ejemplo:

```bash
docker compose exec api npm run import:diagnostics -- 0e3d913d-6135-4d17-aa2e-d50466ed61db
```

## Comandos utiles

```bash
docker compose up --build
docker compose down
docker compose down -v
docker compose down --rmi all -v --remove-orphans
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma generate
docker compose exec api npx prisma studio
docker compose exec api npm run import:diagnostics -- <importBatchId>
docker compose exec api npm test
docker compose exec api npm run build
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

## Ver la base

Para inspeccionar la base directamente:

```bash
docker compose exec db psql -U finanzas_user -d finanzas
```

Para ver las tablas:

```sql
\dt
```
