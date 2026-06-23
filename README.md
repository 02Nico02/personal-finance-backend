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

## Prisma

```bash
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma generate
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

## Comandos utiles

```bash
docker compose up --build
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma generate
docker compose exec api npm test
docker compose exec api npm run build
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```
