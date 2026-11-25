import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, User as UserIcon, Loader2, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import Layout from '../components/Layout';
import { useLanguage } from '../context/LanguageContext';
import { shopDate } from '../utils/shopTime';


// Renders just the content when shown inside the Settings tab (no second page frame).
const Bare = ({ children }) => <>{children}</>;

const Users = ({ embedded = false }) => {
  const Wrap = embedded ? Bare : Layout;
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.list();
      setUsers(response.data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      // Force role to STAFF to ensure only one ADMIN exists
      await userService.create({ username, password, role: 'STAFF' });
      setUsername('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff account?')) return;

    try {
      await userService.delete(id);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await userService.toggleActive(id);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  if (!isAdmin()) {
    return (
      <Wrap>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield size={48} className="text-debt mb-4" />
          <p className="text-debt font-semibold">{t('x2_access_denied')}</p>
          <button onClick={() => navigate('/')} className="mt-4 text-accent font-medium underline min-h-[44px]">{t('x2_back_home')}</button>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className={embedded ? 'space-y-4 pb-20' : 'max-w-4xl mx-auto space-y-4 pb-20'}>
        <div className={`flex items-center justify-between ${embedded ? 'hidden' : ''}`}>
          <div className="flex items-center gap-4">
            {!embedded && (
              <button 
                onClick={() => navigate('/')} 
                className="p-2 bg-row rounded-full shadow-sm hover:bg-band transition-all border border-line"
              >
                <ArrowLeft size={20} className="text-muted" />
              </button>
            )}
            <h1 className="text-xl font-semibold flex items-center gap-2 text-ink">
              <Shield className="text-accent" /> {t('x2_user_mgmt')}
            </h1>
          </div>
        </div>

        {error && (
          <div className="bg-debt-bg p-4 rounded-xl">
            <p className="text-debt font-medium text-base">{error}</p>
          </div>
        )}

        {/* Create User Form */}
        <div className="bg-row p-4 sm:p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-ink">
            <UserPlus size={20} className="text-ok" /> {t('x2_add_staff')}
          </h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted px-1">{t('x2_username')}</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={64}
                className="w-full px-4 min-h-[52px] bg-row border border-line-strong rounded-xl focus:border-accent outline-none font-medium transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="staff_username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted px-1">{t('x2_password')}</label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                pattern=".*[0-9].*"
                title={t('x2_pw_rule')}
                className="w-full px-4 min-h-[52px] bg-row border border-line-strong rounded-xl focus:border-accent outline-none font-medium transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('x2_pw_rule')}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-on-accent px-6 rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-semibold text-base h-[52px]"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : t('x2_create_account')}
            </button>
          </form>
          <p className="mt-3 text-sm text-muted flex items-center gap-1.5">
            <Shield size={14} /> {t('x2_staff_note')}
          </p>
        </div>

        {/* User List */}
        <div className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 border-b border-line">
            <h2 className="text-lg font-semibold text-ink">{t('x2_active_accounts')}</h2>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-muted" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm font-semibold text-ink bg-band border-b border-line">
                    <th className="px-4 sm:px-6 py-3">{t('x2_user_identity')}</th>
                    <th className="px-4 sm:px-6 py-3">{t('x2_access_level')}</th>
                    <th className="px-4 sm:px-6 py-3">{t('x2_joined')}</th>
                    <th className="px-4 sm:px-6 py-3 text-right">{t('x2_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-zebra transition-colors group ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 sm:px-6 py-3 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${u.role === 'ADMIN' ? 'bg-accent text-on-accent' : u.is_active ? 'bg-band text-accent' : 'bg-band text-muted'}`}>
                          <UserIcon size={18} />
                        </div>
                        <div>
                          <span className="font-semibold text-ink text-base sm:text-lg">{u.username}</span>
                          {!u.is_active && (
                            <span className="ml-2 text-xs font-semibold bg-debt-bg text-debt px-2 py-0.5 rounded-full">{t('x2_disabled')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          u.role === 'ADMIN' ? 'bg-band text-accent' : 'bg-ok-bg text-ok'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-base text-muted whitespace-nowrap">
                        {shopDate(u.created_at)}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right">
                        {u.role !== 'ADMIN' && (
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button
                              onClick={() => handleToggleActive(u.id)}
                              className={`px-3 min-h-[44px] rounded-xl border border-line-strong transition-all flex items-center gap-1.5 text-sm font-medium ${
                                u.is_active
                                  ? 'text-ink hover:bg-band'
                                  : 'text-ok hover:bg-ok-bg'
                              }`}
                              title={u.is_active ? t('x2_disable_account') : t('x2_enable_account')}
                            >
                              {u.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                              {u.is_active ? t('x2_disable') : t('x2_enable')}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="w-11 h-11 flex items-center justify-center text-debt hover:bg-debt-bg rounded-xl transition-all"
                              title={t('x2_delete_user')}
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Wrap>
  );
};

export default Users;
