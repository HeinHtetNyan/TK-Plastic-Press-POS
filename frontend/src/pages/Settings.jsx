import React, { useState } from 'react';
import { Settings as SettingsIcon, Users as UsersIcon, ShieldAlert } from 'lucide-react';
import Layout from '../components/Layout';
import Users from './Users';
import AuditLogs from './AuditLogs';
import { useLanguage } from '../context/LanguageContext';
import { getTheme, setTheme, getTextSize, setTextSize } from '../lib/display';

// Settings: admin-only tools. The tab is kept in the URL so a refresh stays on the same tab.
const TABS = [
  { id: 'users', icon: UsersIcon, label: 'users' },
  { id: 'audit', icon: ShieldAlert, label: 'audit' },
];

const getTab = () => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((x) => x.id === t) ? t : 'users';
};

// Two-option selector used for the per-device display settings.
const Choice = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[.88em] font-medium text-muted">{label}</span>
    <div className="flex border border-line-strong rounded-xl overflow-hidden bg-row" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
          className={`flex-1 min-h-12 px-4 font-medium border-r border-line last:border-r-0 ${value === id ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink'}`}>
          {text}
        </button>
      ))}
    </div>
  </div>
);

const Settings = () => {
  const { t } = useLanguage();
  const [theme, setThemeState] = useState(getTheme);
  const [size, setSizeState] = useState(getTextSize);
  const [tab, setTabState] = useState(getTab);

  const setTab = (next) => {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <Layout>
      <div className="space-y-4 pb-12">
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 min-h-12 flex items-center gap-2 font-semibold border-b border-line">
            <SettingsIcon size={20} strokeWidth={1.75} aria-hidden="true" /> {t('set_display')}
          </h2>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            <Choice label={t('set_text_size')} value={size}
              onChange={(v) => { setTextSize(v); setSizeState(v); }}
              options={[['normal', t('set_text_normal')], ['large', t('set_text_large')]]} />
            <Choice label={t('set_theme')} value={theme}
              onChange={(v) => { setTheme(v); setThemeState(v); }}
              options={[['light', t('set_theme_light')], ['dark', t('set_theme_dark')]]} />
          </div>
          <p className="px-4 pb-4 text-[.88em] text-muted">{t('set_display_note')}</p>
        </section>

        <div className="flex border-b border-line-strong overflow-x-auto" role="tablist">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 min-h-12 -mb-px border-b-[3px] whitespace-nowrap ${tab === id ? 'border-accent text-accent font-semibold' : 'border-transparent text-muted font-medium'}`}>
              {React.createElement(Icon, { size: 18 })} {t(label)}
            </button>
          ))}
        </div>

        {tab === 'users' && <Users embedded />}
        {tab === 'audit' && <AuditLogs embedded />}
      </div>
    </Layout>
  );
};

export default Settings;
