import React from 'react';
import RowActions from './RowActions';
import MethodTags from './MethodTags';
import { useLanguage } from '../context/LanguageContext';

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const th = 'px-2 py-2 text-left text-xs font-black uppercase tracking-wider text-gray-500 bg-gray-100 border border-gray-300 whitespace-nowrap sticky top-0 z-10';
const td = 'px-1.5 py-1 sm:px-2 sm:py-1.5 border border-gray-200 text-sm sm:text-base font-bold text-gray-700 align-top';
const num = 'text-right tabular-nums whitespace-nowrap';


// Spreadsheet-style view of a customer's vouchers and direct payments.
// One bordered block per voucher: every product is its own line, voucher-level
// figures (totals, balances, actions) are merged cells spanning those lines.
const HistorySheet = ({
  rows, isAdmin, canEdit, paidLater = new Set(),
  onEditVoucher, onDeleteVoucher, onEditPayment, onDeletePayment,
}) => {
  const { t } = useLanguage();

  const billed = rows.reduce((s, r) => s + (r.type === 'voucher' ? r.items_total || 0 : 0), 0);
  const paid = rows.reduce((s, r) => s + (r.type === 'voucher' ? r.paid_amount || 0 : r.amount_paid || 0), 0);

  return (
    <>
    <p className="sm:hidden text-sm font-black text-gray-400 text-center mb-1">&larr; swipe sideways &rarr;</p>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto overscroll-x-contain sm:overflow-auto sm:max-h-[75vh]">
      <table className="w-full border-collapse min-w-[820px] sm:min-w-[920px]">
        <thead>
          <tr>
            <th className={`${th} left-0 z-20`}>{t('voucher') || 'Voucher'}</th>
            <th className={th}>{t('date') || 'Date'}</th>
            <th className={th}>{t('products') || 'Item'}</th>
            <th className={`${th} text-right`}>LB</th>
            <th className={`${th} text-right`}>{t('plastic')}</th>
            <th className={`${th} text-right`}>{t('color')}</th>
            <th className={`${th} text-right`}>{t('price')}</th>
            <th className={`${th} text-right`}>{t('total')}</th>
            <th className={`${th} text-right`}>{t('voucher_total')}</th>
            <th className={`${th} text-right`}>{t('previous_balance')}</th>
            <th className={`${th} text-right`}>{t('paid_at_site')}</th>
            <th className={`${th} text-right`}>{t('remaining')}</th>
            {isAdmin && <th className={`${th}`}></th>}
          </tr>
        </thead>

        {rows.map((r, ri) => {
          const zebra = ri % 2 === 0 ? 'bg-white' : 'bg-slate-50';

          if (r.type === 'payment') {
            return (
              <tbody key={`payment-${r.id}`} className="border-t-2 border-gray-300">
                <tr className="bg-green-50/60">
                  <td className={`${td} text-green-700 font-black sticky left-0 z-[1] bg-green-50`}>{t('direct_payment')}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.payment_date}</td>
                  <td className={td} colSpan={5}>
                    {r.payment_method && <span className="inline-flex flex-wrap gap-1 mr-2 align-middle"><MethodTags row={r} /></span>}
                    {r.note && <span className="italic text-gray-500">"{r.note}"</span>}
                    {r.discount_amount > 0 && <span className="text-red-500 ml-2">{t('discount')} -{fmt(r.discount_amount)}</span>}
                  </td>
                  <td className={`${td} ${num} text-gray-300`}>-</td>
                  <td className={`${td} ${num} text-gray-300`}>-</td>
                  <td className={`${td} ${num} text-gray-300`}>-</td>
                  <td className={`${td} ${num} text-green-600 font-black`}>{fmt(r.amount_paid)}</td>
                  <td className={`${td} ${num} text-gray-300`}>-</td>
                  {isAdmin && (
                    <td className={`${td} align-middle`}>
                      <RowActions
                        accent="green"
                        onEdit={canEdit(r) ? (e) => onEditPayment(e, r) : null}
                        onDelete={(e) => { e.stopPropagation(); onDeletePayment(r); }}
                      />
                    </td>
                  )}
                </tr>
              </tbody>
            );
          }

          const items = r.items?.length ? r.items : [null];
          const extras = [
            r.extra_charge_amount > 0 && { label: r.extra_charge_note || 'Extra', value: `+${fmt(r.extra_charge_amount)}`, cls: 'text-orange-500' },
            r.discount_amount > 0 && { label: t('discount'), value: `-${fmt(r.discount_amount)}`, cls: 'text-red-500' },
          ].filter(Boolean);
          const span = items.length + extras.length;
          const settledLater = paidLater.has(r.id);
          const owing = r.remaining_balance > 0 && !settledLater;
          const merged = `${td} ${num} ${zebra}`;

          return (
            <tbody key={`voucher-${r.id}`} className="border-t-2 border-gray-300">
              {items.map((it, i) => (
                <tr key={i} className={zebra}>
                  {i === 0 && (
                    <>
                      <td rowSpan={span} className={`${td} ${zebra} font-black text-gray-800 sticky left-0 z-[1]`}>
                        {r.voucher_number}
                        {r.sync_status === 'pending' && <span className="block text-xs text-yellow-700">Pending</span>}
                      </td>
                      <td rowSpan={span} className={`${td} ${zebra} whitespace-nowrap`}>
                        {r.voucher_date}
                        {r.paid_amount > 0 && r.payment_method && <span className="mt-1 flex flex-col items-start gap-1"><MethodTags row={r} /></span>}
                      </td>
                    </>
                  )}
                  {it ? (
                    <>
                      <td className={td}>{it.plastic_size} <span className="text-gray-400">({it.color})</span></td>
                      <td className={`${td} ${num}`}>{fmt(it.lb)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.plastic_price)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.color_price)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.plastic_price + it.color_price)}</td>
                      <td className={`${td} ${num} text-blue-700 font-black`}>{fmt(it.total_price)}</td>
                    </>
                  ) : (
                    <td className={`${td} text-gray-300`} colSpan={6}>-</td>
                  )}
                  {i === 0 && (
                    <>
                      <td rowSpan={span} className={`${merged} font-black`}>{fmt(r.items_total)}</td>
                      <td rowSpan={span} className={`${merged} ${r.previous_balance > 0 ? 'text-orange-500' : 'text-gray-500'}`}>{fmt(r.previous_balance)}</td>
                      <td rowSpan={span} className={`${merged} text-green-600 font-black`}>{fmt(r.paid_amount)}</td>
                      <td rowSpan={span} className={`${merged} font-black ${settledLater ? 'text-gray-400' : owing ? 'text-red-500 bg-red-50' : 'text-green-600'}`}>
                        {fmt(r.remaining_balance)}
                        {settledLater && <span className="block mt-1 w-fit ml-auto text-xs px-1.5 py-0.5 rounded font-black uppercase bg-gray-100 text-gray-500">{t('paid_later')}</span>}
                      </td>
                      {isAdmin && (
                        <td rowSpan={span} className={`${td} ${zebra} align-middle`}>
                          <RowActions
                            onEdit={canEdit(r) ? (e) => onEditVoucher(e, r) : null}
                            onDelete={(e) => onDeleteVoucher(e, r)}
                          />
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {extras.map((x, i) => (
                <tr key={`x${i}`} className={zebra}>
                  <td className={`${td} ${x.cls}`} colSpan={5}>{x.label}</td>
                  <td className={`${td} ${num} ${x.cls} font-black`}>{x.value}</td>
                </tr>
              ))}
              {r.note && (
                <tr className={zebra}>
                  <td className={`${td} italic text-blue-700 text-sm`} colSpan={isAdmin ? 13 : 12}>"{r.note}"</td>
                </tr>
              )}
            </tbody>
          );
        })}

        <tfoot>
          <tr className="bg-gray-100 font-black">
            <td className={`${td} bg-gray-100 uppercase text-xs text-gray-500`} colSpan={8}>{rows.length}</td>
            <td className={`${td} ${num} bg-gray-100`}>{fmt(billed)}</td>
            <td className={`${td} bg-gray-100`}></td>
            <td className={`${td} ${num} bg-gray-100 text-green-600`}>{fmt(paid)}</td>
            <td className={`${td} bg-gray-100`}></td>
            {isAdmin && <td className={`${td} bg-gray-100`}></td>}
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
};

export default HistorySheet;
