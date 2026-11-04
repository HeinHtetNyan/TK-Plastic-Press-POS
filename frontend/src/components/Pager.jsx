import { useLanguage } from '../context/LanguageContext';

// Numbered paging bar: Prev 1 ... 4 [5] 6 ... 20 Next. Renders nothing when there is only one page.
const pageNumbers = (page, pages) => {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, arr) => {
    if (i > 0 && n - arr[i - 1] > 1) out.push('...');
    out.push(n);
  });
  return out;
};

const Pager = ({ page, pages, onChange, disabled = false, className = '' }) => {
  const { t } = useLanguage();
  if (!pages || pages <= 1) return null;
  const btn = 'px-3 py-2 rounded-xl font-black text-base transition-all';
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button type="button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}
        className={`${btn} bg-gray-100 text-gray-600 disabled:opacity-40`}>{t('x_prev')}</button>
      {pageNumbers(page, pages).map((n, i) => (n === '...'
        ? <span key={`gap${i}`} className="px-1 text-gray-400 font-black">...</span>
        : (
          <button key={n} type="button" disabled={disabled} onClick={() => onChange(n)}
            className={`${btn} min-w-[2.75rem] ${n === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{n}</button>
        )))}
      <button type="button" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}
        className={`${btn} bg-gray-100 text-gray-600 disabled:opacity-40`}>{t('x_next')}</button>
    </div>
  );
};

export default Pager;
