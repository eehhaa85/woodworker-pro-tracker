import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRub } from '@/lib/rates';
import type { UserSettings } from '@/hooks/useSettings';

interface DailyRow {
  day: number;
  startTime: string;
  endTime: string;
  hours: number;
  nesting: number;
  tariffHours: number;
  description: string;
}

interface ProjectRow {
  name: string;
  hours: number;
  nesting: number;
  serial: number;
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
  userName: string;
  dailyData: DailyRow[];
  projectSummary: ProjectRow[];
  totals: Totals;
  settings: UserSettings;
}

async function loadFont(): Promise<ArrayBuffer> {
  const resp = await fetch('/fonts/Roboto-Regular.ttf');
  return resp.arrayBuffer();
}

function fmtNum(n: number): string {
  if (n === 0) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

export async function generateTimesheetPDF(data: ReportData) {
  const { monthLabel, userName, dailyData, projectSummary, totals, settings } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Load and register Cyrillic font
  const fontData = await loadFont();
  const fontBase64 = btoa(
    new Uint8Array(fontData).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto', 'normal');

  // Header
  doc.setFontSize(13);
  doc.text(`Табель — ${monthLabel}`, 14, 14);

  doc.setFontSize(9);
  doc.text(`Ф.И.О.: ${userName}`, 14, 20);

  // Daily table
  const dailyBody = dailyData.map((d) => [
    String(d.day),
    d.startTime || '',
    d.endTime || '',
    fmtNum(d.hours),
    fmtNum(d.nesting),
    d.tariffHours ? `${d.tariffHours}:00` : '',
    d.description || '',
  ]);

  const fontName = 'Roboto';
  const tableStyles = { font: fontName, fontSize: 5.5, cellPadding: 0.8, overflow: 'ellipsize' as const };

  autoTable(doc, {
    startY: 24,
    head: [['Дата', 'Начало', 'Конец', 'Часы', 'Нест.', 'Тариф', 'Название проекта и изделия']],
    body: dailyBody,
    theme: 'grid',
    styles: tableStyles,
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 5.5, font: fontName },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 'auto' },
    },
    didParseCell: (hookData) => {
      const rowData = hookData.row.raw as string[];
      if (hookData.section === 'body' && rowData && !rowData[6]) {
        hookData.cell.styles.textColor = [190, 190, 190];
        hookData.cell.styles.minCellHeight = 3.5;
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 4;

  if (y > 235) { doc.addPage(); y = 14; }

  // Project summary
  doc.setFontSize(8);
  doc.text('Отчет по затраченному времени по каждому проекту', 14, y);
  y += 2;

  const projBody = projectSummary.map((p) => [
    p.name,
    fmtNum(p.hours),
    fmtNum(p.nesting),
    p.serial ? formatRub(p.serial) : '',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Проект', 'Часы', 'Нестинг', 'Сдельн. Серийка']],
    body: projBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: 6, cellPadding: 1 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 6, font: fontName },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  if (y > 245) { doc.addPage(); y = 14; }

  // Totals summary
  doc.setFontSize(8);
  doc.text('Отчет по общему рабочему времени', 14, y);
  y += 2;

  const totalsBody: string[][] = [
    ['Всего часов', String(totals.totalWorkHours), '', ''],
    [
      'Всего часов по тарифу',
      String(totals.totalTariffStandard),
      `× ${formatRub(settings.rate_standard)}`,
      formatRub(totals.totalTariffStandard * settings.rate_standard),
    ],
    [
      'Выходные и по просьбе',
      totals.totalTariffOvertime ? String(totals.totalTariffOvertime) : '',
      totals.totalTariffOvertime ? `× ${formatRub(settings.rate_overtime)}` : '',
      totals.totalTariffOvertime ? formatRub(totals.totalTariffOvertime * settings.rate_overtime) : '',
    ],
    [
      'Больничные и отпускные',
      totals.totalTariffSick ? String(totals.totalTariffSick) : '',
      totals.totalTariffSick ? `× ${formatRub(settings.rate_sick_leave)}` : '',
      totals.totalTariffSick ? formatRub(totals.totalTariffSick * settings.rate_sick_leave) : '',
    ],
    [
      'Нестинг всего',
      String(totals.totalNesting),
      `× ${formatRub(settings.rate_full_sheet)}`,
      formatRub(totals.totalNesting * settings.rate_full_sheet),
    ],
  ];

  if (totals.totalSerial > 0) {
    totalsBody.push(['Серийка', formatRub(totals.totalSerial), '', '']);
  }

  autoTable(doc, {
    startY: y,
    body: totalsBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: 6.5, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Save
  doc.save(`Табель_${monthLabel.replace(/\s/g, '_')}.pdf`);
}
