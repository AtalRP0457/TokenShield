import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SimulationToast } from './Toast';
import { PerilAlerts } from './PerilAlerts';

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-60">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <SimulationToast />
      <PerilAlerts />
    </div>
  );
}
