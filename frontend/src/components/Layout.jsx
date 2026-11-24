import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LogOut, TrendingDown, Boxes, BarChart3, Settings as SettingsIcon, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import SyncStatus from './SyncStatus';
import DemoPill from './DemoPill';

const APP_NAME = import.meta.env.VITE_APP_NAME;

const Logo = () => (
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-10 h-8 rounded-lg bg-row border border-line overflow-hidden flex-shrink-0 flex items-center justify-center">
      <img src="/TK.jpeg" alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
    </div>
    <span className="font-semibold leading-tight truncate">{APP_NAME}</span>
  </div>
);

// Shell: bottom tab bar < 600px, icon rail 600-1023px, labelled sidebar >= 1024px.
const Layout = ({ children, wide = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const railOnly = location.pathname === '/history';

  const navItems = [
    { path: '/', icon: Home, label: t('home'), short: t('nav_home') },
    { path: '/stock', icon: Boxes, label: t('stock'), short: t('nav_stock') },
    { path: '/reports', icon: BarChart3, label: t('reports'), short: t('nav_reports') },
  ];

  if (isAdmin()) {
    navItems.push({ path: '/spending', icon: TrendingDown, label: t('spending'), short: t('nav_spending') });
    navItems.push({ path: '/settings', icon: SettingsIcon, label: t('settings'), short: t('nav_settings') });
  }

  const extraTitles = { '/history': t('history'), '/voucher': t('voucher'), '/payment': t('payment') };
  const current = navItems.find((i) => i.path === location.pathname);
  const isHome = location.pathname === '/';
  const title = current ? current.label : extraTitles[location.pathname] || APP_NAME;

  // close the profile menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const go = (item) => navigate(item.path, { replace: item.path === '/', state: null });
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-page text-ink">
      <DemoPill />

      {/* Rail (600-1023) and sidebar (>= 1024) */}
      <nav
        aria-label="Main"
        className={`hidden min-[600px]:flex flex-col gap-1 fixed left-0 top-0 bottom-0 z-30 w-24 bg-row border-r border-line-strong px-2 py-3 ${railOnly ? 'min-[1600px]:w-60 min-[1600px]:px-3 min-[1600px]:py-4' : 'lg:w-60 lg:px-3 lg:py-4'}`}
      >
        <div className={`hidden items-center h-12 px-2 mb-3 ${railOnly ? 'min-[1600px]:flex' : 'lg:flex'}`}><Logo /></div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center rounded-xl font-medium ${railOnly ? 'flex-col justify-center gap-1 min-h-[68px] px-1 text-[13px] min-[1600px]:flex-row min-[1600px]:justify-start min-[1600px]:gap-3 min-[1600px]:min-h-[52px] min-[1600px]:px-4 min-[1600px]:text-base' : 'flex-col justify-center gap-1 min-h-[68px] px-1 text-[13px] lg:flex-row lg:justify-start lg:gap-3 lg:min-h-[52px] lg:px-4 lg:text-base'} ${
                active ? 'bg-accent text-on-accent font-semibold' : 'text-ink hover:bg-band'
              }`}
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-full truncate leading-snug">
                <span className={railOnly ? 'min-[1600px]:hidden' : 'lg:hidden'}>{item.short || item.label}</span>
                <span className={railOnly ? 'hidden min-[1600px]:inline' : 'hidden lg:inline'}>{item.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className={`min-[600px]:ml-24 ${railOnly ? 'min-[1600px]:ml-60' : 'lg:ml-60'} min-h-screen flex flex-col`}>
        {/* Title bar */}
        <header className="sticky top-0 z-20 flex items-center gap-2 min-h-14 pl-4 pr-2 bg-row border-b border-line-strong">
          <div className="flex-1 min-w-0">
            {isHome && <div className="min-[600px]:hidden"><Logo /></div>}
            <h1 className={`text-[1.2em] font-semibold truncate ${isHome ? 'hidden min-[600px]:block' : ''}`}>{title}</h1>
          </div>
          <SyncStatus />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label={user?.username || t('language')}
              className="min-w-12 min-h-12 grid place-items-center rounded-xl hover:bg-band"
            >
              <span className="w-10 h-10 rounded-full border border-line-strong bg-row grid place-items-center text-[.85em] font-semibold">{initials}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[52px] w-[min(300px,calc(100vw-16px))] bg-row rounded-2xl p-3 z-40 shadow-[0_10px_30px_-10px_var(--shadow-pin)]">
                {user && (
                  <div className="flex flex-col pb-2.5 mb-2.5 border-b border-line">
                    <b className="font-semibold truncate">{user.username}</b>
                    <small className="text-muted">{user.role}</small>
                  </div>
                )}
                <div className="text-[.88em] font-medium text-muted mb-1">{t('language')}</div>
                <div className="flex border border-line-strong rounded-xl overflow-hidden mb-3">
                  {[['EN', 'English'], ['MM', 'မြန်မာ']].map(([code, name]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      aria-pressed={lang === code}
                      className={`flex-1 min-h-12 px-3 font-medium border-r border-line last:border-r-0 ${lang === code ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full min-h-12 px-4 rounded-xl border border-line-strong bg-row text-ink font-medium inline-flex items-center justify-center gap-2 hover:bg-band"
                >
                  <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        </header>

        {!isOnline && (
          <div role="status" className="flex items-center gap-2 px-4 py-2 bg-extra-bg text-ink border-b border-line text-[.93em]">
            <WifiOff size={20} strokeWidth={1.75} className="text-extra" aria-hidden="true" />
            <span>{t('shell_offline_banner')}</span>
          </div>
        )}

        <main className="flex-grow min-w-0 p-4 min-[600px]:p-6 lg:px-8">
          <div className={`${wide ? 'max-w-[1500px]' : 'max-w-5xl'} mx-auto mb-20 min-[600px]:mb-0`}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom tab bar (< 600px) */}
      <nav
        aria-label="Main"
        className="min-[600px]:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-row border-t border-line-strong pb-safe"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-w-0 min-h-[60px] flex flex-col items-center justify-center gap-0.5 px-0.5 py-1 border-t-[3px] text-[12.5px] ${
                active ? 'text-accent border-accent font-semibold' : 'text-muted border-transparent font-medium'
              }`}
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-full truncate leading-normal">{item.short || item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
