import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-graphite-950 text-mist-100 overflow-hidden">
      {/* Sidebar for both desktop & mobile drawer */}
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Navbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} isMobileMenuOpen={mobileMenuOpen} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
