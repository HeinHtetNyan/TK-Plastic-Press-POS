import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Clock, User, Activity, Info } from 'lucide-react';
import Layout from '../components/Layout';
import { auditService } from '../services/api';
import Pager from '../components/Pager';
import { useLanguage } from '../context/LanguageContext';


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
        return 'bg-green-100 text-green-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Wrap>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
        <header className="flex items-center gap-4">
          {!embedded && (
            <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <ShieldAlert size={28} className="text-red-600" />
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">{t('x2_audit_title')}</h2>
          </div>
        </header>

        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-base font-black text-gray-600 uppercase tracking-widest">{t('x2_time')}</th>
                  <th className="px-6 py-4 text-base font-black text-gray-600 uppercase tracking-widest">{t('x2_user')}</th>
                  <th className="px-6 py-4 text-base font-black text-gray-600 uppercase tracking-widest">{t('x2_action')}</th>
                  <th className="px-6 py-4 text-base font-black text-gray-600 uppercase tracking-widest">{t('x2_entity')}</th>
                  <th className="px-6 py-4 text-base font-black text-gray-600 uppercase tracking-widest">{t('x2_details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr>
                     <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">{t('x2_loading_logs')}</td>
                   </tr>
                ) : logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-base font-bold text-gray-500">
                        <Clock size={12} />
                        {new Date(log.created_at).toLocaleString('en-GB')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-base font-black text-blue-600">
                        <User size={14} />
                        {log.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-sm font-black uppercase tracking-tighter ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-gray-600">
                      {log.entity_type} <span className="text-gray-400 font-normal">#{log.entity_id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2 text-base text-gray-500 font-medium max-w-xs">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        {log.details}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">{t('x2_no_logs')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 space-y-2">
            <p className="text-center text-sm font-bold text-gray-400">{total.toLocaleString()} {t('x_records')}</p>
            <Pager page={page} pages={pages} onChange={setPage} disabled={loading} />
          </div>
        </div>
      </div>
    </Wrap>
  );
};

export default AuditLogs;
