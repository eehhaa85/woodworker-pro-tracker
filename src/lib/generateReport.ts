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

export function generateTimesheetPDF(data: ReportData) {
  const { monthLabel, userName, dailyData, projectSummary, totals, settings } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Use built-in helvetica (supports basic latin; for Cyrillic we'll use unicode escape workaround)
  // jsPDF doesn't natively support Cyrillic with built-in fonts, so we add a font
  // For now we'll use the built-in font which works in many PDF viewers
  doc.setFont('helvetica');

  // Header
  doc.setFontSize(14);
  doc.text(`Табель — ${monthLabel}`, 14, 15);

  doc.setFontSize(10);
  doc.text(`Ф.И.О.: ${userName}`, 14, 22);

  // Daily table
  const dailyBody = dailyData.map((d) => [
    String(d.day),
    d.startTime || '',
    d.endTime || '',
    d.hours ? String(d.hours) : '',
    d.nesting ? String(d.nesting) : '',
    d.tariffHours ? `${d.tariffHours}:00` : '',
    d.description || '',
  ]);

  autoTable(doc, {
    startY: 27,
    head: [['Дата', 'Начало', 'Конец', 'Часы', 'Нестинг', 'Тариф', 'Название проекта и изделия']],
    body: dailyBody,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 'auto' },
    },
    didParseCell: (hookData) => {
      // Dim empty rows
      const rowData = hookData.row.raw as string[];
      if (hookData.section === 'body' && rowData && !rowData[6]) {
        hookData.cell.styles.textColor = [180, 180, 180];
      }
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // Check if we need a new page
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  // Project summary
  doc.setFontSize(9);
  doc.text('Отчет по затраченному времени по каждому проекту', 14, y);
  y += 2;

  const projBody = projectSummary.map((p) => [
    p.name,
    p.hours ? String(p.hours) : '',
    p.nesting ? String(p.nesting) : '',
    p.serial ? formatRub(p.serial) : '',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Проект', 'Часы', 'Нестинг', 'Сдельн. Серийка']],
    body: projBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (y > 250) {
    doc.addPage();
    y = 15;
  }

  // Totals summary
  doc.setFontSize(9);
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
  ];

  if (totals.totalTariffOvertime > 0) {
    totalsBody.push([
      'Всего выходных и по просьбе часов',
      String(totals.totalTariffOvertime),
      `× ${formatRub(settings.rate_overtime)}`,
      formatRub(totals.totalTariffOvertime * settings.rate_overtime),
    ]);
  } else {
    totalsBody.push(['Всего выходных и по просьбе часов', '', '', '']);
  }

  if (totals.totalTariffSick > 0) {
    totalsBody.push([
      'Больничные и отпускные',
      String(totals.totalTariffSick),
      `× ${formatRub(settings.rate_sick_leave)}`,
      formatRub(totals.totalTariffSick * settings.rate_sick_leave),
    ]);
  } else {
    totalsBody.push(['Больничные и отпускные', '', '', '']);
  }

  totalsBody.push([
    'Нестинг всего',
    String(totals.totalNesting),
    `× ${formatRub(settings.rate_full_sheet)}`,
    formatRub(totals.totalNesting * settings.rate_full_sheet),
  ]);

  if (totals.totalSerial > 0) {
    totalsBody.push(['Серийка', formatRub(totals.totalSerial), '', '']);
  }

  autoTable(doc, {
    startY: y,
    body: totalsBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Save
  doc.save(`Табель_${monthLabel.replace(/\s/g, '_')}.pdf`);
}
