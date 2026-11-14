export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1f1f23" />
        <path d="M16 5l9 3.5v6.8c0 5.6-3.8 10.2-9 11.7-5.2-1.5-9-6.1-9-11.7V8.5L16 5z" fill="none" stroke="#3987e5" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M12 16l3 3 5-6" fill="none" stroke="#ededef" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-fg">TokenShield</span>
    </div>
  );
}
