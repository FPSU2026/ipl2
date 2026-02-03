
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Briefcase, 
  ArrowRight, 
  PieChart, 
  CalendarX, 
  Wallet, 
  Repeat, 
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { MONTHS } from '../constants';

const BalanceSheet: React.FC = () => {
  const { transactions, bills, settings, bankAccounts, bankMutations } = useApp();

  // LOCK STATE TO CURRENT DATE
  const currentRealMonth = new Date().getMonth() + 1;
  const currentRealYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentRealMonth);
  const [selectedYear, setSelectedYear] = useState(currentRealYear);

  // --- LOGIC 1: HITUNG SALDO AWAL (FORWARD WINDING FROM SYSTEM START JAN 2026) ---
  const beginningBalance = useMemo(() => {
    // A. Point Zero: Saldo Awal Manual Jan 2026 (Cash)
    const jan2026CashTx = transactions.find(t => {
        const d = new Date(t.date);
        return d.getFullYear() === 2026 && 
               d.getMonth() === 0 && 
               t.category === 'Saldo Awal' &&
               t.paymentMethod === 'CASH';
    });
    const systemStartCash = jan2026CashTx ? jan2026CashTx.amount : 0;

    // B. Point Zero: Saldo Bank Awal (Rewound from current live balance to target period start)
    const getBankStartBalanceForMonth = (accountId: string, currentBalance: number) => {
        const startOfPeriod = new Date(selectedYear, selectedMonth - 1, 1);
        
        const futureTx = transactions.filter(t => 
            t.bankAccountId === accountId && 
            new Date(t.date) >= startOfPeriod &&
            t.paymentMethod === 'TRANSFER' &&
            t.category !== 'Saldo Awal'
        );
        const txInc = futureTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
        const txExp = futureTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);

        const futureMut = bankMutations.filter(m => 
            m.accountId === accountId &&
            new Date(m.date) >= startOfPeriod
        );
        const mutDebit = futureMut.filter(m => m.type === 'DEBIT').reduce((s,m) => s + m.amount, 0);
        const mutCredit = futureMut.filter(m => m.type === 'KREDIT').reduce((s,m) => s + m.amount, 0);

        return currentBalance - (txInc + mutDebit) + (txExp + mutCredit);
    };

    let startBankTotal = 0;
    bankAccounts.forEach(acc => {
        startBankTotal += getBankStartBalanceForMonth(acc.id, acc.balance);
    });

    // C. Forward wind PREVIOUS CASH transactions from Jan 2026 up to start of Selected Period
    const startOfPeriod = new Date(selectedYear, selectedMonth - 1, 1);
    const systemStartDate = new Date(2026, 0, 1);

    const previousCashTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= systemStartDate && tDate < startOfPeriod && t.category !== 'Saldo Awal' && t.paymentMethod === 'CASH';
    });

    const prevCashIncome = previousCashTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + t.amount, 0);

    const prevCashExpense = previousCashTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => acc + t.amount, 0);

    const startCashPosition = systemStartCash + prevCashIncome - prevCashExpense;

    return Math.max(0, startCashPosition + startBankTotal);
  }, [transactions, selectedMonth, selectedYear, bankAccounts, bankMutations]);


  // --- LOGIC 2: FILTER TRANSAKSI BULAN BERJALAN ---
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      const isSamePeriod = (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
      return isSamePeriod && t.category !== 'Saldo Awal';
    });
  }, [transactions, selectedMonth, selectedYear]);


  // --- LOGIC 3: HITUNG RUGI LABA BULAN INI ---
  const incomeTransactions = currentMonthTransactions.filter(t => t.type === 'INCOME');
  const expenseTransactions = currentMonthTransactions.filter(t => t.type === 'EXPENSE');

  const totalRevenue = incomeTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  const incomeByCategory = useMemo(() => {
    const groups: Record<string, number> = {};
    incomeTransactions.forEach(t => {
        groups[t.category] = (groups[t.category] || 0) + t.amount;
    });
    return Object.entries(groups).map(([name, amount]) => ({ name, amount }));
  }, [incomeTransactions]);

  const expenses = useMemo(() => {
    const rutinGroups: Record<string, number> = {};
    const nonRutinGroups: Record<string, number> = {};
    let totalRutin = 0;
    let totalNonRutin = 0;

    expenseTransactions.forEach(t => {
        const catDef = settings.transactionCategories.find(c => c.name === t.category && c.type === 'EXPENSE');
        const isRutin = catDef?.expenseType === 'RUTIN';

        if (isRutin) {
            rutinGroups[t.category] = (rutinGroups[t.category] || 0) + t.amount;
            totalRutin += t.amount;
        } else {
            nonRutinGroups[t.category] = (nonRutinGroups[t.category] || 0) + t.amount;
            totalNonRutin += t.amount;
        }
    });

    return {
        rutin: Object.entries(rutinGroups).map(([name, amount]) => ({ name, amount })),
        nonRutin: Object.entries(nonRutinGroups).map(([name, amount]) => ({ name, amount })),
        totalRutin,
        totalNonRutin
    };
  }, [expenseTransactions, settings.transactionCategories]);


  // --- LOGIC 4: NERACA (BALANCE SHEET) ---
  const currentCashPosition = beginningBalance + netProfit;
  
  const accountsReceivable = useMemo(() => {
      const unpaidBills = bills.filter(b => b.status === 'UNPAID');
      const validUnpaidBills = unpaidBills.filter(b => {
          if (b.period_year < selectedYear) return true; 
          if (b.period_year === selectedYear && b.period_month <= selectedMonth) return true; 
          return false; 
      });
      return validUnpaidBills.reduce((acc, curr) => acc + (curr.total - (curr.paid_amount || 0)), 0);
  }, [bills, selectedMonth, selectedYear]);

  const totalAssets = currentCashPosition + accountsReceivable;

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Laporan Keuangan</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rugi Laba & Neraca Saldo</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
           <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
               <Calendar size={16} />
           </div>
           <select 
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
             className="bg-transparent px-3 py-2 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
           >
             {MONTHS.map((m, i) => {
                 const monthIndex = i + 1;
                 const isFuture = selectedYear === currentRealYear && monthIndex > currentRealMonth;
                 return (
                    <option key={i} value={monthIndex} disabled={isFuture}>
                        {m} {isFuture ? '(Locked)' : ''}
                    </option>
                 );
             })}
           </select>
           <div className="w-[1px] h-6 bg-slate-200"></div>
           <select 
             value={selectedYear}
             onChange={(e) => setSelectedYear(parseInt(e.target.value))}
             className="bg-transparent px-3 py-2 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
           >
             <option value={currentRealYear}>{currentRealYear}</option>
             <option value={currentRealYear - 1}>{currentRealYear - 1}</option>
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">LAPORAN TRANSAKSI</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode: {MONTHS[selectedMonth-1]} {selectedYear}</p>
                    </div>
                </div>

                <div className="card border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                        <h4 className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center">
                            <ArrowRight size={14} className="mr-2" /> PEMASUKAN OPERASIONAL
                        </h4>
                        <div className="space-y-3">
                            {incomeByCategory.length > 0 ? incomeByCategory.map((inc, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-600">{inc.name}</span>
                                    <span className="font-black text-slate-800">{formatCurrency(inc.amount)}</span>
                                </div>
                            )) : (
                                <div className="text-xs text-slate-400 italic">Tidak ada pemasukan operasional</div>
                            )}
                            
                            <div className="border-t border-slate-200 pt-3 flex justify-between text-sm bg-emerald-50/50 -mx-6 px-6 py-3 mt-2">
                                <span className="font-black text-emerald-700 uppercase tracking-widest">Total Pemasukan</span>
                                <span className="font-black text-emerald-700">{formatCurrency(totalRevenue)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white">
                        <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center">
                            <ArrowRight size={14} className="mr-2" /> PENGELUARAN
                        </h4>
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                <Repeat size={10} className="mr-1" /> Rutin
                            </p>
                            <div className="space-y-2 pl-3 border-l-2 border-indigo-100">
                                {expenses.rutin.length > 0 ? expenses.rutin.map((exp, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-600">{exp.name}</span>
                                        <span className="font-black text-slate-800">{formatCurrency(exp.amount)}</span>
                                    </div>
                                )) : <div className="text-xs text-slate-300 italic">Belum ada data</div>}
                                <div className="flex justify-between text-xs font-bold text-indigo-600 pt-1">
                                    <span>Subtotal Rutin</span>
                                    <span>{formatCurrency(expenses.totalRutin)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mb-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                <AlertTriangle size={10} className="mr-1" /> Non Rutin
                            </p>
                            <div className="space-y-2 pl-3 border-l-2 border-orange-100">
                                {expenses.nonRutin.length > 0 ? expenses.nonRutin.map((exp, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-600">{exp.name}</span>
                                        <span className="font-black text-slate-800">{formatCurrency(exp.amount)}</span>
                                    </div>
                                )) : <div className="text-xs text-slate-300 italic">Belum ada data</div>}
                                <div className="flex justify-between text-xs font-bold text-orange-600 pt-1">
                                    <span>Subtotal Non Rutin</span>
                                    <span>{formatCurrency(expenses.totalNonRutin)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 pt-3 flex justify-between text-sm bg-rose-50/50 -mx-6 px-6 py-3 mt-4">
                            <span className="font-black text-rose-700 uppercase tracking-widest">Total Pengeluaran</span>
                            <span className="font-black text-rose-700">{formatCurrency(totalExpense)}</span>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">SURPLUS / DEFISIT</p>
                            <h3 className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {netProfit >= 0 ? '+' : ''} {formatCurrency(netProfit)}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Scale size={20} />
                    </div>
                    <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Neraca (Balance Sheet)</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Posisi Akhir Bulan {MONTHS[selectedMonth-1]}</p>
                    </div>
                </div>

                <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6">
                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center">
                            <Briefcase size={14} className="mr-2" /> Aset (Aktiva)
                        </h4>
                        <div className="space-y-3 pl-2 border-l-2 border-indigo-100 ml-1">
                            <div className="flex justify-between text-sm bg-indigo-50/50 p-2 rounded-lg">
                                <span className="font-bold text-slate-500 flex items-center gap-2">
                                    <Wallet size={14} /> Saldo Awal (Ground Base)
                                </span>
                                <span className="font-black text-slate-700">{formatCurrency(beginningBalance)}</span>
                            </div>
                            <div className="flex justify-between text-sm pl-2 pt-2">
                                <span className="font-bold text-slate-600">Arus Kas Bersih (Bulan Ini)</span>
                                <span className={`font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-4">
                                <span className="font-bold text-slate-600">Piutang Warga</span>
                                <span className="font-black text-slate-800">{formatCurrency(accountsReceivable)}</span>
                            </div>
                        </div>
                        <div className="mt-6 p-4 bg-indigo-50 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Total Aset</span>
                            <span className="text-lg font-black text-indigo-800">{formatCurrency(totalAssets)}</span>
                        </div>
                    </div>
                </div>
            </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
