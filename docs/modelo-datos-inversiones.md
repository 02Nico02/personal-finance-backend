# Modelo de datos de inversiones

Este documento propone la base de datos inicial para el modulo de inversiones del backend.

No define aun el schema Prisma final. Solo documenta el analisis del workbook actual usado por `frontend-inversion` y una propuesta de entidades para PostgreSQL.

## Objetivo general

Reemplazar progresivamente la logica que hoy vive en Excel y en `frontend-inversion`, usando PostgreSQL y una API NestJS.

## Estrategia de migracion

1. Excel sigue siendo la fuente principal.
2. El backend importa el Excel.
3. El backend guarda datos normalizados.
4. El backend calcula metricas.
5. Se compara contra `frontend-inversion`.
6. Cuando este validado, el sistema nuevo puede reemplazar partes del Excel.

## Fuente actual de datos

Por ahora, el Excel sigue siendo la fuente confiable principal.

El sistema nuevo debera poder importar datos desde el Excel, guardarlos en base de datos y comparar los resultados contra los calculos actuales de `frontend-inversion`.

## Tablas del workbook analizadas

### Tabla6

- Uso: compras, lotes abiertos, base operativa principal de inversiones.
- Columnas relevantes: `ID`, `Fecha`, `ESPECIE`, `MONEDA`, `CANT.`, `PREC. COMP.`, `TOTAL`, `PREC. ACT.`, `VALORI. ACT.`, `VARIACION`, `Var_cuenta_rem_%`, `Valor_cuenta_rem`, `Monto`, `TEM`, `TNA`, `TOP`, `TENDENCIA`.
- Significado:
  - `TOTAL` es el monto invertido de la operacion o lote.
  - `VALORI. ACT.` es el valor actual informado.
  - `TNA` y `TEM` son datos auxiliares, no la base del calculo principal.
- Fuente original o calculo: mezcla. La fila viene del Excel, pero algunos campos son contexto o derivables.
- Mapeo DB: `InvestmentOperation`.
- Importacion: completa, fila por fila.
- Regla importante: `Tabla6` representa compras/lotes abiertos. En FCI, `TOTAL` puede representar el remanente abierto, no necesariamente la compra original completa.

### Tabla13

- Uso: ventas y cierres.
- Columnas relevantes: `Fecha Com.`, `Fecha Vent.`, `ESPECIE`, `MONEDA`, `CANT.`, `PREC. COMP.`, `TOTAL`, `PREC. EN V.`, `VALORI. ACT.`, `VARIACION`, `Monto`, `objetivo minimo`.
- Significado:
  - `TOTAL` = costo original de la porcion vendida.
  - `VALORI. ACT.` = valor real obtenido en la venta.
  - `Monto` = ganancia o diferencia realizada.
  - `objetivo minimo` existe en el Excel, pero en el frontend se usa solo como referencia de contraste.
- Fuente original o calculo: dato fuente con algunos campos de validacion.
- Mapeo DB: `InvestmentSale`.
- Importacion: completa, fila por fila.

### TablaPosiciones

- Uso: posicion actual consolidada.
- Columnas relevantes: `ESPECIE`, `MONEDA`, `TIPO`, `CANTIDAD`, `TOTAL INV`, `PRECIO ACT`, `TOTAL ACTUAL`, `RESULTADO $`, `RESULTADO %`, `PRECIO PROM`.
- Significado:
  - representa el consolidado actual por especie y moneda.
  - `TIPO` no es clase de activo. Solo indica tipo de posicion.
- Fuente original o calculo: snapshot consolidado.
- Mapeo DB: `CurrentPositionSnapshot`.
- Importacion: snapshot completo.
- Regla importante: `TablaPosiciones.TIPO` puede ser `PRECIO` o `VALORIZADO`. No debe interpretarse como clase de activo. La clase de activo viene de `Tabla47`.

### Tabla5

- Uso: precios historicos.
- Columnas relevantes: `FECHA`, `MES`, `ESPECIE`, `PRECIO`.
- Significado:
  - para instrumentos normales, `marketValue = cantidad * precio historico`.
  - para FCI, `Tabla5.PRECIO` representa el valor total historico del FCI en esa fecha.
