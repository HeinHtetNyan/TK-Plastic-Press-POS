import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, CreditCard, History, BarChart3 } from 'lucide-react';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar / Mobile Header */}
      <header className="bg-blue-600 text-white p-3 shadow-md sticky top-0 z-20 md:h-screen md:w-64 md:fixed md:left-0 md:flex flex-col">
        <div className="flex items-center gap-3 md:mb-8">
          <div className="w-16 h-10 bg-white rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
            <img src="/TK.jpeg" alt="TK Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
          </div>

          <h1 className="text-lg md:text-xl font-black tracking-tight leading-tight uppercase">TK Plastic Press</h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-col gap-2 mt-8 flex-grow">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-black uppercase text-xs tracking-widest ${
                  isActive ? 'bg-white text-blue-600 shadow-lg scale-105' : 'text-blue-100 hover:bg-blue-500'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 md:ml-64 w-full transition-all">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - Simplified */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around p-2 z-20 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-1 px-8 rounded-xl transition-all ${
                isActive ? 'text-blue-600 scale-110' : 'text-gray-400'
              }`}
            >
              <Icon size={24} />
              <span className="text-[10px] mt-1 font-black uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
