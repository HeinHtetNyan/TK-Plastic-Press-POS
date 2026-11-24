import { useState } from 'react';
import Combo from './Combo';
import { parseSize, joinSize, frontOptions } from '../utils/size';

const SizeInput = ({ value, onChange, sizes, addOption, required, autoFocus, placeholder, addLabel, secondPlaceholder, className = '' }) => {
  const parsed = parseSize(value);
  // a second number typed while the front is still empty is kept here; once there is a size, the size itself is the truth
  const [draft, setDraft] = useState('');
  const back = value ? parsed.back : draft;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 min-w-0">
        <Combo
          autoFocus={autoFocus}
          required={required}
          placeholder={placeholder}
          addLabel={addLabel}
          options={frontOptions(sizes, parsed.front)}
          value={parsed.front}
          onChange={(f) => { if (!f) setDraft(back); onChange(joinSize(f, back)); }}
          onAdd={(n) => addOption('SIZE', n)}
          className={className}
        />
      </div>
      <span className="font-semibold text-muted text-lg">x</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        placeholder={secondPlaceholder}
        value={back}
        onChange={(e) => {
          const b = e.target.value.replace(/[x×*]/gi, '');
          setDraft(b);
          onChange(joinSize(parsed.front, b.trim()));
        }}
        className={`w-20 sm:w-24 px-2 h-[var(--ctl)] bg-row border border-line-strong rounded-lg focus:border-accent focus:ring-1 focus:ring-accent outline-none font-medium ${className}`}
      />
    </div>
  );
};

export default SizeInput;
