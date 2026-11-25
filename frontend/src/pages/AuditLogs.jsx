import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Clock, User, Activity, Info } from 'lucide-react';
import Layout from '../components/Layout';
import { auditService } from '../services/api';
import Pager from '../components/Pager';
import { useLanguage } from '../context/LanguageContext';
import { shopDateTime } from '../utils/shopTime';


// Renders just the content when shown inside the Settings tab (no second page frame).
const Bare = ({ children }) => <>{children}</>;

const AuditLogs = ({ embedded = false }) => {
  const Wrap = embedded ? Bare : Layout;
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const fetchLogs = async (p) => {
    setLoading(true);
    try {
      const response = await auditService.list(p);
      setLogs(response.data.items);
      setPages(response.data.pages);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
      case 'CREATE_BULK':
        return 'bg-ok-bg text-ok';
      case 'DELETE':
        return 'bg-debt-bg text-debt';
      case 'UPDATE':
        return 'bg-accent/40 text-accent';
      default:
        return 'bg-band text-ink';
    }
  };

  return (
    <Wrap>
      <div className="space-y-4 pb-12">
        <header className={`flex items-center gap-4 ${embedded ? 'hidden' : ''}`}>
          {!embedded && (
            <button onClick={() => navigate('/')} className="p-2 bg-row rounded-full shadow-sm hover:bg-band transition-all">
              <ArrowLeft size={24} className="text-muted" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <ShieldAlert size={24} className="text-debt" />
            <h2 className="text-xl sm:text-2xl font-semibold text-ink">{t('x2_audit_title')}</h2>
          </div>
        </header>

        <div className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-band border-b border-line">
                  <th className="px-4 sm:px-5 py-3 text-sm font-semibold text-ink whitespace-nowrap">{t('x2_time')}</th>
                  <th className="px-4 sm:px-5 py-3 text-sm font-semibold text-ink whitespace-nowrap">{t('x2_user')}</th>
                  <th className="px-4 sm:px-5 py-3 text-sm font-semibold text-ink whitespace-nowrap">{t('x2_action')}</th>
                  <th className="px-4 sm:px-5 py-3 text-sm font-semibold text-ink whitespace-nowrap">{t('x2_entity')}</th>
                  <th className="px-4 sm:px-5 py-3 text-sm font-semibold text-ink whitespace-nowrap">{t('x2_details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                   <tr>
                     <td colSpan="5" className="px-6 py-12 text-center text-muted">{t('x2_loading_logs')}</td>
                   </tr>
                ) : logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zebra transition-colors">
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-base text-muted">
                        <Clock size={14} />
                        {shopDateTime(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-base font-semibold text-accent">
                        <User size={14} />
                        {log.username}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap text-base text-ink">
                      {log.entity_type} <span className="text-muted font-normal">#{log.entity_id}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <div className="flex items-start gap-2 text-base text-muted min-w-[14rem] max-w-md">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        {log.details}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-muted">{t('x2_no_logs')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-line space-y-2">
            <p className="text-center text-sm text-muted">{total.toLocaleString()} {t('x_records')}</p>
            <Pager page={page} pages={pages} onChange={setPage} disabled={loading} />
          </div>
        </div>
      </div>
    </Wrap>
  );
};

export default AuditLogs;
