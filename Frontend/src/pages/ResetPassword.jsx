import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, TrendingUp, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { resetPassword } from '../services/passwordResetService';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (confirm !== password) newErrors.confirm = 'Passwords do not match';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await resetPassword(token, password);
    setLoading(false);

    if (error) {
      setErrors({ form: error.message || 'Unable to reset your password. Please try again.' });
      return;
    }

    setDone(true);
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px]" />

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] mb-4">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Choose a new password</h2>
          <p className="text-sm text-slate-400 mt-1.5">Your new password takes effect immediately</p>
        </div>

        <Card glass className="p-8">
          {done ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#10b981]/15 flex items-center justify-center text-[#10b981]">
                <Check size={20} />
              </div>
              <p className="text-base font-semibold text-white">Password updated</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center mt-2"
                onClick={() => navigate('/login')}
              >
                Go to login
              </Button>
            </div>
          ) : !token ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-400">
                This reset link is missing its token. Please use the full link from the email.
              </p>
              <Link to="/login" className="inline-block text-sm text-emerald-400 hover:text-emerald-300 font-semibold">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="New Password"
                type="password"
                icon={Lock}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors(prev => ({ ...prev, password: '' }));
                }}
                error={errors.password}
              />

              <Input
                label="Confirm New Password"
                type="password"
                icon={Lock}
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors(prev => ({ ...prev, confirm: '' }));
                }}
                error={errors.confirm}
              />

              {errors.form && (
                <p className="text-sm text-rose-400">{errors.form}</p>
              )}

              <Button type="submit" loading={loading} className="w-full py-3.5 text-sm font-semibold justify-center">
                Reset password
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
