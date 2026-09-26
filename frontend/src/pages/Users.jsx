import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, User as UserIcon, Loader2, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import Layout from '../components/Layout';

const Users = () => {
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
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield size={48} className="text-red-200 mb-4" />
          <p className="text-red-500 font-black uppercase tracking-widest">Access Denied. Admins only.</p>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 font-bold underline">Back to Home</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all border border-gray-100"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 uppercase tracking-tight">
              <Shield className="text-blue-600" /> User Management
            </h1>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl">
            <p className="text-red-700 font-bold text-base">{error}</p>
          </div>
        )}

        {/* Create User Form */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-gray-700 uppercase tracking-tight">
            <UserPlus size={20} className="text-green-600" /> Add New Staff Member
          </h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">Username</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="staff_username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 chars"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-6 py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-black uppercase text-base shadow-lg shadow-blue-100 h-[52px]"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-400 font-black uppercase tracking-widest italic flex items-center gap-1">
            <Shield size={10} /> Note: New accounts are created with STAFF privileges.
          </p>
        </div>

        {/* User List */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Active System Accounts</h2>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                    <th className="px-8 py-4">User Identity</th>
                    <th className="px-8 py-4">Access Level</th>
                    <th className="px-8 py-4">Joined Date</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors group ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-8 py-5 flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${u.role === 'ADMIN' ? 'bg-blue-600 text-white' : u.is_active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          <UserIcon size={18} />
                        </div>
                        <div>
                          <span className="font-black text-gray-800 text-lg tracking-tight">{u.username}</span>
                          {!u.is_active && (
                            <span className="ml-2 text-xs font-black uppercase bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Disabled</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-sm font-black tracking-widest ${
                          u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-base font-bold text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {u.role !== 'ADMIN' && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => handleToggleActive(u.id)}
                              className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-sm font-black uppercase ${
                                u.is_active
                                  ? 'text-yellow-500 hover:bg-yellow-50'
                                  : 'text-green-500 hover:bg-green-50'
                              }`}
                              title={u.is_active ? 'Disable Account' : 'Enable Account'}
                            >
                              {u.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                              {u.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-gray-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all"
                              title="Delete User"
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
    </Layout>
  );
};

export default Users;
