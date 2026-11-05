import { Card } from "@/components/ui";

type Accent = "green" | "yellow" | "red" | "blue" | "orange" | "slate";

const COLORS: Record<Accent, string> = {
  green: "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400",
  yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode; accent: Accent;
}) {
  return (
    <Card className="p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${COLORS[accent]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </Card>
  );
}
