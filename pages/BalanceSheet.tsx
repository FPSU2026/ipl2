
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Briefcase, 
  ArrowRight, 
  PieChart, 
  Wallet, 
  Repeat, 
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { MONTHS } from '../constants';

const BalanceSheet: React.FC = () => {
  const { transactions, bills, settings, bankAccounts } = useApp();

  const currentRealMonth = new Date().getMonth() + 1;
  const currentRealYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentRealMonth);
  const [selectedYear, setSelectedYear] = useState(currentRealYear);

  const beginningBalance = useMemo(() => {
    // STARTING POSITION: INITIAL CASH SETTING + INITIAL BANK BALANCES
    const cashBase = settings.cash_initial_balance || 0;
    
    // Total Bank initial balances (as they are in DB now)
    const currentBankTotal = bankAccounts.reduce((acc, bank) => acc + bank.balance, 0);
    
    // We need beginning balance for a selected period. 
    // Logic: Starting Bal = (Cash Base + Bank Start) + (Net Flow before selected month)
    
    const previousTransactions = transactions.filter(t => {
      const [y, m, d] = t.date.split('-').map(Number);
      const isPast = y < selectedYear || (y === selectedYear && m < selectedMonth);
      return isPast && t.category !== 'Saldo Awal';
    });

    const prevIncome = previousTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const prevExpense = previousTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

    // If transactions already update bank balance automatically, then currentBankTotal includes all Transfer transactions.
    // BUT we need the position at the BEGINNING of the period.
    // So we "rewind" bank position: Beginning Bank = Current - (Transfer Flows since Start of Period)
    
    let bankRewindFlow = 0;
    const futureTransferTx = transactions.filter(t => {
        if (t.paymentMethod !== 'TRANSFER') return false;
        const [y, m, d] = t.date.split('-').map(Number);
        return y > selectedYear || (y === selectedYear && m >= selectedMonth);
    });
    const fInc = futureTransferTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
    const fExp = futureTransferTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    bankRewindFlow = fInc - fExp;

    const startBank = currentBankTotal - bankRewindFlow;
    
    // Beginning Cash: Base + Cash Net Flow before period
    const pastCashFlow = previousTransactions.filter(t => t.paymentMethod === 'CASH');
    const pcInc = pastCashFlow.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
    const pcExp = pastCashFlow.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    const startCash = cashBase + pcInc - pcExp;

    return startCash + startBank;
  }, [transactions, selectedMonth, selectedYear, settings.cash_initial_balance, bankAccounts]);

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const [y, m, d] = t.date.split('-').map(Number);
      return m === selectedMonth && y === selectedYear && t.category !== 'Saldo Awal';
    });
  }, [transactions, selectedMonth, selectedYear]);

  const incomeTransactions = currentMonthTransactions.filter(t => t.type === 'INCOME');
  const expenseTransactions = currentMonthTransactions.filter(t => t.type === 'EXPENSE');
  const totalRevenue = incomeTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  const incomeByCategory = useMemo(() => {
    const groups: Record<string, number> = {};
    incomeTransactions.forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });
    return Object.entries(groups).map(([name, amount]) => ({ name, amount }));
  }, [incomeTransactions]);

  const expenses = useMemo(() => {
    const rutinGroups: Record<string, number> = {};
    const nonRutinGroups: Record<string, number> = {};
    let totalRutin = 0;
    let totalNonRutin = 0;
    expenseTransactions.forEach(t => {
        const catDef = settings.transactionCategories.find(c => c.name === t.category && c.type === 'EXPENSE');
        if (catDef?.expenseType === 'RUTIN') { rutinGroups[t.category] = (rutinGroups[t.category] || 0) + t.amount; totalRutin += t.amount; }
        else { nonRutinGroups[t.category] = (nonRutinGroups[t.category] || 0) + t.amount; totalNonRutin += t.amount; }
    });
    return { rutin: Object.entries(rutinGroups).map(([name, amount]) => ({ name, amount })), nonRutin: Object.entries(nonRutinGroups).map(([name, amount]) => ({ name, amount })), totalRutin, totalNonRutin };
  }, [expenseTransactions, settings.transactionCategories]);

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
  const balancedEquity = totalAssets; 
  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Neraca Keuangan</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Laporan Rugi Laba & Posisi Aset</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm"><div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><Calendar size={16} /></div><select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors">{MONTHS.map((m, i) => { const monthIndex = i + 1; const isFuture = selectedYear === currentRealYear && monthIndex > currentRealMonth; return (<option key={i} value={monthIndex} disabled={isFuture}>{m} {isFuture ? '(Locked)' : ''}</option>); })}</select><div className="w-[1px] h-6 bg-slate-200"></div><select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"><option value={currentRealYear}>{currentRealYear}</option><option value={currentRealYear - 1}>{currentRealYear - 1}</option></select></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            <div className="space-y-8">
                <div className="flex items-center space-x-4 mb-2"><div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingUp size={24} /></div><div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">LAPORAN ARUS KAS</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Periode: {MONTHS[selectedMonth-1]} {selectedYear}</p></div></div>
                <div className="card border border-slate-100 shadow-sm overflow-hidden rounded-[3rem]">
                    <div className="p-10 bg-slate-50/50 border-b border-slate-100"><h4 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] mb-6 flex items-center"><ArrowRight size={14} className="mr-2" /> PENERIMAAN OPERASIONAL</h4><div className="space-y-4">{incomeByCategory.length > 0 ? incomeByCategory.map((inc, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="font-bold text-slate-600">{inc.name}</span><span className="font-black text-slate-800">{formatCurrency(inc.amount)}</span></div>)) : (<div className="text-xs text-slate-400 italic">Tidak ada pemasukan</div>)}<div className="border-t border-slate-200 pt-4 flex justify-between text-sm bg-emerald-50/50 -mx-10 px-10 py-5 mt-4"><span className="font-black text-emerald-700 uppercase tracking-widest">Total Penerimaan</span><span className="font-black text-emerald-700">{formatCurrency(totalRevenue)}</span></div></div></div>
                    <div className="p-10 bg-white"><h4 className="text-xs font-black text-rose-600 uppercase tracking-[0.2em] mb-6 flex items-center"><ArrowRight size={14} className="mr-2" /> PENGELUARAN BIAYA</h4><div className="mb-8"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center"><Repeat size={10} className="mr-1" /> Biaya Rutin</p><div className="space-y-3 pl-4 border-l-2 border-indigo-100">{expenses.rutin.length > 0 ? expenses.rutin.map((exp, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="font-bold text-slate-600">{exp.name}</span><span className="font-black text-slate-800">{formatCurrency(exp.amount)}</span></div>)) : <div className="text-xs text-slate-300 italic">Belum ada biaya rutin</div>}<div className="flex justify-between text-xs font-black text-indigo-600 pt-2 border-t border-indigo-50 border-dashed"><span>Subtotal Rutin</span><span>{formatCurrency(expenses.totalRutin)}</span></div></div></div><div className="mb-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center"><AlertTriangle size={10} className="mr-1" /> Biaya Non-Rutin</p><div className="space-y-3 pl-4 border-l-2 border-orange-100">{expenses.nonRutin.length > 0 ? expenses.nonRutin.map((exp, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="font-bold text-slate-600">{exp.name}</span><span className="font-black text-slate-800">{formatCurrency(exp.amount)}</span></div>)) : <div className="text-xs text-slate-300 italic">Belum ada biaya non-rutin</div>}<div className="flex justify-between text-xs font-black text-orange-600 pt-2 border-t border-orange-50 border-dashed"><span>Subtotal Non-Rutin</span><span>{formatCurrency(expenses.totalNonRutin)}</span></div></div></div><div className="border-t border-slate-200 pt-4 flex justify-between text-sm bg-rose-50/50 -mx-10 px-10 py-5 mt-6"><span className="font-black text-rose-700 uppercase tracking-widest">Total Pengeluaran</span><span className="font-black text-rose-700">{formatCurrency(totalExpense)}</span></div></div>
                    <div className="p-10 bg-slate-900 text-white flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10"><Scale size={100} /></div>
                        <div className="relative z-10"><p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-2">SURPLUS / DEFISIT PERIODE</p><h3 className={`text-4xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{netProfit >= 0 ? '+' : ''} {formatCurrency(netProfit)}</h3></div><div className={`p-4 rounded-3xl relative z-10 ${netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{netProfit >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}</div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <div className="flex items-center space-x-4 mb-2"><div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Scale size={24} /></div><div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">NERACA SALDO AKHIR</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Posisi Keuangan s/d Akhir {MONTHS[selectedMonth-1]}</p></div></div>
                <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full rounded-[3rem]">
                    <div className="p-10"><h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center"><Briefcase size={14} className="mr-2" /> AKTIVA (Daftar Aset)</h4><div className="space-y-4 pl-4 border-l-2 border-indigo-100 ml-1"><div className="flex justify-between text-sm bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50"><span className="font-bold text-slate-600 flex items-center gap-2"><Wallet size={16} /> Saldo Awal Kumulatif</span><span className="font-black text-slate-800">{formatCurrency(beginningBalance)}</span></div><div className="flex justify-between text-sm px-2"><span className="font-bold text-slate-500">Perubahan Saldo (Surplus/Defisit)</span><span className={`font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</span></div><div className="border-t border-dashed border-slate-200 my-4"></div><div className="flex justify-between text-sm px-2"><span className="font-black text-slate-800">Total Kas & Bank Akhir</span><span className="font-black text-slate-800">{formatCurrency(currentCashPosition)}</span></div><div className="flex justify-between text-sm px-2 mt-4"><span className="font-bold text-slate-500">Piutang Warga (Tagihan Belum Lunas)</span><span className="font-black text-slate-800">{formatCurrency(accountsReceivable)}</span></div></div><div className="mt-8 p-6 bg-indigo-600 text-white rounded-[2rem] flex justify-between items-center shadow-xl shadow-indigo-600/20"><span className="text-xs font-black uppercase tracking-widest">Total Nilai Aset</span><span className="text-2xl font-black">{formatCurrency(totalAssets)}</span></div></div>
                    <div className="h-[2px] bg-slate-100 mx-10"></div>
                    <div className="p-10 bg-slate-50/30 flex-1"><h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center"><PieChart size={14} className="mr-2" /> PASIVA (Equity & Kewajiban)</h4><div className="mb-10"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Kewajiban Jangka Pendek</p><div className="space-y-3 pl-4 border-l-2 border-slate-200 ml-1"><div className="flex justify-between text-sm px-2"><span className="font-bold text-slate-500">Hutang Usaha</span><span className="font-black text-slate-700">{formatCurrency(0)}</span></div></div></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Modal & Ekuitas</p><div className="space-y-3 pl-4 border-l-2 border-slate-200 ml-1"><div className="flex justify-between text-sm px-2"><span className="font-bold text-slate-500">Modal Warga (Equity)</span><span className="font-black text-slate-700">{formatCurrency(balancedEquity)}</span></div></div></div><div className="mt-10 p-6 bg-slate-200 rounded-[2rem] flex justify-between items-center"><span className="text-xs font-black text-slate-700 uppercase tracking-widest">Total Pasiva</span><span className="text-2xl font-black text-slate-800">{formatCurrency(balancedEquity)}</span></div></div>
                </div>
            </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
