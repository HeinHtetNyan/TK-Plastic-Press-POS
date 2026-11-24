import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { authService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { isDemo, enterDemo, exitDemo, DEMO_LOGIN } from '../lib/demoMode';

const Login = () => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // null = still checking, true = setup needed, false = show login
  const [isSetupRequired, setIsSetupRequired] = useState(null);
  const [checkError, setCheckError] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const checkStatus = async () => {
    setCheckError(false);
    try {
      const res = await authService.checkSetup();
      setIsSetupRequired(res.data.is_setup_required);
    } catch (err) {
      console.error('Failed to check setup status', err);
      setCheckError(true);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSetup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.setup({ username, password, role: 'ADMIN' });
      setIsSetupRequired(false);
      setUsername('');
      setPassword('');
      alert('Super Admin created successfully. Please login.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(username, password);
      const origin = location.state?.from?.pathname || '/';
      navigate(origin);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Still waiting for backend response — show spinner
  if (isSetupRequired === null && !checkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin mx-auto" />
          <p className="text-base font-medium text-muted">{t('x2_connecting')}</p>
        </div>
      </div>
    );
  }

  // Backend unreachable
  if (checkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="max-w-sm w-full bg-row rounded-2xl p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-debt-bg rounded-full flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-debt" />
          </div>
          <h2 className="text-xl font-semibold text-ink">Cannot Reach Server</h2>
          <p className="text-base text-muted">The backend is not reachable. Make sure the server is running and the API URL is configured correctly.</p>
          <button
            onClick={checkStatus}
            className="w-full min-h-[48px] bg-accent text-on-accent rounded-xl font-bold hover:opacity-90 transition-all"
          >
            Retry
          </button>
          {!isDemo() && (
            <button type="button" onClick={enterDemo} className="w-full text-center text-base font-bold text-accent underline">
              {t('x4_demo_link')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isSetupRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-row p-8 sm:p-10 rounded-2xl shadow-sm animate-in zoom-in duration-300">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-accent/40">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
            <h2 className="mt-6 text-center text-2xl sm:text-3xl font-semibold text-ink">
              Initial Setup
            </h2>
            <p className="mt-2 text-center text-base text-muted">
              Create the first **Super Admin** account
            </p>
          </div>
          <form className="mt-8 space-y-4" onSubmit={handleSetup}>
            {error && (
              <div className="bg-debt-bg border-l-4 border-debt rounded-xl p-4">
                <p className="text-base text-debt">{error}</p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-base font-bold text-muted uppercase">{t('x2_username')}</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 min-h-[48px] bg-row border border-line rounded-xl outline-none focus:ring-2 focus:ring-accent"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="text-base font-bold text-muted uppercase">{t('x2_password')}</label>
                <input
                  type="password"
                  required
                  className="w-full px-3 min-h-[48px] bg-row border border-line rounded-xl outline-none focus:ring-2 focus:ring-accent"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-base font-bold text-muted uppercase">{t('x2_confirm_pw')}</label>
                <input
                  type="password"
                  required
                  className="w-full px-3 min-h-[48px] bg-row border border-line rounded-xl outline-none focus:ring-2 focus:ring-accent"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-semibold rounded-xl text-on-accent bg-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              {loading ? 'Processing...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-row p-8 sm:p-10 rounded-2xl shadow-sm">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl border-2 border-ink grid place-items-center text-xl font-semibold">TK</div>
          <h2 className="mt-5 text-2xl sm:text-3xl font-semibold text-ink">
            {import.meta.env.VITE_APP_NAME} POS
          </h2>
          <p className="mt-1.5 text-base text-muted">
            {t('x2_please_signin')}
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-debt-bg border-l-4 border-debt rounded-xl p-4">
              <p className="text-base text-debt">{error}</p>
            </div>
          )}
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-muted mb-1.5">{t('x2_username')}</span>
              <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <User className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                required
                className="appearance-none rounded-xl relative block w-full px-10 min-h-[48px] bg-row border border-line-strong placeholder:text-muted text-ink text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-muted mb-1.5">{t('x2_password')}</span>
              <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <Lock className="h-5 w-5 text-muted" />
              </div>
              <input
                type="password"
                required
                className="appearance-none rounded-xl relative block w-full px-10 min-h-[48px] bg-row border border-line-strong placeholder:text-muted text-ink text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              </div>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center min-h-[48px] px-4 items-center border border-transparent text-base font-semibold rounded-xl text-on-accent bg-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? t('x2_signing_in') : t('x2_signin')}
            </button>
          </div>
        </form>
        <div className="border-t border-line pt-6">
        {isDemo() ? (
          <div className="rounded-xl bg-extra-bg p-4 text-center space-y-2">
            <p className="text-base font-semibold text-extra">{t('x4_demo_pill')}</p>
            <p className="text-base text-extra">{t('x4_demo_login_hint')}: <b>{DEMO_LOGIN.username}</b> / <b>{DEMO_LOGIN.password}</b></p>
            <button type="button" onClick={exitDemo} className="text-base font-bold text-extra underline">{t('x4_demo_exit')}</button>
          </div>
        ) : (
          <button type="button" onClick={enterDemo} className="w-full text-center text-base font-bold text-accent underline">
            {t('x4_demo_link')}
          </button>
        )}
        </div>
      </div>
    </div>
  );
};

export default Login;
