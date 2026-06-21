export default function OfflinePage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-5">
        <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center mx-auto">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-brand-600 dark:text-brand-400" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">You&apos;re Offline</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            DARS requires an internet connection to mark or view attendance. Please check your connection and try again.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Try Again
        </button>
        <p className="text-xs text-slate-400">Drexx Technologies · DARS v1.0</p>
      </div>
    </div>
  );
}
