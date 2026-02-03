
import React, { useState, useRef, useEffect } from 'react';
import { 
  Landmark, 
  ArrowUpCircle, 
  Settings2, 
  History, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  Upload, 
  X, 
  CreditCard, 
  Building, 
  FileText, 
  Download, 
  Loader2 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BankAccount, BankMutation, Transaction } from '../types';
import * as XLSX from 'xlsx';

const BankMutationPage: React.FC = () => {
  const { 
    bankAccounts, 
    bankMutations, 
    transactions,
    addBankAccount, 
    updateBankAccount, 
    deleteBankAccount, 
    addBankMutation, 
    deleteBankMutation, // Use context function
    deleteTransaction, // Use context function for transaction-based mutations
    addNotification 
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Account Form State
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<Partial<BankAccount>>({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    balance: 0
  });

  // Consolidated Mutation Input State
  const [inputState, setInputState] = useState({
      accountId: '',
      type: 'DEBIT' as 'DEBIT' | 'KREDIT',
      amount: '',
      description: ''
  });

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // Progress
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle ESC Key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAccountForm) setShowAccountForm(false);
        if (showImportModal && !isImporting) setShowImportModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAccountForm, showImportModal, isImporting]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNewAccount({ bankName: '', accountNumber: '', accountHolder: '', balance: 0 });
    setShowAccountForm(true);
  };

  const handleOpenEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setNewAccount({
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      accountHolder: acc.accountHolder,
      balance: acc.balance
    });
    setShowAccountForm(true);
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateBankAccount({ ...newAccount, id: editingId } as BankAccount);
      addNotification(`Data rekening berhasil diperbarui.`, "success");
    } else {
      await addBankAccount({ ...newAccount, id: Math.random().toString(36).substr(2, 9) } as BankAccount);
      addNotification(`Rekening baru berhasil ditambahkan.`, "success");
    }
    setShowAccountForm(false);
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus rekening ini?')) {
        await deleteBankAccount(id);
        addNotification("Rekening dihapus.", "success");
    }
  };

  const handleDeleteMutation = async (item: any) => {
      const confirmMsg = "Apakah Anda yakin ingin menghapus data mutasi ini? \n\nPERINGATAN: Saldo rekening akan otomatis disesuaikan kembali (dikembalikan ke kondisi sebelum mutasi).";
      if (window.confirm(confirmMsg)) {
          if (item.source === 'TRANSACTION') {
              // Delete transaction via transaction logic
              await deleteTransaction(item.id);
          } else {
              // Delete manual mutation via mutation logic
              await deleteBankMutation(item.id);
          }
      }
  };

  const submitMutation = async () => {
    if (!inputState.accountId || !inputState.amount || !inputState.description) {
        addNotification("Mohon lengkapi data.", "warning");
        return;
    }
    const mutation: BankMutation = {
      id: Math.random().toString(36).substr(2, 9),
      accountId: inputState.accountId,
      date: new Date().toISOString(),
      type: inputState.type,
      amount: Number(inputState.amount),
      description: inputState.description
    };
    await addBankMutation(mutation);
    addNotification("Mutasi berhasil dicatat.", "success");
    setInputState({ accountId: '', type: 'DEBIT', amount: '', description: '' });
  };

  // Import Logic
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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
            // Expected: TANGGAL, NAMA_BANK, TIPE, JUMLAH, KETERANGAN
            if (row.NAMA_BANK && row.JUMLAH) {
                // Find matching bank account (case insensitive)
                const bankAccount = bankAccounts.find(b => 
                    b.bankName.toLowerCase().trim() === String(row.NAMA_BANK).toLowerCase().trim() ||
                    b.accountNumber.trim() === String(row.NAMA_BANK).trim()
                );

                if (bankAccount) {
                    // Parse Date
                    let dateRaw = row.TANGGAL;
                    if (typeof dateRaw === 'number') {
                        const jsDate = new Date(Math.round((dateRaw - 25569)*86400*1000));
                        dateRaw = jsDate.toISOString();
                    } else if (!dateRaw) {
                        dateRaw = new Date().toISOString();
                    }

                    const typeRaw = String(row.TIPE).toUpperCase().trim();
                    const type = (typeRaw === 'KREDIT' || typeRaw === 'OUT') ? 'KREDIT' : 'DEBIT';
                    const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                    const description = row.KETERANGAN || 'Import Mutasi';

                    if (!isNaN(amount) && amount > 0) {
                        const mutation: BankMutation = {
                            id: `mut-imp-${Date.now()}-${Math.random()}`,
                            accountId: bankAccount.id,
                            date: dateRaw,
                            type: type,
                            amount: amount,
                            description: description,
                            reference: 'IMPORT'
                        };
                        await addBankMutation(mutation);
                        successCount++;
                    }
                }
            }
            processed++;
            setImportProgress(Math.round((processed / total) * 100));
        }
        addNotification(`${successCount} Mutasi berhasil diimpor.`, "success");
        setShowImportModal(false);
      } catch (error) {
        addNotification("Gagal mengimpor file. Pastikan format Excel benar.", "error");
      } finally {
        setIsImporting(false);
        setImportProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const data = [
        { "TANGGAL": "2025-01-01", "NAMA_BANK": "BCA", "TIPE": "DEBIT", "JUMLAH": 1000000, "KETERANGAN": "Setoran Awal" },
        { "TANGGAL": "2025-01-02", "NAMA_BANK": "MANDIRI", "TIPE": "KREDIT", "JUMLAH": 50000, "KETERANGAN": "Biaya Admin" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_mutasi_bank.xlsx");
  };

  // ... (Rest of render) ...

  const combinedHistory = [
      ...bankMutations.map(m => ({ ...m, source: 'MANUAL' })),
      ...transactions.filter(t => t.paymentMethod === 'TRANSFER' && t.bankAccountId && t.category !== 'Saldo Awal').map(t => ({
          id: t.id, date: t.date, accountId: t.bankAccountId!, description: t.description, amount: t.amount,
          type: t.type === 'INCOME' ? 'DEBIT' : 'KREDIT' as 'DEBIT' | 'KREDIT', source: 'TRANSACTION'
      }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredHistory = combinedHistory.filter(m => m.description.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header and other UI components... */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Mutasi Bank</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pengelolaan Dana Rekening</p>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Riwayat</button>
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase ${activeTab === 'settings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Manajemen Rekening</button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bankAccounts.map(acc => {
            return (
                <div key={acc.id} className="card p-8 border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Building2 size={24} /></div>
                        <div className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aktif</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Tersedia</p>
                    <h3 className="text-2xl font-black text-slate-800">Rp {acc.balance.toLocaleString('id-ID')}</h3>
                    <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between text-slate-500">
                        <div><p className="text-[8px] font-black uppercase">Rekening</p><p className="text-xs font-bold font-mono">{acc.accountNumber}</p></div>
                        <div className="text-right"><p className="text-[8px] font-black uppercase">Atas Nama</p><p className="text-[10px] font-black uppercase">{acc.accountHolder}</p></div>
                    </div>
                </div>
            );
        })}
        {bankAccounts.length === 0 && (
            <div className="col-span-full text-center p-10 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                <Building size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm font-bold">Belum ada rekening bank.</p>
                <button onClick={() => setActiveTab('settings')} className="mt-2 text-xs font-black text-emerald-600 uppercase tracking-widest hover:underline">Tambah Rekening di Menu Pengaturan</button>
            </div>
        )}
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
             <div className="card p-8 border border-slate-100 shadow-sm space-y-5">
                  <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-slate-800 uppercase">Input Mutasi Rutin</h4>
                      <button 
                        onClick={() => setShowImportModal(true)}
                        className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Impor Excel"
                      >
                          <Upload size={16} />
                      </button>
                  </div>
                  
                  <select value={inputState.accountId} onChange={e => setInputState({...inputState, accountId: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs"><option value="">-- Pilih Bank --</option>{bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bankName}</option>)}</select>
                  <div className="flex bg-slate-50 rounded-xl p-1"><button onClick={() => setInputState({...inputState, type: 'DEBIT'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${inputState.type === 'DEBIT' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>DEBIT (MASUK)</button><button onClick={() => setInputState({...inputState, type: 'KREDIT'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${inputState.type === 'KREDIT' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}>KREDIT (KELUAR)</button></div>
                  <input type="number" placeholder="Rp 0" value={inputState.amount} onChange={e => setInputState({...inputState, amount: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl font-bold" />
                  <input type="text" placeholder="Keterangan" value={inputState.description} onChange={e => setInputState({...inputState, description: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs" />
                  <button onClick={submitMutation} className="w-full py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase">Simpan</button>
             </div>
          </div>
          <div className="lg:col-span-2 card border border-slate-100 overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex justify-between"><h3 className="text-lg font-black">Riwayat</h3><input type="text" placeholder="Cari..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-slate-50 p-2 rounded-lg text-xs" /></div>
               <div className="overflow-auto max-h-[500px]">
                   <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                           <tr>
                               <th className="p-4">Tanggal</th>
                               <th className="p-4">Ket</th>
                               <th className="p-4 text-right">Debit</th>
                               <th className="p-4 text-right">Kredit</th>
                               <th className="p-4 text-center">Aksi</th>
                           </tr>
                       </thead>
                       <tbody>
                           {filteredHistory.map(m => (
                               <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                                   <td className="p-4 text-xs font-bold">{new Date(m.date).toLocaleDateString()}</td>
                                   <td className="p-4 text-xs">{m.description}</td>
                                   <td className="p-4 text-right text-emerald-600 font-bold">{m.type === 'DEBIT' ? m.amount.toLocaleString() : '-'}</td>
                                   <td className="p-4 text-right text-rose-600 font-bold">{m.type === 'KREDIT' ? m.amount.toLocaleString() : '-'}</td>
                                   <td className="p-4 text-center">
                                       <button 
                                           onClick={() => handleDeleteMutation(m)}
                                           className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                                           title="Hapus Mutasi"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
          </div>
        </div>
      )}

      {/* Account Settings Tab */}
      {activeTab === 'settings' && (
        <div className="animate-in fade-in slide-in-from-bottom duration-500">
           <div className="card border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div>
                   <h3 className="text-xl font-black text-slate-800">Manajemen Rekening</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Daftar akun bank resmi perumahan</p>
                 </div>
                 <button 
                  onClick={handleOpenAdd}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={16} />
                  <span>Tambah Baru</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     <tr>
                       <th className="px-8 py-5">Nama Bank</th>
                       <th className="px-8 py-5">Nomor Rekening</th>
                       <th className="px-8 py-5">Atas Nama</th>
                       <th className="px-8 py-5 text-right">Saldo Saat Ini</th>
                       <th className="px-8 py-5 text-center">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {bankAccounts.length > 0 ? bankAccounts.map(acc => (
                       <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-8 py-5">
                            <div className="flex items-center space-x-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black">
                                 {acc.bankName.charAt(0)}
                               </div>
                               <span className="font-black text-slate-700">{acc.bankName}</span>
                            </div>
                         </td>
                         <td className="px-8 py-5 font-mono text-sm font-bold text-slate-500">{acc.accountNumber}</td>
                         <td className="px-8 py-5 text-[10px] font-black uppercase tracking-tight text-slate-600">{acc.accountHolder}</td>
                         <td className="px-8 py-5 text-right font-black text-emerald-600">Rp {acc.balance.toLocaleString('id-ID')}</td>
                         <td className="px-8 py-5">
                            <div className="flex justify-center items-center space-x-2">
                               <button 
                                onClick={() => handleOpenEdit(acc)}
                                className="p-2 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-100 transition-colors"
                                title="Ubah Rekening"
                               ><Edit size={16} /></button>
                               <button 
                                type="button"
                                onClick={() => handleDeleteAccount(acc.id)}
                                className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                                title="Hapus Rekening"
                              ><Trash2 size={16} /></button>
                            </div>
                         </td>
                       </tr>
                     )) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-32 text-center">
                             <div className="flex flex-col items-center justify-center opacity-20">
                                <Building2 size={64} className="mb-4 text-slate-300" />
                                <p className="text-sm font-black uppercase tracking-[0.3em]">Belum ada rekening terdaftar</p>
                             </div>
                          </td>
                        </tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Account Modal (same as before) */}
      {showAccountForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                  <h3 className="text-xl font-black text-slate-800">{editingId ? 'Ubah Rekening' : 'Tambah Rekening'}</h3>
               </div>
               <button onClick={() => setShowAccountForm(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAccountSubmit} className="p-10 space-y-6">
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nama Bank</label>
                 <input type="text" required placeholder="Contoh: BCA / Mandiri" value={newAccount.bankName} onChange={e => setNewAccount({...newAccount, bankName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none" />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nomor Rekening</label>
                 <input type="text" required placeholder="0000000000" value={newAccount.accountNumber} onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none font-mono" />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Atas Nama</label>
                 <input type="text" required placeholder="Contoh: KAS RT 01" value={newAccount.accountHolder} onChange={e => setNewAccount({...newAccount, accountHolder: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none uppercase" />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Saldo Awal</label>
                 <input type="number" required value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none" />
               </div>
               <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20">Simpan Rekening</button>
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
                <h3 className="font-black text-slate-800 text-lg mb-2">Impor Mutasi Bank</h3>
                <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
                    Pastikan nama bank di file excel sama persis dengan nama rekening yang terdaftar.
                </p>
                
                <input 
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                />
                
                {/* PROGRESS BAR */}
                {isImporting && (
                    <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                        <div 
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-center" 
                            style={{ width: `${importProgress}%` }}
                        >
                        </div>
                        <p className="text-[10px] font-black text-blue-600 mt-1 text-center">{importProgress}% Selesai</p>
                    </div>
                )}

                <div className="space-y-3">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>{isImporting ? 'Memproses...' : 'Pilih File Excel'}</span>
                    </button>
                    <button 
                        onClick={downloadTemplate}
                        disabled={isImporting}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download size={14} /> Download Template
                    </button>
                    <button 
                        onClick={() => setShowImportModal(false)}
                        disabled={isImporting}
                        className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 disabled:opacity-50"
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

export default BankMutationPage;
