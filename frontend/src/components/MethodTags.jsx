import React from 'react';
import { methodShort, methodTagClass, rowMethods } from '../utils/paymentSplits';

const fmt = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

// Method tag(s) of a voucher/payment. A split shows one tag per method with its part.
const MethodTags = ({ row, className = '' }) => {
  const parts = rowMethods(row);
  const split = parts.length > 1;
  return parts.map((p) => (
    <span key={p.method} className={`text-xs px-1.5 py-0.5 rounded font-black uppercase whitespace-nowrap ${methodTagClass(p.method)} ${className}`}>
      {methodShort(p.method)}{split ? ` ${fmt(p.amount)}` : ''}
    </span>
  ));
};

export default MethodTags;
