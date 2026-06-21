import Papa from "papaparse";

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

  // Header
  doc.setFillColor(22, 163, 74); // brand-600
  doc.rect(0, 0, doc.internal.pageSize.width, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DARS — Digital Attendance Recording System", 14, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("UNIZIK · Political Science Department", 14, 14);

  // Title
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
    const headers = Object.keys(rows[0]);
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    autoTable(doc, {
      head: [headers.map((h) => h.replace(/([A-Z])/g, " $1").trim().toUpperCase())],
      body,
      startY: 36,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on each page
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
