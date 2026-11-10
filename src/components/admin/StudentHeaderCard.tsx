import { Ban, Pencil, Smartphone, User, UserCheck } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

interface Props {
  student: { regNumber: string; name: string; department?: string; deviceLinked?: boolean; deviceLinkedAt?: number | null };
  /** Mark present / Revoke only make sense when the student takes at least one of the admin's courses. */
  showActions: boolean;
  onEditName: () => void;
  onMarkPresent: () => void;
  onRevoke: () => void;
  /** Super admins only: unlink the student's phone/browser. */
  onResetDevice?: () => void;
}

/** Student summary on Student Lookup. Stacks on phones (name on top, actions underneath) and sits in one row from `sm` up. */
export default function StudentHeaderCard({ student, showActions, onEditName, onMarkPresent, onRevoke, onResetDevice }: Props) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
          <User className="h-5 w-5 text-brand-700 dark:text-brand-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-bold text-slate-900 dark:text-white">
              {student.name || <span className="font-medium text-slate-400">No name on file</span>}
            </p>
            <button
              onClick={onEditName}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
              title="Edit name"
              aria-label="Edit name"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="font-mono text-sm text-slate-500">{student.regNumber}</p>
          {student.department && <p className="mt-0.5 text-xs text-slate-400">{student.department}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              {student.deviceLinked
                ? `Device linked${student.deviceLinkedAt ? ` · ${formatDisplayDate(new Date(student.deviceLinkedAt).toISOString().slice(0, 10))}` : ""}`
                : "No device linked yet"}
            </span>
            {student.deviceLinked && onResetDevice && (
              <button onClick={onResetDevice} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Reset
              </button>
            )}
          </p>
        </div>
      </div>
      {showActions && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button size="sm" variant="outline" className="text-brand-700 dark:text-brand-300" icon={<UserCheck className="h-3.5 w-3.5" />} onClick={onMarkPresent}>
            Mark present
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" icon={<Ban className="h-3.5 w-3.5" />} onClick={onRevoke}>
            Revoke a day
          </Button>
        </div>
      )}
    </Card>
  );
}
