import React, { useState } from 'react';
import { Settings as SettingsIcon, Users as UsersIcon, ShieldAlert } from 'lucide-react';
import Layout from '../components/Layout';
import Users from './Users';
import AuditLogs from './AuditLogs';
import { useLanguage } from '../context/LanguageContext';

// Settings: admin-only tools. The tab is kept in the URL so a refresh stays on the same tab.
const TABS = [
  { id: 'users', icon: UsersIcon, label: 'users' },
  { id: 'audit', icon: ShieldAlert, label: 'audit' },
];

const getTab = () => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((x) => x.id === t) ? t : 'users';
};

const Settings = () => {
  const { t } = useLanguage();
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
        <header className="flex items-center gap-3">
          <SettingsIcon size={28} className="text-blue-600" />
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">{t('settings')}</h2>
        </header>

        <div className="flex gap-2 flex-wrap">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-base uppercase tracking-wide transition-all ${tab === id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border-2 border-gray-100'}`}>
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
