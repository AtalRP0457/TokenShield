import { Eye, ScrollText, Sailboat, ShieldHalf, Tornado, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  /** Plain-English name shown next to the mythic label. */
  hint: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'The watch', hint: 'Overview', icon: Eye, end: true },
  { to: '/agents', label: 'Heroes', hint: 'Agents', icon: Sailboat },
  { to: '/incidents', label: 'Perils', hint: 'Incidents', icon: Tornado },
  { to: '/activity', label: "Ship's log", hint: 'Live activity', icon: ScrollText },
  { to: '/settings', label: "Athena's wards", hint: 'Protection', icon: ShieldHalf },
];
