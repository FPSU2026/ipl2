
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Filter, 
  Download, 
  X, 
  Save, 
  CreditCard, 
  Banknote, 
  Calendar, 
  Search, 
  Upload, 
  FileText, 
  Wallet, 
  History, 
  ArchiveRestore, 
  Edit, 
  Building2, 
  PieChart, 
  List, 
  ExternalLink, 
  Lock, 
  ChevronRight, 
  Loader2, 
  Trash2, 
  CalendarRange, 
  Printer 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { MONTHS } from '../constants';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Transactions: React.FC = () => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, bankAccounts, settings, addNotification, currentUser } = useApp();
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Filter States
  const [filterMode, setFilterMode] = useState<'MONTHLY' | 'RANGE'>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Date Range States (Default: Start of current month to today)
  const [dateRange, setDateRange] = useState({
      start: new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
  });

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false); 
  const [showBalanceDetailModal, setShowBalanceDetailModal] = useState(false);
  const [showSummaryDetailModal, setShowSummaryDetailModal] = useState(false);
  const [summaryDetailType, setSummaryDetailType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Added submitting state

  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'EXPENSE',
    category: '',
    amount: 0,
    paymentMethod: 'CASH',
    bankAccountId: ''
  });

  const [initialBalanceData, setInitialBalanceData] = useState({ cashAmount: 0 });
  const [editCount, setEditCount] = useState<number>(() => parseInt(localStorage.getItem('saldo_awal_edit_count') || '0'));
  const isSuperAdmin = currentUser?.id === '0';

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false); setShowImportModal(false); setShowInitialBalanceModal(false); setShowBalanceDetailModal(false); setShowSummaryDetailModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const jan2026CashTx = useMemo(() => {
      return transactions.find(t => {
          const d = new Date(t.date);
          return d.getFullYear() === 2026 && d.getMonth() === 0 && t.category === 'Saldo Awal' && t.paymentMethod === 'CASH';
      });
  }, [transactions]);

  // --- LOGIC SALDO AWAL DINAMIS ---
  const beginningBalance = useMemo(() => {
    const cashBase = jan2026CashTx ? jan2026CashTx.amount : 0;
    const bankBase = bankAccounts.reduce((acc, bank) => acc + bank.balance, 0);
    const systemStartBalance = cashBase + bankBase;

    // Determine Cutoff Date based on Filter Mode
    let cutoffDateStr: string;
    
    if (filterMode === 'MONTHLY') {
        // Cutoff is 1st day of selected month
        const m = selectedMonth.toString().padStart(2, '0');
        cutoffDateStr = `${selectedYear}-${m}-01`;
        
        if (selectedMonth === 1 && selectedYear === 2026) return systemStartBalance;
    } else {
        // Cutoff is user selected start date
        cutoffDateStr = dateRange.start;
    }

    const systemStartDateStr = '2026-01-01';

    // Calculate sum of transactions BEFORE the cutoff date
    const previousTransactions = transactions.filter(t => {
      return t.date >= systemStartDateStr && t.date < cutoffDateStr && t.category !== 'Saldo Awal';
    });

    const prevIncome = previousTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const prevExpense = previousTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    
    return systemStartBalance + prevIncome - prevExpense;
  }, [transactions, filterMode, selectedMonth, selectedYear, dateRange.start, jan2026CashTx, bankAccounts]);

  // --- LOGIC RINCIAN SALDO AWAL (Cash vs Bank) ---
  const balanceBreakdown = useMemo(() => {
      let cash = jan2026CashTx ? jan2026CashTx.amount : 0;
      const bankDetails: Record<string, number> = {};
      
      const initialCashBase = jan2026CashTx ? jan2026CashTx.amount : 0;
      let calculatedCash = initialCashBase;
      
      let cutoffDateStr: string;
      if (filterMode === 'MONTHLY') {
          const m = selectedMonth.toString().padStart(2, '0');
          cutoffDateStr = `${selectedYear}-${m}-01`;
      } else {
          cutoffDateStr = dateRange.start;
      }
      
      const systemStartDateStr = '2026-01-01';
      
      const previousTransactions = transactions.filter(t => {
          return t.date >= systemStartDateStr && t.date < cutoffDateStr && t.category !== 'Saldo Awal';
      });

      previousTransactions.forEach(t => {
          const factor = t.type === 'INCOME' ? 1 : -1;
          if (t.paymentMethod === 'CASH') {
              calculatedCash += (t.amount * factor);
          }
      });
      
      bankAccounts.forEach(acc => { bankDetails[acc.id] = acc.balance; });

      return { cash: calculatedCash, bankDetails };
  }, [transactions, filterMode, selectedMonth, selectedYear, dateRange.start, jan2026CashTx, bankAccounts]);

  const periodTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.category === 'Saldo Awal') return false;
      
      if (filterMode === 'MONTHLY') {
          const date = new Date(t.date);
          return (date.getMonth() + 1) === selectedMonth && date.getFullYear() === selectedYear;
      } else {
          return t.date >= dateRange.start && t.date <= dateRange.end;
      }
    });
  }, [transactions, filterMode, selectedMonth, selectedYear, dateRange]);

  const totalIncome = periodTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = periodTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
  const endingBalance = beginningBalance + totalIncome - totalExpense;

  const displayedTransactions = useMemo(() => {
    return periodTransactions.filter(t => {
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.amount.toString().includes(searchQuery);
      return matchesType && matchesSearch;
    });
  }, [periodTransactions, typeFilter, searchQuery]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        let successCount = 0;
        for (const row of jsonData) {
            if (row.TANGGAL && row.JUMLAH) {
                let dateRaw = row.TANGGAL;
                if (typeof dateRaw === 'number') dateRaw = new Date(Math.round((dateRaw - 25569)*86400*1000)).toISOString().split('T')[0];
                const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                if (!isNaN(amount) && amount > 0) {
                    await addTransaction({ id: `tx-imp-${Date.now()}-${Math.random()}`, date: dateRaw, type: String(row.TIPE).toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE', category: row.KATEGORI || 'Umum', description: row.KETERANGAN || 'Import Data', amount, paymentMethod: String(row.METODE).trim().toUpperCase() === 'TRANSFER' ? 'TRANSFER' : 'CASH', bankAccountId: '' });
                    successCount++;
                }
            }
        }
        addNotification(`${successCount} Transaksi diimpor.`, "success"); setShowImportModal(false);
      } catch (error) { addNotification("Gagal impor file.", "error"); } finally { setIsImporting(false); if (importFileRef.current) importFileRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
      const data = [
          { TANGGAL: '2025-01-01', TIPE: 'EXPENSE', KATEGORI: 'Operasional', JUMLAH: 100000, KETERANGAN: 'Beli ATK', METODE: 'CASH' },
          { TANGGAL: '2025-01-02', TIPE: 'INCOME', KATEGORI: 'Donasi', JUMLAH: 500000, KETERANGAN: 'Sumbangan Warga', METODE: 'TRANSFER' }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "template_transaksi.xlsx");
  };

  // --- PDF GENERATION LOGIC ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const periodText = filterMode === 'MONTHLY' 
        ? `${MONTHS[selectedMonth-1]} ${selectedYear}`
        : `${new Date(dateRange.start).toLocaleDateString('id-ID')} s/d ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
    
    // Filter only Expenses for the report based on current period view
    const expenseData = periodTransactions.filter(t => t.type === 'EXPENSE').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const totalExpenseAmount = expenseData.reduce((sum, item) => sum + item.amount, 0);

    // Meta Data
    // Print Date format: dd-mm-yyyy
    const now = new Date();
    const printDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const branchName = settings.location_name;

    // Header Section
    doc.setFontSize(8);
    doc.text(new Date().toLocaleString('en-US'), 10, 10);
    doc.text(`Laporan Rekap Pengeluaran Kas - ${branchName}`, 200, 10, { align: 'right' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("REKAP PENGELUARAN KAS/BANK HARIAN", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal   :   ${printDate}`, 14, 30);
    doc.text(`Kantor    :   ${branchName}`, 14, 35);

    // Table Data Preparation
    const tableBody: any[] = expenseData.map((item, index) => [
        index + 1,
        `${item.description} (${item.category}) - ${new Date(item.date).toLocaleDateString('id-ID')}`,
        `Rp ${item.amount.toLocaleString('id-ID')}`
    ]);

    // Add Total Row
    tableBody.push([
        '', 
        { content: 'Total', styles: { fontStyle: 'bold', halign: 'right' } }, 
        { content: `Rp ${totalExpenseAmount.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold' } }
    ]);

    // Generate Table
    autoTable(doc, {
        startY: 40,
        head: [['No.', 'Keterangan', 'Jumlah']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            fontStyle: 'bold'
        },
        bodyStyles: {
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 2
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { halign: 'left' },
            2: { cellWidth: 40, halign: 'right' }
        }
    });

    // Signatures Section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check if we need a new page for signatures
    if (finalY > 250) {
        doc.addPage();
        // Reset Y for new page
    }

    const yPos = finalY > 250 ? 20 : finalY;

    // Draw Signature Boxes
    const pageWidth = doc.internal.pageSize.width;
    const boxWidth = 50;
    const boxHeight = 35;
    const marginX = (pageWidth - (boxWidth * 3)) / 4; // Space between boxes

    const x1 = marginX;
    const x2 = marginX * 2 + boxWidth;
    const x3 = marginX * 3 + boxWidth * 2;

    doc.setLineWidth(0.1);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Box 1: Membuat
    doc.rect(x1, yPos, boxWidth, boxHeight);
    doc.text("Membuat", x1 + boxWidth/2, yPos + 6, { align: 'center' });
    doc.text("Admin", x1 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' }); // Generic role

    // Box 2: Mengetahui
    doc.rect(x2, yPos, boxWidth, boxHeight);
    doc.text("Mengetahui", x2 + boxWidth/2, yPos + 6, { align: 'center' });
    doc.text("Ketua RT / Koordinator", x2 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' });

    // Box 3: Memverifikasi
    doc.rect(x3, yPos, boxWidth, boxHeight);
    doc.text("Memverifikasi", x3 + boxWidth/2, yPos + 6, { align: 'center' });
    doc.text("Bendahara", x3 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' });

    doc.save(`Rekap_Pengeluaran_${periodText.replace(/ /g, '_')}.pdf`);
  };

  const handleOpenModal = (type: 'INCOME' | 'EXPENSE') => {
    setEditingTransactionId(null);
    const defaultDate = filterMode === 'MONTHLY' 
        ? new Date(selectedYear, selectedMonth - 1, new Date().getDate()).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
        
    setFormData({ date: defaultDate, description: '', type: type, category: '', amount: 0, paymentMethod: 'CASH', bankAccountId: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
      setEditingTransactionId(tx.id);
      setFormData({ date: tx.date, description: tx.description, type: tx.type, category: tx.category, amount: tx.amount, paymentMethod: tx.paymentMethod, bankAccountId: tx.bankAccountId || '' });
      setShowModal(true);
  };

  const handleInitialBalanceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (jan2026CashTx) await deleteTransaction(jan2026CashTx.id);
      if (initialBalanceData.cashAmount > 0) await addTransaction({ id: `init-cash-${Date.now()}`, date: '2026-01-01', description: 'Saldo Awal Per 1 Januari 2026 (Tunai)', type: 'INCOME', category: 'Saldo Awal', amount: Number(initialBalanceData.cashAmount), paymentMethod: 'CASH' });
      if (!isSuperAdmin) { const newCount = editCount + 1; setEditCount(newCount); localStorage.setItem('saldo_awal_edit_count', newCount.toString()); }
      addNotification("Saldo Awal disimpan.", "success"); setShowInitialBalanceModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) { addNotification("Lengkapi data.", "warning"); return; }

    // --- DUPLICATE CHECK LOGIC ---
    // Only check if it's a NEW transaction (not editing)
    if (!editingTransactionId) {
        const isDuplicate = transactions.some(t => 
            t.date === formData.date &&
            t.amount === Number(formData.amount) &&
            t.type === formData.type &&
            t.category === formData.category &&
            t.description.trim().toLowerCase() === formData.description?.trim().toLowerCase()
        );

        if (isDuplicate) {
            addNotification("Transaksi duplikat terdeteksi! Data sama persis sudah ada.", "error");
            return;
        }
    }
    // -----------------------------

    setIsSubmitting(true);
    try {
        const txData: Transaction = {
            id: editingTransactionId || `tx-${Date.now()}`,
            date: formData.date!,
            description: formData.description!,
            type: formData.type as 'INCOME' | 'EXPENSE',
            category: formData.category || 'Umum',
            amount: Number(formData.amount),
            paymentMethod: formData.paymentMethod as 'CASH' | 'TRANSFER',
            bankAccountId: formData.bankAccountId
        };
        if (editingTransactionId) await updateTransaction(txData);
        else await addTransaction(txData);
        setShowModal(false);
    } catch (error) {
        addNotification("Gagal menyimpan transaksi.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => { 
      if(window.confirm("Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.")) {
          await deleteTransaction(id);
      }
  };

  const summaryBreakdown = useMemo(() => {
      const groups: Record<string, number> = {};
      periodTransactions.filter(t => t.type === summaryDetailType).forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });
      return Object.entries(groups).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, summaryDetailType]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Buku Kas Harian</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pencatatan Pemasukan & Pengeluaran Operasional</p>
        </div>
        
        {/* FILTER SECTION */}
        <div className="flex flex-col lg:flex-row gap-4">
            
            {/* Mode Toggle */}
            <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm self-start lg:self-auto">
                <button 
                    onClick={() => setFilterMode('MONTHLY')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterMode === 'MONTHLY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Calendar size={14} /> Bulanan
                </button>
                <button 
                    onClick={() => setFilterMode('RANGE')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterMode === 'RANGE' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <CalendarRange size={14} /> Periode
                </button>
            </div>

            {/* Conditional Inputs */}
            {filterMode === 'MONTHLY' ? (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-2 self-start lg:self-auto">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent px-2 py-2 outline-none text-sm font-black text-slate-700 cursor-pointer">
                        {MONTHS.map((m, i) => {
                            const isFuture = selectedYear === currentYear && (i + 1) > currentMonth;
                            return <option key={i} value={i+1} disabled={isFuture}>{m}</option>;
                        })}
                    </select>
                    <div className="w-[1px] h-6 bg-slate-200"></div>
                    <span className="bg-transparent px-3 py-2 text-sm font-black text-slate-700">{selectedYear}</span>
                </div>
            ) : (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 self-start lg:self-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Dari</span>
                        <input 
                            type="date" 
                            value={dateRange.start} 
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                            className="bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 outline-none border border-slate-200"
                        />
                    </div>
                    <div className="hidden sm:block w-[1px] h-6 bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Sampai</span>
                        <input 
                            type="date" 
                            value={dateRange.end} 
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                            className="bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 outline-none border border-slate-200"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center space-x-2 self-start lg:self-auto">
                <button onClick={() => setShowImportModal(true)} className="bg-slate-800 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest" title="Impor Data"><Upload size={16} /></button>
                
                {/* NEW PDF EXPORT BUTTON */}
                <button 
                    onClick={handleExportPDF} 
                    className="bg-rose-50 text-rose-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border border-rose-100 hover:bg-rose-100 transition-colors"
                    title="Ekspor PDF Rekap Pengeluaran"
                >
                    <Printer size={16} /> <span className="hidden sm:inline">PDF</span>
                </button>

                {filterMode === 'MONTHLY' && selectedMonth === 1 && selectedYear === 2026 && (isSuperAdmin || editCount < 2) && (
                    <button onClick={() => { setInitialBalanceData({ cashAmount: jan2026CashTx?.amount || 0 }); setShowInitialBalanceModal(true); }} className="bg-indigo-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                        {jan2026CashTx ? <Edit size={16} /> : <ArchiveRestore size={16} />}
                    </button>
                )}
                <button onClick={() => handleOpenModal('EXPENSE')} className="bg-red-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Plus size={16} /> Keluar</button>
                <button onClick={() => handleOpenModal('INCOME')} className="bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Plus size={16} /> Masuk</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div onClick={() => setShowBalanceDetailModal(true)} className="card p-5 border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all group">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><History size={12} /> Saldo Awal</p></div>
          <div className="mt-4">
              <p className="text-2xl font-black text-indigo-600">Rp {beginningBalance.toLocaleString('id-ID')}</p>
              <p className="text-[9px] font-bold text-indigo-400 mt-1">
                  Per {filterMode === 'MONTHLY' ? `1 ${MONTHS[selectedMonth-1]}` : new Date(dateRange.start).toLocaleDateString('id-ID')}
              </p>
          </div>
        </div>
        <div onClick={() => { setSummaryDetailType('INCOME'); setShowSummaryDetailModal(true); }} className="card p-5 border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowUpRight size={12} /> TOTAL MASUK</p></div>
          <div className="mt-4"><p className="text-2xl font-black text-emerald-600">+ Rp {totalIncome.toLocaleString('id-ID')}</p></div>
        </div>
        <div onClick={() => { setSummaryDetailType('EXPENSE'); setShowSummaryDetailModal(true); }} className="card p-5 border border-red-100 bg-red-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowDownLeft size={12} /> TOTAL KELUAR</p></div>
          <div className="mt-4"><p className="text-2xl font-black text-rose-600">- Rp {totalExpense.toLocaleString('id-ID')}</p></div>
        </div>
        <div className="card p-5 bg-slate-900 text-white shadow-xl border-none relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10"><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Wallet size={12} /> Saldo Akhir</p></div>
          <div className="relative z-10 mt-4">
              <p className="text-2xl font-black tracking-tight">Rp {endingBalance.toLocaleString('id-ID')}</p>
              <p className="text-[9px] font-bold text-slate-500 mt-1">Termasuk Bank</p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4"><Banknote size={100} /></div>
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
                <button onClick={() => setTypeFilter('ALL')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Semua</button>
                <button onClick={() => setTypeFilter('INCOME')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'INCOME' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Pemasukan</button>
                <button onClick={() => setTypeFilter('EXPENSE')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'EXPENSE' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>Pengeluaran</button>
            </div>
            <div className="relative w-full md:w-64"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none" /></div>
        </div>

        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20">
              <tr>
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5">Keterangan</th>
                <th className="px-8 py-5">Kategori</th>
                <th className="px-8 py-5">Metode</th>
                <th className="px-8 py-5 text-right">Jumlah</th>
                <th className="px-8 py-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.length > 0 ? displayedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5"><span className="text-xs font-black text-slate-600">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</span></td>
                    <td className="px-8 py-5"><div className="font-bold text-slate-700 text-sm">{t.description}</div></td>
                    <td className="px-8 py-5"><span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.category}</span></td>
                    <td className="px-8 py-5">{t.paymentMethod === 'TRANSFER' ? <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Transfer</span> : <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Tunai</span>}</td>
                    <td className={`px-8 py-5 text-right font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'INCOME' ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}</td>
                    <td className="px-8 py-5">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenEditModal(t)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Ubah"><Edit size={14} /></button>
                            <button onClick={() => handleDelete(t.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all" title="Hapus"><Trash2 size={14} /></button>
                        </div>
                    </td>
                  </tr>
                )) : (<tr><td colSpan={6} className="px-8 py-32 text-center text-slate-400 font-bold uppercase tracking-widest">Tidak ada transaksi ditemukan</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modals (Balance & Summary) are reused from previous logic */}
      {showBalanceDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                      <div><h3 className="font-black text-indigo-900 text-lg">Rincian Saldo Awal</h3></div>
                      <button onClick={() => setShowBalanceDetailModal(false)} className="p-2 hover:bg-indigo-100 rounded-full text-indigo-400"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-600">Tunai / Cash</span>
                          <span className="font-black text-slate-800">Rp {balanceBreakdown.cash.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rekening Bank (Posisi Saat Ini)</p>
                          {bankAccounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                                  <span className="text-xs font-bold text-slate-700">{acc.bankName}</span>
                                  <span className="font-black text-slate-800">Rp {(balanceBreakdown.bankDetails[acc.id] || 0).toLocaleString('id-ID')}</span>
                              </div>
                          ))}
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total</span>
                          <span className="text-lg font-black text-indigo-600">Rp {beginningBalance.toLocaleString('id-ID')}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showSummaryDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${summaryDetailType === 'INCOME' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <h3 className="font-black text-lg text-slate-800">Rincian Kategori</h3>
                      <button onClick={() => setShowSummaryDetailModal(false)} className="p-2 rounded-full hover:bg-white/50 text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-3">
                      {summaryBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                              <span className="text-xs font-bold text-slate-600">{item.name}</span>
                              <span className={`font-black ${summaryDetailType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {item.amount.toLocaleString('id-ID')}</span>
                          </div>
                      ))}
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total</span>
                      <span className={`text-lg font-black ${summaryDetailType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {(summaryDetailType === 'INCOME' ? totalIncome : totalExpense).toLocaleString('id-ID')}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Main Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-black text-slate-800 text-lg">{editingTransactionId ? 'Ubah Transaksi' : `Input ${formData.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}`}</h3>
                 <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tanggal</label><input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keterangan</label><input type="text" required placeholder="Tulis rincian..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori</label><select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value="">-- Pilih Kategori --</option>{(settings.transactionCategories || []).filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="Umum">Umum / Lain-lain</option></select></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label><input type="number" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-800 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metode Pembayaran</label><div className="flex gap-3"><button type="button" onClick={() => setFormData({...formData, paymentMethod: 'CASH', bankAccountId: ''})} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>Tunai</button><button type="button" onClick={() => setFormData({...formData, paymentMethod: 'TRANSFER'})} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>Transfer</button></div></div>
                 {formData.paymentMethod === 'TRANSFER' && (<div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih Bank</label><select required value={formData.bankAccountId} onChange={(e) => setFormData({...formData, bankAccountId: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold outline-none"><option value="">-- Pilih Rekening --</option>{bankAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>))}</select></div>)}
                 <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {editingTransactionId ? 'Simpan Perubahan' : 'Simpan Baru'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Saldo Awal & Import Modals follow same pattern... */}
      {showInitialBalanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                 <h3 className="font-black text-indigo-900 text-lg">Input Saldo Cash Awal</h3>
                 <button onClick={() => setShowInitialBalanceModal(false)} className="p-2 text-indigo-400 rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleInitialBalanceSubmit} className="p-8 space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo Tunai Per 1 Jan 2026</label>
                    <input type="number" required value={initialBalanceData.cashAmount} onChange={(e) => setInitialBalanceData({ cashAmount: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-700 outline-none" />
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Simpan Saldo Awal</button>
              </form>
           </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <FileText size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Import Transaksi</h3>
                <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
                    Gunakan template Excel (.xlsx). Pastikan format kolom sesuai (TANGGAL, TIPE, JUMLAH, dll).
                </p>
                
                <input 
                    type="file"
                    ref={importFileRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                />
                
                <div className="space-y-3">
                    <button 
                        onClick={() => importFileRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>Pilih File Excel</span>
                    </button>
                    <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <Download size={14} /> Download Template
                    </button>
                    <button 
                        onClick={() => setShowImportModal(false)}
                        className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
