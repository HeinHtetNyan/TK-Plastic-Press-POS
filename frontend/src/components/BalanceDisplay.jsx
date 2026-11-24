import React from 'react';
import { useLanguage } from '../context/LanguageContext';

// Balance of one customer. `embedded` = a cell inside a bigger panel (no own card, fills its cell, tinted by status).
const BalanceDisplay = ({ balance, label, embedded = false }) => {
  const { t } = useLanguage();
  const isDebt = balance > 0;
  const isCredit = balance < 0;
  const tone = isDebt ? 'text-debt' : isCredit ? 'text-ok' : 'text-ink';
  const tint = isDebt ? 'bg-debt-bg' : isCredit ? 'bg-ok-bg' : 'bg-row';

  if (embedded) {
    return (
      <div className={`h-full p-5 flex flex-col justify-center gap-1 ${tint}`}>
        <p className="text-sm text-muted">{label || t('x2_current_balance')}</p>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-4xl font-semibold tabular-nums leading-tight break-all ${tone}`}>
            {Math.abs(balance).toLocaleString()}
          </span>
          <span className="text-base font-medium text-muted">MMK</span>
        </div>
        {isCredit && <p className="text-ok font-semibold">{t('x2_credit_balance')}</p>}
        {!isDebt && !isCredit && <p className="text-muted">{t('x2_no_balance')}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl shadow-sm px-4 py-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${tint}`}>
      <p className="text-base font-semibold text-ink">{label || t('x2_current_balance')}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl md:text-4xl font-bold tabular-nums ${tone}`}>
          {Math.abs(balance).toLocaleString()}
        </span>
        <span className="text-lg font-medium text-muted">MMK</span>
      </div>
      {isCredit && <p className="text-ok font-semibold w-full">{t('x2_credit_balance')}</p>}
      {!isDebt && !isCredit && <p className="text-muted w-full">{t('x2_no_balance')}</p>}
    </div>
  );
};

export default BalanceDisplay;
