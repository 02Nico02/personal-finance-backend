# Mapa oficial del workbook Excel

Este documento describe la estructura esperada del workbook de inversiones y sirve como referencia para diagnostico, importacion y futuras normalizaciones.

## Hoja `inversiones`

| tabla | funcion | tipo | prioridad | normalizacion |
|---|---|---|---|---|
| `Tabla6` | Compras y lotes abiertos | source | high | alta |
| `Tabla13` | Ventas y cierres | source | high | alta |
| `TablaPosiciones` | Snapshot de posiciones actuales | snapshot | high | alta |
| `Tabla11` | Auxiliar FCI | auxiliary | medium | media |
| `TablaMovimientosInversiones` | Dividendos, rentas, amortizaciones y devoluciones de capital | source | medium | media |
| `Tabla_OrdenesPendientes` | Ordenes pendientes | snapshot | medium | media |
| `Tabla9` | Resumen mensual de inversiones | metric | low | baja |

## Hoja `Historial Inversiones`

| tabla | funcion | tipo | prioridad | normalizacion |
|---|---|---|---|---|
| `Tabla5` | Precios historicos | source | high | alta |
| `Tabla14` | Balance diario | snapshot | medium | media |
| `Tabla60` | Resumen historico anual | metric | low | baja |
| `HistorialMensualReconstruido` | Resumen mensual reconstruido | metric | low | baja |

## Hoja `Alertas`

| tabla | funcion | tipo | prioridad | normalizacion |
|---|---|---|---|---|
| `Tabla47` | Clasificacion de instrumentos | source | high | alta |

## Hoja `tabla dinamica`

| tabla | funcion | tipo | prioridad | normalizacion |
|---|---|---|---|---|
| `TablaCalendario` | Benchmark principal de plazo fijo / TNA | benchmark | medium | media |
| `TablaCalendarioRem` | Benchmark remunerada / money market | benchmark | medium | media |
| `TablaCalendarioInf` | Benchmark inflacionario | benchmark | medium | media |

## Hoja `graficos`

| tabla | funcion | tipo | prioridad | normalizacion |
|---|---|---|---|---|
| `Tabla35` | Split estrategico entre jubilacion y ahorro | snapshot | low | baja |
| `Tabla38` | Distribucion por plataforma | snapshot | low | baja |
| `Tabla39` | Cashflow y resumen | metric | low | baja |

## Criterio de prioridad

1. `Tabla47` para clasificacion de instrumentos.
2. `Tabla5` para precios historicos.
3. `Tabla11` como auxiliar FCI.
4. `TablaPosiciones` como snapshot actual.
5. `Tabla_OrdenesPendientes` para ordenes pendientes.
6. `TablaCalendario`, `TablaCalendarioRem` y `TablaCalendarioInf` como benchmarks.
7. `Tabla6` como base operativa de compras y lotes.
8. `Tabla13` como ventas y cierres.
9. `TablaMovimientosInversiones` como movimientos de rendimiento/capital.

## Uso

Este mapa se usa para:

- validar si un bloque importado pertenece a una hoja oficial
- sugerir la tabla logica mas probable en el diagnostico
- priorizar la normalizacion futura del workbook
