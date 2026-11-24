import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Clearly labelled Edit / Delete buttons (v2 look: outlined, 12px corners). Edit uses the accent
// (green for payments), Delete is red; icon + word on top of the colour so they never look alike.
// Stacked with a wide gap in the sheet so a finger aimed at one cannot land on the other.
const RowActions = ({ onEdit, onDelete, accent = 'blue', horizontal = false, compact = false }) => {
  const { t } = useLanguage();
  const edit = accent === 'green'
    ? 'border-ok text-ok hover:bg-ok-bg'
    : 'border-accent text-accent hover:bg-band';

  if (compact) {
    return (
      <div className="flex flex-col xl:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={t('edit')} title={t('edit')} className={`w-11 h-11 flex items-center justify-center rounded-xl border bg-row active:scale-95 transition-all ${edit}`}>
            <Pencil size={18} />
          </button>
        )}
        <button type="button" onClick={onDelete} aria-label={t('delete')} title={t('delete')} className="w-11 h-11 flex items-center justify-center rounded-xl border border-debt bg-row text-debt hover:bg-debt-bg active:scale-95 transition-all">
          <Trash2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={horizontal ? 'flex flex-row gap-3 w-full' : 'flex flex-col gap-2 w-[5.5rem] sm:gap-4 sm:w-28'} onClick={(e) => e.stopPropagation()}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={`${horizontal ? 'flex-1' : ''} flex items-center justify-center gap-1.5 rounded-xl border bg-row ${horizontal ? 'min-h-[48px] px-3 text-base' : 'min-h-[38px] px-1.5 text-sm sm:min-h-[44px] sm:px-3 sm:text-base'} font-semibold active:scale-95 transition-all ${edit}`}
        >
          <Pencil size={18} /> {t('edit')}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className={`${horizontal ? 'flex-1' : ''} flex items-center justify-center gap-2 rounded-xl border border-debt bg-row text-debt ${horizontal ? 'min-h-[48px] px-3 text-base' : 'min-h-[38px] px-1.5 text-sm sm:min-h-[44px] sm:px-3 sm:text-base'} font-semibold hover:bg-debt-bg active:scale-95 transition-all`}
      >
        <Trash2 size={18} /> {t('delete')}
      </button>
    </div>
  );
};

export default RowActions;
