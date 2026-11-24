import { isDemo, exitDemo } from '../lib/demoMode';
import { useLanguage } from '../context/LanguageContext';

// Shown only in demo mode: tells the reviewer this is sample data and lets them leave.
const DemoPill = () => {
  const { t } = useLanguage();
  if (!isDemo()) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-extra text-on-accent px-4 py-2 shadow-lg text-sm font-black whitespace-nowrap">
      <span>{t('x4_demo_pill')}</span>
      <button type="button" onClick={exitDemo} className="underline">{t('x4_demo_exit')}</button>
    </div>
  );
};

export default DemoPill;
