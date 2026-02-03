
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
  Loader2,
  TrendingUp
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
    deleteBankMutation,
    deleteTransaction,
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
  
  // State for balance addition in edit mode
  const [balanceAddition, setBalanceAddition] = useState<string>('');

  // Consolidated Mutation Input State
  const [inputState, setInputState] = useState({
      accountId: '',
      type: 'KREDIT' as 'DEBIT' | 'KREDIT', // Default KREDIT (Masuk)
      amount: '',
      description: ''
  });

  // Handle ESC Key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAccountForm) setShowAccountForm(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAccountForm]);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const addition = parseInt(balanceAddition) || 0;
      
      // Update data dasar rekening
      await updateBankAccount({ ...newAccount, id: editingId } as BankAccount);
      
      // Jika ada penambahan saldo, catat sebagai mutasi otomatis agar saldo akhir tersinkronisasi melalui addBankMutation logic di context
      if (addition > 0) {
          const autoMutation: BankMutation = {
              id: `adj-${Date.now()}`,
              accountId: editingId,
              date: new Date().toISOString(),
              type: 'KREDIT',
              amount: addition,
              description: 'Penyesuaian Saldo (Update Manual)'
          };
          await addBankMutation(autoMutation);
          addNotification(`Rekening diperbarui & saldo ditambah Rp ${addition.toLocaleString()}.`, "success");
      } else {
          addNotification(`Data rekening berhasil diperbarui.`, "success");
      }
    } else {
      await addBankAccount({ ...newAccount, id: Math.random().toString(36).substr(2, 9), isActive: true } as BankAccount);
      addNotification(`Rekening baru berhasil ditambahkan.`, "success");
    }
    setShowAccountForm(false);
    setBalanceAddition('');
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus rekening ini?')) {
        await deleteBankAccount(id);
    }
  };

  const handleDeleteMutation = async (item: any) => {
      const confirmMsg = "Apakah Anda yakin ingin menghapus data mutasi ini? \n\nPERINGATAN: Saldo rekening akan otomatis disesuaikan kembali.";
      if (window.confirm(confirmMsg)) {
          if (item.source === 'TRANSACTION') {
              await deleteTransaction(item.id);
          } else {
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
    setInputState({ ...inputState, amount: '', description: '' });
  };

  const combinedHistory = [
      ...bankMutations.map(m => ({ ...m, source: 'MANUAL' })),
      ...transactions.filter(t => t.paymentMethod === 'TRANSFER' && t.bankAccountId && t.category !== 'Saldo Awal').map(t => ({
          id: t.id, date: t.date, accountId: t.bankAccountId!, description: t.description, amount: t.amount,
          type: t.type === 'INCOME' ? 'KREDIT' : 'DEBIT' as 'DEBIT' | 'KREDIT', source: 'TRANSACTION'
      }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredHistory = combinedHistory.filter(m => m.description.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bankAccounts.map(acc => (
          <div key={acc.id} className="card p-8 border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Building2 size={24} /></div>
                  <div className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status: Aktif</p>
                  </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Tersedia</p>
              <h3 className="text-2xl font-black text-slate-800">Rp {acc.balance.toLocaleString('id-ID')}</h3>
              <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between text-slate-500">
                  <div><p className="text-[8px] font-black uppercase">Rekening</p><p className="text-xs font-bold font-mono">{acc.accountNumber}</p></div>
                  <div className="text-right"><p className="text-[8px] font-black uppercase">Atas Nama</p><p className="text-[10px] font-black uppercase truncate max-w-[120px]">{acc.accountHolder}</p></div>
              </div>
          </div>
        ))}
      </div>

      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
             <div className="card p-8 border border-slate-100 shadow-sm space-y-5">
                  <h4 className="text-sm font-black text-slate-800 uppercase">Input Mutasi Baru</h4>
                  <select value={inputState.accountId} onChange={e => setInputState({...inputState, accountId: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs"><option value="">-- Pilih Bank --</option>{bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bankName}</option>)}</select>
                  <div className="flex bg-slate-50 rounded-xl p-1">
                      <button onClick={() => setInputState({...inputState, type: 'KREDIT'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${inputState.type === 'KREDIT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>KREDIT (MASUK)</button>
                      <button onClick={() => setInputState({...inputState, type: 'DEBIT'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${inputState.type === 'DEBIT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`}>DEBIT (KELUAR)</button>
                  </div>
                  <input type="number" placeholder="Rp 0" value={inputState.amount} onChange={e => setInputState({...inputState, amount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                  <input type="text" placeholder="Keterangan" value={inputState.description} onChange={e => setInputState({...inputState, description: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs" />
                  <button onClick={submitMutation} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Catat Mutasi</button>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <p className="text-[9px] text-blue-800 font-bold uppercase tracking-widest mb-1">Info Saldo</p>
                      <p className="text-[9px] text-blue-600 leading-relaxed italic">
                          Sesuai standar: Kredit menambah saldo (+), Debit mengurangi saldo (-).
                      </p>
                  </div>
             </div>
          </div>
          <div className="lg:col-span-2 card border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
               <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-black text-slate-800">Riwayat Gabungan</h3>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="Cari..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                    </div>
               </div>
               <div className="overflow-auto flex-1">
                   <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100">
                           <tr>
                               <th className="p-4">Tanggal</th>
                               <th className="p-4">Deskripsi</th>
                               <th className="p-4 text-right">Debit (Keluar)</th>
                               <th className="p-4 text-right">Kredit (Masuk)</th>
                               <th className="p-4 text-center">Aksi</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {filteredHistory.map(m => (
                               <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="p-4 text-xs font-bold text-slate-500">{new Date(m.date).toLocaleDateString('id-ID')}</td>
                                   <td className="p-4">
                                       <p className="text-xs font-bold text-slate-700">{m.description}</p>
                                       {m.source === 'TRANSACTION' && <span className="text-[8px] bg-blue-50 text-blue-500 px-1 py-0.5 rounded font-black uppercase tracking-widest">Sistem</span>}
                                   </td>
                                   <td className="p-4 text-right text-rose-600 font-black text-sm">{m.type === 'DEBIT' ? m.amount.toLocaleString() : '-'}</td>
                                   <td className="p-4 text-right text-emerald-600 font-black text-sm">{m.type === 'KREDIT' ? m.amount.toLocaleString() : '-'}</td>
                                   <td className="p-4 text-center">
                                       <button onClick={() => handleDeleteMutation(m)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="animate-in fade-in slide-in-from-bottom duration-500">
           <div className="card border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div>
                   <h3 className="text-xl font-black text-slate-800">Manajemen Akun Bank</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Daftar rekening bank perumahan</p>
                 </div>
                 <button onClick={() => { setEditingId(null); setNewAccount({ bankName: '', accountNumber: '', accountHolder: '', balance: 0 }); setShowAccountForm(true); }} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/20"><Plus size={16} /><span>Tambah Rekening</span></button>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     <tr>
                       <th className="px-8 py-5">Nama Bank</th>
                       <th className="px-8 py-5">Nomor Rekening</th>
                       <th className="px-8 py-5">Atas Nama</th>
                       <th className="px-8 py-5 text-right">Saldo</th>
                       <th className="px-8 py-5 text-center">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {bankAccounts.map(acc => (
                       <tr key={acc.id} className="hover:bg-slate-50">
                         <td className="px-8 py-5 font-black text-slate-700">{acc.bankName}</td>
                         <td className="px-8 py-5 font-mono text-sm font-bold text-slate-500">{acc.accountNumber}</td>
                         <td className="px-8 py-5 text-[10px] font-black uppercase text-slate-600">{acc.accountHolder}</td>
                         <td className="px-8 py-5 text-right font-black text-emerald-600">Rp {acc.balance.toLocaleString()}</td>
                         <td className="px-8 py-5 text-center flex justify-center gap-2">
                             <button onClick={() => { setEditingId(acc.id); setNewAccount(acc); setBalanceAddition(''); setShowAccountForm(true); }} className="p-2 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-100 transition-all"><Edit size={16} /></button>
                             <button onClick={() => handleDeleteAccount(acc.id)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"><Trash2 size={16} /></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-black text-slate-800">{editingId ? 'Edit Rekening' : 'Tambah Rekening'}</h3>
               <button onClick={() => setShowAccountForm(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleAccountSubmit} className="p-8 space-y-5">
               <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nama Bank</label><input type="text" required value={newAccount.bankName} onChange={e => setNewAccount({...newAccount, bankName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold" /></div>
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">No. Rekening</label><input type="text" required value={newAccount.accountNumber} onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold font-mono" /></div>
               </div>
               <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Atas Nama</label><input type="text" required value={newAccount.accountHolder} onChange={e => setNewAccount({...newAccount, accountHolder: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold uppercase" /></div>
               
               {editingId ? (
                   <div className="grid grid-cols-2 gap-4 pt-2">
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Berjalan</p>
                           <p className="text-sm font-black text-slate-700">Rp {newAccount.balance?.toLocaleString()}</p>
                       </div>
                       <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 relative">
                           <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Tambah Saldo Awal (+)</p>
                           <input 
                             type="number" 
                             placeholder="0"
                             value={balanceAddition}
                             onChange={e => setBalanceAddition(e.target.value)}
                             className="w-full bg-transparent font-black text-emerald-800 text-sm outline-none placeholder:text-emerald-300"
                           />
                           <TrendingUp size={14} className="absolute top-4 right-4 text-emerald-400" />
                       </div>
                   </div>
               ) : (
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Saldo Awal</label><input type="number" required value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold" /></div>
               )}
               
               <div className="pt-2">
                  <button type="submit" className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Simpan Data</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankMutationPage;
