import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Mail, Lock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export const Login = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await login(email, password);
      // If the user landed here from a workspace invitation link, return
      // them to the /invite page to accept it after signing in.
      let pendingInvite = null;
      try {
        const raw = sessionStorage.getItem('finflow_pending_invite');
        if (raw) {
          pendingInvite = JSON.parse(raw);
          sessionStorage.removeItem('finflow_pending_invite');
        }
      } catch {
        pendingInvite = null;
      }
      if (pendingInvite?.token) {
        navigate(`/invite?token=${encodeURIComponent(pendingInvite.token)}`);
        return;
      }
      navigate('/dashboard');
    } catch (error) {
      setErrors({ form: error.message || 'Invalid email or password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px]" />

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] mb-4">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
          <p className="text-sm text-slate-400 mt-1.5">Enter your details to access your FinFlow dashboard</p>
        </div>

        <Card glass className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              icon={Mail}
              placeholder="alex@finflow.io"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors(prev => ({ ...prev, email: '' }));
              }}
              error={errors.email}
            />

            <Input
              label="Password"
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors(prev => ({ ...prev, password: '' }));
              }}
              error={errors.password}
            />

            {errors.form && (
              <p className="text-sm text-rose-400">{errors.form}</p>
            )}

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input type="checkbox" className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/50" />
                Remember me
              </label>
              <a href="#forgot" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">Forgot password?</a>
            </div>

            <Button type="submit" loading={loading} className="w-full py-3.5 text-sm font-semibold justify-center">
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
              Sign up
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
