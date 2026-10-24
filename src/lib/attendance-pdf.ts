import { format } from "date-fns";
import { ADMISSION_TYPES, DEPARTMENTS } from "@/constants/academics";
import type { CourseExportData, ExportSession, ExportStudent } from "@/types/admin";

type RGB = [number, number, number];

const BRAND: RGB = [22, 163, 74];
const GREEN_BG: RGB = [220, 252, 231];
const GREEN_TX: RGB = [22, 101, 52];
const RED_BG: RGB = [254, 226, 226];
const RED_TX: RGB = [153, 27, 27];
const AMBER_BG: RGB = [254, 243, 199];
const AMBER_TX: RGB = [146, 64, 14];

const dayLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE, MMM d yyyy");
};
const shortDay = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return format(new Date(y, m - 1, d), "MMM d");
};
const clock = (ts: number) => (ts ? format(new Date(ts), "h:mm a") : "");

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const pctColour = (p: number): RGB => (p < 20 ? RED_TX : p < 50 ? AMBER_TX : GREEN_TX);

const safeFile = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

/** Green banner + title block. Returns the Y where the table should start. */
function header(doc: import("jspdf").jsPDF, title: string, lines: string[]): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DARS - Digital Attendance Recording System", 14, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("UNIZIK · Political Science Department", 14, 14);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 27);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  let y = 33;
  for (const line of lines) {
    doc.text(line, 14, y);
    y += 4.5;
  }
  return y + 1.5;
}

function footer(doc: import("jspdf").jsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pages} · Developed by Drexx Technologies`, w / 2, h - 6, { align: "center" });
  }
}

/** Students split by department, in the order of DEPARTMENTS (Political Science first). Empty departments are dropped. */
function groupByDepartment(students: ExportStudent[]) {
  return DEPARTMENTS.map((d) => ({ id: d.id, label: d.label, students: students.filter((s) => s.department === d.id) })).filter(
    (g) => g.students.length > 0
  );
}

/** "9 Regular, 3 CEP" for a list of students. */
const typeSummary = (list: ExportStudent[]) =>
  ADMISSION_TYPES.map((t) => ({ label: t.label, n: list.filter((s) => s.admissionType === t.id).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${x.label}`)
    .join(", ");

const sessionHead = (s: ExportSession, sameDayCount: number) =>
  sameDayCount > 1 ? `${shortDay(s.date)}\n${clock(s.startTime)}` : shortDay(s.date);

/**
 * Whole-course report: one row per student, one column per class held, plus attended count and percentage.
 * P = present, L = present but late, A = absent. Wide courses continue across pages with the student columns repeated.
 */
export async function exportCourseAttendancePDF(data: CourseExportData) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { course, sessions, students, records } = data;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const perDay = new Map<string, number>();
  sessions.forEach((s) => perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1));

  const dates = sessions.map((s) => s.date).filter(Boolean).sort();
  const held = `${sessions.length} class${sessions.length === 1 ? "" : "es"} held${dates.length ? ` (${dayLabel(dates[0])} to ${dayLabel(dates[dates.length - 1])})` : ""}`;
  const title = `Course Attendance - ${course.code} · ${course.name}`;
  const keyLine = `Key: P = present · L = present, late · A = absent        Generated: ${format(new Date(), "MMM d yyyy, h:mm a")}`;

  if (sessions.length === 0 || students.length === 0) {
    const startY = header(doc, title, [held, keyLine]);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(sessions.length === 0 ? "No classes have been held for this course yet." : "No students to list.", 14, startY + 6);
    footer(doc);
    doc.save(`DARS_${safeFile(course.code)}_attendance_full.pdf`);
    return;
  }

  const FIXED = 5; // S/N, Reg, Name, Attended, %
  const columnStyles: Record<number, object> = {
    0: { cellWidth: 10, halign: "center" },
    1: { cellWidth: 26 },
    2: { cellWidth: 52 },
    3: { cellWidth: 17, halign: "center" },
    4: { cellWidth: 13, halign: "center" },
  };
  sessions.forEach((_, i) => (columnStyles[FIXED + i] = { cellWidth: 16, halign: "center" }));
  const head = [["S/N", "Reg No.", "Name", "Attended", "%", ...sessions.map((s) => sessionHead(s, perDay.get(s.date) ?? 1))]];

  // One section per department, each on its own page(s), numbered from 1.
  groupByDepartment(students).forEach((group, gi) => {
    if (gi > 0) doc.addPage();

    const present = group.students.reduce((n, s) => n + Object.keys(records[s.regNumber] ?? {}).length, 0);
    const startY = header(doc, title, [
      `${group.label} · ${group.students.length} student${group.students.length === 1 ? "" : "s"} (${typeSummary(group.students)}) · overall attendance ${pct(present, group.students.length * sessions.length)}%`,
      held,
      keyLine,
    ]);

    const body = group.students.map((st, i) => {
      const rec = records[st.regNumber] ?? {};
      const attended = sessions.filter((s) => rec[s.id]).length;
      return [
        String(i + 1),
        st.regNumber,
        st.name,
        `${attended}/${sessions.length}`,
        `${pct(attended, sessions.length)}%`,
        ...sessions.map((s) => (rec[s.id] ? (rec[s.id].late ? "L" : "P") : "A")),
      ];
    });

    autoTable(doc, {
      head,
      body,
      startY,
      theme: "grid",
      margin: { left: 10, right: 10, bottom: 12 },
      styles: { fontSize: 7.5, cellPadding: 1.8, valign: "middle", lineColor: [226, 232, 240], lineWidth: 0.15, overflow: "ellipsize" },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7 },
      columnStyles,
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1, 2, 3, 4],
      didParseCell(h) {
        if (h.section !== "body") return;
        const col = h.column.index;
        const raw = String(h.cell.raw ?? "");
        if (col === 2) h.cell.styles.halign = "left";
        if (col === 4) {
          h.cell.styles.textColor = pctColour(parseInt(raw, 10) || 0);
          h.cell.styles.fontStyle = "bold";
        }
        if (col >= FIXED) {
          h.cell.styles.fontStyle = "bold";
          if (raw === "P") { h.cell.styles.fillColor = GREEN_BG; h.cell.styles.textColor = GREEN_TX; }
          else if (raw === "L") { h.cell.styles.fillColor = AMBER_BG; h.cell.styles.textColor = AMBER_TX; }
          else if (raw === "A") { h.cell.styles.fillColor = RED_BG; h.cell.styles.textColor = RED_TX; }
        }
      },
    });
  });

  footer(doc);
  doc.save(`DARS_${safeFile(course.code)}_attendance_full.pdf`);
}

