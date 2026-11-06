import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportSection = {
  heading: string;
  columns: string[];
  rows: string[][];
};

export type ReportSpec = {
  title: string;
  subtitle: string;
  preparedBy: string;
  agent: string;
  notes?: string;
  sections: ReportSection[];
};

export async function downloadReport(spec: ReportSpec) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const ink: [number, number, number] = [28, 25, 21];
  const brass: [number, number, number] = [140, 98, 57];
  const forest: [number, number, number] = [31, 77, 58];
  const paper: [number, number, number] = [251, 248, 243];

  doc.setFillColor(...ink);
  doc.rect(0, 0, 612, 78, "F");
  doc.setFillColor(...brass);
  doc.rect(0, 78, 612, 4, "F");
  doc.setTextColor(247, 241, 230);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("AIDYL SYSTEMS", 40, 34);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(spec.title, 40, 54);
  doc.setFontSize(9);
  doc.text(spec.agent, 420, 34);
  doc.text(new Date().toLocaleString(), 420, 50);

  doc.setTextColor(...ink);
  doc.setFontSize(10);
  const sub = doc.splitTextToSize(spec.subtitle, 520);
  doc.text(sub, 40, 108);
  let y = 108 + sub.length * 13 + 8;
  doc.setFontSize(9);
  doc.setTextColor(...forest);
  doc.text(`Prepared by ${spec.preparedBy}`, 40, y);
  y += 16;

  for (const section of spec.sections) {
    if (y > 700) {
      doc.addPage();
      y = 48;
    }
    doc.setTextColor(...ink);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(section.heading, 40, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows.length ? section.rows : [["No rows in this cut"]],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, textColor: ink, cellPadding: 4 },
      headStyles: { fillColor: forest, textColor: paper, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [243, 230, 212] },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    y += 22;
  }

  if (spec.notes) {
    if (y > 700) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const notes = doc.splitTextToSize(spec.notes, 520);
    doc.text(notes, 40, y);
  }

  const safe = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`aidyl-${safe || "report"}.pdf`);
}
