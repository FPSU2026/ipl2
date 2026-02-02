
// pages/Arrears.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AlertCircle, Search, MessageCircle, Calendar, Check, X, Plus, Upload, FileText, Save, Building, Eye, Wallet, Banknote, CreditCard, Send, Printer, Share2, ChevronRight, Layers, Download, Loader2, Trash2, Edit, AlertOctagon, Users } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { Bill, UserRole, Transaction } from '../types';
import * as XLSX from 'xlsx';

const Arrears: React.FC = () => {
  const { residents, bills, addBill, updateBill, addNotification, settings, currentUser, payBill, bankAccounts, addTransaction, deleteBill } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentYear = new Date().getFullYear();
  const startYear = 2023;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
  
  const [selectedYear, setSelectedYear] = useState<number>(-1); 
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [filterRT, setFilterRT] = useState('ALL');
  
  const [showInputModal, setShowInputModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); 
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResidentDetail, setSelectedResidentDetail] = useState<{name: string, houseNo: string, items: Bill[]} | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); 

  const [manualArrear, setManualArrear] = useState({ residentId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '' });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editFormData, setEditFormData] = useState({ month: 0, year: 0, amount: '' });

  const isResident = currentUser?.role === UserRole.RESIDENT;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showInputModal) setShowInputModal(false);
        if (showDetailModal) setShowDetailModal(false);
        if (showImportModal && !isImporting) setShowImportModal(false);
        if (showEditModal) setShowEditModal(false);
        if (showPaymentModal) setShowPaymentModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showInputModal, showDetailModal, showImportModal, showEditModal, showPaymentModal, isImporting]);

  // AUTO SELECT BANK FOR ARREARS PAYMENT
  useEffect(() => {
    if (paymentMethod === 'TRANSFER' && !selectedBankId) {
        const activeBank = bankAccounts.find(acc => acc.isActive);
        if (activeBank) {
            setSelectedBankId(activeBank.id);
        }
    }
  }, [paymentMethod, bankAccounts, selectedBankId]);

  const calculateTotalArrears = (residentId: string) => {
    let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYearNum = now.getFullYear();
    unpaidBills = unpaidBills.filter(b => {
        if (b.period_year > currentYearNum) return false;
        if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
        return true;
    });
    if (selectedYear !== -1) unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
    return unpaidBills.reduce((bSum, b) => bSum + (b.total - (b.paid_amount || 0)), 0);
  };

  const getArrearsDescription = (residentId: string) => {
      let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();
      unpaidBills = unpaidBills.filter(b => {
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });
      if (selectedYear !== -1) unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
      if (unpaidBills.length === 0) return '-';
      const billsByYear: Record<number, number[]> = {};
      unpaidBills.forEach(b => {
          if (!billsByYear[b.period_year]) billsByYear[b.period_year] = [];
          billsByYear[b.period_year].push(b.period_month);
      });
      const parts: string[] = [];
      const sortedYears = Object.keys(billsByYear).map(Number).sort((a,b) => a - b);
      sortedYears.forEach(year => {
          if (year === 2023) parts.push("2023");
          else {
              const months = billsByYear[year].sort((a,b) => a - b);
              const monthNames = months.map(m => MONTHS[m-1].substring(0, 3));
              parts.push(`${monthNames.join(', ')} ${year}`);
          }
      });
      return parts.join('; ');
  };

  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
        if (isResident && r.id !== currentUser?.residentId) return false;
        if (filterRT !== 'ALL' && r.rt !== filterRT) return false;
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        const totalArrears = calculateTotalArrears(r.id);
        if (statusFilter === 'UNPAID') return totalArrears > 0;
        if (statusFilter === 'PAID') return totalArrears === 0;
        return totalArrears > 0; 
    });
  }, [residents, isResident, currentUser, filterRT, searchTerm, statusFilter, bills, selectedYear]);

  const { totalArrearsSummary, totalDebtorsCount } = useMemo(() => {
      const total = filteredResidents.reduce((acc, r) => acc + calculateTotalArrears(r.id), 0);
      const count = filteredResidents.filter(r => calculateTotalArrears(r.id) > 0).length;
      return { totalArrearsSummary: total, totalDebtorsCount: count };
  }, [filteredResidents, bills, selectedYear]);

  const getResidentUnpaidBills = (residentId: string) => {
      let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();
      unpaidBills = unpaidBills.filter(b => {
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });
      if (selectedYear !== -1) unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
      return unpaidBills.sort((a, b) => {
          if (a.period_year !== b.period_year) return a.period_year - b.period_year;
          return a.period_month - b.period_month;
      });
  };

  const sendReminder = (r: any) => {
    const unpaidItems = getResidentUnpaidBills(r.id);
    if (unpaidItems.length === 0) return;
    const total = unpaidItems.reduce((acc, b) => acc + (b.total - (b.paid_amount||0)), 0);
    const details = unpaidItems.map((b, index) => `${index + 1}. ${MONTHS[b.period_month - 1]} ${b.period_year}: Rp ${(b.total - (b.paid_amount||0)).toLocaleString('id-ID')}`).join('\n');
    let template = settings.whatsappTemplates?.arrearsMessage || DEFAULT_SETTINGS.whatsappTemplates.arrearsMessage;
    const replaceMap: Record<string, string> = { '{NAMA}': r.name, '{RUMAH}': r.houseNo, '{TOTAL}': total.toLocaleString('id-ID'), '{RINCIAN}': details };
    Object.keys(replaceMap).forEach(key => { template = template.replace(new RegExp(key, 'g'), replaceMap[key]); });
    window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(template)}`, '_blank');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualArrear.residentId || !manualArrear.amount) return;
      const newBill: Bill = {
          id: `manual-${Date.now()}`, residentId: manualArrear.residentId, period_month: manualArrear.month, period_year: manualArrear.year, prev_meter: 0, curr_meter: 0, water_usage: 0, water_cost: 0, ipl_cost: 0, kas_rt_cost: 0, abodemen_cost: 0, extra_cost: 0, arrears: 0, total: parseInt(manualArrear.amount), status: 'UNPAID', created_at: new Date().toISOString()
      };
      await addBill(newBill);
      setShowInputModal(false);
      addNotification("Tunggakan manual berhasil ditambahkan", "success");
  };

  const handleEditItemClick = (bill: Bill) => {
      setEditingBill(bill);
      setEditFormData({ month: bill.period_month, year: bill.period_year, amount: bill.total.toString() });
      setShowEditModal(true);
  };

  const handleUpdateItemSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingBill) return;
      const updatedBill: Bill = { ...editingBill, period_month: editFormData.month, period_year: editFormData.year, total: parseInt(editFormData.amount) || 0 };
      await updateBill(updatedBill);
      addNotification("Data tunggakan berhasil diperbarui", "success");
      setShowEditModal(false);
      if (selectedResidentDetail) {
          const rId = selectedResidentDetail.items[0]?.residentId || editingBill.residentId;
          const refreshedItems = getResidentUnpaidBills(rId);
          const resident = residents.find(r => r.id === rId);
          if (resident) setSelectedResidentDetail({ name: resident.name, houseNo: resident.houseNo, items: refreshedItems });
      }
  };

  const handleOpenPayment = (bill: Bill) => {
      setSelectedBill(bill);
      setPaymentAmount((bill.total - (bill.paid_amount || 0)).toString());
      setPaymentMethod('CASH');
      setSelectedBankId('');
      setPaymentProof(null); 
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBill) return;
      if (isResident && !paymentProof) { addNotification("Wajib melampirkan foto bukti pembayaran!", "error"); return; }
      const amount = parseInt(paymentAmount);
      await payBill(selectedBill.id, amount, paymentMethod, selectedBankId, paymentProof || undefined, undefined, false, paymentDate);
      setShowPaymentModal(false);
      if (selectedResidentDetail) {
          const remainingItems = selectedResidentDetail.items.filter(item => item.id !== selectedBill.id);
          setSelectedResidentDetail(prev => prev ? { ...prev, items: remainingItems } : null);
          if (remainingItems.length === 0) setShowDetailModal(false);
      }
  };

  const handleImportArrears = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      setImportProgress(0);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        let successCount = 0;
        const total = jsonData.length;
        let processed = 0;
        for (const row of jsonData) {
            if (row.NOMOR_RUMAH && row.JUMLAH) {
                const resident = residents.find(r => r.houseNo.toLowerCase() === String(row.NOMOR_RUMAH).toLowerCase());
                if (resident) {
                    const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                    const month = parseInt(row.BULAN) || (new Date().getMonth() + 1);
                    const year = parseInt(row.TAHUN) || new Date().getFullYear();
                    if (!isNaN(amount) && amount > 0) {
                        const newBill: Bill = { id: `imp-arr-${Date.now()}-${Math.random()}`, residentId: resident.id, period_month: month, period_year: year, prev_meter: 0, curr_meter: 0, water_usage: 0, water_cost: 0, ipl_cost: 0, kas_rt_cost: 0, abodemen_cost: 0, extra_cost: 0, arrears: 0, total: amount, status: 'UNPAID', created_at: new Date().toISOString() };
                        await addBill(newBill);
                        successCount++;
                    }
                }
            }
            processed++;
            setImportProgress(Math.round((processed / total) * 100));
        }
        addNotification(`${successCount} Data tunggakan berhasil diimport.`, "success");
        setShowImportModal(false);
      } catch (error) { addNotification("Gagal mengimport file.", "error"); } finally { setIsImporting(false); setImportProgress(0); if (importFileRef.current) importFileRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadArrearsTemplate = () => {
    const data = [ { "NOMOR_RUMAH": "A-01", "BULAN": 1, "TAHUN": 2025, "JUMLAH": 150000 }, { "NOMOR_RUMAH": "B-05", "BULAN": 2, "TAHUN": 2025, "JUMLAH": 200000 } ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_tunggakan.xlsx");
  };
  
  const handleOpenDetail = (resident: any) => {
      const items = getResidentUnpaidBills(resident.id);
      setSelectedResidentDetail({ name: resident.name, houseNo: resident.houseNo, items: items });
      setShowDetailModal(true);
  };

  const handleDeleteItem = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin menghapus data tunggakan ini?")) {
          await deleteBill(id);
          if (selectedResidentDetail) {
              const updatedItems = selectedResidentDetail.items.filter(item => item.id !== id);
              setSelectedResidentDetail({ ...selectedResidentDetail, items: updatedItems });
          }
      }
  };

  const handleDeleteAllForResident = async (residentId: string) => {
      if (window.confirm("PERINGATAN: Aksi ini akan MENGHAPUS SEMUA tagihan tertunggak untuk warga ini.")) {
          const items = getResidentUnpaidBills(residentId);
          for (const item of items) await deleteBill(item.id);
          addNotification("Semua data tunggakan warga ini telah dihapus.", "success");
      }
  };

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div><h2 className="text-3xl font-black text-slate-800 tracking-tight">Data Tunggakan</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monitoring Pembayaran Tertunggak (Bulan Lalu)</p></div>
        {!isResident && (<div className="flex flex-wrap items-center gap-2"><button onClick={() => setShowImportModal(true)} className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"><Upload size={14} /> Import Data</button><button onClick={() => setShowInputModal(true)} className="px-4 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-500/20 active:scale-95 transition-all flex items-center gap-2"><Plus size={14} /> Input Manual</button></div>)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0"><div className="p-6 bg-rose-500 text-white rounded-[2rem] shadow-lg shadow-rose-500/20 relative overflow-hidden flex flex-col justify-center min-h-[100px]"><div className="absolute top-0 right-0 p-4 opacity-10"><Banknote size={100} /></div><div className="relative z-10"><p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">TOTAL TUNGGAKAN {selectedYear !== -1 ? `(${selectedYear})` : ''}</p><h3 className="text-3xl font-black">Rp {totalArrearsSummary.toLocaleString('id-ID')}</h3></div></div><div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4 min-h-[100px]"><div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shrink-0"><Users size={28} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Warga Menunggak</p><h3 className="text-2xl font-black text-slate-800">{totalDebtorsCount} <span className="text-sm text-slate-400 font-bold">Unit</span></h3></div></div></div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50/50 shrink-0"><div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto"><div className="relative w-full md:w-64"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Cari nama / unit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" /></div>{!isResident && (<select value={filterRT} onChange={(e) => setFilterRT(e.target.value)} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer"><option value="ALL">Semua RT</option>{settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}</select>)}<select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer"><option value={-1}>Semua Tahun</option>{years.map(year => (<option key={year} value={year}>{year}</option>))}</select></div></div>
          <div className="overflow-auto flex-1 relative"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20 shadow-sm"><tr><th className="px-6 py-5 bg-slate-50">No. Rumah</th><th className="px-6 py-5 bg-slate-50">Periode Tertunggak</th><th className="px-6 py-5 bg-slate-50 text-right">Total Tunggakan</th><th className="px-6 py-5 bg-slate-50 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredResidents.length > 0 ? (filteredResidents.map(r => { const totalArrears = calculateTotalArrears(r.id); if (totalArrears <= 0) return null; return (<tr key={r.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-6 py-5"><div className="flex items-center gap-2"><span className="text-sm font-black text-slate-800 uppercase tracking-wider">{r.houseNo}</span></div></td><td className="px-6 py-5"><span className="text-xs font-bold text-slate-500">{getArrearsDescription(r.id)}</span></td><td className="px-6 py-5 text-right"><span className="font-black text-sm text-rose-600">Rp {totalArrears.toLocaleString('id-ID')}</span></td><td className="px-6 py-5"><div className="flex justify-center items-center gap-2"><button onClick={() => handleOpenDetail(r)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100" title="Edit Rincian / Detail"><Edit size={16}/></button>{!isResident && (<button onClick={() => handleDeleteAllForResident(r.id)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100" title="Hapus Semua Tunggakan"><Trash2 size={16}/></button>)}{!isResident && (<button onClick={() => sendReminder(r)} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100" title="Kirim Pengingat WA"><MessageCircle size={16}/></button>)}</div></td></tr>); })) : (<tr><td colSpan={4} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada data tunggakan</td></tr>)}</tbody></table></div>
      </div>

      {showInputModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200"><div className="bg-slate-800 p-6 flex justify-between items-center text-white"><div><h3 className="font-black text-lg">Input Tunggakan Manual</h3></div><button onClick={() => setShowInputModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button></div><form onSubmit={handleManualSubmit} className="p-8 space-y-5"><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih Warga</label><select required value={manualArrear.residentId} onChange={e => setManualArrear({...manualArrear, residentId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"><option value="">-- Pilih Warga --</option>{residents.map(r => <option key={r.id} value={r.id}>{r.houseNo} - {r.name}</option>)}</select></div><div className="flex gap-4"><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bulan</label><select value={manualArrear.month} onChange={e => setManualArrear({...manualArrear, month: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">{MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}</select></div><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tahun</label><input type="number" value={manualArrear.year} onChange={e => setManualArrear({...manualArrear, year: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" /></div></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label><input type="number" required value={manualArrear.amount} onChange={e => setManualArrear({...manualArrear, amount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div><button type="submit" className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Simpan</button></form></div></div>
      )}

      {showEditModal && editingBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4"><div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200"><div className="bg-slate-800 p-6 flex justify-between items-center text-white"><div><h3 className="font-black text-lg">Edit Data Tunggakan</h3></div><button onClick={() => setShowEditModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button></div><form onSubmit={handleUpdateItemSubmit} className="p-8 space-y-5"><div className="flex gap-4"><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{editFormData.year === 2023 ? 'Bulan (Non-Aktif)' : 'Bulan'}</label><select value={editFormData.month} onChange={e => setEditFormData({...editFormData, month: parseInt(e.target.value)})} disabled={editFormData.year === 2023} className={`w-full p-3 border border-slate-200 rounded-xl font-bold text-xs ${editFormData.year === 2023 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'}`}>{MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}</select></div><div className="flex-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tahun</label><input type="number" value={editFormData.year} onChange={e => setEditFormData({...editFormData, year: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" /></div></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label><input type="number" required value={editFormData.amount} onChange={e => setEditFormData({...editFormData, amount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div><button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Simpan Perubahan</button></form></div></div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8"><div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100"><FileText size={32} /></div><h3 className="font-black text-slate-800 text-lg mb-2">Import Data Tunggakan</h3><p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">Gunakan template Excel (.xlsx) untuk upload massal.</p><input type="file" ref={importFileRef} accept=".xlsx, .xls" className="hidden" onChange={handleImportArrears} />{isImporting && (<div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-center" style={{ width: `${importProgress}%` }}></div><p className="text-[10px] font-black text-blue-600 mt-1 text-center">{importProgress}% Selesai</p></div>)}<div className="space-y-3"><button onClick={() => importFileRef.current?.click()} disabled={isImporting} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed">{isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}<span>{isImporting ? 'Memproses...' : 'Pilih File Excel'}</span></button><button onClick={downloadArrearsTemplate} disabled={isImporting} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"><Download size={16} /> Download Template</button><button onClick={() => setShowImportModal(false)} disabled={isImporting} className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 disabled:opacity-50">Batal</button></div></div></div>
      )}

      {showDetailModal && selectedResidentDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]"><div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"><div><h3 className="font-black text-lg text-slate-800">Rincian Tunggakan</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedResidentDetail.houseNo}</p></div><button onClick={() => setShowDetailModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={20}/></button></div><div className="p-6 overflow-y-auto">{selectedResidentDetail.items.length > 0 ? (<div className="space-y-3">{selectedResidentDetail.items.map(item => (<div key={item.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-white shadow-sm"><div><p className="font-bold text-slate-700 text-sm">{item.period_year === 2023 ? '2023' : `${MONTHS[item.period_month-1]} ${item.period_year}`}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tunggakan</p></div><div className="flex items-center gap-2"><span className="font-black text-rose-600">Rp {(item.total - (item.paid_amount||0)).toLocaleString('id-ID')}</span><button onClick={() => handleOpenPayment(item)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors ml-2" title="Bayar Tunggakan Ini"><Wallet size={14} /></button>{!isResident && (<div className="flex gap-1 ml-1"><button onClick={() => handleEditItemClick(item)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Item Ini"><Edit size={14} /></button><button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus Item Ini"><Trash2 size={14} /></button></div>)}</div></div>))}<div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center"><span className="font-black text-slate-800 uppercase text-xs tracking-widest">Total</span><span className="font-black text-xl text-rose-600">Rp {selectedResidentDetail.items.reduce((acc, curr) => acc + (curr.total - (curr.paid_amount||0)), 0).toLocaleString('id-ID')}</span></div></div>) : (<div className="text-center py-8 text-slate-400"><Check size={48} className="mx-auto mb-2 text-emerald-300" /><p className="text-sm font-bold">Tidak ada tunggakan.</p></div>)}</div></div></div>
      )}

      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4"><div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]"><div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0"><div><h3 className="font-black text-lg">Input Pembayaran</h3><p className="text-[10px] uppercase tracking-widest opacity-60">{MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}</p></div><button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button></div><form onSubmit={handlePaymentSubmit} className="p-8 space-y-5 pt-4 overflow-y-auto custom-scrollbar"><div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs"><div className="flex justify-between items-center pb-2 border-b border-slate-200"><span className="font-bold text-slate-500">Sisa Tagihan</span><span className="font-black text-slate-700">Rp {(selectedBill.total - (selectedBill.paid_amount||0)).toLocaleString()}</span></div></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metode</label><div className="flex gap-2"><button type="button" onClick={() => setPaymentMethod('CASH')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>Cash</button><button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>Transfer</button></div></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar size={14} /> Tanggal Pembayaran</label><input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" /></div>{paymentMethod === 'TRANSFER' && (<select required value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs"><option value="">-- Pilih Rekening --</option>{bankAccounts.filter(acc => acc.isActive).map(acc => (<option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>))}</select>)}<div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah Dibayar (Rp)</label><input type="number" required autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none" /></div>{isResident && (<div className="space-y-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bukti Transfer <span className="text-rose-500">*Wajib</span></label><input type="file" ref={proofInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { if (ev.target?.result) setPaymentProof(ev.target.result as string); }; reader.readAsDataURL(file); } } } />{paymentProof ? (<div className="relative rounded-2xl overflow-hidden border border-slate-200 group"><img src={paymentProof} alt="Preview" className="w-full h-32 object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={() => setPaymentProof(null)} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"><Trash2 size={16} /></button></div></div>) : (<div onClick={() => proofInputRef.current?.click()} className="border-2 border-dashed border-blue-200 bg-blue-50 hover:border-blue-300 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all"><Upload size={24} className="text-blue-400" /><p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Unggah Bukti</p></div>)}{!paymentProof && <p className="text-[9px] text-rose-500 font-bold italic">* Mohon lampirkan foto bukti pembayaran.</p>}</div>)}<button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Konfirmasi Pembayaran</button></form></div></div>
      )}
    </div>
  );
};

export default Arrears;
