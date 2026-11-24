import React from 'react';
import { Printer } from 'lucide-react';
import RowActions from './RowActions';
import MethodTags from './MethodTags';
import { useLanguage } from '../context/LanguageContext';

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const th = 'px-1.5 py-2.5 text-left text-[13px] font-semibold text-muted bg-band border border-grid lg:whitespace-normal whitespace-nowrap leading-tight sticky top-0 z-10';
const td = 'px-1.5 py-1.5 border border-line text-[length:var(--sfs)] font-normal text-ink align-top';
const num = 'text-right tabular-nums whitespace-nowrap';


// Spreadsheet-style view of a customer's vouchers and direct payments.
// One bordered block per voucher: every product is its own line, voucher-level
// figures (totals, balances, actions) are merged cells spanning those lines.
const HistorySheet = ({
  rows, allRows, isAdmin, canEdit, paidLater = new Set(),
  onEditVoucher, onDeleteVoucher, onEditPayment, onDeletePayment,
  onPrint, printingId,
}) => {
  const { t } = useLanguage();

  // footer totals cover ALL records of the filter, not only the page being shown
  const totalRows = allRows || rows;
  const billed = totalRows.reduce((s, r) => s + (r.type === 'voucher' ? r.items_total || 0 : 0), 0);
  const paid = totalRows.reduce((s, r) => s + (r.type === 'voucher' ? r.paid_amount || 0 : r.amount_paid || 0), 0);

  return (
    <>
    <p className="sm:hidden text-[13px] font-medium text-muted text-center mb-1">&larr; swipe sideways &rarr;</p>
    <div className="bg-row rounded-2xl border border-line-strong shadow-sm relative isolate z-0 overflow-auto overscroll-x-contain max-h-[calc(100dvh-9rem)] sm:max-h-[78vh]">
      <table className="w-full border-collapse min-w-[1060px] lg:min-w-0">
        <thead>
          <tr>
            <th className={`${th} left-0 z-20`}>{t('voucher')}</th>
            <th className={th}>{t('date')}</th>
            <th className={th}>{t('size')}</th>
            <th className={th}>{t('gate')}</th>
            <th className={th}>{t('plastic_color')}</th>
            <th className={th}>{t('print_color')}</th>
            <th className={`${th} text-right`}>{t('x_lb')}</th>
            <th className={`${th} text-right`}>{t('plastic_price')}</th>
            <th className={`${th} text-right`}>{t('color_price')}</th>
            <th className={`${th} text-right`}>{t('price')}</th>
            <th className={`${th} text-right`}>{t('total')}</th>
            <th className={`${th} text-right`}>{t('voucher_total')}</th>
            <th className={`${th} text-right`}>{t('previous_balance')}</th>
            <th className={`${th} text-right`}>{t('paid_at_site')}</th>
            <th className={`${th} text-right`}>{t('remaining')}</th>
            {isAdmin && <th className={`${th} sticky right-0 z-20 shadow-[-6px_0_8px_-6px_var(--shadow-pin)]`}></th>}
          </tr>
        </thead>

        {rows.map((r, ri) => {
          const zebra = ri % 2 === 0 ? 'bg-row' : 'bg-zebra';

          if (r.type === 'payment') {
            return (
              <tbody key={`payment-${r.id}`} className="border-t-2 border-line-strong">
                <tr className="bg-pay-bg">
                  <td className={`${td} text-ok font-semibold sticky left-0 z-[1] bg-pay-bg`}>{t('direct_payment')}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.payment_date}</td>
                  <td className={td} colSpan={8}>
                    {r.payment_method && <span className="inline-flex flex-wrap gap-1 mr-2 align-middle"><MethodTags row={r} /></span>}
                    {r.note && <span className="italic text-muted">"{r.note}"</span>}
                    {r.discount_amount > 0 && <span className="text-debt ml-2">{t('discount')} -{fmt(r.discount_amount)}</span>}
                  </td>
                  <td className={`${td} ${num} text-muted/50`}>-</td>
                  <td className={`${td} ${num} text-muted/50`}>-</td>
                  <td className={`${td} ${num} text-muted/50`}>-</td>
                  <td className={`${td} ${num} text-ok font-semibold`}>{fmt(r.amount_paid)}</td>
                  <td className={`${td} ${num} text-muted/50`}>-</td>
                  {isAdmin && (
                    <td className={`${td} align-middle sticky right-0 z-[1] bg-pay-bg shadow-[-6px_0_8px_-6px_var(--shadow-pin)]`}>
                      <RowActions
                        accent="green"
                        compact
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
            r.extra_charge_amount > 0 && { label: r.extra_charge_note || 'Extra', value: `+${fmt(r.extra_charge_amount)}`, cls: 'text-extra' },
            r.discount_amount > 0 && { label: t('discount'), value: `-${fmt(r.discount_amount)}`, cls: 'text-debt' },
          ].filter(Boolean);
          const span = items.length + extras.length;
          const settledLater = paidLater.has(r.id);
          const owing = r.remaining_balance > 0 && !settledLater;
          const merged = `${td} ${num} ${zebra}`;

          return (
            <tbody key={`voucher-${r.id}`} className="border-t-2 border-line-strong">
              {items.map((it, i) => (
                <tr key={i} className={zebra}>
                  {i === 0 && (
                    <>
                      <td rowSpan={span} className={`${td} ${zebra} font-semibold text-ink sticky left-0 z-[1]`}>
                        {r.voucher_number}
                        {onPrint && (
                          <button
                            type="button"
                            disabled={printingId === r.id}
                            onClick={(e) => onPrint(e, r)}
                            className="mt-1.5 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-accent text-on-accent text-[13px] font-semibold min-h-[40px] disabled:opacity-60 whitespace-nowrap"
                          >
                            <Printer size={16} /> {printingId === r.id ? '...' : t('x3_reprint_short')}
                          </button>
                        )}
                        {r.core_weight_lb > 0 && <span className="block text-[13px] font-semibold text-extra whitespace-nowrap">{t('core_weight').replace(' (lb)', '').replace(' (ပေါင်)', '').replace(' Core', '').replace('ကတ်ထူလိပ်', 'ကတ်ထူ')}<span className="block">{r.core_weight_lb} lb</span></span>}
                        {r.sync_status === 'pending' && <span className="block text-[13px] text-extra">{t('x2_pending')}</span>}
                      </td>
                      <td rowSpan={span} className={`${td} ${zebra} whitespace-nowrap`}>
                        {r.voucher_date}
                        {r.paid_amount > 0 && r.payment_method && <span className="mt-1 flex flex-col items-start gap-1"><MethodTags row={r} /></span>}
                      </td>
                    </>
                  )}
                  {it ? (
                    <>
                      <td className={`${td} whitespace-nowrap`}>{it.plastic_size}</td>
                      <td className={`${td} whitespace-nowrap`}>{it.gate || <span className="text-muted/50">-</span>}</td>
                      <td className={td}>{it.color}</td>
                      <td className={td}>{it.print_color || <span className="text-muted/50">-</span>}</td>
                      <td className={`${td} ${num}`}>{fmt(it.lb)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.plastic_price)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.color_price)}</td>
                      <td className={`${td} ${num}`}>{fmt(it.plastic_price + it.color_price)}</td>
                      <td className={`${td} ${num} text-accent font-semibold`}>{fmt(it.total_price)}</td>
                    </>
                  ) : (
                    <td className={`${td} text-muted/50`} colSpan={9}>-</td>
                  )}
                  {i === 0 && (
                    <>
                      <td rowSpan={span} className={`${merged} font-semibold`}>{fmt(r.items_total)}</td>
                      <td rowSpan={span} className={`${merged} ${r.previous_balance > 0 ? 'text-extra' : 'text-muted'}`}>{fmt(r.previous_balance)}</td>
                      <td rowSpan={span} className={`${merged} text-ok font-semibold`}>{fmt(r.paid_amount)}</td>
                      <td rowSpan={span} className={`${merged} font-semibold ${settledLater ? 'text-muted' : owing ? 'text-debt bg-debt-bg' : 'text-ok'}`}>
                        {fmt(r.remaining_balance)}
                        {settledLater && <span className="block mt-1 w-fit ml-auto text-[13px] px-1.5 py-0.5 rounded-full font-medium bg-band text-muted">{t('paid_later')}</span>}
                      </td>
                      {isAdmin && (
                        <td rowSpan={span} className={`${td} ${zebra} align-middle sticky right-0 z-[1] shadow-[-6px_0_8px_-6px_var(--shadow-pin)]`}>
                          <RowActions
                            compact
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
                  <td className={`${td} ${x.cls}`} colSpan={8}>{x.label}</td>
                  <td className={`${td} ${num} ${x.cls} font-semibold`}>{x.value}</td>
                </tr>
              ))}
              {r.note && (
                <tr className={zebra}>
                  <td className={`${td} italic text-accent`} colSpan={isAdmin ? 16 : 15}>"{r.note}"</td>
                </tr>
              )}
            </tbody>
          );
        })}

        <tfoot className="sticky bottom-0 z-10">
          <tr className="bg-band font-semibold">
            <td className={`${td} bg-band text-sm text-muted`} colSpan={11}>{totalRows.length} {t('x_records')}</td>
            <td className={`${td} ${num} bg-band`}>{fmt(billed)}</td>
            <td className={`${td} bg-band`}></td>
            <td className={`${td} ${num} bg-band text-ok`}>{fmt(paid)}</td>
            <td className={`${td} bg-band`}></td>
            {isAdmin && <td className={`${td} bg-band`}></td>}
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
};

export default HistorySheet;
