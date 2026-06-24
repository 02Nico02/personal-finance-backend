export type ExcelWorkbookTableType = 'source' | 'snapshot' | 'benchmark' | 'auxiliary' | 'metric';
export type ExcelWorkbookTablePriority = 'high' | 'medium' | 'low';

export type ExcelWorkbookTableDefinition = {
  name: string;
  description: string;
  type: ExcelWorkbookTableType;
  priority: ExcelWorkbookTablePriority;
  requiredHeaders: string[];
};

export type ExcelWorkbookTableMap = Record<string, ExcelWorkbookTableDefinition[]>;

export const EXCEL_WORKBOOK_TABLE_MAP = {
  inversiones: [
    {
      name: 'Tabla6',
      description: 'Compras y lotes abiertos',
      type: 'source',
      priority: 'high',
      requiredHeaders: ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACION', 'TEM', 'TNA']
    },
    {
      name: 'Tabla13',
      description: 'Ventas y cierres',
      type: 'source',
      priority: 'high',
      requiredHeaders: ['Fecha Com.', 'Fecha Vent.', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC.en V.', 'VALORI. ACT.', 'Monto', 'objetivo minimo']
    },
    {
      name: 'TablaPosiciones',
      description: 'Snapshot de posiciones actuales',
      type: 'snapshot',
      priority: 'high',
      requiredHeaders: ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM']
    },
    {
      name: 'Tabla11',
      description: 'Auxiliar FCI',
      type: 'auxiliary',
      priority: 'medium',
      requiredHeaders: ['Fondos com. Inv.']
    },
    {
      name: 'TablaMovimientosInversiones',
      description: 'Dividendos, rentas, amortizaciones y devoluciones de capital',
      type: 'source',
      priority: 'medium',
      requiredHeaders: ['Fecha', 'Especie', 'Tipo movimiento', 'Monto', 'Afecta rendimiento', 'Afecta capital invertido', 'Observacion']
    },
    {
      name: 'Tabla_OrdenesPendientes',
      description: 'Ordenes pendientes',
      type: 'snapshot',
      priority: 'medium',
      requiredHeaders: ['ESPECIE', 'Cant', 'PRECIO']
    },
    {
      name: 'Tabla9',
      description: 'Resumen mensual de inversiones',
      type: 'metric',
      priority: 'low',
      requiredHeaders: ['MES', 'TOTAL DEL MES', 'ACUMULADO', 'Val. Inicio', 'VARIACION %', 'REND. REAL']
    }
  ],
  'Historial Inversiones': [
    {
      name: 'Tabla5',
      description: 'Precios historicos',
      type: 'source',
      priority: 'high',
      requiredHeaders: ['FECHA', 'MES', 'ESPECIE', 'PRECIO']
    },
    {
      name: 'Tabla14',
      description: 'Balance diario',
      type: 'snapshot',
      priority: 'medium',
      requiredHeaders: ['FECHA', 'MES', 'BALANCE']
    },
    {
      name: 'Tabla60',
      description: 'Resumen historico anual',
      type: 'metric',
      priority: 'low',
      requiredHeaders: ['Año', 'Val Inicio', 'Compras', 'Ventas', 'Val Fin', 'Resultado', 'Rend. %']
    },
    {
      name: 'HistorialMensualReconstruido',
      description: 'Resumen mensual reconstruido',
      type: 'metric',
      priority: 'low',
      requiredHeaders: ['MES', 'ValInicio', 'Compras', 'Ventas', 'ValFin', 'Resultado', 'VARIACION %']
    }
  ],
  Alertas: [
    {
      name: 'Tabla47',
      description: 'Clasificacion de instrumentos',
      type: 'source',
      priority: 'high',
      requiredHeaders: ['ESPECIE', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION']
    }
  ],
  'tabla dinamica': [
    {
      name: 'TablaCalendario',
      description: 'Benchmark principal de plazo fijo / TNA',
      type: 'benchmark',
      priority: 'medium',
      requiredHeaders: ['Fecha', 'TNA', 'Rend_diaria', 'Indice']
    },
    {
      name: 'TablaCalendarioRem',
      description: 'Benchmark remunerada / money market',
      type: 'benchmark',
      priority: 'medium',
      requiredHeaders: ['Fecha', 'TNA', 'Rend_diaria', 'Indice']
    },
    {
      name: 'TablaCalendarioInf',
      description: 'Benchmark inflacionario',
      type: 'benchmark',
      priority: 'medium',
      requiredHeaders: ['Fecha', 'Mes', 'Inflacion mensual', 'Días del mes', 'Rend_diaria_inf', 'Indice_inf']
    }
  ],
  graficos: [
    {
      name: 'Tabla35',
      description: 'Split estrategico entre jubilacion y ahorro',
      type: 'snapshot',
      priority: 'low',
      requiredHeaders: ['FECHA', 'VALOR AR', 'VALOR USD', '% JUBILACION', '% AHORRO', 'MONTO JUB. AR', 'MONTO AHOR. AR']
    },
    {
      name: 'Tabla38',
      description: 'Distribucion por plataforma',
      type: 'snapshot',
      priority: 'low',
      requiredHeaders: ['Plataforma', 'Monto', 'moneda']
    },
    {
      name: 'Tabla39',
      description: 'Cashflow y resumen',
      type: 'metric',
      priority: 'low',
      requiredHeaders: ['CUATRIMESTRE', 'AÑO', 'INGRESO', 'EGRESO', 'BALANCE']
    }
  ]
} satisfies ExcelWorkbookTableMap;

export function getOfficialSheetNames(): string[] {
  return Object.keys(EXCEL_WORKBOOK_TABLE_MAP);
}

export function getOfficialTablesForSheet(sheetName: string): ExcelWorkbookTableDefinition[] {
  return EXCEL_WORKBOOK_TABLE_MAP[sheetName] ?? [];
}

export function getOfficialTableNamesForSheet(sheetName: string): string[] {
  return getOfficialTablesForSheet(sheetName).map((table) => table.name);
}

export function getOfficialTableDefinition(tableName: string): ExcelWorkbookTableDefinition | undefined {
  for (const tables of Object.values(EXCEL_WORKBOOK_TABLE_MAP)) {
    const found = tables.find((table) => table.name === tableName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function isOfficialSheet(sheetName: string): boolean {
  return sheetName in EXCEL_WORKBOOK_TABLE_MAP;
}

export function isOfficialTableForSheet(sheetName: string, tableName: string): boolean {
  return getOfficialTablesForSheet(sheetName).some((table) => table.name === tableName);
}

export function getNormalizationOrder(): string[] {
  return ['Tabla47', 'Tabla5', 'Tabla11', 'TablaPosiciones', 'Tabla_OrdenesPendientes', 'TablaCalendario', 'TablaCalendarioRem', 'TablaCalendarioInf', 'Tabla6', 'Tabla13', 'TablaMovimientosInversiones'];
}

