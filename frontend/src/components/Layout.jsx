import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, CreditCard, History, BarChart3, Users, LogOut, User as UserIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import SyncStatus from './SyncStatus';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => {
    setLang(lang === 'EN' ? 'MM' : 'EN');
  };

  const navItems = [
    { path: '/', icon: Home, label: t('home') },
    { path: '/reports', icon: BarChart3, label: t('reports') },
  ];

  if (isAdmin()) {
    navItems.push({ path: '/users', icon: Users, label: t('users') });
    navItems.push({ path: '/audit-logs', icon: ShieldAlert, label: t('audit') });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar / Mobile Header */}
      <header className="bg-blue-600 text-white p-3 shadow-md sticky top-0 z-20 md:h-screen md:w-64 md:fixed md:left-0 md:flex flex-col">
        <div className="flex items-center gap-3 md:mb-8">
          <div className="w-16 h-10 bg-white rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
            <img src="/TK.jpeg" alt="TK Logo" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-tight leading-tight uppercase">{import.meta.env.VITE_APP_NAME}</h1>
        </div>

        {/* Language Toggle */}
        <div className="flex gap-1 mb-6 p-1 bg-blue-700/30 rounded-xl self-start">
          <button
            onClick={() => setLang('EN')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-200 hover:text-white'}`}
          >
            ENGLISH
          </button>
          <button
            onClick={() => setLang('MM')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'MM' ? 'bg-white text-blue-600 shadow-sm' : 'text-blue-200 hover:text-white'}`}
          >
            MYANMAR
          </button>
        </div>

        {/* User Info (Desktop) */}
        {user && (
          <div className="hidden md:flex flex-col gap-1 p-4 mb-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-full">
                <UserIcon size={16} />
              </div>
              <span className="font-bold truncate">{user.username}</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 ml-8">{user.role}</span>
          </div>
        )}

        {/* Sync status pill (Desktop — inside sidebar) */}
        <div className="hidden md:flex mb-3">
          <SyncStatus />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-col gap-2 mt-2 flex-grow">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path, { replace: item.path === '/', state: null })}
                className={`flex items-center gap-3 p-4 rounded-2xl transition-all font-black uppercase text-xs tracking-widest text-left ${
                  isActive ? 'bg-white text-blue-600 shadow-lg scale-105' : 'text-blue-100 hover:bg-blue-500'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout Button (Desktop) */}
        <button
          onClick={logout}
          className="hidden md:flex items-center gap-3 p-4 rounded-2xl transition-all font-black uppercase text-xs tracking-widest text-blue-100 hover:bg-red-500 hover:text-white mt-auto mb-4"
        >
          <LogOut size={20} />
          {t('logout')}
        </button>

        {/* Mobile Header Right — username + sync pill + logout */}
        <div className="md:hidden flex items-center ml-auto gap-3">
          <button
            onClick={toggleLang}
            className="px-2 py-1 bg-blue-700 rounded-lg text-[10px] font-black border border-blue-500/30"
          >
            {lang}
          </button>
          {user && <span className="text-xs font-bold uppercase">{user.username}</span>}
          <SyncStatus />
          <button onClick={logout} className="p-2 bg-blue-700 rounded-lg">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 md:ml-64 w-full transition-all">
        <div className="max-w-5xl mx-auto mb-20 md:mb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around p-2 z-20 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path, { replace: item.path === '/', state: null })}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
                isActive ? 'text-blue-600 scale-110' : 'text-gray-400'
              }`}
            >
              <Icon size={24} />
              <span className="text-[10px] mt-1 font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
