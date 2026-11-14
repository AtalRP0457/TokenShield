import { Activity, Bot, LayoutDashboard, ShieldAlert, SlidersHorizontal, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/incidents', label: 'Incidents', icon: ShieldAlert },
  { to: '/activity', label: 'Live activity', icon: Activity },
  { to: '/settings', label: 'Protection', icon: SlidersHorizontal },
];
