import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRub, formatHoursHHMM } from '@/lib/rates';
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
  return String(n);
}

export async function generateTimesheetPDF(data: ReportData) {
  const { monthLabel, userName, dailyData, projectSummary, totals, settings } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const fontData = await loadFont();
  const fontBase64 = btoa(
    new Uint8Array(fontData).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');

  // Header
  doc.setFontSize(13);
  doc.text(`Табель — ${monthLabel}`, 14, 14);
  doc.setFontSize(9);
  doc.text(`Ф.И.О.: ${userName}`, 14, 20);

  // Daily table — compact with Ч and СУ columns
  const dailyBody = dailyData.map((d) => [
    String(d.day),
    d.startTime || '',
    d.endTime || '',
    fmtNum(d.hours),
    fmtNum(d.hoursOt),
    fmtNum(d.nesting),
    formatHoursHHMM(d.tariffHours),
    d.description || '',
  ]);

  const fontName = 'Roboto';
  const tableStyles = { font: fontName, fontSize: 6.5, cellPadding: 0.8, overflow: 'linebreak' as const };

  autoTable(doc, {
    startY: 24,
    head: [['Д', 'Нач', 'Кон', 'Ч', 'СУ', 'Н', 'Тариф', 'Описание']],
    body: dailyBody,
    theme: 'grid',
    styles: tableStyles,
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 6.5, font: fontName },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 7, halign: 'center' },
      4: { cellWidth: 7, halign: 'center' },
      5: { cellWidth: 7, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    didParseCell: (hookData) => {
      const rowData = hookData.row.raw as string[];
      if (hookData.section === 'body' && rowData && !rowData[7]) {
        hookData.cell.styles.textColor = [190, 190, 190];
        hookData.cell.styles.minCellHeight = 3;
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 4;
  if (y > 235) { doc.addPage(); y = 14; }

  // Project summary
  doc.setFontSize(8);
  doc.text('По проектам', 14, y);
  y += 2;

  const projBody = projectSummary.map((p) => [
    p.name,
    fmtNum(p.hours),
    fmtNum(p.nesting),
    p.serial ? formatRub(p.serial) : '',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Проект', 'Часы', 'Нест.', 'Серийка TR']],
    body: projBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 7, font: fontName },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;
  if (y > 245) { doc.addPage(); y = 14; }

  // Totals summary
  doc.setFontSize(8);
  doc.text('Итого', 14, y);
  y += 2;

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

  // Show advance only after 15th of current month, or always for past months
  const now = new Date();
  const [reportYear, reportMonth] = data.monthLabel.split(' ');
  const isCurrentMonth = now.toLocaleDateString('ru-RU', { month: 'long' }).toLowerCase() === reportYear?.toLowerCase()
    || data.monthLabel.toLowerCase().includes(now.toLocaleDateString('ru-RU', { month: 'long' }).toLowerCase());
  const showAdvance = !isCurrentMonth || now.getDate() >= 15;

  if (showAdvance) {
    totalsBody.push(['Аванс', formatRub(settings.advance_payment), '', '']);
  }

  autoTable(doc, {
    startY: y,
    body: totalsBody,
    theme: 'grid',
    styles: { font: fontName, fontSize: 7.5, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  doc.save(`Табель_${monthLabel.replace(/\s/g, '_')}.pdf`);
}
