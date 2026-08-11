import JSZip from "jszip";

export type SpreadsheetValue = string | number | boolean | null | undefined;

const xmlEscape = (value: unknown): string => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cellXml(value: SpreadsheetValue, reference: string, header = false): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${header ? ' s="1"' : ""}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"${header ? ' s="1"' : ""}><v>${value ? 1 : 0}</v></c>`;
  }
  // inlineStr deliberately keeps user-provided values as text. Values beginning
  // with =, +, - or @ can therefore never become spreadsheet formulas.
  return `<c r="${reference}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

/** Builds a compact, standards-compliant XLSX without parsing untrusted files. */
export async function createXlsxBuffer(
  rows: Array<Record<string, SpreadsheetValue>>,
  sheetName = "Datos",
): Promise<Buffer> {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const matrix: SpreadsheetValue[][] = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
  const lastColumn = columnName(Math.max(headers.length - 1, 0));
  const lastRow = Math.max(matrix.length, 1);
  const dimensions = headers.length > 0 ? `A1:${lastColumn}${lastRow}` : "A1";
  const safeSheetName = sheetName.replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31) || "Datos";

  const widths = headers.map((header, columnIndex) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length),
    );
    return Math.min(40, Math.max(10, maxLength + 2));
  });
  const columnsXml = widths.length > 0
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const rowsXml = matrix.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cellXml(
      value,
      `${columnName(columnIndex)}${rowIndex + 1}`,
      rowIndex === 0,
    )).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(safeSheetName).replace(/"/g, "&quot;")}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font/><font><b/><color rgb="FFFFFFFF"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensions}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${columnsXml}
  <sheetData>${rowsXml}</sheetData>
  ${headers.length > 0 ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` : ""}
</worksheet>`);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
