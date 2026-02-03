
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
  Calendar,
  Download,
  FileText
} from 'lucide-react';
import { MONTHS } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BalanceSheet: React.FC = () => {
  const { transactions, bills, settings, bankAccounts } = useApp();

  // LOCK STATE TO CURRENT DATE
  const now = new Date();
  const currentRealMonth = now.getMonth() + 1;
  const currentRealYear = now.getFullYear();

  // START YEAR FOR THE SYSTEM
  const START_YEAR = 2026;

  const [selectedMonth, setSelectedMonth] = useState(currentRealMonth);
  const [selectedYear, setSelectedYear] = useState(Math.max(START_YEAR, currentRealYear));

  // Generate Year Options starting from 2026
  const yearOptions = useMemo(() => {
    const years = [];
    const maxYear = Math.max(START_YEAR, currentRealYear);
    for (let y = START_YEAR; y <= maxYear; y++) {
      years.push(y);
    }
    return years.sort((a, b) => b - a); // Newest first
  }, [currentRealYear]);

  // --- LOGIC 1: HITUNG SALDO AWAL ---
  const beginningBalance = useMemo(() => {
    const jan2026CashTx = transactions.find(t => {
        const d = new Date(t.date);
        return d.getFullYear() === 2026 && 
               d.getMonth() === 0 && 
               t.category === 'Saldo Awal' &&
               t.paymentMethod === 'CASH';
    });

    const cashBase = jan2026CashTx ? jan2026CashTx.amount : 0;
    const bankBase = bankAccounts.reduce((acc, bank) => acc + bank.balance, 0);
    const systemStartBalance = cashBase + bankBase;

    if (selectedMonth === 1 && selectedYear === 2026) {
        return systemStartBalance;
    }

    const startOfPeriod = new Date(selectedYear, selectedMonth - 1, 1);
    const systemStartDate = new Date(2026, 0, 1); 

    const previousTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= systemStartDate && tDate < startOfPeriod && t.category !== 'Saldo Awal';
    });

    const prevIncome = previousTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + t.amount, 0);

    const prevExpense = previousTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => acc + t.amount, 0);

    return systemStartBalance + prevIncome - prevExpense;
  }, [transactions, selectedMonth, selectedYear, bankAccounts]);


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


  // --- LOGIC 4: NERACA ---
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
  const accountsPayable = 0; 
  const totalLiabilities = accountsPayable;
  const balancedEquity = totalAssets - totalLiabilities; 

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const period = `${MONTHS[selectedMonth-1]} ${selectedYear}`;
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.location_name.toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("LAPORAN KEUANGAN BULANAN", 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${period}`, 105, 34, { align: 'center' });
    doc.line(20, 38, 190, 38);

    // Section 1: Income Statement
    doc.setFont('helvetica', 'bold');
    doc.text("I. LAPORAN RUGI LABA (OPERASIONAL)", 20, 48);
    
    const incomeData: any[] = incomeByCategory.map(i => [i.name, formatCurrency(i.amount)]);
    incomeData.push([{ content: 'TOTAL PEMASUKAN', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalRevenue), styles: { fontStyle: 'bold' } }]);

    autoTable(doc, {
        startY: 52,
        head: [['Keterangan Pemasukan', 'Jumlah']],
        body: incomeData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
    });

    const expenseData: any[] = [];
    expenses.rutin.forEach(e => expenseData.push([e.name, formatCurrency(e.amount)]));
    expenses.nonRutin.forEach(e => expenseData.push([e.name, formatCurrency(e.amount)]));
    expenseData.push([{ content: 'TOTAL PENGELUARAN', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalExpense), styles: { fontStyle: 'bold' } }]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Keterangan Pengeluaran', 'Jumlah']],
        body: expenseData,
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] }
    });

    const netY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`SURPLUS / DEFISIT BULAN INI: ${formatCurrency(netProfit)}`, 20, netY);

    // Section 2: Balance Sheet
    doc.addPage();
    doc.setFontSize(14);
    doc.text("II. LAPORAN NERACA (POSISI KEUANGAN)", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.line(20, 25, 190, 25);

    const balanceData: any[] = [
        ['Saldo Awal Kas & Bank', formatCurrency(beginningBalance)],
        ['Perubahan Kas (Bulan Ini)', formatCurrency(netProfit)],
        ['Total Kas & Bank Akhir', formatCurrency(currentCashPosition)],
        ['Piutang Warga (Outstanding)', formatCurrency(accountsReceivable)],
        [{ content: 'TOTAL ASET', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(totalAssets), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
        ['Kewajiban (Hutang)', formatCurrency(totalLiabilities)],
        ['Modal Akhir (Ekuitas)', formatCurrency(balancedEquity)],
        [{ content: 'TOTAL PASIVA', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(totalLiabilities + balancedEquity), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]
    ];

    autoTable(doc, {
        startY: 35,
        head: [['Akun Neraca', 'Nilai']],
        body: balanceData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 20, (doc as any).lastAutoTable.finalY + 20);

    doc.save(`Laporan_Keuangan_${settings.location_name.replace(/\s/g, '_')}_${period.replace(/\s/g, '_')}.pdf`);
  };
  
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Laporan Keuangan</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rugi Laba & Neraca Saldo</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* EXPORT BUTTON */}
            <button 
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
            >
                <Download size={16} /> Ekspor Laporan
            </button>

            {/* ACTIVE FILTER */}
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
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* INCOME STATEMENT */}
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
                    {/* PEMASUKAN */}
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

                    {/* PENGELUARAN */}
                    <div className="p-6 bg-white">
                        <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center">
                            <ArrowRight size={14} className="mr-2" /> PENGELUARAN
                        </h4>
                        
                        {/* RUTIN */}
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

                        {/* NON RUTIN */}
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

                    {/* NET PROFIT */}
                    <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">SURPLUS / DEFISIT (Bulan Ini)</p>
                            <h3 className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {netProfit >= 0 ? '+' : ''} {formatCurrency(netProfit)}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-full ${netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        </div>
                    </div>
                </div>
            </div>


            {/* BALANCE SHEET */}
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
                    
                    {/* ASET */}
                    <div className="p-6">
                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center">
                            <Briefcase size={14} className="mr-2" /> Aset (Aktiva)
                        </h4>
                        <div className="space-y-3 pl-2 border-l-2 border-indigo-100 ml-1">
                            <div className="flex justify-between text-sm bg-indigo-50/50 p-2 rounded-lg">
                                <span className="font-bold text-slate-500 flex items-center gap-2">
                                    <Wallet size={14} /> Saldo Awal (Cash & Bank)
                                </span>
                                <span className="font-black text-slate-700">{formatCurrency(beginningBalance)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 px-2 -mt-2 mb-2 italic">
                                *Total Saldo Manual (Cash) + Total Rekening Bank (Saat Ini)
                            </div>

                            <div className="flex justify-between text-sm pl-2">
                                <span className="font-bold text-slate-600">Perubahan Kas (Surplus/Defisit)</span>
                                <span className={`font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</span>
                            </div>

                            <div className="border-t border-dashed border-slate-200 my-2"></div>

                            <div className="flex justify-between text-sm">
                                <span className="font-bold text-slate-800">Total Kas & Bank (Posisi Akhir)</span>
                                <span className="font-black text-slate-800">{formatCurrency(currentCashPosition)}</span>
                            </div>

                            <div className="flex justify-between text-sm mt-4">
                                <span className="font-bold text-slate-600">Piutang Warga (Outstanding)</span>
                                <span className="font-black text-slate-800">{formatCurrency(accountsReceivable)}</span>
                            </div>
                        </div>
                        <div className="mt-4 p-4 bg-indigo-50 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Total Aset</span>
                            <span className="text-lg font-black text-indigo-800">{formatCurrency(totalAssets)}</span>
                        </div>
                    </div>

                    <div className="h-[1px] bg-slate-100 mx-6"></div>

                    {/* PASIVA */}
                    <div className="p-6 bg-slate-50/30 flex-1">
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                            <PieChart size={14} className="mr-2" /> Kewajiban & Ekuitas (Pasiva)
                        </h4>
                        
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kewajiban (Liabilities)</p>
                            <div className="space-y-2 pl-2 border-l-2 border-slate-200 ml-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-600">Hutang Usaha</span>
                                    <span className="font-black text-slate-800">{formatCurrency(accountsPayable)}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ekuitas (Equity)</p>
                            <div className="space-y-2 pl-2 border-l-2 border-slate-200 ml-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-600">Modal Akhir</span>
                                    <span className="font-black text-slate-800">{formatCurrency(balancedEquity)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-slate-200 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Total Pasiva</span>
                            <span className="text-lg font-black text-slate-800">{formatCurrency(totalLiabilities + balancedEquity)}</span>
                        </div>
                    </div>
                </div>
            </div>

      </div>
    </div>
  );
};

export default BalanceSheet;
