import { useState, useEffect, useCallback } from 'react';
import { Boxes, Plus, Trash2, Pencil, Save, X, History as HistoryIcon } from 'lucide-react';
import Layout from '../components/Layout';
import Combo from '../components/Combo';
import Pager from '../components/Pager';
import { paginate } from '../utils/paginate';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { stockService, optionService } from '../services/api';
import { usePlasticOptions } from '../hooks/usePlasticOptions';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';

const inputCls = 'w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const labelCls = 'block truncate text-base font-black text-gray-600 uppercase px-1 tracking-widest';
const today = () => new Date().toLocaleDateString('en-GB').split('/').join('-');
const num = (v) => parseFloat(v) || 0;
const money = (v) => Math.round(v).toLocaleString();
const lbFmt = (v) => (Math.round(v * 100) / 100).toLocaleString();

const emptyLine = () => ({ size: '', gate: '', color: '', weight_lb: '', price_per_lb: '' });

// URL keeps the tab so a refresh stays on the same view.
const getTab = () => new URLSearchParams(window.location.search).get('tab') || 'stock';

const Stock = () => {
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const { t } = useLanguage();
  const { options, addOption, refresh: refreshOptions } = usePlasticOptions();
  const [tab, setTabState] = useState(getTab);
  const setTab = (next) => {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <Layout>
      <div className="space-y-4 pb-12">
        <header className="flex items-center gap-3">
          <Boxes size={28} className="text-blue-600" />
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">{t('stock')}</h2>
        </header>

        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
          {[['stock', t('stock_tab_stock')], ...(admin ? [['buy', t('stock_tab_buy')]] : []), ['lists', t('stock_tab_lists')]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-2 lg:px-4 py-3 rounded-2xl font-black text-sm lg:text-base leading-tight uppercase tracking-wide transition-all ${tab === id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 border-2 border-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'stock' && <StockTab admin={admin} options={options} addOption={addOption} t={t} />}
        {tab === 'buy' && admin && <BuyTab options={options} addOption={addOption} t={t} />}
        {tab === 'lists' && <ListsTab options={options} admin={admin} addOption={addOption} refresh={refreshOptions} t={t} />}
      </div>
    </Layout>
  );
};

/* ------------------------------------------------------------------ Stock */
const StockTab = ({ admin, options, addOption, t }) => {
  const [data, setData] = useState({ items: [], total_lb: 0 });
  const [error, setError] = useState('');
  const [showOpening, setShowOpening] = useState(false);
  const [opening, setOpening] = useState(emptyLine());
  const [editing, setEditing] = useState(null); // { id, qty }
  const [moves, setMoves] = useState(null); // { item, rows, page, pages }
  const [movesLoading, setMovesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const { data: d } = await stockService.list();
      setData(d);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load stock');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveOpening = async (e) => {
    e.preventDefault();
    try {
      await stockService.opening({ size: opening.size, color: opening.color, gate: opening.gate, weight_lb: num(opening.weight_lb), cost_per_lb: num(opening.price_per_lb) });
      setOpening(emptyLine());
      setShowOpening(false);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save');
    }
  };

  const saveAdjust = async () => {
    try {
      await stockService.adjust(editing.id, { new_qty_lb: num(editing.qty), note: 'counted by hand' });
      setEditing(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save');
    }
  };

  const openMoves = async (item, page = 1) => {
    setMovesLoading(true);
    try {
      const { data } = await stockService.movements(item.id, page);
      setMoves({ item, rows: data.items, page: data.page, pages: data.pages });
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not load');
    } finally {
      setMovesLoading(false);
    }
  };

  // search ignores spaces / x / * / half sign, like the pick boxes
  const sk = (v) => (v || '').toLowerCase().replace(/\s+/g, '').replace(/\u00bd/g, '(1/2)').replace(/[\u00d7*]\/?/g, 'x');
  const q = sk(search);
  const matches = data.items.filter((s) => !q || sk(`${s.size}${s.color}${s.gate}`).includes(q) || sk(`${s.size}x${s.gate}${s.color}`).includes(q));
  const shownStock = paginate(matches, stockPage, 25);

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 text-red-700 font-bold p-3 rounded-xl">{error}</div>}
      <div className={`grid gap-3 ${admin ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <span className="text-base font-black text-gray-600 uppercase block tracking-widest mb-1">{t('x_total_in_stock')}</span>
          <span className="text-2xl font-black text-blue-600">{lbFmt(data.total_lb)}</span> <span className="text-gray-400 font-bold">lb</span>
        </div>
        {admin && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-base font-black text-gray-600 uppercase block tracking-widest mb-1">{t('x_stock_value')}</span>
            <span className="text-2xl font-black text-green-600">{money(data.total_value || 0)}</span> <span className="text-gray-400 font-bold">MMK</span>
          </div>
        )}
      </div>

      {admin && (
        <button onClick={() => setShowOpening((v) => !v)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-2xl font-black">
          <Plus size={18} /> {t('x_add_opening')}
        </button>
      )}

      {showOpening && (
        <form onSubmit={saveOpening} className="bg-white p-4 rounded-3xl border-2 border-blue-100 space-y-3">
          <p className="text-base font-bold text-gray-500">{t('x_opening_help')}</p>
          <LineFields line={opening} onChange={setOpening} options={options} addOption={addOption} t={t} priceLabel={t('x_cost_per_lb')} />
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-2xl font-black"><Save size={18} /> {t('x_save')}</button>
            <button type="button" onClick={() => setShowOpening(false)} className="px-4 py-3 rounded-2xl font-black bg-gray-100 text-gray-600">{t('x_cancel')}</button>
          </div>
        </form>
      )}

      {data.items.length > 8 && (
        <input type="search" placeholder={t('x_search_stock')} value={search}
          onChange={(e) => { setSearch(e.target.value); setStockPage(1); }}
          className={inputCls} />
      )}

      <div className="space-y-2">
        {data.items.length === 0 && <div className="text-center text-gray-400 font-bold py-10">{t('x_no_stock')}</div>}
        {data.items.length > 0 && matches.length === 0 && <div className="text-center text-gray-400 font-bold py-10">{t('x_nothing_matches')}</div>}
        {shownStock.rows.map((s) => (
          <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem]">
              <div className="text-lg font-black text-gray-800 break-words">{s.size} <span className="text-gray-400">/</span> {s.color}{s.gate ? <span className="text-gray-400"> / {s.gate}</span> : null}</div>
              {admin && <div className="text-base text-gray-500 font-bold">{t('x_avg_cost')} {money(s.avg_cost_per_lb)} / lb &middot; {t('x_value')} {money(s.value)}</div>}
            </div>
            {editing?.id === s.id ? (
              <div className="flex items-center gap-2">
                <input type="number" step="any" className={`${inputCls} w-28`} value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} />
                <button onClick={saveAdjust} className="p-3 bg-green-600 text-white rounded-xl"><Save size={18} /></button>
                <button onClick={() => setEditing(null)} className="p-3 bg-gray-100 text-gray-600 rounded-xl"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black ${s.qty_lb < 0 ? 'text-red-600' : 'text-blue-700'}`}>{lbFmt(s.qty_lb)} <span className="text-base text-gray-400">lb</span></span>
                {admin && (
                  <>
                    <button title={t('x2_set_counted')} onClick={() => setEditing({ id: s.id, qty: s.qty_lb })} className="p-3 bg-gray-100 text-gray-600 rounded-xl"><Pencil size={18} /></button>
                    <button title={t('x2_history')} onClick={() => openMoves(s)} className="p-3 bg-gray-100 text-gray-600 rounded-xl"><HistoryIcon size={18} /></button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager page={shownStock.page} pages={shownStock.pages} onChange={setStockPage} />

      {moves && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setMoves(null)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black">{moves.item.size} / {moves.item.color} {moves.item.gate && `/ ${moves.item.gate}`}</h3>
              <button onClick={() => setMoves(null)} className="p-2 bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-1">
              {moves.rows.map((m) => (
                <div key={m.id} className="flex justify-between gap-2 text-base border-b border-gray-100 py-2">
                  <span className="font-bold text-gray-600 break-words">{m.kind} <span className="text-gray-400">{m.ref}</span><span className="block text-sm text-gray-400">{new Date(m.created_at).toLocaleString()}</span></span>
                  <span className={`font-black whitespace-nowrap ${m.delta_lb < 0 ? 'text-red-600' : 'text-green-600'}`}>{m.delta_lb > 0 ? '+' : ''}{lbFmt(m.delta_lb)} lb</span>
                </div>
              ))}
              {moves.rows.length === 0 && <div className="text-gray-400 font-bold py-4 text-center">{t('x_nothing_yet')}</div>}
            </div>
            <Pager page={moves.page} pages={moves.pages} onChange={(p) => openMoves(moves.item, p)} disabled={movesLoading} className="pt-3" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- one line */
const LineFields = ({ line, onChange, options, addOption, t, priceLabel = t('x_price_per_lb') }) => {
  const set = (k, v) => onChange({ ...line, [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="space-y-1"><label className={labelCls}>{t('size')}</label>
        <Combo required placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.sizes} value={line.size} onChange={(v) => set('size', v)} onAdd={(n) => addOption('SIZE', n)} /></div>
      <div className="space-y-1"><label className={labelCls}>{t('gate')}</label>
        <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.gates} value={line.gate} onChange={(v) => set('gate', v)} onAdd={(n) => addOption('GATE', n)} /></div>
      <div className="space-y-1"><label className={labelCls}>{t('plastic_color')}</label>
        <Combo required placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.colors} value={line.color} onChange={(v) => set('color', v)} onAdd={(n) => addOption('COLOR', n)} /></div>
      <div className="space-y-1"><label className={labelCls}>{t('weight_lb')}</label>
        <input required type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={line.weight_lb} onChange={(e) => set('weight_lb', e.target.value)} /></div>
      <div className="space-y-1"><label className={labelCls}>{priceLabel}</label>
        <input required type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={line.price_per_lb} onChange={(e) => set('price_per_lb', e.target.value)} /></div>
    </div>
  );
};

/* ------------------------------------------------------------ Buy (factory) */
const BuyTab = ({ options, addOption, t }) => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (p = page) => {
    try {
      const { data } = await stockService.listPurchases(p);
      setList(data.items);
      setPages(data.pages);
      if (data.page !== p) setPage(data.page);
    } catch { /* shown empty */ }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const blank = () => ({ id: null, supplier: '', purchase_number: '', purchase_date: today(), note: '', lines: [emptyLine()], extras: [] });
  const edit = (p) => setForm({
    id: p.id, supplier: p.supplier || '', purchase_number: p.purchase_number || '', purchase_date: p.purchase_date, note: p.note || '',
    lines: p.lines.map((l) => ({ size: l.size, gate: l.gate, color: l.color, weight_lb: String(l.weight_lb), price_per_lb: String(l.price_per_lb) })),
    extras: (p.extras || []).map((x) => ({ label: x.label, amount: String(x.amount) })),
  });

  const total = form ? form.lines.reduce((sum, l) => sum + num(l.weight_lb) * num(l.price_per_lb), 0) : 0;
  const totalLb = form ? form.lines.reduce((sum, l) => sum + num(l.weight_lb), 0) : 0;
  const extrasTotal = form ? form.extras.reduce((sum, x) => sum + num(x.amount), 0) : 0;
  const setLine = (i, line) => setForm({ ...form, lines: form.lines.map((l, idx) => (idx === i ? line : l)) });
  const setExtra = (i, patch) => setForm({ ...form, extras: form.extras.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      supplier: form.supplier || null, purchase_number: form.purchase_number || null, purchase_date: form.purchase_date, note: form.note || null,
      lines: form.lines.map((l) => ({ size: l.size, color: l.color, gate: l.gate || '', weight_lb: num(l.weight_lb), price_per_lb: num(l.price_per_lb) })),
      extras: form.extras.filter((x) => num(x.amount) > 0).map((x) => ({ label: x.label || '', amount: num(x.amount) })),
    };
    try {
      if (form.id) await stockService.updatePurchase(form.id, body); else await stockService.createPurchase(body);
      setForm(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete purchase ${p.purchase_number || p.id}? Its lb will be taken out of stock again.`)) return;
    try { await stockService.deletePurchase(p.id); load(); } catch (err) { alert(err.response?.data?.detail || 'Could not delete'); }
  };

  return (
    <div className="space-y-3">
      {!form && (
        <button onClick={() => setForm(blank())} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-2xl font-black"><Plus size={18} /> {t('x_new_factory')}</button>
      )}

      {form && (
        <form onSubmit={save} className="bg-white p-4 rounded-3xl border-2 border-blue-100 space-y-4">
          <h3 className="text-xl font-black text-gray-800">{form.id ? t('x_edit_factory') : t('x_new_factory')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><label className={labelCls}>{t('x_supplier')}</label>
              <input className={inputCls} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div className="space-y-1"><label className={labelCls}>{t('x_their_no')}</label>
              <input className={inputCls} value={form.purchase_number} onChange={(e) => setForm({ ...form, purchase_number: e.target.value })} /></div>
            <DropdownDatePicker label={t('x_date')} value={form.purchase_date} onChange={(v) => setForm({ ...form, purchase_date: v })} />
          </div>

          {form.lines.map((l, i) => (
            <div key={i} className="bg-gray-50 p-3 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-base font-black text-gray-600 uppercase">{t('x_roll')} {i + 1}</span>
                {form.lines.length > 1 && <button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })} className="text-red-400"><Trash2 size={18} /></button>}
              </div>
              <LineFields line={l} onChange={(nl) => setLine(i, nl)} options={options} addOption={addOption} t={t} />
              <div className="text-right text-base font-bold text-gray-500">{t('x_cost')}: <span className="font-black text-blue-700">{money(num(l.weight_lb) * num(l.price_per_lb))}</span> MMK</div>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-2xl font-black"><Plus size={18} /> {t('x_add_roll')}</button>

          <div className="bg-amber-50 border-2 border-amber-100 p-3 rounded-2xl space-y-2">
            <div className="text-base font-black text-gray-700">{t('x4_extras_title')}</div>
            <div className="text-sm font-bold text-gray-500">{t('x4_extras_hint')}</div>
            {form.id && <div className="text-sm font-bold text-amber-700">{t('x4_edit_note')}</div>}
            {form.extras.map((x, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1"><label className={labelCls}>{t('x4_extra_name')}</label>
                  <input className={inputCls} placeholder={t('x4_extra_ph')} value={x.label} onChange={(e) => setExtra(i, { label: e.target.value })} /></div>
                <div className="space-y-1"><label className={labelCls}>{t('x4_extra_amount')}</label>
                  <input type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={x.amount} onChange={(e) => setExtra(i, { amount: e.target.value })} /></div>
                <button type="button" onClick={() => setForm({ ...form, extras: form.extras.filter((_, idx) => idx !== i) })} className="p-3 text-red-400"><Trash2 size={18} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, extras: [...form.extras, { label: '', amount: '' }] })} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-3 rounded-2xl font-black border-2 border-amber-100"><Plus size={18} /> {t('x4_add_extra')}</button>
          </div>

          <div className="space-y-1"><label className={labelCls}>{t('note')}</label>
            <input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>

          <div className="bg-gray-800 text-white p-4 rounded-2xl space-y-1">
            {extrasTotal > 0 && (
              <div className="text-sm font-bold text-gray-300 flex justify-between"><span>{t('x4_goods')} {money(total)}</span><span>{t('x4_extras_word')} {money(extrasTotal)}</span></div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-bold">{lbFmt(totalLb)} lb</span>
              <span className="text-2xl font-black text-blue-300">{money(total + extrasTotal)} MMK</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} type="submit" className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl font-black"><Save size={18} /> {saving ? '...' : t('x_save')}</button>
            <button type="button" onClick={() => setForm(null)} className="px-5 py-3 rounded-2xl font-black bg-gray-100 text-gray-600">{t('x_cancel')}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {list.length === 0 && !form && <div className="text-center text-gray-400 font-bold py-10">{t('x_no_factory')}</div>}
        {list.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <div>
                <div className="font-black text-gray-800">{p.supplier || t('x_factory')} {p.purchase_number && <span className="text-gray-400">#{p.purchase_number}</span>}</div>
                <div className="text-sm text-gray-400 font-bold">{p.purchase_date}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-blue-700">{money(p.grand_total ?? p.total_cost)} MMK</span>
                <button onClick={() => edit(p)} className="p-3 bg-gray-100 text-gray-600 rounded-xl"><Pencil size={18} /></button>
                <button onClick={() => remove(p)} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={18} /></button>
              </div>
            </div>
            <div className="text-base text-gray-600 font-bold space-y-0.5">
              {p.lines.map((l) => (
                <div key={l.id} className="flex justify-between gap-2"><span className="break-words">{l.size} / {l.color}{l.gate ? ` / ${l.gate}` : ''} &middot; {lbFmt(l.weight_lb)} lb &times; {money(l.price_per_lb)}</span><span className="whitespace-nowrap">{money(l.line_cost)}</span></div>
              ))}
              {(p.extras || []).map((x) => (
                <div key={x.id} className="flex justify-between gap-2 text-amber-700"><span className="break-words">+ {x.label}</span><span className="whitespace-nowrap">{money(x.amount)}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} pages={pages} onChange={setPage} />
    </div>
  );
};

/* ------------------------------------------------------------------- Lists */
// small tab per list; only the chosen list is shown, kept in the URL (?list=size|gate|color)
const LIST_IDS = ['size', 'gate', 'color', 'print'];
const getList = () => {
  const v = new URLSearchParams(window.location.search).get('list');
  return LIST_IDS.includes(v) ? v : 'size';
};

const ListsTab = ({ options, admin, addOption, refresh, t }) => {
  const groups = {
    size: { kind: 'SIZE', title: t('size'), rows: options.sizes },
    gate: { kind: 'GATE', title: t('gate'), rows: options.gates },
    color: { kind: 'COLOR', title: t('plastic_color'), rows: options.colors },
    print: { kind: 'PRINT', title: t('print_color'), rows: options.prints || [] },
  };
  const [which, setWhich] = useState(getList);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState(null); // { id, name }

  const pick = (id) => {
    setWhich(id);
    setDraft('');
    setSearch('');
    setPage(1);
    setRenaming(null);
    const url = new URL(window.location.href);
    url.searchParams.set('list', id);
    window.history.replaceState(window.history.state, '', url);
  };

  const g = groups[which];
  // search ignores spaces / x / * / half sign, like the pick boxes
  const sk = (v) => (v || '').toLowerCase().replace(/\s+/g, '').replace(/\u00bd/g, '(1/2)').replace(/[\u00d7*]\/?/g, 'x');
  const matches = g.rows.filter((o) => !search || sk(o.name).includes(sk(search)));
  const shown = paginate(matches, page, 20);

  const add = async () => {
    if (!draft.trim()) return;
    try { await addOption(g.kind, draft); setDraft(''); } catch (err) { alert(err.response?.data?.detail || 'Could not add'); }
  };
  const rename = async () => {
    try { await optionService.rename(renaming.id, renaming.name); setRenaming(null); refresh(); } catch (err) { alert(err.response?.data?.detail || 'Could not rename'); }
  };
  const remove = async (o) => {
    if (!window.confirm(`Remove "${o.name}" from the list? Old vouchers and stock keep their text.`)) return;
    try { await optionService.remove(o.id); refresh(); } catch (err) { alert(err.response?.data?.detail || 'Could not remove'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {LIST_IDS.map((id) => (
          <button key={id} onClick={() => pick(id)}
            className={`px-4 py-2 rounded-xl font-black text-base transition-all ${which === id ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-600 border-2 border-gray-200'}`}>
            {groups[id].title} <span className={which === id ? 'text-gray-300' : 'text-gray-400'}>({groups[id].rows.length})</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <h3 className="text-xl font-black text-gray-800">{g.title} <span className="text-gray-400">({g.rows.length})</span></h3>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
          <input className={inputCls} placeholder={`${t('add_new')}...`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="px-4 bg-blue-600 text-white rounded-xl font-black"><Plus size={18} /></button>
        </form>
        {g.rows.length > 8 && (
          <input type="search" className={inputCls} placeholder={t('x_search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {shown.rows.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded-xl">
              {renaming?.id === o.id ? (
                <>
                  <input className={inputCls} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                  <button onClick={rename} className="p-2 bg-green-600 text-white rounded-lg"><Save size={16} /></button>
                  <button onClick={() => setRenaming(null)} className="p-2 bg-gray-200 rounded-lg"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="font-bold text-gray-700 break-words min-w-0">{o.name}</span>
                  {admin && (
                    <span className="flex gap-1 shrink-0">
                      <button onClick={() => setRenaming({ id: o.id, name: o.name })} className="p-2 bg-gray-200 text-gray-600 rounded-lg"><Pencil size={16} /></button>
                      <button onClick={() => remove(o)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {g.rows.length === 0 && <div className="text-gray-400 font-bold text-center py-4">{t('x_empty')}</div>}
        {g.rows.length > 0 && matches.length === 0 && <div className="text-gray-400 font-bold text-center py-4">{t('x_nothing_matches')}</div>}
        <Pager page={shown.page} pages={shown.pages} onChange={setPage} />
      </div>
    </div>
  );
};

export default Stock;
