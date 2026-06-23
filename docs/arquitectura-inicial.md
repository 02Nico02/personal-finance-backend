# Arquitectura inicial

Este backend sera la base del nuevo sistema personal de finanzas.

## Objetivo general

Reemplazar progresivamente la logica que hoy vive en Excel y en frontend-inversion, usando una base de datos PostgreSQL y una API NestJS.

## Fuente actual de datos

Por ahora, el Excel sigue siendo la fuente confiable principal.

El sistema nuevo debera poder importar datos desde el Excel, guardarlos en base de datos y comparar los resultados contra los calculos actuales.

## Stack

- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- Jest
- Zod / validacion de env

## Principio de migracion

No se debe intentar reemplazar el Excel de golpe.

Primero se debe importar y validar.

Luego se podran agregar pantallas y carga manual.

## Modulos futuros

- Importaciones
- Instrumentos
- Operaciones de inversion
- Ventas
- Posiciones
- Precios historicos
- Benchmarks
- Movimientos de inversion
- Ordenes pendientes
- Ingresos personales
- Gastos personales
- Categorias
- Reportes
