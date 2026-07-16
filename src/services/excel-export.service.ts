import ExcelJS from 'exceljs';

export type ExcelColumn = { header: string; key: string; width?: number };

/**
 * Builds an xlsx buffer with a bold header row + data rows. An empty `rows` array still
 * produces a valid workbook with headers only (reports.md edge case: "export of an empty
 * result set still returns a valid file with headers only, not an error").
 */
export async function buildExcelBuffer(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pharmacy Sys API';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
