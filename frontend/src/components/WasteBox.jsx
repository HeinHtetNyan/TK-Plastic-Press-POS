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
  const lab = 'block truncate text-base font-black text-gray-600 uppercase px-1 tracking-widest';
  const box = compact ? '!p-3 !bg-white !border-gray-200 text-lg' : '';
  const kinds = [
    { kind: 'CORE', label: t('core_weight'), tone: 'amber' },
    { kind: 'DAMAGE', label: t('damage_weight'), tone: 'red' },
  ];
  return (
    <div className="bg-white p-4 rounded-3xl border-2 border-dashed border-gray-200 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-black text-gray-500 uppercase tracking-widest">{t('core_damage_title')} <span className="text-gray-300 font-bold normal-case">({t('optional_note')})</span></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button key={k.kind} type="button" onClick={() => onChange([...wastes, emptyWaste(k.kind, firstItem)])}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 font-black text-base ${k.tone === 'amber' ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
            <Plus size={16} /> {k.label}
          </button>
        ))}
      </div>
      {wastes.map((w, i) => (
        <div key={i} className={`rounded-2xl border-2 p-3 space-y-2 ${w.kind === 'CORE' ? 'border-amber-100 bg-amber-50/40' : 'border-red-100 bg-red-50/40'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-base font-black uppercase ${w.kind === 'CORE' ? 'text-amber-700' : 'text-red-700'}`}>{w.kind === 'CORE' ? t('core_weight') : t('damage_weight')}</span>
            <button type="button" onClick={() => onChange(wastes.filter((_, k) => k !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className={lab}>{t('weight_lb')}</label>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={w.lb}
                onKeyDown={(e) => e.key === '-' && e.preventDefault()} onChange={(e) => set(i, { lb: e.target.value })}
                className="w-full p-2 bg-white border-2 border-gray-100 rounded-xl focus:border-amber-400 outline-none font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
      <p className="text-sm text-gray-400 font-bold px-1">{t('core_damage_hint')}</p>
    </div>
  );
};

export default WasteBox;
