import React, { useState, useMemo, useEffect } from "react";
import { useApp } from '../context/AppContext';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  UploadCloud
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Select, SelectItem } from '../components/ui/Select';
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../services/transactionService";

export const Transactions = () => {
  const { settings } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Search & Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Selected Transaction for operations
  const [selectedTx, setSelectedTx] = useState(null);

  // Form states
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [type, setType] = useState('expense');
  const [method, setMethod] = useState('Credit Card');
  const [status, setStatus] = useState('Completed');
  const [date, setDate] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);

  // Categories list derived
  const categories = useMemo(() => {
    const set = new Set(transactions.map(t => t.category));
    return ['all', ...Array.from(set)];
  }, [transactions]);

  // Filtered transactions
  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchType = filterType === 'all' || t.type === filterType;
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;

      return matchSearch && matchCategory && matchType && matchStatus;
    });
  }, [transactions, searchTerm, filterCategory, filterType, filterStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTx.length / itemsPerPage) || 1;
  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTx.slice(start, start + itemsPerPage);
  }, [filteredTx, currentPage]);

  const formatCurrency = (val) => `${settings.currency}${Math.abs(Number(val)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await getTransactions();

    if (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to load transactions.');
      setLoading(false);
      return;
    }

    const normalizedTransactions = (data || []).map((item) => ({
      ...item,
      merchant: item.merchant || item.name || item.description || 'Unnamed transaction',
      amount: item.amount ?? item.value ?? 0,
      category: item.category || 'Uncategorized',
      type: item.type || 'expense',
      paymentMethod: item.paymentMethod || item.payment_method || 'Credit Card',
      status: item.status || 'Completed',
      date: item.date || item.transaction_date || '',
      receiptImage: item.receiptImage || item.receipt_image || null,
      logoText: item.logoText || (item.merchant ? item.merchant.charAt(0).toUpperCase() : 'T'),
      logoBg: item.logoBg || 'bg-emerald-600',
    }));

    setTransactions(normalizedTransactions);
    setLoading(false);
  }

  // Form Handlers
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!merchant || !amount || !date) return;

    setSaving(true);
    setErrorMessage('');

    try {
      const { error } = await addTransaction({
        merchant,
        amount: Number(amount),
        category,
        type,
        paymentMethod: method,
        status,
        date,
        receiptImage: receiptImage || null
      });

      if (error) {
        throw error;
      }

      await loadTransactions();
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to add transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (tx) => {
    setSelectedTx(tx);
    setMerchant(tx.merchant);
    setAmount(Math.abs(tx.amount).toString());
    setCategory(tx.category);
    setType(tx.type);
    setMethod(tx.paymentMethod);
    setStatus(tx.status);
    setDate(tx.date);
    setReceiptImage(tx.receiptImage || null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!merchant || !amount || !date) return;

    setSaving(true);
    setErrorMessage('');

    try {
      const { error } = await updateTransaction(selectedTx.id, {
        merchant,
        amount: Number(amount),
        category,
        type,
        paymentMethod: method,
        status,
        date,
        receiptImage
      });

      if (error) {
        throw error;
      }

      await loadTransactions();
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to update transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (tx) => {
    setSelectedTx(tx);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setSaving(true);
    setErrorMessage('');

    try {
      const { error } = await deleteTransaction(selectedTx.id);

      if (error) {
        throw error;
      }

      await loadTransactions();
      setIsDeleteOpen(false);
      setSelectedTx(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to delete transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptPreviewClick = (tx) => {
    setSelectedTx(tx);
    setIsReceiptOpen(true);
  };

  const resetForm = () => {
    setMerchant('');
    setAmount('');
    setCategory('Groceries');
    setType('expense');
    setMethod('Credit Card');
    setStatus('Completed');
    setDate('');
    setReceiptImage(null);
    setSelectedTx(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert the selected receipt image to a base64 data URL for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Ledger & Transactions</h1>
          <p className="text-sm text-slate-400 mt-1">Audit, edit, and organize all asset activities and bills.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setDate(new Date().toISOString().split('T')[0]);
            setIsAddOpen(true);
          }}
          className="self-start sm:self-auto"
          disabled={loading}
          loading={loading}
        >
          <Plus size={16} className="mr-1.5" /> Add Transaction
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="p-5 rounded-3xl bg-[#111827] border border-white/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search by merchant, description or tag..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white/5 border border-white/10 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-500 outline-none transition-all duration-200"
            />
          </div>

          <div>
            <Select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
            >
              <SelectItem value="all">All Categories</SelectItem>
              {categories.filter(c => c !== 'all').map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </Select>

            <Select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </Select>
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-[#111827] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="p-4 pl-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Merchant / Details</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Method</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="p-4 pr-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedTx.length > 0 ? (
                paginatedTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${tx.logoBg || 'bg-emerald-600'} text-white`}>
                          {tx.logoText || tx.merchant.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-none">{tx.merchant}</p>
                          <p className="text-[10px] text-slate-500 mt-1">ID: {tx.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium text-slate-300 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                        {tx.category}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-medium">
                      {tx.date}
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-semibold">
                      {tx.paymentMethod}
                    </td>
                    <td className="p-4">
                      <Badge variant={tx.status === 'Completed' ? 'success' : tx.status === 'Pending' ? 'warning' : 'danger'}>
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className={`text-sm font-extrabold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleReceiptPreviewClick(tx)}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Receipt Preview"
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          onClick={() => handleEditClick(tx)}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Edit Transaction"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(tx)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Transaction"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-8">
                    <EmptyState
                      title="No transactions match filters"
                      description="Try adjusting your filters, search term, or add a new transaction manually to reflect immediately."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        {filteredTx.length > 0 && (
          <div className="p-4 px-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing <span className="font-bold text-white">{Math.min(filteredTx.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
              <span className="font-bold text-white">{Math.min(filteredTx.length, currentPage * itemsPerPage)}</span> of{' '}
              <span className="font-bold text-white">{filteredTx.length}</span> transactions
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-xs text-slate-400 px-2">Page {currentPage} of {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 1. Modal: Add Transaction */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Transaction">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-slate-400'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${type === 'income' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'}`}
            >
              Income
            </button>
          </div>

          <Input
            label="Merchant / Source"
            placeholder="e.g. Starbucks, Figma, Github"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Amount (${settings.currency})`}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {type === 'income' ? (
                  <>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Groceries">Groceries</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Dining Out">Dining Out</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                  </>
                )}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <SelectItem value="Credit Card">Credit Card</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Apple Pay">Apple Pay</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm py-3 px-4 outline-none focus:border-[#10b981]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </Select>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Attach Receipt</label>
            <div className="flex items-center justify-center border border-dashed border-white/15 rounded-xl p-4 bg-white/[0.01]">
              <label className="flex flex-col items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white transition-colors">
                <UploadCloud size={24} />
                <span className="text-xs">{receiptImage ? 'Receipt Selected' : 'Upload invoice file (PNG/JPG)'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <Button type="submit" className="w-full justify-center" loading={saving} disabled={saving}>
            Save Transaction
          </Button>
        </form>
      </Modal>

      {/* 2. Modal: Edit Transaction */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modify Transaction">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-slate-400'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${type === 'income' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'}`}
            >
              Income
            </button>
          </div>

          <Input
            label="Merchant / Source"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {type === 'income' ? (
                  <>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Groceries">Groceries</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Dining Out">Dining Out</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                  </>
                )}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <SelectItem value="Credit Card">Credit Card</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Apple Pay">Apple Pay</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm py-3 px-4 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </Select>
          </div>

          <Button type="submit" className="w-full justify-center" loading={saving} disabled={saving}>
            Apply Changes
          </Button>
        </form>
      </Modal>

      {/* 3. Modal: Delete Transaction */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Deletion">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">Permanently delete transaction?</h4>
            <p className="text-xs text-slate-400">
              This action cannot be undone. It will remove the record of{' '}
              <span className="text-white font-bold">{selectedTx?.merchant}</span> costing{' '}
              <span className="text-white font-bold">{selectedTx && formatCurrency(selectedTx.amount)}</span>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={saving} disabled={saving}>
              Delete Records
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Modal: Receipt Preview */}
      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Digital Invoice Receipt">
        {selectedTx && (
          <div className="space-y-5 text-left bg-black/20 p-5 rounded-2xl border border-white/5 font-mono text-xs">
            <div className="text-center pb-4 border-b border-white/5 border-dashed space-y-1">
              <h2 className="text-lg font-black tracking-wider text-white">FINFLOW PLATFORM</h2>
              <p className="text-[10px] text-slate-500">TRANSACTION COMPLIANCE INVOICE</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">INVOICE ID:</span>
                <span className="text-white font-bold">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MERCHANT:</span>
                <span className="text-white font-bold">{selectedTx.merchant}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DATE:</span>
                <span className="text-white">{selectedTx.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CATEGORY:</span>
                <span className="text-white">{selectedTx.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PAYMENT TYPE:</span>
                <span className="text-white">{selectedTx.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">STATUS:</span>
                <span className={`font-bold ${selectedTx.status === 'Completed' ? 'text-emerald-400' : 'text-amber-400'}`}>{selectedTx.status}</span>
              </div>
            </div>

            <div className="border-t border-white/5 border-dashed pt-4 flex items-center justify-between text-base">
              <span className="text-slate-400 font-bold">TOTAL BILLED:</span>
              <span className="text-white font-black">{formatCurrency(selectedTx.amount)}</span>
            </div>

            {selectedTx.receiptImage ? (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] text-slate-500 mb-2 font-sans font-semibold">ATTACHMENT PREVIEW</p>
                <img src={selectedTx.receiptImage} alt="Receipt attachment" className="w-full rounded-lg max-h-48 object-cover border border-white/10" />
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-white/5 text-center text-[10px] text-slate-500 font-sans">
                No user physical receipt attached. Auto-generated by digital payment routing ledger.
              </div>
            )}

            <Button
              variant="secondary"
              className="w-full justify-center font-sans mt-2"
              onClick={() => window.print()}
            >
              <Download size={14} className="mr-1.5" /> Print Receipt
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
