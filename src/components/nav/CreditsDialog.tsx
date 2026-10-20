"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { Dialog } from "@/components/ui";

export default function CreditsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Credits" icon={<Heart className="w-5 h-5" />}>
      <div className="text-center space-y-4 py-2">
        <Image
          src="/icon.png"
          alt="DARS"
          width={64}
          height={64}
          className="w-16 h-16 rounded-2xl shadow-md mx-auto"
        />
        <div>
          <p className="font-bold text-lg text-slate-900 dark:text-white tracking-wide">DARS</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Digital Attendance Recording System</p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Developed by{" "}
          <span className="font-semibold text-brand-600 dark:text-brand-400">Drexx Technologies</span>
        </p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} · All rights reserved</p>
      </div>
    </Dialog>
  );
}
