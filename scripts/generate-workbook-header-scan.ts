import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeWorkbookFile, buildWorkbookScanMarkdown } from '../src/imports/excel/workbook-header-scan-analysis';

const outputDir = path.join(process.cwd(), 'docs', 'import-diagnostics');

async function main(): Promise<void> {
  const workbookPathArg = process.argv[2];

  if (!workbookPathArg) {
    throw new Error('Debes pasar la ruta del archivo Excel. Ejemplo: npm run excel:scan-headers -- "./data/Historial Sueldo.xlsm"');
  }

  const analysis = analyzeWorkbookFile(workbookPathArg);

  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const outputPath = path.join(outputDir, `workbook-header-scan-${timestamp}.md`);
  fs.writeFileSync(outputPath, buildWorkbookScanMarkdown(analysis), 'utf8');

  console.log(`Scanner crudo generado en: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
