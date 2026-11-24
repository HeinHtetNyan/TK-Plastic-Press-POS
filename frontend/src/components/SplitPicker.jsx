import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { METHOD_IDS, methodShort, partsSum } from '../utils/paymentSplits';

const COLORS = {
  CASH: { on: 'bg-ok text-on-accent', box: 'border-ok/30 bg-ok-bg' },
  KBZPAY: { on: 'bg-accent text-on-accent', box: 'border-line bg-band' },
  BANK_TRANSFER: { on: 'bg-m-bank text-on-accent', box: 'border-m-bank/40 bg-band' },
};

// "One method | Split" switch. One method: shows whatever `single` renders (the page's own
// method buttons). Split: an amount box per method with a "Rest" shortcut and a live
// "left to assign" line. `total` is the amount being paid.
const SplitPicker = ({ total, split, onSplitChange, parts, onParts, method, single }) => {
  const { t } = useLanguage();
  const totalNum = parseFloat(total) || 0;
  const left = Math.round((totalNum - partsSum(parts)) * 100) / 100;
  const balanced = Math.abs(left) <= 0.01;

  const turnSplit = (on) => {
    onSplitChange(on);
    // Starting a split: put the whole amount on the method already chosen, to be divided from there.
    if (on && METHOD_IDS.every((m) => !parts[m]) && totalNum > 0 && method) {
      onParts({ ...parts, [method]: String(totalNum) });
    }
  };

  const setPart = (m, v) => onParts({ ...parts, [m]: v });
  const rest = (m) => {
    const others = METHOD_IDS.filter((x) => x !== m).reduce((a, x) => a + (parseFloat(parts[x]) || 0), 0);
    setPart(m, String(Math.max(0, Math.round((totalNum - others) * 100) / 100)));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 border border-line-strong rounded-xl overflow-hidden">
        {[[false, t('one_method')], [true, t('split_payment')]].map(([on, label]) => (
          <button
            key={String(on)}
            type="button"
            onClick={() => turnSplit(on)}
            className={`min-h-[var(--ctl)] text-base font-medium leading-normal transition-all ${split === on ? 'bg-accent text-on-accent' : 'bg-row text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!split ? single : (
        <div className="space-y-2">
          {METHOD_IDS.map((m) => (
            <div key={m} className={`flex items-center gap-2 p-2 rounded-xl border ${parts[m] ? COLORS[m].box : 'border-line bg-row'}`}>
              <span className={`shrink-0 w-[4.5rem] text-center py-2 rounded-lg text-sm font-semibold uppercase ${parts[m] ? COLORS[m].on : 'bg-band text-muted'}`}>{methodShort(m)}</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={parts[m]}
                onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                onChange={(e) => setPart(m, e.target.value)}
                className="min-w-0 flex-1 p-2.5 bg-row border border-line rounded-lg outline-none focus:border-accent text-lg font-semibold text-ink text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => rest(m)} className="shrink-0 min-h-[44px] px-3 rounded-lg border border-line bg-row text-muted text-sm font-semibold leading-normal">
                {t('split_rest')}
              </button>
            </div>
          ))}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-base font-semibold leading-normal ${balanced ? 'bg-ok-bg text-ok' : 'bg-debt-bg text-debt'}`}>
            <span>{balanced ? t('split_done') : t('split_left')}</span>
            {!balanced && <span className="tabular-nums">{left.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitPicker;
