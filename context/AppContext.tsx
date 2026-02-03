import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Resident, Bill, Settings, User, UserRole, BankAccount, BankMutation, Transaction, MeterReading, AppNotification, GlobalPopupRequest, Complaint, Language } from '../types';
import { DEFAULT_SETTINGS, MONTHS, TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface AppContextType {
  residents: Resident[];
  bills: Bill[];
  bankAccounts: BankAccount[];
  bankMutations: BankMutation[];
  transactions: Transaction[]; 
  meterReadings: MeterReading[];
  complaints: Complaint[];
  settings: Settings & { rtList: string[]; rwList: string[] };
  currentUser: User | null;
  systemUsers: User[];
  notifications: AppNotification[];
  globalPopup: GlobalPopupRequest | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING'; 
  loadingProgress: number; 
  language: Language; 
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['id']) => string;
  
  addResident: (resident: Resident) => Promise<void>;
  addResidentsImport: (residents: Resident[]) => Promise<void>;
  updateResident: (resident: Resident) => Promise<void>;
  deleteResident: (id: string) => Promise<void>;
  deleteAllResidents: () => Promise<void>;
  addBankAccount: (account: BankAccount) => Promise<void>;
  updateBankAccount: (account: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  addBankMutation: (mutation: BankMutation) => Promise<void>;
  deleteBankMutation: (id: string) => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addMeterReading: (reading: MeterReading) => Promise<void>;
  updateMeterReading: (reading: MeterReading) => Promise<void>;
  deleteMeterReading: (id: string, residentId: string, month: number, year: number) => Promise<void>;
  updateSettings: (newSettings: Partial<Settings & { rtList: string[]; rwList: string[] }>) => Promise<void>;
  generateBills: (month: number, year: number) => Promise<void>;
  recalculateBills: () => Promise<void>; 
  addBill: (bill: Bill) => Promise<void>;
  updateBill: (bill: Bill) => Promise<void>; 
  deleteBill: (id: string) => Promise<void>;
  payBill: (billId: string, amount: number, paymentMethod: 'CASH' | 'TRANSFER', bankAccountId?: string, proofOfPayment?: string, customDescription?: string, isEdit?: boolean, paymentDate?: string) => Promise<void>;
  addComplaint: (complaint: Complaint) => Promise<void>;
  updateComplaint: (complaint: Complaint) => Promise<void>;
  deleteComplaint: (id: string) => Promise<void>;
  syncUnpaidBills: () => Promise<void>;
  checkUnsyncedBills: () => number;
  addNotification: (message: string, type: AppNotification['type']) => void;
  markNotificationsAsRead: () => void;
  triggerPopup: (request: GlobalPopupRequest) => void;
  closeGlobalPopup: () => void;
  setCurrentUser: (user: User | null) => void;
  addSystemUser: (user: User) => Promise<void>;
  updateSystemUser: (user: User) => Promise<void>;
  deleteSystemUser: (id: string) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<boolean>; 
  updateUserProfile: (id: string, newUsername: string, newPass: string) => Promise<boolean>; 
  resetDatabase: () => Promise<void>;
  exportDatabase: () => Promise<any>;
  importDatabase: (jsonData: any) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankMutations, setBankMutations] = useState<BankMutation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [globalPopup, setGlobalPopup] = useState<GlobalPopupRequest | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'SYNCING'>('CONNECTED');
  const [loadingProgress, setLoadingProgress] = useState(0); 
  
  const [language, setLanguageState] = useState<Language>(() => {
      const saved = localStorage.getItem('app_language');
      return (saved === 'en' || saved === 'id') ? saved : 'id';
  });

  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('app_language', lang);
  };

  const t = (key: keyof typeof TRANSLATIONS['id']) => {
      return TRANSLATIONS[language][key] || key;
  };

  const [settings, setSettings] = useState<Settings & { rtList: string[]; rwList: string[] }>({
    ...DEFAULT_SETTINGS,
    rtList: ['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06'],
    rwList: ['RW 15']
  });

  const addNotification = (message: string, type: AppNotification['type']) => {
    const newNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random()}`,
        message,
        type,
        timestamp: new Date(),
        read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').limit(1);
    if (data && data.length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...data[0].config, id: data[0].id });
    }
  }, []);

  const fetchSystemUsers = useCallback(async () => {
    const { data } = await supabase.from('app_users').select('*');
    if (data) {
        const mappedUsers: User[] = data.map(u => ({
            id: u.id, username: u.username, role: u.role, password: u.password, residentId: u.resident_id, permissions: u.permissions 
        }));
        setSystemUsers(mappedUsers);
    }
  }, []);

  const fetchResidents = useCallback(async () => {
    const { data } = await supabase.from('residents').select('*');
    if (data) {
        const mappedResidents: Resident[] = data.map(r => ({
            id: r.id, houseNo: r.house_no, name: r.name, rt: r.rt, rw: r.rw, phone: r.phone, initialMeter: r.initial_meter, initialArrears: r.initial_arrears, status: r.status, isDispensation: r.is_dispensation ?? false, dispensationNote: r.dispensation_note, exemptions: r.exemptions || [], activeCustomFees: r.active_custom_fees || [], password: r.password
        }));
        setResidents(mappedResidents.sort((a,b) => a.houseNo.localeCompare(b.houseNo, undefined, {numeric: true})));
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    const { data } = await supabase.from('bank_accounts').select('*');
    if (data) {
        const mappedBanks: BankAccount[] = data.map(b => ({
            id: b.id, bankName: b.bank_name, accountNumber: b.account_number, accountHolder: b.account_holder, balance: b.balance, isActive: b.is_active 
        }));
        setBankAccounts(mappedBanks);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*');
    if (data) {
        const mappedTx: Transaction[] = data.map(t => ({
            id: t.id, date: t.date, type: t.type, category: t.category, amount: t.amount, description: t.description, paymentMethod: t.payment_method, bankAccountId: t.bank_account_id, resident_id: t.resident_id, bill_id: t.bill_id
        }));
        setTransactions(mappedTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, []);

  const fetchBills = useCallback(async () => {
    const { data } = await supabase.from('bills').select('*');
    if (data) {
        const mappedBills: Bill[] = data.map(b => ({
            id: b.id, residentId: b.resident_id, period_month: b.period_month, period_year: b.period_year, prev_meter: b.prev_meter, curr_meter: b.curr_meter, water_usage: b.water_usage, water_cost: b.water_cost, ipl_cost: b.ipl_cost, kas_rt_cost: b.kas_rt_cost, abodemen_cost: b.abodemen_cost, extra_cost: b.extra_cost, arrears: b.arrears, total: b.total, status: b.status, paid_amount: b.paid_amount, paid_at: b.paid_at, payment_edit_count: b.payment_edit_count || 0, meter_photo_url: b.meter_photo_url, photo_url: b.photo_url, operator: b.operator, created_at: b.created_at
        }));
        setBills(mappedBills);
    }
  }, []);

  const fetchMeterReadings = useCallback(async () => {
    const { data } = await supabase.from('meter_readings').select('*');
    if (data) {
        const mappedMeter: MeterReading[] = data.map(m => ({
            id: m.id, residentId: m.resident_id, month: m.month, year: m.year, meterValue: m.meter_value, prevMeterValue: m.prev_meter_value, usage: m.usage, photoUrl: m.photo_url, operator: m.operator, timestamp: m.timestamp
        }));
        setMeterReadings(mappedMeter);
    }
  }, []);

  const fetchBankMutations = useCallback(async () => {
    const { data } = await supabase.from('bank_mutations').select('*');
    if (data) {
        const mappedMut: BankMutation[] = data.map(m => ({
            id: m.id, accountId: m.account_id, date: m.date, type: m.type, amount: m.amount, description: m.description, reference: m.reference
        }));
        setBankMutations(mappedMut);
    }
  }, []);

  const fetchComplaints = useCallback(async () => {
    try {
        const { data, error } = await supabase.from('complaints').select('*');
        if (error) { console.warn("Complaints warning:", error.message); return; }
        if (data) {
            const mappedComplaints: Complaint[] = data.map(c => ({
                id: c.id, resident_id: c.resident_id, title: c.title, description: c.description, category: c.category, status: c.status, admin_response: c.admin_response, created_at: c.created_at, updated_at: c.updated_at
            }));
            setComplaints(mappedComplaints.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
    } catch (e) { console.warn("Fetch complaints failed safely"); }
  }, []);

  useEffect(() => {
      const loadAll = async () => {
          setConnectionStatus('SYNCING');
          try {
            await Promise.all([
                fetchSettings(), fetchSystemUsers(), fetchResidents(), fetchBankAccounts(), fetchTransactions(), fetchBills(), fetchMeterReadings(), fetchBankMutations(), fetchComplaints()
            ]);
            setConnectionStatus('CONNECTED');
          } catch (e) {
            console.error("Critical: Initial Data Load Failed", e);
            setConnectionStatus('DISCONNECTED');
          }
      };
      loadAll();

      const channel = supabase.channel('global-db-changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                  setConnectionStatus('SYNCING');
                  switch (payload.table) {
                      case 'residents': fetchResidents(); break;
                      case 'bills': fetchBills(); break;
                      case 'transactions': fetchTransactions(); fetchBankAccounts(); break;
                      case 'bank_accounts': fetchBankAccounts(); break;
                      case 'meter_readings': fetchMeterReadings(); fetchBills(); break;
                      case 'bank_mutations': fetchBankMutations(); fetchBankAccounts(); break;
                      case 'app_settings': fetchSettings(); break;
                      case 'app_users': fetchSystemUsers(); break;
                      case 'complaints': fetchComplaints(); break;
                  }
                  setTimeout(() => setConnectionStatus('CONNECTED'), 500);
              }
          ).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [fetchSettings, fetchSystemUsers, fetchResidents, fetchBankAccounts, fetchTransactions, fetchBills, fetchMeterReadings, fetchBankMutations, fetchComplaints]);

  const markNotificationsAsRead = () => { setNotifications(prev => prev.map(n => ({...n, read: true}))); };
  const triggerPopup = (request: GlobalPopupRequest) => { setGlobalPopup(request); };
  const closeGlobalPopup = () => { setGlobalPopup(null); };

  const addResident = async (resident: Resident) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').insert({
            id: resident.id, house_no: resident.houseNo, name: resident.name, rt: resident.rt, rw: resident.rw, phone: resident.phone, initial_meter: resident.initialMeter, initial_arrears: resident.initialArrears, status: resident.status, is_dispensation: resident.isDispensation, dispensation_note: resident.dispensationNote, exemptions: resident.exemptions, active_custom_fees: resident.activeCustomFees
        });
        if (error) throw error;
        addNotification("Data warga tersimpan", "success");
    } catch (err) { addNotification("Gagal menyimpan warga", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addResidentsImport = async (newResidents: Resident[]) => {
    setConnectionStatus('SYNCING');
    try {
        const dbData = newResidents.map(r => ({
            id: r.id, house_no: r.houseNo, name: r.name, rt: r.rt, rw: r.rw, phone: r.phone, initial_meter: r.initialMeter, initial_arrears: r.initialArrears, status: r.status, is_dispensation: r.isDispensation, dispensation_note: r.dispensationNote, exemptions: r.exemptions, active_custom_fees: r.activeCustomFees
        }));
        const { error } = await supabase.from('residents').insert(dbData);
        if (error) throw error;
        addNotification(`${newResidents.length} data warga berhasil diimport`, "success");
    } catch (err) { console.error(err); addNotification("Gagal import data warga", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateResident = async (updatedResident: Resident) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').update({
            house_no: updatedResident.houseNo, name: updatedResident.name, rt: updatedResident.rt, rw: updatedResident.rw, phone: updatedResident.phone, initial_meter: updatedResident.initialMeter, initial_arrears: updatedResident.initialArrears, status: updatedResident.status, is_dispensation: updatedResident.isDispensation, dispensation_note: updatedResident.dispensationNote, exemptions: updatedResident.exemptions, active_custom_fees: updatedResident.activeCustomFees
        }).eq('id', updatedResident.id);
        if (error) throw error;
        addNotification("Data warga diperbarui", "success");
    } catch (err) { addNotification("Gagal update data warga", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteResident = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').delete().eq('id', id);
        if (error) throw error;
        addNotification("Data warga dihapus", "success");
    } catch (err) { addNotification("Gagal menghapus warga", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteAllResidents = async () => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').delete().neq('id', '0'); 
        if (error) throw error;
        addNotification("Semua data warga dihapus", "warning");
    } catch (err) { addNotification("Gagal reset data warga", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addBankAccount = async (account: BankAccount) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').insert({ 
            id: account.id, bank_name: account.bankName, account_number: account.accountNumber, account_holder: account.accountHolder, balance: account.balance, is_active: account.isActive ?? true 
        });
        if (error) throw error;
        addNotification("Rekening bank disimpan", "success");
    } catch(e) { addNotification("Gagal simpan rekening", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateBankAccount = async (account: BankAccount) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').update({ 
            bank_name: account.bankName, account_number: account.accountNumber, account_holder: account.accountHolder, balance: account.balance, is_active: account.isActive 
        }).eq('id', account.id);
        if (error) throw error;
        addNotification("Data rekening diperbarui", "success");
    } catch(e) { addNotification("Gagal update rekening", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteBankAccount = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
        if (error) throw error;
        addNotification("Rekening dihapus", "success");
    } catch (e) { addNotification("Gagal hapus rekening", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addBankMutation = async (mutation: BankMutation) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_mutations').insert({ id: mutation.id, account_id: mutation.accountId, date: mutation.date, type: mutation.type, amount: mutation.amount, description: mutation.description, reference: mutation.reference });
        if (error) throw error;
        
        // REFINED: KREDIT (Masuk) menambah saldo, DEBIT (Keluar) mengurangi saldo
        const account = bankAccounts.find(a => a.id === mutation.accountId);
        if (account) {
            const change = mutation.type === 'KREDIT' ? mutation.amount : -mutation.amount;
            await supabase.from('bank_accounts').update({ balance: account.balance + change }).eq('id', account.id);
        }
        addNotification("Mutasi bank tercatat", "success");
    } catch (e) { addNotification("Gagal mencatat mutasi", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteBankMutation = async (id: string) => { 
      setConnectionStatus('SYNCING');
      try {
          const mutation = bankMutations.find(m => m.id === id);
          if (!mutation) { setConnectionStatus('CONNECTED'); return; }
          const { error } = await supabase.from('bank_mutations').delete().eq('id', id);
          if (error) throw error;
          
          const account = bankAccounts.find(a => a.id === mutation.accountId);
          if (account) {
              const change = mutation.type === 'KREDIT' ? -mutation.amount : mutation.amount;
              await supabase.from('bank_accounts').update({ balance: account.balance + change }).eq('id', account.id);
          }
          addNotification("Mutasi bank dihapus & saldo dikembalikan", "success");
      } catch (e) { addNotification("Gagal menghapus mutasi", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addTransaction = async (transaction: Transaction) => {
    setConnectionStatus('SYNCING');
    try {
        if (transaction.paymentMethod === 'TRANSFER' && transaction.bankAccountId) {
            const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', transaction.bankAccountId).single();
            if (bankData) {
                const change = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
                const newBalance = (bankData.balance || 0) + change;
                await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', transaction.bankAccountId);
            }
        }

        const { error } = await supabase.from('transactions').insert({ 
            id: transaction.id, date: transaction.date, type: transaction.type, category: transaction.category, amount: transaction.amount, description: transaction.description, payment_method: transaction.paymentMethod, bank_account_id: transaction.bankAccountId, resident_id: transaction.resident_id, bill_id: transaction.bill_id 
        });
        if (error) throw error;
    } catch (e) { 
        console.error(e);
        addNotification("Gagal mencatat transaksi", "error"); 
        setConnectionStatus('CONNECTED'); 
    }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    setConnectionStatus('SYNCING');
    try {
        const oldTx = transactions.find(t => t.id === updatedTx.id);
        if (!oldTx) return;
        
        if (oldTx.paymentMethod === 'TRANSFER' && oldTx.bankAccountId) {
            const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', oldTx.bankAccountId).single();
            if (bankData) {
                const revertChange = oldTx.type === 'INCOME' ? -oldTx.amount : oldTx.amount;
                await supabase.from('bank_accounts').update({ balance: bankData.balance + revertChange }).eq('id', oldTx.bankAccountId);
            }
        }
        
        const { error: txError } = await supabase.from('transactions').update({
            date: updatedTx.date, description: updatedTx.description, type: updatedTx.type, category: updatedTx.category, amount: updatedTx.amount, payment_method: updatedTx.paymentMethod, bank_account_id: updatedTx.bankAccountId
        }).eq('id', updatedTx.id);
        if (txError) throw txError;
        
        if (updatedTx.paymentMethod === 'TRANSFER' && updatedTx.bankAccountId) {
             const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', updatedTx.bankAccountId).single();
             if (bankData) {
                 const change = updatedTx.type === 'INCOME' ? updatedTx.amount : -updatedTx.amount;
                 await supabase.from('bank_accounts').update({ balance: bankData.balance + change }).eq('id', updatedTx.bankAccountId);
             }
        }
        addNotification("Transaksi diperbarui", "success");
    } catch (e) { addNotification("Gagal mengupdate transaksi", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteTransaction = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        
        if (tx.paymentMethod === 'TRANSFER' && tx.bankAccountId) {
            const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', tx.bankAccountId).single();
            if (bankData) {
                const change = tx.type === 'INCOME' ? -tx.amount : tx.amount;
                await supabase.from('bank_accounts').update({ balance: bankData.balance + change }).eq('id', tx.bankAccountId);
            }
        }
        addNotification("Transaksi dihapus", "success");
    } catch (e) { addNotification("Gagal hapus transaksi", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addMeterReading = async (reading: MeterReading) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').insert({ id: reading.id, resident_id: reading.residentId, month: reading.month, year: reading.year, meter_value: reading.meterValue, prev_meter_value: reading.prevMeterValue, usage: reading.usage, photo_url: reading.photoUrl, operator: reading.operator, timestamp: reading.timestamp });
        if (error) throw error;
        
        const resident = residents.find(r => r.id === reading.residentId);
        if (resident) {
            const ipl = (resident.isDispensation && resident.exemptions?.includes('IPL')) ? 0 : settings.ipl_base;
            const kas = (resident.isDispensation && resident.exemptions?.includes('KAS_RT')) ? 0 : settings.kas_rt_base;
            const abodemen = (resident.isDispensation && resident.exemptions?.includes('WATER_ABODEMEN')) ? 0 : settings.water_abodemen;
            let totalExtra = 0;
            settings.extra_fees.forEach(fee => { if (resident.activeCustomFees?.includes(fee.id)) totalExtra += fee.amount; });
            const isWaterUsageExempt = resident.isDispensation && resident.exemptions?.includes('WATER_USAGE');
            let waterCost = 0;
            const limit = settings.water_rate_threshold || 10;
            if (reading.usage > 0 && !isWaterUsageExempt) {
                if (reading.usage <= limit) waterCost = reading.usage * settings.water_rate_low;
                else waterCost = (limit * settings.water_rate_low) + ((reading.usage - limit) * settings.water_rate_high);
            }
            const total = ipl + kas + abodemen + totalExtra + waterCost + resident.initialArrears;
            await supabase.from('bills').upsert({ id: `bill-${resident.id}-${reading.month}-${reading.year}`, resident_id: resident.id, period_month: reading.month, period_year: reading.year, prev_meter: reading.prevMeterValue, curr_meter: reading.meterValue, water_usage: reading.usage, water_cost: waterCost, ipl_cost: ipl, kas_rt_cost: kas, abodemen_cost: abodemen, extra_cost: totalExtra, arrears: resident.initialArrears, total: total, status: 'UNPAID', meter_photo_url: reading.photoUrl, operator: reading.operator });
            addNotification(`Meteran & Tagihan ${resident.houseNo} tersimpan!`, "success");
        }
    } catch(e) { addNotification("Gagal menyimpan meteran", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateMeterReading = async (reading: MeterReading) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').update({
            meter_value: reading.meterValue, usage: reading.usage, photo_url: reading.photoUrl, timestamp: new Date().toISOString(), operator: reading.operator
        }).eq('id', reading.id);
        if (error) throw error;

        const resident = residents.find(r => r.id === reading.residentId);
        if (resident) {
            const ipl = (resident.isDispensation && resident.exemptions?.includes('IPL')) ? 0 : settings.ipl_base;
            const kas = (resident.isDispensation && resident.exemptions?.includes('KAS_RT')) ? 0 : settings.kas_rt_base;
            const abodemen = (resident.isDispensation && resident.exemptions?.includes('WATER_ABODEMEN')) ? 0 : settings.water_abodemen;
            let totalExtra = 0;
            settings.extra_fees.forEach(fee => { if (resident.activeCustomFees?.includes(fee.id)) totalExtra += fee.amount; });
            const isWaterUsageExempt = resident.isDispensation && resident.exemptions?.includes('WATER_USAGE');
            let waterCost = 0;
            const limit = settings.water_rate_threshold || 10;
            if (reading.usage > 0 && !isWaterUsageExempt) {
                if (reading.usage <= limit) waterCost = reading.usage * settings.water_rate_low;
                else waterCost = (limit * settings.water_rate_low) + ((reading.usage - limit) * settings.water_rate_high);
            }
            const total = ipl + kas + abodemen + totalExtra + waterCost + resident.initialArrears;
            await supabase.from('bills').upsert({ 
                id: `bill-${resident.id}-${reading.month}-${reading.year}`, resident_id: resident.id, period_month: reading.month, period_year: reading.year, prev_meter: reading.prevMeterValue, curr_meter: reading.meterValue, water_usage: reading.usage, water_cost: waterCost, ipl_cost: ipl, kas_rt_cost: kas, abodemen_cost: abodemen, extra_cost: totalExtra, arrears: resident.initialArrears, total: total, meter_photo_url: reading.photoUrl, operator: reading.operator 
            });
            addNotification(`Data meteran unit ${resident.houseNo} berhasil diperbarui!`, "success");
        }
    } catch(e) { addNotification("Gagal memperbarui meteran", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteMeterReading = async (id: string, residentId: string, month: number, year: number) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').delete().eq('id', id);
        if (error) throw error;
        const billId = `bill-${residentId}-${month}-${year}`;
        await supabase.from('bills').delete().eq('id', billId);
        addNotification("Data meteran dan tagihan dihapus", "success");
    } catch(e) { addNotification("Gagal menghapus meteran", "error"); setConnectionStatus('CONNECTED'); }
  };

  const recalculateBills = async () => {
        setConnectionStatus('SYNCING');
        setLoadingProgress(0); 
        try {
            const unpaidBills = bills.filter(b => b.status === 'UNPAID');
            const updates = unpaidBills.map(bill => {
                const resident = residents.find(r => r.id === bill.residentId);
                if (!resident) return null;
                const ipl = (resident.isDispensation && resident.exemptions?.includes('IPL')) ? 0 : settings.ipl_base;
                const kas = (resident.isDispensation && resident.exemptions?.includes('KAS_RT')) ? 0 : settings.kas_rt_base;
                const abodemen = (resident.isDispensation && resident.exemptions?.includes('WATER_ABODEMEN')) ? 0 : settings.water_abodemen;
                let totalExtra = 0;
                settings.extra_fees.forEach(fee => { if (resident.activeCustomFees?.includes(fee.id)) totalExtra += fee.amount; });
                const isWaterUsageExempt = resident.isDispensation && resident.exemptions?.includes('WATER_USAGE');
                let waterCost = 0;
                const limit = settings.water_rate_threshold || 10;
                if (bill.water_usage > 0 && !isWaterUsageExempt) {
                    if (bill.water_usage <= limit) waterCost = bill.water_usage * settings.water_rate_low;
                    else waterCost = (limit * settings.water_rate_low) + ((bill.water_usage - limit) * settings.water_rate_high);
                }
                const total = ipl + kas + abodemen + totalExtra + waterCost + bill.arrears;
                return {
                    ...bill, ipl_cost: ipl, kas_rt_cost: kas, abodemen_cost: abodemen, extra_cost: totalExtra, water_cost: waterCost, total: total
                };
            }).filter(Boolean) as Bill[];

            const BATCH_SIZE = 20; 
            const totalItems = updates.length;
            let processed = 0;

            if (totalItems > 0) {
                for (let i = 0; i < totalItems; i += BATCH_SIZE) {
                    const batch = updates.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(b => 
                        supabase.from('bills').update({
                            ipl_cost: b.ipl_cost, kas_rt_cost: b.kas_rt_cost, abodemen_cost: b.abodemen_cost, extra_cost: b.extra_cost, water_cost: b.water_cost, total: b.total
                        }).eq('id', b.id)
                    ));
                    processed += batch.length;
                    setLoadingProgress(Math.round((processed / totalItems) * 100));
                    await new Promise(r => setTimeout(r, 50));
                }
            }
            fetchBills();
            addNotification(`Berhasil menghitung ulang ${totalItems} tagihan.`, "success");
            setConnectionStatus('CONNECTED');
            setLoadingProgress(100);
            setTimeout(() => setLoadingProgress(0), 1000); 
        } catch (e) {
            addNotification("Gagal menghitung ulang tagihan.", "error");
            setConnectionStatus('CONNECTED');
            setLoadingProgress(0);
        }
  };

  const updateSettings = async (newSettings: Partial<Settings & { rtList: string[]; rwList: string[] }>) => {
    setConnectionStatus('SYNCING');
    try {
        const mergedSettings = { ...settings, ...newSettings };
        const { data } = await supabase.from('app_settings').select('id').limit(1);
        if (data && data.length > 0) await supabase.from('app_settings').update({ config: mergedSettings }).eq('id', data[0].id);
        else await supabase.from('app_settings').insert({ config: mergedSettings });
        setSettings(mergedSettings);
        await recalculateBills(); 
        triggerPopup({ title: 'Tersimpan & Diperbarui', message: 'Pengaturan disimpan.', type: 'DATA' });
    } catch (e) { addNotification("Gagal menyimpan pengaturan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const generateBills = async (month: number, year: number) => {};
  const addBill = async (bill: Bill) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').insert({ id: bill.id, resident_id: bill.residentId, period_month: bill.period_month, period_year: bill.period_year, total: bill.total, status: bill.status, created_at: bill.created_at });
        if (error) throw error;
        addNotification("Tagihan manual tersimpan", "success");
    } catch (e) { addNotification("Gagal membuat tagihan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateBill = async (bill: Bill) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').update({ ipl_cost: bill.ipl_cost, kas_rt_cost: bill.kas_rt_cost, abodemen_cost: bill.abodemen_cost, water_cost: bill.water_cost, extra_cost: bill.extra_cost, arrears: bill.arrears, total: bill.total }).eq('id', bill.id);
        if (error) throw error;
        addNotification("Perubahan tagihan disimpan", "success");
        setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
        setConnectionStatus('CONNECTED');
    } catch (e) { addNotification("Gagal memperbarui tagihan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteBill = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').delete().eq('id', id);
        if (error) throw error;
        addNotification("Tagihan dihapus", "success");
    } catch (e) { addNotification("Gagal menghapus tagihan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const payBill = async (billId: string, amount: number, paymentMethod: 'CASH' | 'TRANSFER', bankAccountId?: string, proofOfPayment?: string, customDescription?: string, isEdit: boolean = false, paymentDate?: string) => {
    setConnectionStatus('SYNCING');
    try {
        const bill = bills.find(b => b.id === billId);
        if (!bill) return;
        
        const pDate = paymentDate ? new Date(paymentDate) : new Date();
        const paidAtDate = pDate.toISOString();
        const txDate = pDate.toISOString().split('T')[0];

        // LOGIKA KATEGORI OTOMATIS BERDASARKAN PERIODE TAGIHAN VS TANGGAL PEMBAYARAN
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Tagihan dianggap TUNGGAKAN jika periodenya sudah lewat dari bulan/tahun berjalan
        const isArrears = (bill.period_year < currentYear) || (bill.period_year === currentYear && bill.period_month < currentMonth);
        const category = isArrears ? "PENERIMAAN TUNGGAKAN" : "PENERIMAAN TAGIHAN";

        if (isEdit) {
            const oldTx = transactions.find(t => t.bill_id === billId && t.type === 'INCOME');
            if (oldTx) {
                await deleteTransaction(oldTx.id);
                const oldDiff = bill.total - (bill.paid_amount || 0);
                const resident = residents.find(r => r.id === bill.residentId);
                if (resident) {
                    await supabase.from('residents').update({ initial_arrears: resident.initialArrears - oldDiff }).eq('id', resident.id);
                }
            }
        }

        const updateData: any = { status: 'PAID', paid_amount: amount, paid_at: paidAtDate };
        if (proofOfPayment) updateData.photo_url = proofOfPayment;
        if (isEdit) updateData.payment_edit_count = (bill.payment_edit_count || 0) + 1;
        await supabase.from('bills').update(updateData).eq('id', billId);

        const { data: resData } = await supabase.from('residents').select('initial_arrears').eq('id', bill.residentId).single();
        const currentArrears = resData?.initial_arrears || 0;
        const newDiff = bill.total - amount;
        await supabase.from('residents').update({ initial_arrears: currentArrears + newDiff }).eq('id', bill.residentId);

        const monthName = MONTHS[bill.period_month - 1] || 'Bulan Ini';
        const resident = residents.find(r => r.id === bill.residentId);
        const houseNo = resident ? resident.houseNo : 'Unknown';
        const description = customDescription || `Pembayaran ${isArrears ? 'Tunggakan' : 'Tagihan'} ${houseNo} (${monthName} ${bill.period_year})${newDiff !== 0 ? (newDiff > 0 ? ' [Kurang Bayar]' : ' [Lebih Bayar]') : ''}${isEdit ? ' (Edit)' : ''}`;
        
        await addTransaction({ id: `tx-pay-${Date.now()}`, date: txDate, description, type: 'INCOME', category, amount, paymentMethod, bankAccountId, resident_id: bill.residentId, bill_id: bill.id });
        addNotification(isEdit ? "Pembayaran berhasil diubah" : "Pembayaran berhasil", "success");
    } catch(e) { addNotification("Gagal memproses pembayaran", "error"); setConnectionStatus('CONNECTED'); }
  };

  const addComplaint = async (complaint: Complaint) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').insert({ id: complaint.id, resident_id: complaint.resident_id, title: complaint.title, description: complaint.description, category: complaint.category, status: complaint.status, created_at: complaint.created_at });
        if (error) throw error;
        addNotification("Aduan berhasil dikirim", "success");
    } catch (e: any) { addNotification("Gagal mengirim aduan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateComplaint = async (complaint: Complaint) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').update({ status: complaint.status, admin_response: complaint.admin_response, updated_at: new Date().toISOString() }).eq('id', complaint.id);
        if (error) throw error;
        addNotification("Status aduan diperbarui", "success");
    } catch (e) { addNotification("Gagal update aduan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteComplaint = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').delete().eq('id', id);
        if (error) throw error;
        addNotification("Aduan dihapus", "success");
    } catch (e) { addNotification("Gagal menghapus aduan", "error"); setConnectionStatus('CONNECTED'); }
  };

  const syncUnpaidBills = async () => {};
  const checkUnsyncedBills = () => 0;

  const addSystemUser = async (user: User) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').insert({ id: user.id, username: user.username, password: user.password, role: user.role, permissions: user.permissions });
        addNotification("User ditambahkan", "success");
    } catch(e) { addNotification("Gagal menambah user", "error"); setConnectionStatus('CONNECTED'); }
  };

  const updateSystemUser = async (user: User) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').update({ username: user.username, password: user.password, role: user.role, permissions: user.permissions }).eq('id', user.id);
        addNotification("User diperbarui", "success");
    } catch(e) { addNotification("Gagal update user", "error"); setConnectionStatus('CONNECTED'); }
  };

  const deleteSystemUser = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').delete().eq('id', id);
        addNotification("User dihapus", "success");
    } catch(e) { addNotification("Gagal hapus user", "error"); setConnectionStatus('CONNECTED'); }
  };

  const changePassword = async (oldPass: string, newPass: string) => false;

  const updateUserProfile = async (id: string, newUsername: string, newPass: string) => {
      setConnectionStatus('SYNCING');
      try {
          if (!currentUser) return false;
          if (currentUser.role === UserRole.RESIDENT) await supabase.from('residents').update({ password: newPass }).eq('id', id);
          else await supabase.from('app_users').update({ username: newUsername, password: newPass }).eq('id', id);
          const updatedUser = { ...currentUser, username: newUsername };
          setCurrentUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          addNotification("Profil diperbarui", "success");
          setConnectionStatus('CONNECTED');
          return true;
      } catch (e) { addNotification("Gagal memperbarui profil", "error"); setConnectionStatus('CONNECTED'); return false; }
  };

  const resetDatabase = async () => {
      setConnectionStatus('SYNCING');
      await supabase.from('transactions').delete().neq('id', '0');
      await supabase.from('bills').delete().neq('id', '0');
      await supabase.from('meter_readings').delete().neq('id', '0');
      await supabase.from('bank_mutations').delete().neq('id', '0');
      await supabase.from('residents').delete().neq('id', '0');
      await supabase.from('complaints').delete().neq('id', '0');
      addNotification("Database berhasil di-reset", "success");
      setConnectionStatus('CONNECTED');
  };

  const exportDatabase = async () => {
      try {
          const { data: app_settings } = await supabase.from('app_settings').select('*');
          const { data: residents } = await supabase.from('residents').select('*');
          const { data: bills } = await supabase.from('bills').select('*');
          const { data: transactions } = await supabase.from('transactions').select('*');
          const { data: meter_readings } = await supabase.from('meter_readings').select('*');
          const { data: bank_accounts } = await supabase.from('bank_accounts').select('*');
          const { data: bank_mutations } = await supabase.from('bank_mutations').select('*');
          const { data: app_users } = await supabase.from('app_users').select('*');
          const { data: complaints } = await supabase.from('complaints').select('*');
          return { app_settings, residents, bills, transactions, meter_readings, bank_accounts, bank_mutations, app_users, complaints, _metadata: { export_date: new Date().toISOString(), version: '1.0' } };
      } catch (error) { console.error("Export failed", error); throw error; }
  };

  const importDatabase = async (jsonData: any) => {
      setConnectionStatus('SYNCING');
      try {
          if (!jsonData._metadata) throw new Error("Invalid Backup File");
          if (jsonData.app_settings) await supabase.from('app_settings').upsert(jsonData.app_settings);
          if (jsonData.bank_accounts) await supabase.from('bank_accounts').upsert(jsonData.bank_accounts);
          if (jsonData.residents) await supabase.from('residents').upsert(jsonData.residents);
          if (jsonData.app_users) await supabase.from('app_users').upsert(jsonData.app_users);
          if (jsonData.meter_readings) await supabase.from('meter_readings').upsert(jsonData.meter_readings);
          if (jsonData.bills) await supabase.from('bills').upsert(jsonData.bills);
          if (jsonData.transactions) await supabase.from('transactions').upsert(jsonData.transactions);
          if (jsonData.bank_mutations) await supabase.from('bank_mutations').upsert(jsonData.bank_mutations);
          if (jsonData.complaints) await supabase.from('complaints').upsert(jsonData.complaints);
          addNotification("Database berhasil di-restore!", "success");
          setConnectionStatus('CONNECTED');
          window.location.reload(); 
          return true;
      } catch (error) { addNotification("Gagal restore database", "error"); setConnectionStatus('CONNECTED'); return false; }
  };

  const value = {
    residents, bills, bankAccounts, bankMutations, transactions, meterReadings, complaints, settings, currentUser, systemUsers, notifications, globalPopup, connectionStatus, loadingProgress, language,
    addResident, addResidentsImport, updateResident, deleteResident, deleteAllResidents, addBankAccount, updateBankAccount, deleteBankAccount, addBankMutation, deleteBankMutation,
    addTransaction, updateTransaction, deleteTransaction, addMeterReading, updateMeterReading, deleteMeterReading, updateSettings, generateBills, recalculateBills, addBill, updateBill, deleteBill, payBill,
    addComplaint, updateComplaint, deleteComplaint,
    syncUnpaidBills, checkUnsyncedBills, addNotification, markNotificationsAsRead, triggerPopup, closeGlobalPopup, setCurrentUser, addSystemUser,
    updateSystemUser, deleteSystemUser, changePassword, updateUserProfile, resetDatabase, exportDatabase, importDatabase, setLanguage, t
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};