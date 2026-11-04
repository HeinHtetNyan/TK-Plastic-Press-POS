import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';

// Search ignores spaces and treats x, X, × and * the same, and ½ the same as (1/2),
// so typing "4*6", "4 x 6" or "4(1/2)x6" all find "4½ x 6".
const key = (v) => (v || '').toLowerCase().replace(/\s+/g, '').replace(/½/g, '(1/2)').replace(/[×*]\/?/g, 'x');

/**
 * Pick-from-list box you can also type into to search.
 * options: [{ id, name }]. value: the chosen name (string).
 * onChange(name) is called only with a name that is in the list (or was just added via onAdd).
 * onAdd(name) -> Promise<string>: shows a "+ Add" row when the typed text is not in the list.
 */
const Combo = ({ value, onChange, options, onAdd, placeholder, required, className = '', autoFocus, addLabel = 'Add' }) => {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  // keep the box in sync when the parent changes the value (e.g. opening the edit form)
  useEffect(() => { setText(value || ''); }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) {
        setOpen(false);
        setText(value || ''); // anything not picked is thrown away
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open, value]);

  const typed = text.split(/\s+/).filter(Boolean).join(' ');
  const q = key(typed);
  const shown = options.filter((o) => !q || key(o.name).includes(q));
  const exact = options.find((o) => key(o.name) === q);
  const canAdd = onAdd && typed && !exact;

  const pick = (name) => {
    onChange(name);
    setText(name);
    setOpen(false);
  };

  const add = async () => {
    setBusy(true);
    try {
      pick(await onAdd(typed));
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exact) pick(exact.name);
      else if (shown.length === 1 && !canAdd) pick(shown[0].name);
      else if (canAdd && !busy) add();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setText(value || '');
    }
  };

  return (
    <div className="relative" ref={box}>
      <input
        type="text"
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        // `required` is satisfied by the picked value, not by whatever is half-typed
        required={required && !value}
        onFocus={(e) => {
          setOpen(true);
          // on a phone, bring the box and its list to the middle of the screen so the keyboard does not hide them
          if (window.matchMedia('(max-width: 1023px)').matches) {
            const el = e.target;
            setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
          }
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(''); // typing again un-picks, so a half-typed name is never saved
        }}
        onKeyDown={onKeyDown}
        className={`w-full p-2 pr-8 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold ${className}`}
      />
      <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      {open && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto bg-white border-2 border-gray-100 rounded-xl shadow-xl">
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.name)}
                className={`w-full text-left px-3 py-2.5 font-bold text-base hover:bg-blue-50 ${o.name === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                {o.name}
              </button>
            </li>
          ))}
          {canAdd && (
            <li>
              <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={add}
                className="w-full text-left px-3 py-2.5 font-black text-base text-green-700 bg-green-50 hover:bg-green-100 flex items-center gap-2">
                <Plus size={16} /> {addLabel} &ldquo;{typed}&rdquo;
              </button>
            </li>
          )}
          {!shown.length && !canAdd && <li className="px-3 py-2.5 text-gray-400 font-bold text-base">-</li>}
        </ul>
      )}
    </div>
  );
};

export default Combo;