- Fuente original o calculo: dato fuente historico.
- Mapeo DB: `PriceHistory`.
- Importacion: completa, fila por fila.
- Regla importante: para FCI no se debe multiplicar cantidad por precio historico.

### Tabla47

- Uso: clasificacion de activos.
- Columnas relevantes: `ESPECIE`, `VALORI. ACT.`, `Monto`, `Esperado`, `TIPO`, `SECTOR`, `SUBSECTOR`, `REGION`.
- Significado:
  - clasifica la especie por tipo, sector, subsector y region.
  - es la fuente de la clase de activo, no `TablaPosiciones`.
- Fuente original o calculo: dato fuente de clasificacion.
- Mapeo DB: `InstrumentClassification`.
- Importacion: completa, fila por fila.

### Tabla11

- Uso: identificacion de FCI.
- Columna relevante observada: `Fondos com. Inv.`
- Significado:
  - `frontend-inversion` la usa como lista auxiliar para detectar simbolos FCI.
  - no parece ser una tabla operativa principal.
- Fuente original o calculo: auxiliar de deteccion.
- Mapeo DB: no una entidad propia obligatoria; puede alimentar un atributo auxiliar de instrumento o una lista de referencias FCI.
- Importacion: parcial o como snapshot auxiliar si se necesita trazabilidad.
- Regla importante: `Tabla11` ayuda a identificar FCI. Si un simbolo esta en `Tabla11`, el frontend lo trata como FCI en varias reglas historicas.

### TablaMovimientosInversiones

- Uso: dividendos, rentas, amortizaciones y devoluciones de capital.
- Columnas relevantes: `Fecha`, `Especie`, `Tipo movimiento`, `Monto`, `Afecta rendimiento`, `Afecta capital invertido`, `Observacion`.
- Significado:
  - registra movimientos que afectan rendimiento o capital.
  - no son compras ni ventas.
- Fuente original o calculo: dato fuente.
- Mapeo DB: `InvestmentMovement`.
- Importacion: completa, fila por fila.

### Tabla_OrdenesPendientes

- Uso: ordenes pendientes.
- Columnas relevantes: `ESPECIE`, `Cant`, `PRECIO`.
- Significado:
  - no son posiciones actuales.
  - el capital ya esta reservado.
  - no se suma nuevamente al cash disponible.
  - si se ejecutan, recien pasan a `Tabla6` / `TablaPosiciones`.
- Fuente original o calculo: snapshot operativo.
- Mapeo DB: `PendingOrder`.
- Importacion: completa, fila por fila.

### TablaCalendario

- Uso: benchmark de plazo fijo / TNA.
- Columnas relevantes: `Fecha`, `TNA`, `Rend_diaria`, `Indice`.
- Significado:
  - se usa para minimo esperado de rendimiento.
  - el frontend prioriza esta tabla sobre los respaldos.
- Fuente original o calculo: serie benchmark historica.
- Mapeo DB: `BenchmarkIndex`.
- Importacion: completa.

### TablaCalendarioRem

- Uso: benchmark de money market o remunerada.
- Columnas relevantes: `Fecha`, `TNA`, `Rend_diaria`, `Indice`.
- Significado:
  - respaldo o alternativa de benchmark.
- Fuente original o calculo: serie benchmark historica.
- Mapeo DB: `BenchmarkIndex`.
- Importacion: completa.

### TablaCalendarioInf

- Uso: benchmark inflacionario.
- Columnas relevantes: `Fecha`, `Mes`, `Inflación mensual`, `Días del mes`, `Rend_diaria_inf`, `Indice_inf`.
- Significado:
  - benchmark de inflacion para comparacion de rendimiento minimo.
- Fuente original o calculo: serie benchmark historica.
- Mapeo DB: `BenchmarkIndex`.
- Importacion: completa.

### Tabla14

- Uso: balance diario.
- Columnas relevantes: `FECHA`, `MES`, `BALANCE`.
- Significado:
  - representa balance diario, no valor acumulado.
