import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Clearly labelled Edit / Delete buttons. Stacked with a wide gap so a thumb or
// finger aimed at one cannot land on the other; Delete is outlined red and
// visually different from Edit (blue, filled).
const RowActions = ({ onEdit, onDelete, accent = 'blue', horizontal = false }) => {
  const { t } = useLanguage();
  const edit = accent === 'green'
    ? 'bg-green-600 hover:bg-green-700 border-green-700'
    : 'bg-blue-600 hover:bg-blue-700 border-blue-700';

  return (
    <div className={horizontal ? 'flex flex-row gap-6 w-full' : 'flex flex-col gap-2 w-[5.5rem] sm:gap-4 sm:w-28'} onClick={(e) => e.stopPropagation()}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={`${horizontal ? 'flex-1' : ''} flex items-center justify-center gap-1.5 rounded-xl border-2 text-white ${horizontal ? 'min-h-[44px] px-3 text-base' : 'min-h-[38px] px-1.5 text-sm sm:min-h-[44px] sm:px-3 sm:text-base'} font-black shadow-sm active:scale-95 transition-all ${edit}`}
        >
          <Pencil size={16} /> {t('edit')}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className={`${horizontal ? 'flex-1' : ''} flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-white text-red-600 ${horizontal ? 'min-h-[44px] px-3 text-base' : 'min-h-[38px] px-1.5 text-sm sm:min-h-[44px] sm:px-3 sm:text-base'} font-black hover:bg-red-50 active:scale-95 transition-all`}
      >
        <Trash2 size={16} /> {t('delete')}
      </button>
    </div>
  );
};

export default RowActions;
