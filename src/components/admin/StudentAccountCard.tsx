"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { KeyRound, Mail, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import ConfirmJobSheet from "@/components/ui/ConfirmJobSheet";
import DeleteStudentSheet from "@/components/admin/DeleteStudentSheet";
import { useScopes } from "@/hooks/useScopes";
import { adminFetch } from "@/lib/admin-api";
import { clientAuth } from "@/lib/firebase-client";

export interface StudentAccount {
  uid: string | null;
  email: string;
  disabled: boolean;
  isAdmin: boolean;
}

interface Props {
  student: { regNumber: string; name: string };
  account: StudentAccount;
  /** Re-run the lookup (status changed). */
  onChanged: () => void;
  /** The student was deleted. */
  onDeleted: () => void;
}

const base = (reg: string) => `/api/admin/students/${encodeURIComponent(reg)}/account`;

/** Email and login controls for a looked-up student: send a reset email, disable / enable sign-in, delete the account. */
export default function StudentAccountCard({ student, account, onChanged, onDeleted }: Props) {
  const { guard } = useScopes();
  const [sheet, setSheet] = useState<"reset" | "toggle" | "delete" | null>(null);
  const who = student.name || student.regNumber;
  const noLogin = !account.uid;

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</h2>
        {account.disabled ? <Badge variant="red">Disabled</Badge> : noLogin ? <Badge variant="slate">No login</Badge> : <Badge variant="green">Active</Badge>}
      </div>

      <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <Mail className="h-4 w-4 shrink-0 text-slate-400" />
        {account.email ? <span className="break-all">{account.email}</span> : <span className="text-slate-400">No email on file</span>}
      </p>

      {account.isAdmin ? (
        <p className="text-xs text-slate-500">This account is an admin. Manage it from Admin Management.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button size="sm" variant="outline" icon={<KeyRound className="h-3.5 w-3.5" />} disabled={!account.email} onClick={() => guard("student.lookup") && setSheet("reset")}>
            Reset password
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={noLogin}
            icon={account.disabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldBan className="h-3.5 w-3.5" />}
            onClick={() => guard("student.lookup") && setSheet("toggle")}
          >
            {account.disabled ? "Enable account" : "Disable account"}
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => guard("student.delete") && setSheet("delete")}>
            Delete account
          </Button>
        </div>
      )}

      <ConfirmJobSheet<{ email: string }>
        open={sheet === "reset"}
        onClose={() => setSheet(null)}
        tone="default"
        confirmVariant="primary"
        icon={<KeyRound className="h-5 w-5" />}
        title="Send a password reset email?"
        subtitle={who}
        confirmLabel="Send email"
        runningTitle="Sending reset email"
        run={async (onProgress) => {
          onProgress({ step: "Checking your access…" });
          const r = await adminFetch<{ email: string }>(base(student.regNumber), { body: { action: "reset_password" } });
          if (!r.ok) return { ok: false, error: r.error, outOfScope: r.outOfScope };
          onProgress({ step: `Emailing ${r.data.email}…` });
          try {
            await sendPasswordResetEmail(clientAuth, r.data.email);
            return { ok: true, result: { email: r.data.email } };
          } catch {
            return { ok: false, error: "Firebase couldn't send the email. Check the address and try again in a moment." };
          }
        }}
        success={(r) => ({ title: "Reset email sent", body: <p>A password reset link was sent to <strong className="break-all">{r.email}</strong>. It may take a minute, and can land in spam.</p> })}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A reset link goes to <strong className="break-all">{account.email}</strong>. Their current password keeps working until they use it.
        </p>
      </ConfirmJobSheet>

      <ConfirmJobSheet<{ disabled: boolean }>
        open={sheet === "toggle"}
        onClose={() => setSheet(null)}
        tone={account.disabled ? "default" : "warning"}
        confirmVariant={account.disabled ? "primary" : "danger"}
        icon={account.disabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldBan className="h-5 w-5" />}
        title={account.disabled ? "Enable this account?" : "Disable this account?"}
        subtitle={who}
        confirmLabel={account.disabled ? "Enable" : "Disable"}
        runningTitle={account.disabled ? "Enabling account" : "Disabling account"}
        run={async (onProgress) => {
          onProgress({ step: account.disabled ? "Restoring sign-in…" : "Blocking sign-in and ending their sessions…" });
          const r = await adminFetch<{ disabled: boolean }>(base(student.regNumber), { body: { action: account.disabled ? "enable" : "disable" } });
          return r.ok ? { ok: true, result: { disabled: r.data.disabled } } : { ok: false, error: r.error, outOfScope: r.outOfScope };
        }}
        success={(r) => ({
          title: r.disabled ? "Account disabled" : "Account enabled",
          body: <p>{r.disabled ? `${who} can't sign in or mark attendance until you enable the account again. Their records are untouched.` : `${who} can sign in and mark attendance again.`}</p>,
        })}
        onFinished={() => {
          toast.success(account.disabled ? "Account enabled." : "Account disabled.");
          onChanged();
        }}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {account.disabled
            ? "They'll be able to sign in and mark attendance again."
            : "They'll be signed out and blocked from signing in or marking attendance. Nothing is deleted, and you can enable the account again any time."}
        </p>
      </ConfirmJobSheet>

      <DeleteStudentSheet open={sheet === "delete"} onClose={() => setSheet(null)} student={student} onDeleted={onDeleted} />
    </Card>
  );
}
