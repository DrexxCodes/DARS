import Papa from "papaparse";
import type jsPDF from "jspdf";

// CSV colouring is not possible natively, so we just export raw data.
// The "attended" column already contains "Present" or "Absent" for easy reading.
export function exportCSV(rows: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportPDF(
  rows: Record<string, unknown>[],
  filename: string,
  title: string
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });

  // ── Header banner ──────────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, doc.internal.pageSize.width, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DARS — Digital Attendance Recording System", 14, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("UNIZIK · Political Science Department", 14, 14);

  // ── Report title ───────────────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 26);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  if (rows.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text("No records found.", 14, 45);
  } else {
    const headers = Object.keys(rows[0]).filter((h) => h !== "classId"); // hide internal id
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    autoTable(doc, {
      head: [headers.map((h) => h.replace(/([A-Z])/g, " $1").trim().toUpperCase())],
      body,
      startY: 36,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 14, right: 14 },
      // ── Colour "attended" column cells ────────────────────────────────────
      didParseCell(data) {
        const attendedColIdx = headers.indexOf("attended");
        if (data.section === "body" && data.column.index === attendedColIdx) {
          const val = String(data.cell.raw ?? "");
          if (val === "Present") {
            data.cell.styles.fillColor = [220, 252, 231]; // green-100
            data.cell.styles.textColor = [22, 101, 52];   // green-800
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Absent") {
            data.cell.styles.fillColor = [254, 226, 226]; // red-100
            data.cell.styles.textColor = [153, 27, 27];   // red-800
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  // ── Page footer ────────────────────────────────────────────────────────────
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} · Developed by Drexx Technologies`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 6,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}
