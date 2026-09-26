import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Clock, User, Activity, Info } from 'lucide-react';
import Layout from '../components/Layout';
import { auditService } from '../services/api';

const AuditLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await auditService.list();
      setLogs(response.data);
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
    <Layout>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert size={28} className="text-red-600" />
            <h2 className="text-2xl font-black text-gray-800">Security Audit Trail</h2>
          </div>
        </header>

        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Time</th>
                  <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Action</th>
                  <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Entity</th>
                  <th className="px-6 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr>
                     <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">Loading logs...</td>
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
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">No logs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AuditLogs;
