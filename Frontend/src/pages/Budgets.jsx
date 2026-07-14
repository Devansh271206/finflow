import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Code,
  ShoppingBag,
  Utensils,
  Car,
  Film,
  CreditCard,
  Plus,
  Edit2,
  Calendar,
  AlertTriangle,
  Loader2,
  PieChart
} from 'lucide-react';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import {
  getBudgets,
  updateBudget,
  createBudget,
  deleteBudget,
} from "../services/budgetService";
import { getCategories } from "../services/categoryService";

// Days remaining until the end of the given budget's month/year (defaults to current period)
function getDaysRemainingInPeriod(budget) {
  const now = new Date();
  const year = budget?.year || now.getFullYear();
  const month = (budget?.month || now.getMonth() + 1) - 1; // JS months are 0-indexed
  const periodEnd = new Date(year, month + 1, 0); // last day of the period's month
  const isCurrentPeriod = year === now.getFullYear() && month === now.getMonth();
  const reference = isCurrentPeriod ? now : new Date(year, month, 1);
  const msRemaining = periodEnd.setHours(23, 59, 59, 999) - reference.getTime();
  const days = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  return days;
}

const iconMap = {
  Code: Code,
  ShoppingBag: ShoppingBag,
  Utensils: Utensils,
  Car: Car,
  Film: Film,
  CreditCard: CreditCard
};

export const Budgets = () => {
  const { settings } = useApp();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [limitValue, setLimitValue] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadBudgets();
    loadCategories();
  }, []);

  async function loadBudgets() {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await getBudgets();
    if (!error) {
      setBudgets(data || []);
    } else {
      setErrorMessage(error.message || 'Unable to load budgets.');
    }
    setLoading(false);
  }

  async function loadCategories() {
    setCategoriesLoading(true);
    const { data, error } = await getCategories();
    if (!error) {
      // Budgets track spending limits, so only expense categories are relevant here.
      const expenseCategories = (data || []).filter((c) => (c.type || 'expense') === 'expense');
      setCategories(expenseCategories);
    } else {
      toast.error(error.message || 'Unable to load categories.');
    }
    setCategoriesLoading(false);
  }

  const formatCurrency = (val) => `${settings.currency}${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const handleEditClick = (b) => {
    setSelectedBudget(b);
    setLimitValue(b.limit.toString());
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!limitValue || !selectedBudget) return;

    const { error } = await updateBudget(selectedBudget.id, { limit: Number(limitValue) });
    if (!error) {
      setBudgets((prev) => prev.map((budget) => budget.id === selectedBudget.id ? { ...budget, limit: Number(limitValue), monthly_limit: Number(limitValue) } : budget));
      toast.success('Budget limit updated.');
    } else {
      toast.error('Failed to update budget limit.');
    }

    setIsEditOpen(false);
    setSelectedBudget(null);
  };

  const handleCreateBudget = async (e) => {
    e.preventDefault();

    if (!categoryId || !budgetLimit) {
      toast.error("Please fill all required fields.");
      return;
    }

    const { data, error } = await createBudget({
      categoryId,
      limit: Number(budgetLimit),
      month: budgetMonth,
      year: budgetYear,
    });

    if (error) {
      toast.error(error.message || "Failed to create budget.");
      return;
    }

    toast.success("Budget created successfully!");

    setIsCreateOpen(false);
    setCategoryId("");
    setBudgetLimit("");
    setBudgetMonth(new Date().getMonth() + 1);
    setBudgetYear(new Date().getFullYear());

    loadBudgets();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Expense Budgets
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Set thresholds and limits for automated overspending defense.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus size={16} className="mr-2" />
          Create Budget
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading budgets…
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No budgets configured yet"
          description="Create categories and set spending limits to start tracking your budget performance."
        />
      ) : (
        /* Budgets Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b) => {
            const IconComponent = iconMap[b.icon] || CreditCard;
            const ratio = (b.spent / b.limit) * 100;
            const remaining = Math.max(0, b.limit - b.spent);
            const isOver = b.spent > b.limit;

            // Colors
            const themeColor = b.color || 'emerald';
            const borderHighlight = ratio > 90
              ? 'border-rose-500/20'
              : ratio > 75
                ? 'border-amber-500/20'
                : 'border-white/5';

            return (
              <Card
                key={b.id}
                hover={false}
                className={`flex flex-col justify-between border ${borderHighlight} transition-all duration-300`}
              >
                <div className="space-y-4">
                  {/* Icon & Details */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center`}>
                        <IconComponent size={20} className={themeColor === 'emerald' ? 'text-[#10b981]' : `text-${themeColor}-400`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight">{b.category}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{getDaysRemainingInPeriod(b)} Days remaining</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ratio >= 90 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20">
                          <AlertTriangle size={10} /> Critical
                        </span>
                      ) : ratio >= 75 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                          Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          Healthy
                        </span>
                      )}

                      <button
                        onClick={() => handleEditClick(b)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit Limit"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Values */}
                  <div className="flex items-baseline justify-between pt-2">
                    <div>
                      <p className="text-xs text-slate-500">Spent Balance</p>
                      <p className="text-xl font-extrabold text-white mt-0.5">{formatCurrency(b.spent)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Limit Target</p>
                      <p className="text-sm font-bold text-slate-400 mt-0.5">{formatCurrency(b.limit)}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <ProgressBar
                    value={b.spent}
                    max={b.limit}
                    color={ratio > 90 ? 'rose' : ratio > 75 ? 'amber' : themeColor}
                  />
                </div>

                {/* Footer text */}
                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {isOver
                      ? `Overdraft: ${formatCurrency(b.spent - b.limit)}`
                      : `${formatCurrency(remaining)} remaining`
                    }
                  </span>
                  <span>{Math.round(ratio)}% Allocated</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Budget Limit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Set Limit: ${selectedBudget?.category}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label={`New Budget Limit (${settings.currency})`}
            type="number"
            placeholder="0.00"
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Update limit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Budget Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Budget">
        <form onSubmit={handleCreateBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              disabled={categoriesLoading}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
            >
              <option value="" disabled>
                {categoriesLoading ? 'Loading categories…' : 'Select a category'}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!categoriesLoading && categories.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1.5">
                No expense categories yet — create one first.
              </p>
            )}
          </div>

          <Input
            label={`Budget Limit (${settings.currency})`}
            type="number"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(e.target.value)}
            required
          />

          <Input
            label="Month"
            type="number"
            min="1"
            max="12"
            value={budgetMonth}
            onChange={(e) => setBudgetMonth(Number(e.target.value))}
            required
          />

          <Input
            label="Year"
            type="number"
            value={budgetYear}
            onChange={(e) => setBudgetYear(Number(e.target.value))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit">
              Create Budget
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Budgets;