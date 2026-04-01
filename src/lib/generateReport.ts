import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRub } from '@/lib/rates';
import type { UserSettings } from '@/hooks/useSettings';

interface DailyRow {
  day: number;
  startTime: string;
  endTime: string;
  hours: number;
  hoursStd: number;
  hoursOt: number;
  nesting: number;
  tariffHours: number;
  description: string;
  dayType: string;
}

interface ProjectRow {
  name: string;
  hours: number;
  nesting: number;
  serial: number;
}

interface SerialRow {
  name: string;
  quantity: number;
}

interface Totals {
  totalWorkHours: number;
  totalTariffStandard: number;
  totalTariffOvertime: number;
  totalTariffSick: number;
  totalNesting: number;
  totalSerial: number;
}

interface ReportData {
  monthLabel: string;
  monthStart: string;
  userName: string;
  dailyData: DailyRow[];
  projectSummary: ProjectRow[];
  serialSummary: SerialRow[];
  totals: Totals;
  settings: UserSettings;
}

async function loadFont(): Promise<ArrayBuffer> {
  const resp = await fetch('/fonts/Roboto-Regular.ttf');
  return resp.arrayBuffer();
}

function fmtNum(n: number): string {
  if (n === 0) return '';
  return String(n);
}

function fmtDec(n: number): string {
  if (n === 0) return '';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export async function generateTimesheetPDF(data: ReportData) {
  const { monthLabel, userName, dailyData, projectSummary, serialSummary, totals, settings } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const fontData = await loadFont();
  const fontBase64 = btoa(
    new Uint8Array(fontData).reduce((buffer, byte) => buffer + String.fromCharCode(byte), '')
  );
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');

  const fontName = 'Roboto';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageMargin = { top: 8, right: 8, bottom: 8, left: 8 };
  const sectionGap = 2.5;
  const filledRowHeight = 4.2;
  const emptyRowHeight = 3.36;
  const dailyFontSize = 7.2;
  const summaryFontSize = 7.4;
  const totalsFontSize = 7.9;
  const headingFontSize = 8.6;
  const defaultPadding = { top: 0.28, right: 0.45, bottom: 0.28, left: 0.45 };
  const emptyPadding = { top: 0.16, right: 0.45, bottom: 0.16, left: 0.45 };
  const summaryPadding = { top: 0.3, right: 0.45, bottom: 0.3, left: 0.45 };
  const totalsPadding = { top: 0.38, right: 0.5, bottom: 0.38, left: 0.5 };

  const now = new Date();
  const selectedDate = new Date(data.monthStart);
  const isCurrentMonth = now.getFullYear() === selectedDate.getFullYear() && now.getMonth() === selectedDate.getMonth();
  const showAdvance = !isCurrentMonth || now.getDate() >= 15;

  const totalsBody: string[][] = [
    ['Всего часов', String(totals.totalWorkHours), '', ''],
    [
      'Часы (тариф)',
      String(totals.totalTariffStandard),
      `× ${formatRub(settings.rate_standard)}`,
      formatRub(totals.totalTariffStandard * settings.rate_standard),
    ],
    [
      'Сверхурочные',
      totals.totalTariffOvertime ? String(totals.totalTariffOvertime) : '',
      totals.totalTariffOvertime ? `× ${formatRub(settings.rate_overtime)}` : '',
      totals.totalTariffOvertime ? formatRub(totals.totalTariffOvertime * settings.rate_overtime) : '',
    ],
    [
      'Больничные/отпуск',
      totals.totalTariffSick ? String(totals.totalTariffSick) : '',
      totals.totalTariffSick ? `× ${formatRub(settings.rate_sick_leave)}` : '',
      totals.totalTariffSick ? formatRub(totals.totalTariffSick * settings.rate_sick_leave) : '',
    ],
    [
      'Нестинг',
      String(totals.totalNesting),
      `× ${formatRub(settings.rate_full_sheet)}`,
      formatRub(totals.totalNesting * settings.rate_full_sheet),
    ],
  ];

  if (totals.totalSerial > 0) {
    totalsBody.push(['Серийка TR', formatRub(totals.totalSerial), '', '']);
  }

  if (showAdvance) {
    totalsBody.push(['Аванс', formatRub(settings.advance_payment), '', '']);
  }

  const dailyBody = dailyData.map((d) => [
    String(d.day),
    d.startTime || '',
    d.endTime || '',
    fmtNum(d.hours),
    fmtDec(d.hoursOt),
    fmtNum(d.nesting),
    fmtDec(d.tariffHours),
    d.description || '',
  ]);

  doc.setFontSize(13.7);
  doc.text(`Табель — ${monthLabel}`, pageMargin.left, pageMargin.top + 1.5);
  doc.setFontSize(9.7);
  doc.text(`Ф.И.О.: ${userName}`, pageMargin.left, pageMargin.top + 6);

  autoTable(doc, {
    startY: pageMargin.top + 9,
    margin: pageMargin,
    head: [['Д', 'Нач', 'Кон', 'Ч', 'СУ', 'Н', 'Тариф', 'Описание']],
    body: dailyBody,
    theme: 'grid',
    styles: {
      font: fontName,
      fontSize: dailyFontSize,
      cellPadding: defaultPadding,
      overflow: 'linebreak',
      minCellHeight: emptyRowHeight,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: 255,
      fontSize: dailyFontSize,
      font: fontName,
      cellPadding: { top: 0.35, right: 0.45, bottom: 0.35, left: 0.45 },
    },
    columnStyles: {
      0: { cellWidth: 5.5, halign: 'center' },
      1: { cellWidth: 9.5, halign: 'center' },
      2: { cellWidth: 9.5, halign: 'center' },
      3: { cellWidth: 6.5, halign: 'center' },
      4: { cellWidth: 7.5, halign: 'center' },
      5: { cellWidth: 6.5, halign: 'center' },
      6: { cellWidth: 9.5, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;

      const rowData = hookData.row.raw as string[];
      const isEmptyRow = !!rowData && !rowData[1] && !rowData[2] && !rowData[3] && !rowData[4] && !rowData[5] && !rowData[6] && !rowData[7];

      hookData.cell.styles.minCellHeight = isEmptyRow ? emptyRowHeight : filledRowHeight;
      hookData.cell.styles.cellPadding = isEmptyRow ? emptyPadding : defaultPadding;

      if (isEmptyRow) {
        hookData.cell.styles.textColor = [190, 190, 190];
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + sectionGap;
  const bottomLimit = pageHeight - pageMargin.bottom;
  const hasSerialSummary = serialSummary.length > 0;
  const summaryGap = hasSerialSummary ? 3 : 0;
  const leftWidth = hasSerialSummary
    ? (pageWidth - pageMargin.left - pageMargin.right - summaryGap) * 0.56
    : pageWidth - pageMargin.left - pageMargin.right;

  doc.setFontSize(headingFontSize);
  doc.text('По проектам', pageMargin.left, y);

  if (hasSerialSummary) {
    doc.text('Серийные позиции', pageMargin.left + leftWidth + summaryGap, y);
  }

  y += 1.5;

  const projBody = projectSummary.map((p) => [
    p.name,
    fmtNum(p.hours),
    fmtNum(p.nesting),
    p.serial ? formatRub(p.serial) : '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: {
      left: pageMargin.left,
      right: hasSerialSummary ? pageWidth - pageMargin.left - leftWidth : pageMargin.right,
    },
    head: [['Проект', 'Часы', 'Нест.', 'Серийка TR']],
    body: projBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: summaryFontSize, cellPadding: summaryPadding, minCellHeight: 4 },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: 255,
      fontSize: summaryFontSize,
      font: fontName,
      cellPadding: summaryPadding,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 13, halign: 'center' },
      2: { cellWidth: 13, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
    },
  });

  const projEndY = (doc as any).lastAutoTable.finalY;

  if (hasSerialSummary) {
    const serialBody = serialSummary.map((s) => [s.name, String(s.quantity)]);

    autoTable(doc, {
      startY: y,
      margin: { left: pageMargin.left + leftWidth + summaryGap, right: pageMargin.right },
      head: [['Позиция', 'Кол-во']],
      body: serialBody,
      theme: 'grid',
      styles: { font: fontName, fontSize: summaryFontSize, cellPadding: summaryPadding, minCellHeight: 4 },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: 255,
        fontSize: summaryFontSize,
        font: fontName,
        cellPadding: summaryPadding,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 15, halign: 'center' },
      },
    });
  }

  const serialEndY = hasSerialSummary ? (doc as any).lastAutoTable.finalY : projEndY;
  y = Math.max(projEndY, serialEndY) + sectionGap;

  const estimatedTotalsHeight = 5 + totalsBody.length * 4.4;
  if (y + estimatedTotalsHeight > bottomLimit) {
    doc.addPage();
    y = pageMargin.top;
  }

  doc.setFontSize(headingFontSize);
  doc.text('Итого', pageMargin.left, y);
  y += 1.5;

  autoTable(doc, {
    startY: y,
    margin: pageMargin,
    body: totalsBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: totalsFontSize, cellPadding: totalsPadding, minCellHeight: 4.2 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  doc.save(`Табель_${monthLabel.replace(/\s/g, '_')}.pdf`);
}
