
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Resident, Bill, Settings, User, UserRole, BankAccount, BankMutation, Transaction, MeterReading, AppNotification, GlobalPopupRequest, Complaint } from '../types';
import { DEFAULT_SETTINGS, MONTHS } from '../constants';
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
  addBill: (bill: Bill) => Promise<void>;
  updateBill: (bill: Bill) => Promise<void>; 
  deleteBill: (id: string) => Promise<void>;
  payBill: (billId: string, amount: number, paymentMethod: 'CASH' | 'TRANSFER', bankAccountId?: string, customDescription?: string, isEdit?: boolean) => Promise<void>;
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
  changeLanguage: (lang: 'id' | 'en') => void;
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
  
  const [settings, setSettings] = useState<Settings & { rtList: string[]; rwList: string[] }>({
    ...DEFAULT_SETTINGS,
    rtList: ['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06'],
    rwList: ['RW 15'],
    language: (localStorage.getItem('app_language') as 'id' | 'en') || DEFAULT_SETTINGS.language
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
        const dbConfig = { ...DEFAULT_SETTINGS, ...data[0].config, id: data[0].id };
        const localLang = localStorage.getItem('app_language');
        if (localLang) { dbConfig.language = localLang as 'id' | 'en'; }
        setSettings(dbConfig);
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
        const mappedResidents: Resident[] = (data as any[]).map(r => ({
            id: r.id, 
            houseNo: r.house_no, 
            name: r.name, 
            rt: r.rt, 
            rw: r.rw, 
            phone: r.phone, 
            initialMeter: r.initial_meter, 
            initialArrears: r.initial_arrears, 
            deposit: r.deposit || 0, 
            status: r.status, 
            isDispensation: r.is_dispensation ?? false, 
            dispensationNote: r.dispensation_note, 
            exemptions: r.exemptions || [], 
            activeCustomFees: r.active_custom_fees || [], 
            password: r.password
        }));
        setResidents(mappedResidents.sort((a,b) => a.houseNo.localeCompare(b.houseNo, undefined, {numeric: true})));
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    const { data } = await supabase.from('bank_accounts').select('*');
    if (data) {
        const mappedBanks: BankAccount[] = data.map(b => ({
            id: b.id, 
            bankName: b.bank_name, 
            accountNumber: b.account_number, 
            accountHolder: b.account_holder, 
            balance: b.balance,
            isActiveForBilling: b.is_active_for_billing ?? true, // Fallback to true if missing
            isActiveForExpense: b.is_active_for_expense ?? true
        }));
        setBankAccounts(mappedBanks);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*');
    if (data) {
        const mappedTx: Transaction[] = (data as any[]).map(t => ({
            id: t.id, date: t.date, type: t.type, category: t.category, amount: t.amount, description: t.description, paymentMethod: t.payment_method, bankAccountId: t.bank_account_id, resident_id: t.resident_id, bill_id: t.bill_id
        }));
        setTransactions(mappedTx.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, []);

  const fetchBills = useCallback(async () => {
    const { data } = await supabase.from('bills').select('*');
    if (data) {
        const mappedBills: Bill[] = data.map(b => ({
            id: b.id, residentId: b.resident_id, period_month: b.period_month, period_year: b.period_year, prev_meter: b.prev_meter, curr_meter: b.curr_meter, water_usage: b.water_usage, water_cost: b.water_cost, ipl_cost: b.ipl_cost, kas_rt_cost: b.kas_rt_cost, abodemen_cost: b.abodemen_cost, extra_cost: b.extra_cost, arrears: b.arrears, total: b.total, status: b.status, paid_amount: b.paid_amount, paid_at: b.paid_at, payment_edit_count: b.payment_edit_count || 0, meter_photo_url: b.meter_photo_url, operator: b.operator, created_at: b.created_at
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
        if (error) return;
        if (data) {
            const mappedComplaints: Complaint[] = data.map(c => ({
                id: c.id, resident_id: c.resident_id, title: c.title, description: c.description, category: c.category, status: c.status, admin_response: c.admin_response, created_at: c.created_at, updated_at: c.updated_at
            }));
            setComplaints(mappedComplaints.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
    } catch (e) {}
  }, []);

  useEffect(() => {
      const loadAll = async () => {
          setConnectionStatus('SYNCING');
          try {
            await Promise.all([
                fetchSettings(), fetchSystemUsers(), fetchResidents(), fetchBankAccounts(), fetchTransactions(), fetchBills(), fetchMeterReadings(), fetchBankMutations(), fetchComplaints()
            ]);
            setConnectionStatus('CONNECTED');
          } catch (e) { setConnectionStatus('DISCONNECTED'); }
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
          })
          .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [fetchSettings, fetchSystemUsers, fetchResidents, fetchBankAccounts, fetchTransactions, fetchBills, fetchMeterReadings, fetchBankMutations, fetchComplaints]);

  const markNotificationsAsRead = () => { setNotifications(prev => prev.map(n => ({...n, read: true}))); };
  const triggerPopup = (request: GlobalPopupRequest) => { setGlobalPopup(request); };
  const closeGlobalPopup = () => { setGlobalPopup(null); };

  const changeLanguage = (lang: 'id' | 'en') => {
      localStorage.setItem('app_language', lang);
      setSettings(prev => ({ ...prev, language: lang }));
  };

  const addResident = async (resident: Resident) => {
    setConnectionStatus('SYNCING');
    try {
        // Fix: Use resident.isDispensation instead of resident.is_dispensation
        const { error } = await supabase.from('residents').insert({
            id: resident.id, house_no: resident.houseNo, name: resident.name, rt: resident.rt, rw: resident.rw, phone: resident.phone, initial_meter: resident.initialMeter, initial_arrears: resident.initialArrears, deposit: resident.deposit, status: resident.status, is_dispensation: resident.isDispensation, dispensation_note: resident.dispensationNote, exemptions: resident.exemptions, active_custom_fees: resident.activeCustomFees
        });
        if (error) throw error;
        
        // Optimistic update
        setResidents(prev => [...prev, resident].sort((a,b) => a.houseNo.localeCompare(b.houseNo, undefined, {numeric: true})));
        
        addNotification("Data warga tersimpan", "success");
    } catch (err) { 
        addNotification("Gagal menyimpan warga", "error"); 
    } finally {
        setConnectionStatus('CONNECTED');
    }
  };

  const addResidentsImport = async (newResidents: Resident[]) => {
    setConnectionStatus('SYNCING');
    try {
        const dbData = newResidents.map(r => ({
            // Fix: Use r.isDispensation instead of r.is_dispensation
            id: r.id, house_no: r.houseNo, name: r.name, rt: r.rt, rw: r.rw, phone: r.phone, initial_meter: r.initialMeter, initial_arrears: r.initialArrears, deposit: r.deposit, status: r.status, is_dispensation: r.isDispensation, dispensation_note: r.dispensationNote, exemptions: r.exemptions, active_custom_fees: r.activeCustomFees
        }));
        const { error } = await supabase.from('residents').insert(dbData);
        if (error) throw error;
        
        // Optimistic update
        setResidents(prev => [...prev, ...newResidents].sort((a,b) => a.houseNo.localeCompare(b.houseNo, undefined, {numeric: true})));

        addNotification(`${newResidents.length} data warga berhasil diimport`, "success");
    } catch (err) { addNotification("Gagal import data warga", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateResident = async (updatedResident: Resident) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').update({
            house_no: updatedResident.houseNo, name: updatedResident.name, rt: updatedResident.rt, rw: updatedResident.rw, phone: updatedResident.phone, initial_meter: updatedResident.initialMeter, initial_arrears: updatedResident.initialArrears, deposit: updatedResident.deposit, status: updatedResident.status, is_dispensation: updatedResident.isDispensation, dispensation_note: updatedResident.dispensationNote, exemptions: updatedResident.exemptions, active_custom_fees: updatedResident.activeCustomFees
        }).eq('id', updatedResident.id);
        if (error) throw error;
        
        // Optimistic update
        setResidents(prev => prev.map(r => r.id === updatedResident.id ? updatedResident : r).sort((a,b) => a.houseNo.localeCompare(b.houseNo, undefined, {numeric: true})));

        addNotification("Data warga diperbarui", "success");
    } catch (err) { addNotification("Gagal update data warga", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteResident = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').delete().eq('id', id);
        if (error) throw error;
        
        // Optimistic update
        setResidents(prev => prev.filter(r => r.id !== id));

        addNotification("Data warga dihapus", "success");
    } catch (err) { addNotification("Gagal menghapus warga", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteAllResidents = async () => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('residents').delete().neq('id', '0'); 
        if (error) throw error;
        setResidents([]);
        addNotification("Semua data warga dihapus", "warning");
    } catch (err) { addNotification("Gagal reset data warga", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const addBankAccount = async (account: BankAccount) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').insert({ 
            id: account.id, 
            bank_name: account.bankName, 
            account_number: account.accountNumber, 
            account_holder: account.accountHolder, 
            balance: account.balance,
            is_active_for_billing: account.isActiveForBilling ?? true,
            is_active_for_expense: account.isActiveForExpense ?? true
        });
        if (error) throw error;
        setBankAccounts(prev => [...prev, account]);
        addNotification("Rekening bank disimpan", "success");
    } catch(e) { addNotification("Gagal simpan rekening", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateBankAccount = async (account: BankAccount) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').update({ 
            bank_name: account.bankName, 
            account_number: account.accountNumber, 
            account_holder: account.accountHolder, 
            balance: account.balance,
            is_active_for_billing: account.isActiveForBilling,
            is_active_for_expense: account.isActiveForExpense
        }).eq('id', account.id);
        if (error) throw error;
        setBankAccounts(prev => prev.map(b => b.id === account.id ? account : b));
        addNotification("Data rekening diperbarui", "success");
    } catch(e) { addNotification("Gagal update rekening", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteBankAccount = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
        if (error) throw error;
        setBankAccounts(prev => prev.filter(b => b.id !== id));
        addNotification("Rekening dihapus", "success");
    } catch (e) { addNotification("Gagal hapus rekening", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const addBankMutation = async (mutation: BankMutation) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bank_mutations').insert({ id: mutation.id, account_id: mutation.accountId, date: mutation.date, type: mutation.type, amount: mutation.amount, description: mutation.description, reference: mutation.reference });
        if (error) throw error;
        
        setBankMutations(prev => [...prev, mutation]);

        const txDate = mutation.date.split('T')[0];
        const txType = mutation.type === 'DEBIT' ? 'INCOME' : 'EXPENSE';
        
        const { data: existingTx } = await supabase.from('transactions').select('*').eq('date', txDate).eq('description', mutation.description).eq('bank_account_id', mutation.accountId).eq('type', txType).maybeSingle();

        if (existingTx) {
            const newTotal = existingTx.amount + mutation.amount;
            await updateTransaction({ ...existingTx, amount: newTotal, paymentMethod: 'TRANSFER', bankAccountId: mutation.accountId } as any);
        } else {
            await addTransaction({
                id: `tx-mut-${Date.now()}-${Math.random()}`,
                date: txDate,
                type: txType,
                category: 'Mutasi Bank',
                amount: mutation.amount,
                description: mutation.description,
                paymentMethod: 'TRANSFER',
                bankAccountId: mutation.accountId
            });
        }
        addNotification("Mutasi bank tercatat", "success");
    } catch (e) { addNotification("Gagal mencatat mutasi", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteBankMutation = async (id: string) => { 
      setConnectionStatus('SYNCING');
      try {
          const mutation = bankMutations.find(m => m.id === id);
          if (!mutation) return;
          
          const { error } = await supabase.from('bank_mutations').delete().eq('id', id);
          if (error) throw error;
          
          setBankMutations(prev => prev.filter(m => m.id !== id));

          const relatedTx = transactions.find(t => t.description === mutation.description && t.bankAccountId === mutation.accountId && t.amount === mutation.amount);
          if (relatedTx) {
              await deleteTransaction(relatedTx.id);
          }
          
          addNotification("Mutasi bank dihapus", "success");
      } catch (e) { addNotification("Gagal menghapus mutasi", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const addTransaction = async (transaction: Transaction) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('transactions').insert({ 
            id: transaction.id, date: transaction.date, type: transaction.type, category: transaction.category, amount: transaction.amount, description: transaction.description, payment_method: transaction.paymentMethod, bank_account_id: transaction.bankAccountId || null, resident_id: transaction.resident_id || null, bill_id: transaction.bill_id || null
        });
        if (error) throw error;
        
        setTransactions(prev => [...prev, transaction].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        if (transaction.paymentMethod === 'TRANSFER' && transaction.bankAccountId) {
            const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', transaction.bankAccountId).single();
            if (bankData) {
                const change = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
                await supabase.from('bank_accounts').update({ balance: bankData.balance + change }).eq('id', transaction.bankAccountId);
                setBankAccounts(prev => prev.map(b => b.id === transaction.bankAccountId ? { ...b, balance: bankData.balance + change } : b));
            }
        }
        addNotification("Transaksi tercatat", "success");
    } catch (e) { addNotification("Gagal mencatat transaksi", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    setConnectionStatus('SYNCING');
    try {
        const oldTx = transactions.find(t => t.id === updatedTx.id);
        if (!oldTx) return;

        if (oldTx.paymentMethod === 'TRANSFER' && oldTx.bankAccountId) {
            const { data: bData } = await supabase.from('bank_accounts').select('balance').eq('id', oldTx.bankAccountId).single();
            if (bData) {
                const revertedBalance = bData.balance + (oldTx.type === 'INCOME' ? -oldTx.amount : oldTx.amount);
                
                if (oldTx.bankAccountId === updatedTx.bankAccountId && updatedTx.paymentMethod === 'TRANSFER') {
                    const newBalance = revertedBalance + (updatedTx.type === 'INCOME' ? updatedTx.amount : -updatedTx.amount);
                    await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', updatedTx.bankAccountId);
                    setBankAccounts(prev => prev.map(b => b.id === updatedTx.bankAccountId ? { ...b, balance: newBalance } : b));
                } else {
                    await supabase.from('bank_accounts').update({ balance: revertedBalance }).eq('id', oldTx.bankAccountId);
                    setBankAccounts(prev => prev.map(b => b.id === oldTx.bankAccountId ? { ...b, balance: revertedBalance } : b));
                    
                    if (updatedTx.paymentMethod === 'TRANSFER' && updatedTx.bankAccountId) {
                        const { data: bNewData } = await supabase.from('bank_accounts').select('balance').eq('id', updatedTx.bankAccountId).single();
                        if (bNewData) {
                            const newBalance = bNewData.balance + (updatedTx.type === 'INCOME' ? updatedTx.amount : -updatedTx.amount);
                            await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', updatedTx.bankAccountId);
                            setBankAccounts(prev => prev.map(b => b.id === updatedTx.bankAccountId ? { ...b, balance: newBalance } : b));
                        }
                    }
                }
            }
        } else if (updatedTx.paymentMethod === 'TRANSFER' && updatedTx.bankAccountId) {
            const { data: bNewData } = await supabase.from('bank_accounts').select('balance').eq('id', updatedTx.bankAccountId).single();
            if (bNewData) {
                const newBalance = bNewData.balance + (updatedTx.type === 'INCOME' ? updatedTx.amount : -updatedTx.amount);
                await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', updatedTx.bankAccountId);
                setBankAccounts(prev => prev.map(b => b.id === updatedTx.bankAccountId ? { ...b, balance: newBalance } : b));
            }
        }

        const { error } = await supabase.from('transactions').update({
            date: updatedTx.date, description: updatedTx.description, type: updatedTx.type, category: updatedTx.category, amount: updatedTx.amount, payment_method: updatedTx.paymentMethod, bank_account_id: updatedTx.bankAccountId || null
        }).eq('id', updatedTx.id);
        if (error) throw error;
        
        setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        addNotification("Transaksi diperbarui", "success");
    } catch (e) { addNotification("Gagal mengupdate transaksi", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteTransaction = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        
        setTransactions(prev => prev.filter(t => t.id !== id));

        if (tx.paymentMethod === 'TRANSFER' && tx.bankAccountId) {
            const { data: bankData } = await supabase.from('bank_accounts').select('balance').eq('id', tx.bankAccountId).single();
            if (bankData) {
                const revert = tx.type === 'INCOME' ? -tx.amount : tx.amount;
                await supabase.from('bank_accounts').update({ balance: bankData.balance + revert }).eq('id', tx.bankAccountId);
                setBankAccounts(prev => prev.map(b => b.id === tx.bankAccountId ? { ...b, balance: bankData.balance + revert } : b));
            }
        }
        addNotification("Transaksi dihapus", "success");
    } catch (e) { addNotification("Gagal hapus transaksi", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const addMeterReading = async (reading: MeterReading) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').insert({ id: reading.id, resident_id: reading.residentId, month: reading.month, year: reading.year, meter_value: reading.meterValue, prev_meter_value: reading.prevMeterValue, usage: reading.usage, photo_url: reading.photoUrl, operator: reading.operator, timestamp: reading.timestamp });
        if (error) throw error;
        setMeterReadings(prev => [...prev, reading]);

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
            
            const newBill: Bill = { 
                id: `bill-${resident.id}-${reading.month}-${reading.year}`, 
                residentId: resident.id, 
                period_month: reading.month, 
                period_year: reading.year, 
                prev_meter: reading.prevMeterValue, 
                curr_meter: reading.meterValue, 
                water_usage: reading.usage, 
                water_cost: waterCost, 
                ipl_cost: ipl, 
                kas_rt_cost: kas, 
                abodemen_cost: abodemen, 
                extra_cost: totalExtra, 
                arrears: resident.initialArrears, 
                total: total, 
                status: 'UNPAID', 
                meter_photo_url: reading.photoUrl, 
                operator: reading.operator,
                created_at: new Date().toISOString()
            };

            await supabase.from('bills').upsert({ 
                id: newBill.id, 
                resident_id: newBill.residentId, 
                period_month: newBill.period_month, 
                period_year: newBill.period_year, 
                prev_meter: newBill.prev_meter, 
                curr_meter: newBill.curr_meter, 
                water_usage: newBill.water_usage, 
                water_cost: newBill.water_cost, 
                ipl_cost: newBill.ipl_cost, 
                kas_rt_cost: newBill.kas_rt_cost, 
                abodemen_cost: newBill.abodemen_cost, 
                extra_cost: newBill.extra_cost, 
                arrears: newBill.arrears, 
                total: newBill.total, 
                status: 'UNPAID', 
                meter_photo_url: newBill.meter_photo_url, 
                operator: newBill.operator 
            });
            
            setBills(prev => {
                const existing = prev.findIndex(b => b.id === newBill.id);
                if (existing > -1) {
                    const copy = [...prev];
                    copy[existing] = newBill;
                    return copy;
                }
                return [...prev, newBill];
            });

            addNotification(`Meteran & Tagihan ${resident.houseNo} tersimpan!`, "success");
        }
    } catch(e) { addNotification("Gagal menyimpan meteran", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateMeterReading = async (reading: MeterReading) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').update({ meter_value: reading.meterValue, usage: reading.usage, photo_url: reading.photoUrl, timestamp: new Date().toISOString(), operator: reading.operator }).eq('id', reading.id);
        if (error) throw error;
        setMeterReadings(prev => prev.map(m => m.id === reading.id ? reading : m));

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
            
            const updatedBill: Bill = { 
                id: `bill-${resident.id}-${reading.month}-${reading.year}`, 
                residentId: resident.id, 
                period_month: reading.month, 
                period_year: reading.year, 
                prev_meter: reading.prevMeterValue, 
                curr_meter: reading.meterValue, 
                water_usage: reading.usage, 
                water_cost: waterCost, 
                ipl_cost: ipl, 
                kas_rt_cost: kas, 
                abodemen_cost: abodemen, 
                extra_cost: totalExtra, 
                arrears: resident.initialArrears, 
                total: total, 
                status: 'UNPAID', 
                meter_photo_url: reading.photoUrl, 
                operator: reading.operator,
                created_at: new Date().toISOString()
            };

            await supabase.from('bills').upsert({ 
                id: updatedBill.id, 
                resident_id: updatedBill.residentId, 
                period_month: updatedBill.period_month, 
                period_year: updatedBill.period_year, 
                prev_meter: updatedBill.prev_meter, 
                curr_meter: updatedBill.curr_meter, 
                water_usage: updatedBill.water_usage, 
                water_cost: updatedBill.water_cost, 
                ipl_cost: updatedBill.ipl_cost, 
                kas_rt_cost: updatedBill.kas_rt_cost, 
                abodemen_cost: updatedBill.abodemen_cost, 
                extra_cost: updatedBill.extra_cost, 
                arrears: updatedBill.arrears, 
                total: updatedBill.total, 
                meter_photo_url: updatedBill.meter_photo_url, 
                operator: updatedBill.operator 
            });

            setBills(prev => {
                const existing = prev.findIndex(b => b.id === updatedBill.id);
                if (existing > -1) {
                    const copy = [...prev];
                    copy[existing] = { ...copy[existing], ...updatedBill, status: copy[existing].status }; 
                    return copy;
                }
                return [...prev, updatedBill];
            });

            addNotification(`Data meteran unit ${resident.houseNo} berhasil diperbarui!`, "success");
        }
    } catch(e) { addNotification("Gagal memperbarui meteran", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteMeterReading = async (id: string, residentId: string, month: number, year: number) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('meter_readings').delete().eq('id', id);
        if (error) throw error;
        setMeterReadings(prev => prev.filter(m => m.id !== id));

        const billId = `bill-${residentId}-${month}-${year}`;
        await supabase.from('bills').delete().eq('id', billId);
        setBills(prev => prev.filter(b => b.id !== billId));

        addNotification("Data meteran dan tagihan dihapus", "success");
    } catch(e) { addNotification("Gagal menghapus meteran", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateSettings = async (newSettings: Partial<Settings & { rtList: string[]; rwList: string[] }>) => {
    setConnectionStatus('SYNCING');
    try {
        const mergedSettings = { ...settings, ...newSettings };
        const { data } = await supabase.from('app_settings').select('id').limit(1);
        if (data && data.length > 0) await supabase.from('app_settings').update({ config: mergedSettings }).eq('id', data[0].id);
        else await supabase.from('app_settings').insert({ config: mergedSettings });
        setSettings(mergedSettings);
        triggerPopup({ title: 'Tersimpan ke Cloud', message: 'Pengaturan sistem berhasil diperbarui.', type: 'DATA' });
    } catch (e) { addNotification("Gagal menyimpan pengaturan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const generateBills = async (month: number, year: number) => {};
  const addBill = async (bill: Bill) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').insert({ id: bill.id, resident_id: bill.residentId, period_month: bill.period_month, period_year: bill.period_year, total: bill.total, status: bill.status, created_at: bill.created_at });
        if (error) throw error;
        setBills(prev => [...prev, bill]);
        addNotification("Tagihan manual tersimpan", "success");
    } catch (e) { addNotification("Gagal membuat tagihan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateBill = async (bill: Bill) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').update({ ipl_cost: bill.ipl_cost, kas_rt_cost: bill.kas_rt_cost, abodemen_cost: bill.abodemen_cost, water_cost: bill.water_cost, extra_cost: bill.extra_cost, arrears: bill.arrears, total: bill.total }).eq('id', bill.id);
        if (error) throw error;
        setBills(prev => prev.map(b => b.id === bill.id ? { ...b, ...bill } : b));
        addNotification("Perubahan tagihan disimpan", "success");
    } catch (e) { addNotification("Gagal memperbarui tagihan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteBill = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('bills').delete().eq('id', id);
        if (error) throw error;
        setBills(prev => prev.filter(b => b.id !== id));
        addNotification("Tagihan dihapus", "success");
    } catch (e) { addNotification("Gagal menghapus tagihan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const payBill = async (billId: string, amount: number, paymentMethod: 'CASH' | 'TRANSFER', bankAccountId?: string, customDescription?: string, isEdit: boolean = false) => {
    setConnectionStatus('SYNCING');
    try {
        const bill = bills.find(b => b.id === billId);
        if (!bill) return;
        
        if (isEdit) {
            const oldTx = transactions.find(t => t.bill_id === billId && t.type === 'INCOME');
            if (oldTx) {
                await deleteTransaction(oldTx.id);
                await supabase.from('bills').update({ status: 'UNPAID', paid_amount: 0 }).eq('id', billId);
            }
        }

        const { data: resData } = await supabase.from('residents').select('initial_arrears, deposit').eq('id', bill.residentId).single();
        if (!resData) throw new Error("Resident not found");

        const alreadyPaid = isEdit ? 0 : (bill.paid_amount || 0); 
        const totalBill = bill.total;
        const totalPaidAfterThis = alreadyPaid + amount;
        const remaining = totalBill - totalPaidAfterThis;

        let newStatus: 'PAID' | 'PARTIAL' = 'PAID';
        let newInitialArrears = resData.initial_arrears;
        let newDeposit = resData.deposit || 0;

        if (remaining > 0) {
            newStatus = 'PARTIAL';
            newInitialArrears = remaining; 
        } else {
            newStatus = 'PAID';
            newInitialArrears = 0; 
            if (remaining < 0) {
                const excess = Math.abs(remaining);
                newDeposit += excess;
            }
        }

        // Update Bill
        await supabase.from('bills').update({ 
            status: newStatus, 
            paid_amount: isEdit ? amount : ((bill.paid_amount || 0) + amount), 
            paid_at: new Date().toISOString(),
            payment_edit_count: isEdit ? (bill.payment_edit_count || 0) + 1 : (bill.payment_edit_count || 0)
        }).eq('id', billId);

        // Update Resident
        await supabase.from('residents').update({ 
            initial_arrears: newInitialArrears,
            deposit: newDeposit
        }).eq('id', bill.residentId);

        // Update local state
        setBills(prev => prev.map(b => b.id === billId ? { 
            ...b, 
            status: newStatus, 
            paid_amount: isEdit ? amount : ((b.paid_amount || 0) + amount),
            paid_at: new Date().toISOString() 
        } : b));

        setResidents(prev => prev.map(r => r.id === bill.residentId ? { 
            ...r, 
            initialArrears: newInitialArrears, 
            deposit: newDeposit 
        } : r));

        const resident = residents.find(r => r.id === bill.residentId);
        const desc = customDescription || `Pembayaran Tagihan ${resident?.houseNo} (${MONTHS[bill.period_month-1]} ${bill.period_year})${isEdit ? ' (Edit)' : ''}`;
        
        await addTransaction({ 
            id: `tx-pay-${Date.now()}`, 
            date: new Date().toISOString().split('T')[0], 
            description: desc, 
            type: 'INCOME', 
            category: 'Iuran Warga (IPL & Air)', 
            amount, 
            paymentMethod, 
            bankAccountId, 
            resident_id: bill.residentId, 
            bill_id: bill.id 
        });

        let notifMsg = isEdit ? "Pembayaran berhasil diubah" : "Pembayaran berhasil";
        if (remaining < 0) notifMsg += `. Lebih bayar Rp ${Math.abs(remaining).toLocaleString()} masuk ke Deposit.`;
        if (remaining > 0) notifMsg += `. Sisa tagihan Rp ${remaining.toLocaleString()} (Kurang Bayar).`;

        addNotification(notifMsg, "success");
    } catch(e) { addNotification("Gagal memproses pembayaran", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const addComplaint = async (complaint: Complaint) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').insert({ id: complaint.id, resident_id: complaint.resident_id, title: complaint.title, description: complaint.description, category: complaint.category, status: complaint.status, created_at: complaint.created_at });
        if (error) throw error;
        setComplaints(prev => [complaint, ...prev]);
        addNotification("Aduan berhasil dikirim", "success");
    } catch (e: any) { addNotification("Gagal mengirim aduan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateComplaint = async (complaint: Complaint) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').update({ status: complaint.status, admin_response: complaint.admin_response, updated_at: new Date().toISOString() }).eq('id', complaint.id);
        if (error) throw error;
        setComplaints(prev => prev.map(c => c.id === complaint.id ? complaint : c));
        addNotification("Status aduan diperbarui", "success");
    } catch (e) { addNotification("Gagal update aduan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteComplaint = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        const { error } = await supabase.from('complaints').delete().eq('id', id);
        if (error) throw error;
        setComplaints(prev => prev.filter(c => c.id !== id));
        addNotification("Aduan dihapus", "success");
    } catch (e) { addNotification("Gagal menghapus aduan", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const syncUnpaidBills = async () => {};
  const checkUnsyncedBills = () => 0;

  const addSystemUser = async (user: User) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').insert({ id: user.id, username: user.username, password: user.password, role: user.role, permissions: user.permissions });
        setSystemUsers(prev => [...prev, user]);
        addNotification("User ditambahkan", "success");
    } catch(e) { addNotification("Gagal menambah user", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const updateSystemUser = async (user: User) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').update({ username: user.username, password: user.password, role: user.role, permissions: user.permissions }).eq('id', user.id);
        setSystemUsers(prev => prev.map(u => u.id === user.id ? user : u));
        addNotification("User diperbarui", "success");
    } catch(e) { addNotification("Gagal update user", "error"); } finally { setConnectionStatus('CONNECTED'); }
  };

  const deleteSystemUser = async (id: string) => {
    setConnectionStatus('SYNCING');
    try {
        await supabase.from('app_users').delete().eq('id', id);
        setSystemUsers(prev => prev.filter(u => u.id !== id));
        addNotification("User dihapus", "success");
    } catch(e) { addNotification("Gagal hapus user", "error"); } finally { setConnectionStatus('CONNECTED'); }
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
          return true;
      } catch (e) { addNotification("Gagal memperbarui profil", "error"); return false; } finally { setConnectionStatus('CONNECTED'); }
  };

  const resetDatabase = async () => {
      setConnectionStatus('SYNCING');
      await supabase.from('transactions').delete().neq('id', '0');
      await supabase.from('bills').delete().neq('id', '0');
      await supabase.from('meter_readings').delete().neq('id', '0');
      await supabase.from('bank_mutations').delete().neq('id', '0');
      await supabase.from('residents').delete().neq('id', '0');
      await supabase.from('complaints').delete().neq('id', '0');
      
      // Reset local state
      setResidents([]);
      setBills([]);
      setTransactions([]);
      setMeterReadings([]);
      setBankMutations([]);
      setComplaints([]);

      addNotification("Database berhasil di-reset", "success");
      setConnectionStatus('CONNECTED');
  };

  const exportDatabase = async () => {
      try {
          const [
            { data: app_settings },
            { data: residents },
            { data: bills },
            { data: transactions },
            { data: meter_readings },
            { data: bank_accounts },
            { data: bank_mutations },
            { data: app_users },
            { data: complaints }
          ] = await Promise.all([
            supabase.from('app_settings').select('*'),
            supabase.from('residents').select('*'),
            supabase.from('bills').select('*'),
            supabase.from('transactions').select('*'),
            supabase.from('meter_readings').select('*'),
            supabase.from('bank_accounts').select('*'),
            supabase.from('bank_mutations').select('*'),
            supabase.from('app_users').select('*'),
            supabase.from('complaints').select('*')
          ]);
          
          return { 
            app_settings: app_settings || [], 
            residents: residents || [], 
            bills: bills || [], 
            transactions: transactions || [], 
            meter_readings: meter_readings || [], 
            bank_accounts: bank_accounts || [], 
            bank_mutations: bank_mutations || [], 
            app_users: app_users || [], 
            complaints: complaints || [], 
            _metadata: { export_date: new Date().toISOString(), version: '1.1' } 
          };
      } catch (err) {
          console.error("Export failed:", err);
          throw err;
      }
  };

  const importDatabase = async (jsonData: any) => {
      setConnectionStatus('SYNCING');
      try {
          if (!jsonData._metadata) throw new Error("Invalid Backup File");
          if (jsonData.app_settings?.length > 0) await supabase.from('app_settings').upsert(jsonData.app_settings);
          if (jsonData.bank_accounts?.length > 0) await supabase.from('bank_accounts').upsert(jsonData.bank_accounts);
          if (jsonData.residents?.length > 0) await supabase.from('residents').upsert(jsonData.residents);
          if (jsonData.app_users?.length > 0) await supabase.from('app_users').upsert(jsonData.app_users);
          if (jsonData.meter_readings?.length > 0) await supabase.from('meter_readings').upsert(jsonData.meter_readings);
          if (jsonData.bills?.length > 0) await supabase.from('bills').upsert(jsonData.bills);
          if (jsonData.transactions?.length > 0) await supabase.from('transactions').upsert(jsonData.transactions);
          if (jsonData.bank_mutations?.length > 0) await supabase.from('bank_mutations').upsert(jsonData.bank_mutations);
          if (jsonData.complaints?.length > 0) await supabase.from('complaints').upsert(jsonData.complaints);
          addNotification("Database berhasil di-restore!", "success");
          setConnectionStatus('CONNECTED');
          window.location.reload(); 
          return true;
      } catch (err) { addNotification("Gagal restore database", "error"); setConnectionStatus('CONNECTED'); return false; }
  };

  const value = {
    residents, bills, bankAccounts, bankMutations, transactions, meterReadings, complaints, settings, currentUser, systemUsers, notifications, globalPopup, connectionStatus,
    addResident, addResidentsImport, updateResident, deleteResident, deleteAllResidents, addBankAccount, updateBankAccount, deleteBankAccount, addBankMutation, deleteBankMutation,
    addTransaction, updateTransaction, deleteTransaction, addMeterReading, updateMeterReading, deleteMeterReading, updateSettings, generateBills, addBill, updateBill, deleteBill, payBill,
    addComplaint, updateComplaint, deleteComplaint,
    syncUnpaidBills, checkUnsyncedBills, addNotification, markNotificationsAsRead, triggerPopup, closeGlobalPopup, setCurrentUser, addSystemUser,
    updateSystemUser, deleteSystemUser, changePassword, updateUserProfile, resetDatabase, exportDatabase, importDatabase, changeLanguage
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
