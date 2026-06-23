# Personal Finance Backend

Base técnica del backend de finanzas personales.

## Stack

- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- Jest
- `@nestjs/config`
- Zod

## Requisitos

- Docker
- Docker Compose

No hace falta instalar PostgreSQL, Prisma CLI ni NestJS CLI globalmente.

## Variables de entorno

Existe un archivo `.env.example` con las variables esperadas.

## Levantar el entorno

```bash
docker compose up --build
```

API:

- `http://localhost:3000`

PostgreSQL:

- `localhost:5435`

## Prisma

Generar Prisma Client:

```bash
docker compose exec api npx prisma generate
```

Ejecutar migraciones:

```bash
docker compose exec api npx prisma migrate dev
```

Abrir Prisma Studio:

```bash
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

## Endpoints base

- `GET /`
- `GET /health`
- `GET /health/db`