- Fuente original o calculo: snapshot historico.
- Mapeo DB: `PortfolioSnapshot`.
- Importacion: completa, como snapshot historico.

### Tabla35

- Uso: split estrategico entre jubilacion y ahorro.
- Columnas relevantes: `FECHA`, `VALOR AR`, `VALOR USD`, `% JUBILACION`, `% AHORRO`, `MONTO JUB. AR`, `MONTO JUB. USD`, `MONTO AHOR. AR`, `MONTO AHOR. USD`.
- Significado:
  - sirve como guia para futuros aportes.
  - no es una obligacion de rebalanceo por rendimiento.
- Fuente original o calculo: snapshot estrategico o tabla calculada auxiliar.
- Mapeo DB: `StrategicAllocation`.
- Importacion: snapshot completo.

### Tabla60 y Tabla9

- Uso: resúmenes historicos anual y mensual.
- Columnas relevantes:
  - `Tabla60`: `Año`, `Val Inicio`, `Compras`, `Ventas`, `Val Fin`, `Resultado`, `Rend. %`, `Inflacion`, `Rend. Real`, `Ratio Aporte`.
  - `Tabla9`: `MES`, `TOTAL DEL MES`, `ACUMULADO`, `Val. Inicio`, `VARIACION %`, `REND. REAL`.
- Significado:
  - son resumentes historicos y calculados.
- Fuente original o calculo: calculado o snapshot derivado.
- Mapeo DB: `PortfolioMetricSnapshot`.
- Importacion: snapshot calculado o importado para contrastar.

### HistorialMensualReconstruido

- Uso: resumen mensual reconstruido.
- Columnas relevantes: `MES`, `ValInicio`, `Compras`, `Ventas`, `ValFin`, `Resultado`, `VARIACION %`, `Inflacion %`, `Rend. Real %`, `Rend. Real Acum %`, `Ratio Aporte`, `Buen Mercado`, `Buen Aporte`, `Tipo de Mes`, `Año`.
- Significado:
  - resumen historico reconstruido para analisis de rendimientos.
- Fuente original o calculo: snapshot calculado o reconstruido.
- Mapeo DB: `PortfolioMetricSnapshot`.
- Importacion: snapshot calculado o importado para auditoria.

### Tabla38

- Uso: distribucion por plataforma.
- Columnas relevantes: `Plataforma`, `Monto`, `moneda`.
- Significado:
  - distribucion auxiliar del portafolio por plataforma.
- Fuente original o calculo: snapshot auxiliar.
- Mapeo DB: `PortfolioMetricSnapshot` o entidad auxiliar si luego se vuelve relevante.
- Importacion: snapshot parcial.

### Tabla39

- Uso: cashflow / ingreso-egreso.
- Columnas relevantes: `CUATRIMESTRE`, `AÑO`, `INGRESO`, `EGRESO`, `BALANCE`.
- Significado:
  - no es central para inversiones, pero puede ayudar en reportes de portafolio.
- Fuente original o calculo: snapshot de reportes.
- Mapeo DB: `PortfolioMetricSnapshot` si se decide persistirlo.
- Importacion: opcional.

## Reglas financieras que no se deben perder

### Posiciones actuales

`TablaPosiciones` representa posicion actual consolidada.

`TIPO` puede ser `PRECIO` o `VALORIZADO`. No es clase de activo.

La clase de activo viene de `Tabla47`.

### Operaciones abiertas

`Tabla6` representa compras y lotes abiertos.

En FCI, `Tabla6.TOTAL` puede representar el remanente abierto, no necesariamente la compra original completa.

### Ventas

`Tabla13` representa ventas y cierres.

- `Tabla13.TOTAL` = costo original de la porcion vendida.
- `Tabla13.VALORI. ACT.` = valor real obtenido en la venta.
- `Tabla13.Monto` = ganancia o diferencia realizada.

### Precios historicos

`Tabla5` representa precios historicos.

Para instrumentos normales:

`marketValue = cantidad * precio historico`

Para FCI:

`Tabla5.PRECIO` representa el valor total historico del FCI en esa fecha.
No se debe multiplicar por cantidad.

