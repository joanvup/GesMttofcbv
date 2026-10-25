import type ExcelJS from 'exceljs';

/**
 * Capa de acceso a hojas de cálculo.
 *
 * Aísla la dependencia (ExcelJS) del resto de la aplicación para poder
 * reemplazarla sin tocar los módulos que exportan o importan Excel.
 * La librería se carga bajo demanda para no inflar el bundle principal.
 */

export type ExcelCellValue = string | number | boolean | Date | null | undefined;
export type ExcelRow = Record<string, ExcelCellValue>;

const MAX_SHEET_NAME_LENGTH = 31;

let excelJsModule: Promise<typeof import('exceljs')> | null = null;

async function loadExcelJs(): Promise<typeof ExcelJS> {
  if (!excelJsModule) {
    excelJsModule = import('exceljs');
  }
  const mod = await excelJsModule;
  // El build de navegador se publica como UMD: puede venir en `default` o en el propio módulo.
  return ((mod as unknown as { default?: typeof ExcelJS }).default ?? mod) as typeof ExcelJS;
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Liberar memoria una vez que el navegador inició la descarga
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Genera un archivo .xlsx a partir de filas con encabezados y lo descarga.
 */
export async function writeExcelFile(options: {
  filename: string;
  sheetName: string;
  rows: ExcelRow[];
  widths?: number[];
}): Promise<void> {
  const { filename, sheetName, rows, widths = [] } = options;

  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName.slice(0, MAX_SHEET_NAME_LENGTH));

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  sheet.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: widths[index] ?? 18,
  }));

  rows.forEach((row) => {
    sheet.addRow(headers.map((header) => row[header] ?? ''));
  });

  // Encabezado en negrita y congelado para facilitar la lectura
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  if (headers.length > 0) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, filename);
}

/**
 * Normaliza el valor de una celda de ExcelJS a texto plano.
 */
function cellToText(value: ExcelJS.CellValue): ExcelCellValue {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    // Texto enriquecido: concatenar los fragmentos
    return value
      .map((part) => (typeof part === 'object' && part && 'text' in part ? String(part.text) : ''))
      .join('');
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellToText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join('');
    }
    if ('hyperlink' in value) return (value as ExcelJS.CellHyperlinkValue).text;
  }
  return '';
}

/**
 * Lee la primera hoja de un archivo Excel y devuelve las filas como objetos
 * indexados por el encabezado de la primera fila.
 */
export async function readExcelFile(file: File): Promise<ExcelRow[]> {
  const data = await file.arrayBuffer();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const text = String(cellToText(cell.value)).trim();
    headers[columnNumber] = text;
  });

  const rows: ExcelRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: ExcelRow = {};
    let hasValue = false;

    headers.forEach((header, columnNumber) => {
      if (!header) return;
      const value = cellToText(row.getCell(columnNumber).value);
      record[header] = value ?? '';
      if (value !== '' && value !== null && value !== undefined) hasValue = true;
    });

    if (hasValue) rows.push(record);
  });

  return rows;
}
