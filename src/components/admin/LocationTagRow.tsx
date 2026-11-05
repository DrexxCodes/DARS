import { MapPin, Ruler, Star, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { LocationTag } from "@/types/location";

interface Props {
  tag: LocationTag;
  /** The primary tag, or the only tag left, can't be deleted. */
  canDelete: boolean;
  settingPrimary: boolean;
  deleting: boolean;
  onEditRange: () => void;
  onSetPrimary: () => void;
  onDelete: () => void;
}

/**
 * One saved location. On phones the details sit on top and the actions share the full width underneath, so the name and
 * coordinates are never squeezed by the buttons. From `sm` up it's a single row.
 */
export default function LocationTagRow({ tag, canDelete, settingPrimary, deleting, onEditRange, onSetPrimary, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tag.isPrimary ? "bg-brand-100 dark:bg-brand-900" : "bg-slate-100 dark:bg-slate-800"}`}>
          <MapPin className={`h-4 w-4 ${tag.isPrimary ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">{tag.name}</p>
            {tag.isPrimary && <Badge variant="green">Primary</Badge>}
          </div>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {tag.lat.toFixed(5)}, {tag.lng.toFixed(5)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{tag.radiusMeters} m radius</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap">
        <Button size="sm" variant="outline" className="flex-1 sm:flex-none" icon={<Ruler className="h-3.5 w-3.5" />} onClick={onEditRange}>
          Range
        </Button>
        {!tag.isPrimary && (
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" icon={<Star className="h-3.5 w-3.5" />} loading={settingPrimary} onClick={onSetPrimary}>
            Set Primary
          </Button>
        )}
        <Button size="sm" variant="danger" className="flex-1 sm:flex-none" icon={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} disabled={!canDelete} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