No se debe sumar `Tabla6 + Tabla13` para valor de mercado FCI.

### FCI

Reglas especiales:

- FCI se identifica por clasificacion o `Tabla11`.
- Valor historico FCI = `Tabla5.PRECIO`.
- No multiplicar `cantidad * precio` en FCI.
- Para reconstruir capital original FCI:

```text
capitalOriginal = Tabla6.TOTAL abierto + SUMA(Tabla13.TOTAL ventas asociadas)
```

- Para capital expuesto por fecha:

```text
capitalExpuestoCosto(date) = capitalOriginal - SUMA(Tabla13.TOTAL ventas con Fecha Vent. <= date)
```

- Al vender parcialmente, la porcion vendida se lleva su minimo esperado proporcional.

### Ordenes pendientes

`Tabla_OrdenesPendientes` no son posiciones actuales.

No se suman al valor actual del portafolio.

No afectan el resultado actual.

El capital ya fue reservado.

No se descuenta nuevamente del cash disponible.

Si representan exposicion futura probable.

### Benchmarks

`TablaCalendario`, `TablaCalendarioRem` y `TablaCalendarioInf` se usan para calcular minimo esperado / benchmark.

La tabla principal para minimo esperado es `TablaCalendario`, con respaldos en `TablaCalendarioRem` y `TablaCalendarioInf`.

### Movimientos

`TablaMovimientosInversiones` cubre:

- dividendos
- rentas
- amortizaciones
- devoluciones de capital

Estos movimientos pueden afectar valor comparable.

```text
valorComparable = valorActual + rentas/dividendos/amortizaciones cuando corresponda
```

## Propuesta de entidades de base de datos

### ImportBatch

- Propósito: agrupar cada importacion del Excel.
- Campos principales:
  - `id`
  - `fileName`
  - `importedAt`
  - `status`
  - `detectedTables`
  - `warnings`
  - `errors`
  - `checksum`
- Viene de: ninguna tabla unica; registra el proceso de importacion.
- Fuente o calculo: dato fuente de auditoria.
- Relaciones: 1 a N con `ImportedRow`.

### ImportedRow

- Propósito: trazabilidad fila por fila.
- Campos principales:
  - `id`
  - `importBatchId`
  - `sourceTable`
  - `sourceRowId`
  - `sourceSheet`
  - `rawData`
  - `normalizedData`
  - `rowHash`
  - `status`
  - `warnings`
  - `errors`
- Viene de: cualquier tabla importada.
- Fuente o calculo: dato fuente importado.
- Relaciones: pertenece a `ImportBatch` y puede vincularse a una entidad de dominio.

### Instrument

- Propósito: maestro de especies o instrumentos.
- Campos principales:
  - `id`
  - `symbol`
  - `name`
  - `currency`
  - `instrumentType`
  - `isFci`
  - `active`
- Viene de: `Tabla6`, `Tabla13`, `TablaPosiciones`, `Tabla47`, `Tabla11`.
- Fuente o calculo: maestro normalizado.
- Relaciones: 1 a N con operaciones, ventas, precios, movimientos y snapshots.

### InstrumentClassification

- Propósito: clasificacion por tipo, sector, subsector y region.
- Campos principales:
  - `id`
  - `instrumentId`
  - `type`
  - `sector`
  - `subsector`
  - `region`
  - `expectedValue`
  - `currentValue`
- Viene de: `Tabla47`.
- Fuente o calculo: dato fuente de clasificacion.
- Relaciones: 1 a 1 o 1 a N con `Instrument`.

### InvestmentOperation

- Propósito: compras, aportes o lotes abiertos.
- Campos principales:
  - `id`
  - `instrumentId`
  - `operationDate`
  - `quantity`
  - `buyPrice`
  - `totalCost`
  - `currentPrice`
  - `currentValue`
  - `monthlyRate`
  - `annualRate`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `Tabla6`.
- Fuente o calculo: dato fuente con algunos campos derivados.
- Relaciones: pertenece a `Instrument`, `ImportBatch` e indirectamente alimenta `CurrentPositionSnapshot`.

### InvestmentSale