/**
 * Single-day report: every student against the class(es) held on that day, with the time each was marked.
 */
export async function exportDayAttendancePDF(data: CourseExportData, date: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const { course, sessions, students, records } = data;
  const multi = sessions.length > 1;
  const doc = new jsPDF({ orientation: multi ? "landscape" : "portrait", unit: "mm", format: "a4" });

  const presentIn = (reg: string) => sessions.filter((s) => records[reg]?.[s.id]).length;
  const times = sessions.map((s) => `${clock(s.startTime)}${s.endTime ? ` - ${clock(s.endTime)}` : ""}${s.locationName ? ` · ${s.locationName}` : ""}`).join("   |   ");
  const generated = `Generated: ${format(new Date(), "MMM d yyyy, h:mm a")}`;
  const title = `Daily Attendance - ${course.code} · ${dayLabel(date)}`;
  const file = `DARS_${safeFile(course.code)}_attendance_${date}.pdf`;

  if (sessions.length === 0 || students.length === 0) {
    const startY = header(doc, title, [times, generated]);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(sessions.length === 0 ? "No class was held for this course on that day." : "No students to list.", 14, startY + 6);
    footer(doc);
    doc.save(file);
    return;
  }

  const cell = (reg: string, s: ExportSession) => {
    const r = records[reg]?.[s.id];
    if (!r) return "Absent";
    const t = clock(r.timestamp);
    return `${r.late ? "Late" : "Present"}${r.manual ? " (admin)" : ""}${t ? `\n${t}` : ""}`;
  };

  const head = [["S/N", "Reg No.", "Name", ...sessions.map((s) => (multi ? `Class ${clock(s.startTime)}` : "Status"))]];

  // One section per department, each on its own page(s), numbered from 1.
  groupByDepartment(students).forEach((group, gi) => {
    if (gi > 0) doc.addPage();

    const list = group.students;
    const withAny = list.filter((s) => presentIn(s.regNumber) > 0).length;
    const lateCount = list.reduce((n, s) => n + sessions.filter((x) => records[s.regNumber]?.[x.id]?.late).length, 0);
    const startY = header(doc, title, [
      `${group.label} · ${list.length} student${list.length === 1 ? "" : "s"} (${typeSummary(list)})`,
      times,
      multi
        ? `${sessions.length} classes held this day · ${withAny} of ${list.length} students attended at least one`
        : `Present: ${withAny} of ${list.length} (${pct(withAny, list.length)}%) · Absent: ${list.length - withAny}${lateCount ? ` · Late: ${lateCount}` : ""}`,
      generated,
    ]);

    const body = list.map((st, i) => [String(i + 1), st.regNumber, st.name, ...sessions.map((s) => cell(st.regNumber, s))]);

    autoTable(doc, {
      head,
      body,
      startY,
      theme: "grid",
      margin: { left: 10, right: 10, bottom: 12 },
      styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [226, 232, 240], lineWidth: 0.15, overflow: "ellipsize" },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 28 } },
      didParseCell(h) {
        if (h.section !== "body" || h.column.index < 3) return;
        const raw = String(h.cell.raw ?? "");
        h.cell.styles.halign = "center";
        h.cell.styles.fontStyle = "bold";
        if (raw.startsWith("Present")) { h.cell.styles.fillColor = GREEN_BG; h.cell.styles.textColor = GREEN_TX; }
        else if (raw.startsWith("Late")) { h.cell.styles.fillColor = AMBER_BG; h.cell.styles.textColor = AMBER_TX; }
        else { h.cell.styles.fillColor = RED_BG; h.cell.styles.textColor = RED_TX; }
      },
    });
  });

  footer(doc);
  doc.save(file);
}
