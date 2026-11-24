import { Plus, Trash2 } from 'lucide-react';
import Combo from './Combo';
import { parseSize, frontOptions } from '../utils/size';
import { useLanguage } from '../context/LanguageContext';

// Cardboard core / damaged plastic on a voucher. Each entry says how many lb and which Size / Color / Thickness stock
// they come out of. A private note: never on the customer voucher, never in the price.
import { emptyWaste } from '../utils/waste';

const WasteBox = ({ wastes, onChange, options, addOption, firstItem, compact }) => {
  const { t } = useLanguage();
  const set = (i, patch) => onChange(wastes.map((w, k) => (k === i ? { ...w, ...patch } : w)));
  const lab = 'block truncate text-sm font-medium text-muted';
  const box = compact ? '!p-3 !bg-row !border-line text-lg' : '';
  const kinds = [
    { kind: 'CORE', label: t('core_weight'), tone: 'amber' },
    { kind: 'DAMAGE', label: t('damage_weight'), tone: 'red' },
  ];
  return (
    <section className={compact ? 'space-y-3' : 'bg-row px-5 py-4 rounded-2xl shadow-sm space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-ink">{t('core_damage_title')} <span className="text-muted font-medium normal-case">({t('optional_note')})</span></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button key={k.kind} type="button" onClick={() => onChange([...wastes, emptyWaste(k.kind, firstItem)])}
            className={`flex items-center gap-1.5 px-4 min-h-[var(--ctl)] rounded-xl border font-semibold text-base ${k.tone === 'amber' ? 'border-extra/40 text-extra bg-extra-bg' : 'border-debt/40 text-debt bg-debt-bg'}`}>
            <Plus size={16} /> {k.label}
          </button>
        ))}
      </div>
      {wastes.map((w, i) => (
        <div key={i} className={`rounded-xl p-3 space-y-2 ${w.kind === 'CORE' ? 'bg-extra-bg' : 'bg-debt-bg'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-base font-semibold ${w.kind === 'CORE' ? 'text-extra' : 'text-debt'}`}>{w.kind === 'CORE' ? t('core_weight') : t('damage_weight')}</span>
            <button type="button" onClick={() => onChange(wastes.filter((_, k) => k !== i))} aria-label="Remove" className="w-10 h-10 flex items-center justify-center rounded-xl text-debt hover:bg-row/60"><Trash2 size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className={lab}>{t('weight_lb')}</label>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={w.lb}
                onKeyDown={(e) => e.key === '-' && e.preventDefault()} onChange={(e) => set(i, { lb: e.target.value })}
                className="w-full px-3 h-[var(--ctl)] bg-row border border-line-strong rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-right font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className={lab}>{t('size')}</label>
              <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={frontOptions(options.sizes, parseSize(w.size).front)} value={parseSize(w.size).front}
                onChange={(v) => set(i, { size: v })} onAdd={(n) => addOption('SIZE', n)} className={box} />
            </div>
            <div className="space-y-1">
              <label className={lab}>{t('plastic_color')}</label>
              <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.colors} value={w.color}
                onChange={(v) => set(i, { color: v })} onAdd={(n) => addOption('COLOR', n)} className={box} />
            </div>
            <div className="space-y-1">
              <label className={lab}>{t('gate')}</label>
              <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.gates} value={w.gate}
                onChange={(v) => set(i, { gate: v })} onAdd={(n) => addOption('GATE', n)} className={box} />
            </div>
          </div>
        </div>
      ))}
      <p className="text-sm text-muted font-medium px-1">{t('core_damage_hint')}</p>
    </section>
  );
};

export default WasteBox;