- Propósito: ventas, cierres y salidas parciales.
- Campos principales:
  - `id`
  - `instrumentId`
  - `buyDate`
  - `sellDate`
  - `quantity`
  - `buyPrice`
  - `sellPrice`
  - `originalCost`
  - `sellValue`
  - `realizedGain`
  - `minimumObjective`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `Tabla13`.
- Fuente o calculo: dato fuente.
- Relaciones: pertenece a `Instrument`, `ImportBatch`.

### InvestmentMovement

- Propósito: dividendos, rentas, amortizaciones y devoluciones de capital.
- Campos principales:
  - `id`
  - `instrumentId`
  - `movementDate`
  - `movementType`
  - `amount`
  - `affectsPerformance`
  - `affectsInvestedCapital`
  - `capitalEffect`
  - `note`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `TablaMovimientosInversiones`.
- Fuente o calculo: dato fuente.
- Relaciones: pertenece a `Instrument`, `ImportBatch`.

### CurrentPositionSnapshot

- Propósito: guardar la posicion actual consolidada.
- Campos principales:
  - `id`
  - `snapshotDate`
  - `instrumentId`
  - `currency`
  - `positionType`
  - `quantity`
  - `totalInvested`
  - `currentPrice`
  - `currentValue`
  - `resultAmount`
  - `resultPercent`
  - `averagePrice`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `TablaPosiciones`.
- Fuente o calculo: snapshot importado.
- Relaciones: pertenece a `Instrument` e `ImportBatch`.

### PriceHistory

- Propósito: historico de precios por fecha.
- Campos principales:
  - `id`
  - `instrumentId`
  - `priceDate`
  - `month`
  - `price`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `Tabla5`.
- Fuente o calculo: dato fuente historico.
- Relaciones: pertenece a `Instrument` e `ImportBatch`.

### BenchmarkIndex

- Propósito: series de benchmark para inflacion, plazo fijo y remunerada.
- Campos principales:
  - `id`
  - `benchmarkType`
  - `sourceTable`
  - `benchmarkDate`
  - `tna`
  - `dailyReturnPercent`
  - `indexValue`
  - `month`
  - `importBatchId`
  - `sourceTableRowId`
- Viene de: `TablaCalendario`, `TablaCalendarioRem`, `TablaCalendarioInf`.
- Fuente o calculo: dato fuente o serie auxiliar normalizada.
- Relaciones: pertenece a `ImportBatch`.

### PendingOrder

- Propósito: ordenes pendientes y capital reservado.
- Campos principales:
  - `id`
  - `instrumentId`
  - `quantity`
  - `limitPrice`
  - `reservedAmount`
  - `orderStatus`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `Tabla_OrdenesPendientes`.
- Fuente o calculo: dato fuente.
- Relaciones: pertenece a `Instrument` e `ImportBatch`.

### StrategicAllocation

- Propósito: split estrategico de aportes.
- Campos principales:
  - `id`
  - `allocationDate`
  - `currency`
  - `retirementPercent`
  - `savingsPercent`
  - `retirementAmount`
  - `savingsAmount`
  - `sourceTableRowId`
  - `importBatchId`
- Viene de: `Tabla35`.
- Fuente o calculo: snapshot importado o calculado.
- Relaciones: pertenece a `ImportBatch`.

### PortfolioSnapshot

- Propósito: snapshot historico del portafolio.
- Campos principales:
  - `id`
  - `snapshotDate`
  - `totalCurrentValue`
  - `totalInvested`
  - `totalResult`
  - `totalResultPercent`
  - `currency`
  - `source`
  - `importBatchId`
- Viene de: `Tabla14`, `HistorialMensualReconstruido`, `Tabla60`, `Tabla9`.
- Fuente o calculo: puede ser importado o calculado.
- Relaciones: puede agrupar snapshot de posiciones y metricas.

### PortfolioMetricSnapshot

- Propósito: metricas calculadas del portafolio.
- Campos principales:
  - `id`
  - `metricDate`
  - `metricType`
  - `currency`
  - `value`
  - `source`
  - `notes`
  - `importBatchId`
