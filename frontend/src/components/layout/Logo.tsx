/** Athena's aegis: a bronze shield bearing her owl. */
export function Logo({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#2a1d3a" />
        <path d="M16 4.5l9.5 3.6v7c0 5.9-4 10.7-9.5 12.4C10.5 25.8 6.5 21 6.5 15.1v-7L16 4.5z" fill="none" stroke="#d4a35a" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="13" cy="14" r="2" fill="none" stroke="#f1eaf6" strokeWidth="1.6" />
        <circle cx="19" cy="14" r="2" fill="none" stroke="#f1eaf6" strokeWidth="1.6" />
        <path d="M14.8 18.5l1.2 1.6 1.2-1.6" fill="none" stroke="#d4a35a" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <div className="leading-none">
        <span className="font-display text-[15px] font-semibold tracking-wide text-fg">TokenShield</span>
        {showTagline && <span className="mt-1 block text-[10px] tracking-[0.2em] text-bronze uppercase">Aegis of Athena</span>}
      </div>
    </div>
  );
}
