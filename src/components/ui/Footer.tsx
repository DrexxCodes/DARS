export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <p>© {year} DARS — Digital Attendance Recording System</p>
        <p>
          Developed by{" "}
          <span className="font-semibold text-brand-600 dark:text-brand-400">
            Drexx Technologies
          </span>
        </p>
      </div>
    </footer>
  );
}