- Viene de: calculos del backend.
- Fuente o calculo: calculado.
- Relaciones: puede relacionarse con `PortfolioSnapshot` y `ImportBatch`.

## Dato fuente vs dato calculado

### Datos fuente importados del Excel

- `InvestmentOperation`
- `InvestmentSale`
- `InvestmentMovement`
- `PriceHistory`
- `BenchmarkIndex`
- `PendingOrder`
- `InstrumentClassification`

### Datos calculados por el backend

- `PortfolioMetricSnapshot`
- partes derivadas de `PortfolioSnapshot`
- agregados por moneda, especie, benchmark o periodo

### Snapshots importados desde el Excel

- `CurrentPositionSnapshot`
- `StrategicAllocation`
- `PortfolioSnapshot`

### Snapshots calculados por el backend

- `PortfolioMetricSnapshot`
- resumentes comparativos por periodo
- series de validacion contra `frontend-inversion`

## ImportBatch

`ImportBatch` es clave para auditar diferencias con el Excel.

Cada importacion deberia guardar:

- archivo importado
- fecha de importacion
- estado
- tablas detectadas
- warnings
- errores
- checksum si aplica

Cada fila importada deberia poder trazarse a:

- `importBatchId`
- `sourceTable`
- `sourceRowId`
- `sourceSheet` si aplica

## Preguntas abiertas / decisiones pendientes

- Como identificar de forma robusta ventas asociadas a una compra o lote.
- Como versionar snapshots.
- Si las posiciones actuales se guardaran como snapshot o se reconstruiran siempre desde operaciones.
- Como tratar instrumentos en USD.
- Como tratar cripto.
- Como separar portafolio de largo plazo y mediano plazo.
- Si `Tabla11` merece una entidad propia o solo un auxiliar de deteccion FCI.
- Si `Tabla14` se persiste como snapshot historico o solo como referencia de validacion.
- Que nivel de granularidad conviene para `PortfolioMetricSnapshot`.

## Decisiones implementadas en Prisma v1

- `Instrument` se identifica de forma unica por `symbol + currency + instrumentType`.
- `symbol` solo no alcanza porque una misma especie puede existir en distintos mercados, monedas o formas operativas.
- `ImportedRow` se identifica por `importBatchId + sourceTable + sourceSheet + sourceRowId`.
- `sourceSheet` se incluye para trazabilidad mas robusta del Excel.

### Entidades implementadas

- `ImportBatch`
- `ImportedRow`
- `Instrument`
- `InstrumentClassification`
- `InvestmentOperation`
- `InvestmentSale`
- `InvestmentMovement`
- `PriceHistory`
- `BenchmarkIndex`
- `PendingOrder`
- `CurrentPositionSnapshot`

### Entidades postergadas

- `PortfolioSnapshot`
- `PortfolioMetricSnapshot`
- `StrategicAllocation`
- `User`
- `Auth`
- `Account`
- `PersonalExpense`
- `PersonalIncome`

### Campos dejados como Json

- `ImportBatch.detectedTables`
- `ImportBatch.warnings`
- `ImportBatch.errors`
- `ImportedRow.rawData`
- `ImportedRow.normalizedData`
- `ImportedRow.warnings`
- `ImportedRow.errors`

### Campos dejados como string por flexibilidad

- `ImportBatch.status`
- `ImportedRow.status`
- `Instrument.instrumentType`
- `Instrument.currency`
- `InstrumentClassification.type`
- `InstrumentClassification.sector`
- `InstrumentClassification.subsector`
- `InstrumentClassification.region`
- `InvestmentMovement.movementType`
- `InvestmentMovement.capitalEffect`
- `BenchmarkIndex.benchmarkType`
- `PendingOrder.orderStatus`
- `CurrentPositionSnapshot.positionType`

### Decisiones pendientes

- Definir si `Instrument` sera estrictamente un maestro unico o si necesitara versionado historico.
- Decidir si `BenchmarkIndex` deberia unificarse luego en una tabla de serie temporal por fuente.
- Definir si `ImportedRow` necesitara relation inversa a las entidades normalizadas.
- Definir la estrategia exacta para FCI cuando se implemente la reconstruccion historica completa.
