import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Target,
  Plus,
  Trash2,
  Calendar,
  Gift,
  CheckCircle2,
  Edit2,
  Loader2
} from 'lucide-react';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { getGoals, addGoal, addGoalFunds, deleteGoal, updateGoal } from '../services/goalService';

const GOAL_CATEGORIES = ['Safety', 'Work', 'Travel', 'Fitness', 'Retirement', 'Education', 'Home', 'General'];

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(16,185,129,0.2)' };

const GoalFormFields = ({
  formName,
  setFormName,
  formTarget,
  setFormTarget,
  formCategory,
  setFormCategory,
  formDeadline,
  setFormDeadline,
  currency,
}) => (
  <>
    <Input
      label="Goal Name"
      placeholder="e.g. Vacation to Bali, Emergency Fund"
      value={formName}
      onChange={e => setFormName(e.target.value)}
      required
    />
    <div className="grid grid-cols-2 gap-4">
      <Input
        label={`Target Amount (${currency})`}
        type="number"
        placeholder="0.00"
        value={formTarget}
        onChange={e => setFormTarget(e.target.value)}
        required
      />
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
        <select
          value={formCategory}
          onChange={e => setFormCategory(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm py-3 px-4 outline-none focus:border-[#10b981]/50"
        >
          {GOAL_CATEGORIES.map(cat => (
            <option key={cat} value={cat} className="bg-[#111827]">{cat}</option>
          ))}
        </select>
      </div>
    </div>
<div>
  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
    Deadline
  </label>

  <input
    type="date"
    value={formDeadline}
    onChange={e => setFormDeadline(e.target.value)}
    min={new Date().toISOString().split("T")[0]}
    required
    className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm py-3 px-4 outline-none focus:border-[#10b981]/50"
  />
</div>  
</>

);

export const Goals = () => {
  const { settings } = useApp();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Modal states
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCelebrateOpen, setIsCelebrateOpen] = useState(false);
  const [celebrationGoal, setCelebrationGoal] = useState(null);

  // Deposit form
  const [depositAmount, setDepositAmount] = useState('');

  // Create/Edit form
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCategory, setFormCategory] = useState('Safety');
  const [formDeadline, setFormDeadline] = useState('');

  const currency = settings?.currency || '₹';
  const formatCurrency = useCallback(
    (val) => `${currency}${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    [currency]
  );

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getGoals();
    if (!error) setGoals(data || []);
    else toast.error('Failed to load goals.');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // ── Deposit ──────────────────────────────────────────────────────
  const handleDepositClick = (g) => {
    setSelectedGoal(g);
    setDepositAmount('');
    setIsDepositOpen(true);
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depositAmount || !selectedGoal) return;
    setSaving(true);
    const amt = Number(depositAmount);
    const { data, error } = await addGoalFunds(selectedGoal.id, amt);
    if (!error && data) {
      const newCurrent = data.current;
      setGoals(prev =>
        prev.map(g => g.id === selectedGoal.id ? { ...g, current: newCurrent } : g)
      );
      if (newCurrent >= selectedGoal.target && selectedGoal.current < selectedGoal.target) {
        setCelebrationGoal({ ...selectedGoal, current: newCurrent });
        setIsCelebrateOpen(true);
      } else {
        toast.success(`Added ${formatCurrency(amt)} to "${selectedGoal.name}"`, { style: TOAST_STYLE });
      }
    } else {
      toast.error('Failed to add funds.');
    }
    setSaving(false);
    setIsDepositOpen(false);
    setSelectedGoal(null);
  };

  // ── Create ────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormName('');
    setFormTarget('');
    setFormCategory('Safety');
    setFormDeadline('');
  };

  const handleNewGoalSubmit = async (e) => {
    e.preventDefault();
    if (!formName || !formTarget) return;
    setSaving(true);
    const { data, error } = await addGoal({
      name: formName,
      target: Number(formTarget),
      category: formCategory,
      deadline: formDeadline || null,
    });
    if (!error && data) {
      setGoals(prev => [data, ...prev]);
      toast.success('Savings goal created!', { style: TOAST_STYLE });
    } else {
      toast.error('Failed to create goal.');
    }
    setSaving(false);
    setIsNewGoalOpen(false);
    resetForm();
  };

  // ── Edit ──────────────────────────────────────────────────────────
  const handleEditClick = (g) => {
    setSelectedGoal(g);
    setFormName(g.name);
    setFormTarget(String(g.target));
    setFormCategory(g.category || 'Safety');
    setFormDeadline(g.deadline ? g.deadline.slice(0, 10) : '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formName || !formTarget || !selectedGoal) return;
    setSaving(true);
    const { data, error } = await updateGoal(selectedGoal.id, {
      name: formName,
      target: Number(formTarget),
      category: formCategory,
      deadline: formDeadline || null,
      status: selectedGoal.status || 'active',
    });
    if (!error && data) {
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, ...data } : g));
      toast.success('Goal updated!', { style: TOAST_STYLE });
    } else {
      toast.error('Failed to update goal.');
    }
    setSaving(false);
    setIsEditOpen(false);
    resetForm();
    setSelectedGoal(null);
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = async (g) => {
    if (!window.confirm(`Delete "${g.name}"? This cannot be undone.`)) return;
    const { error } = await deleteGoal(g.id);
    if (!error) {
      setGoals(prev => prev.filter(goal => goal.id !== g.id));
      toast.success('Goal deleted.', { style: TOAST_STYLE });
    } else {
      toast.error('Failed to delete goal.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Savings Goals</h1>
          <p className="text-sm text-slate-400 mt-1">Fund allocation targeting long-term capital investments.</p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setIsNewGoalOpen(true); }}>
          <Plus size={16} className="mr-1.5" /> Create Goal
        </Button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading goals…
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No savings goals yet. Create your first goal!</p>
        </div>
      ) : (
        /* Goals Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map(g => {
            const ratio = g.target > 0 ? (g.current / g.target) * 100 : 0;
            const isCompleted = g.current >= g.target;

            return (
              <Card
                key={g.id}
                hover={false}
                className={`flex flex-col justify-between border ${isCompleted ? 'border-emerald-500/20 bg-emerald-950/5' : 'border-white/5'} transition-all`}
              >
                <div className="space-y-4">
                  {/* Header info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-300'}`}>
                        <Target size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight">{g.name}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{g.category || 'General'} Target</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Achieved
                        </span>
                      ) : (
                        <Button
                          variant="emeraldOutline"
                          size="sm"
                          onClick={() => handleDepositClick(g)}
                          className="py-1 text-[11px] font-bold"
                        >
                          Add Capital
                        </Button>
                      )}
                      <button
                        onClick={() => handleEditClick(g)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit Goal"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Values */}
                  <div className="flex items-baseline justify-between pt-2">
                    <div>
                      <p className="text-xs text-slate-500">Total Saved Pool</p>
                      <p className="text-xl font-extrabold text-white mt-0.5">{formatCurrency(g.current)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Required Target</p>
                      <p className="text-sm font-bold text-slate-400 mt-0.5">{formatCurrency(g.target)}</p>
                    </div>
                  </div>

                  <ProgressBar value={g.current} max={g.target || 1} color={isCompleted ? 'emerald' : 'blue'} />

                  {/* Milestones */}
                  {g.milestones && g.milestones.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Milestone Achievements</p>
                      <div className="grid grid-cols-2 gap-2">
                        {g.milestones.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.01] border border-white/5">
                            <CheckCircle2 size={13} className={m.achieved || isCompleted ? 'text-emerald-400' : 'text-slate-600'} />
                            <span className={`text-[10px] truncate ${m.achieved || isCompleted ? 'text-white' : 'text-slate-500'}`}>{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {g.deadline
                      ? `Deadline: ${new Date(g.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                      : g.estimatedCompletion
                      ? `Est: ${g.estimatedCompletion}`
                      : 'No deadline'}
                  </span>
                  <span>{Math.round(ratio)}% Secured</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deposit Modal */}
      <Modal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} title={`Deposit Capital: ${selectedGoal?.name}`}>
        <form onSubmit={handleDepositSubmit} className="space-y-4">
          <Input
            label={`Amount to Deposit (${currency})`}
            type="number"
            placeholder="0.00"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsDepositOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Fund Goal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Goal Modal */}
      <Modal isOpen={isNewGoalOpen} onClose={() => { setIsNewGoalOpen(false); resetForm(); }} title="Create Savings Goal">
        <form onSubmit={handleNewGoalSubmit} className="space-y-4">
          <GoalFormFields
            formName={formName}
            setFormName={setFormName}
            formTarget={formTarget}
            setFormTarget={setFormTarget}
            formCategory={formCategory}
            setFormCategory={setFormCategory}
            formDeadline={formDeadline}
            setFormDeadline={setFormDeadline}
            currency={currency}
          />
          <Button type="submit" className="w-full justify-center" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Create Savings Goal
          </Button>
        </form>
      </Modal>

      {/* Edit Goal Modal */}
      <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); resetForm(); setSelectedGoal(null); }} title="Edit Savings Goal">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <GoalFormFields
            formName={formName}
            setFormName={setFormName}
            formTarget={formTarget}
            setFormTarget={setFormTarget}
            formCategory={formCategory}
            setFormCategory={setFormCategory}
            formDeadline={formDeadline}
            setFormDeadline={setFormDeadline}
            currency={currency}
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setIsEditOpen(false); resetForm(); setSelectedGoal(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Celebration Modal */}
      <Modal isOpen={isCelebrateOpen} onClose={() => setIsCelebrateOpen(false)} title="Goal Achieved! 🎉">
        <div className="text-center space-y-4 p-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce">
            <Gift size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">Target Completed!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Congratulations! You have successfully secured{' '}
              <span className="text-[#10b981] font-bold">{celebrationGoal && formatCurrency(celebrationGoal.target)}</span>{' '}
              for your <span className="text-white font-bold">"{celebrationGoal?.name}"</span> fund.
            </p>
          </div>
          <Button variant="primary" className="w-full mt-2" onClick={() => setIsCelebrateOpen(false)}>
            Splendid!
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Goals;
