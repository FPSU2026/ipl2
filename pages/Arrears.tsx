
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, MessageCircle, X, Plus, Upload, FileText, Wallet, Trash2, Edit, CheckCircle2, Loader2, Download, Circle, AlertTriangle, ArrowRight, MoreVertical, Printer, Share2, List } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { Bill, UserRole } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Arrears: React.FC = () => {
  const { residents, bills, addBill, updateBill, addNotification, settings, currentUser, payBill, bankAccounts, deleteBill } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // DYNAMIC YEAR RANGE STARTING FROM 2023
  const currentYear = new Date().getFullYear();
  const startYear = 2023;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
  
  const [selectedYear, setSelectedYear] = useState<number>(currentYear); // Default to Current Year
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [filterRT, setFilterRT] = useState('ALL');
  
  // Modal States
  const [showInputModal, setShowInputModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Duplicate Detection State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingBill, setPendingBill] = useState<Bill | null>(null);
  const [conflictBill, setConflictBill] = useState<Bill | null>(null);
  
  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResidentDetail, setSelectedResidentDetail] = useState<{name: string, houseNo: string, items: Bill[]} | null>(null);

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  // Import State
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Dropdown State
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Manual Input Form State
  const [manualArrear, setManualArrear] = useState({
     residentId: '',
     month: new Date().getMonth() + 1,
     year: new Date().getFullYear(),
     amount: ''
  });

  // Edit Bill State
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editFormData, setEditFormData] = useState({
      month: 0,
      year: 0,
      amount: ''
  });

  const isResident = currentUser?.role === UserRole.RESIDENT;

  // Filter bank accounts for incoming billing/arrears payments
  const billingBankAccounts = useMemo(() => {
      return bankAccounts.filter(acc => acc.isActiveForBilling);
  }, [bankAccounts]);

  // Handle ESC Key & Click Outside
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showInputModal) setShowInputModal(false);
        if (showDetailModal) setShowDetailModal(false);
        if (showImportModal) setShowImportModal(false);
        if (showEditModal) setShowEditModal(false);
        if (showPaymentModal) setShowPaymentModal(false);
        if (showDuplicateModal) setShowDuplicateModal(false);
        setActiveDropdown(null);
      }
    };
    
    const handleClickOutside = (event: MouseEvent) => {
        if (activeDropdown && !(event.target as Element).closest('.action-dropdown')) {
            setActiveDropdown(null);
        }
    };

    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        window.removeEventListener('keydown', handleEsc);
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInputModal, showDetailModal, showImportModal, showEditModal, showPaymentModal, showDuplicateModal, activeDropdown]);

  // --- CALCULATION LOGIC ---
  const calculateTotalArrears = (residentId: string) => {
    let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYearNum = now.getFullYear();

    // STRICT ARREARS LOGIC: Exclude current month and future months
    unpaidBills = unpaidBills.filter(b => {
        if (b.period_year > currentYearNum) return false; // Future year
        if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false; // Current or Future month
        return true;
    });
    
    // Filter by Year ONLY IF not -1 (Semua Tahun)
    if (selectedYear !== -1) {
        unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
    }

    const billsTotal = unpaidBills.reduce((bSum, b) => bSum + (b.total - (b.paid_amount || 0)), 0);
    return billsTotal;
  };

  const getMonthlyBill = (residentId: string, month: number, year: number) => {
      const bill = bills.find(b => 
          b.residentId === residentId && 
          b.period_month === month && 
          b.period_year === year &&
          b.status === 'UNPAID'
      );
      
      if (!bill) return null;

      // Strict Logic: Don't show current/future month as "Arrears" in the grid
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();
      
      if (year > currentYearNum) return null;
      if (year === currentYearNum && month >= currentMonth) return null;

      return bill;
  };

  // Helper for "Semua Tahun" view (List View)
  const getArrearsSummary = (residentId: string) => {
      // Get all unpaid bills for this resident, sorted
      let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();

      // Strict check: Only past bills
      unpaidBills = unpaidBills.filter(b => {
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });

      if (unpaidBills.length === 0) return <span className="text-slate-300 text-xs italic">- Tidak ada -</span>;

      // Group by Year
      const grouped: Record<number, string[]> = {};
      unpaidBills.sort((a,b) => (a.period_year - b.period_year) || (a.period_month - b.period_month)).forEach(b => {
          if (!grouped[b.period_year]) grouped[b.period_year] = [];
          grouped[b.period_year].push(MONTHS[b.period_month - 1]);
      });

      return (
          <div className="flex flex-col gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
              {Object.entries(grouped).map(([year, months]) => (
                  <div key={year} className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-rose-400 shrink-0 shadow-sm"></div>
                      <span className="text-xs text-slate-600 leading-snug">
                          <span className="font-black text-slate-800 mr-1">{year}:</span>
                          {months.join(', ')}
                      </span>
                  </div>
              ))}
          </div>
      );
  };

  const filteredResidents = residents.filter(r => {
    if (isResident && r.id !== currentUser?.residentId) return false;
    if (filterRT !== 'ALL' && r.rt !== filterRT) return false;

    const matchesSearch = 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const totalArrears = calculateTotalArrears(r.id);
    if (statusFilter === 'UNPAID') return totalArrears > 0;
    if (statusFilter === 'PAID') return totalArrears === 0;
    
    return totalArrears > 0; 
  });

  // Calculate which months (columns) have data to show
  const activeMonthIndices = useMemo(() => {
      if (selectedYear === -1) return [];
      
      const indices = new Set<number>();
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();

      filteredResidents.forEach(r => {
          // Check bills for this resident in the selected year
          const resBills = bills.filter(b => 
              b.residentId === r.id && 
              b.status === 'UNPAID' && 
              b.period_year === selectedYear
          );

          resBills.forEach(b => {
              // Only count if it's a valid arrear (past month)
              if (b.period_year < currentYearNum || (b.period_year === currentYearNum && b.period_month < currentMonth)) {
                  indices.add(b.period_month - 1);
              }
          });
      });

      return Array.from(indices).sort((a, b) => a - b);
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

      if (selectedYear !== -1) {
          unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
      }
      
      return unpaidBills.sort((a, b) => {
          if (a.period_year !== b.period_year) return a.period_year - b.period_year;
          return a.period_month - b.period_month;
      });
  };

  const sendReminder = (r: any) => {
    const unpaidItems = getResidentUnpaidBills(r.id);
    if (unpaidItems.length === 0) return;

    const total = unpaidItems.reduce((acc, b) => acc + (b.total - (b.paid_amount||0)), 0);
    
    const details = unpaidItems.map((b, index) => {
        return `${index + 1}. ${MONTHS[b.period_month - 1]} ${b.period_year}: Rp ${(b.total - (b.paid_amount||0)).toLocaleString('id-ID')}`;
    }).join('\n');

    let template = settings.whatsappTemplates?.arrearsMessage || DEFAULT_SETTINGS.whatsappTemplates.arrearsMessage;
    
    const replaceMap: Record<string, string> = {
        '{NAMA}': r.name,
        '{RUMAH}': r.houseNo,
        '{TOTAL}': total.toLocaleString('id-ID'),
        '{RINCIAN}': details
    };

    Object.keys(replaceMap).forEach(key => {
        template = template.replace(new RegExp(key, 'g'), replaceMap[key]);
    });

    window.open(`https://wa.me/${r.phone}?text=${encodeURIComponent(template)}`, '_blank');
  };

  const handleShareDetail = (residentDetail: {name: string, houseNo: string, items: Bill[]}) => {
      const r = residents.find(res => res.houseNo === residentDetail.houseNo);
      if(r) sendReminder(r);
  };

  const handlePrintDetail = (residentDetail: {name: string, houseNo: string, items: Bill[]}) => {
      const doc = new jsPDF();
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("RINCIAN TUNGGAKAN IURAN", 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nama: ${residentDetail.name}`, 14, 30);
      doc.text(`Unit: ${residentDetail.houseNo}`, 14, 35);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 40);

      const tableData = residentDetail.items.map((item, index) => [
          index + 1,
          `${MONTHS[item.period_month - 1]} ${item.period_year}`,
          `Rp ${(item.total - (item.paid_amount || 0)).toLocaleString('id-ID')}`
      ]);

      const total = residentDetail.items.reduce((acc, curr) => acc + (curr.total - (curr.paid_amount||0)), 0);
      tableData.push(['', 'TOTAL TUNGGAKAN', `Rp ${total.toLocaleString('id-ID')}`]);

      autoTable(doc, {
          startY: 45,
          head: [['No.', 'Periode', 'Jumlah']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [220, 53, 69] } // Rose Color
      });

      doc.save(`Tunggakan_${residentDetail.houseNo}.pdf`);
  };

  // Manual Arrear Submit (with Duplicate Check)
  const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualArrear.residentId || !manualArrear.amount) return;
      
      // 1. Create the prospective bill object
      const newBill: Bill = {
          id: `manual-${Date.now()}`,
          residentId: manualArrear.residentId,
          period_month: manualArrear.month,
          period_year: manualArrear.year,
          prev_meter: 0,
          curr_meter: 0,
          water_usage: 0,
          water_cost: 0,
          ipl_cost: 0,
          kas_rt_cost: 0,
          abodemen_cost: 0,
          extra_cost: 0,
          arrears: 0,
          total: parseInt(manualArrear.amount),
          status: 'UNPAID',
          created_at: new Date().toISOString()
      };

      // 2. Check for Duplicates in existing bills
      const existing = bills.find(b => 
          b.residentId === manualArrear.residentId &&
          b.period_month === manualArrear.month &&
          b.period_year === manualArrear.year
      );

      // 3. If duplicate found, trigger resolution modal
      if (existing) {
          setConflictBill(existing);
          setPendingBill(newBill);
          setShowInputModal(false); // Close input modal
          setShowDuplicateModal(true); // Open duplicate warning modal
          return;
      }
      
      // 4. If no duplicate, proceed to add
      await addBill(newBill);
      setShowInputModal(false);
      addNotification("Tunggakan manual berhasil ditambahkan", "success");
  };

  // Duplicate Resolution Handlers
  const handleKeepOld = () => {
      // Logic: Do nothing to DB, just discard pending bill
      setPendingBill(null);
      setConflictBill(null);
      setShowDuplicateModal(false);
      addNotification("Input baru dibatalkan. Data lama dipertahankan.", "info");
  };

  const handleReplace = async () => {
      if (!conflictBill || !pendingBill) return;
      
      // Logic: Delete old, add new
      await deleteBill(conflictBill.id);
      await addBill(pendingBill);
      
      setPendingBill(null);
      setConflictBill(null);
      setShowDuplicateModal(false);
      addNotification("Data lama dihapus. Input baru disimpan.", "success");
  };

  // Edit Bill Logic (Individual Item)
  const handleEditItemClick = (bill: Bill) => {
      setEditingBill(bill);
      setEditFormData({
          month: bill.period_month,
          year: bill.period_year,
          amount: bill.total.toString()
      });
      setShowEditModal(true);
  };

  const handleUpdateItemSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingBill) return;

      const updatedBill: Bill = {
          ...editingBill,
          period_month: editFormData.month,
          period_year: editFormData.year,
          total: parseInt(editFormData.amount) || 0,
      };

      await updateBill(updatedBill);
      addNotification("Data tunggakan berhasil diperbarui", "success");
      setShowEditModal(false);
      
      // Refresh detail view
      if (selectedResidentDetail) {
          const rId = selectedResidentDetail.items[0]?.residentId || editingBill.residentId;
          const refreshedItems = getResidentUnpaidBills(rId);
          const resident = residents.find(r => r.id === rId);
          if (resident) {
              setSelectedResidentDetail({
                  name: resident.name,
                  houseNo: resident.houseNo,
                  items: refreshedItems
              });
          }
      }
  };

  // Payment Logic
  const handleOpenPayment = (bill: Bill) => {
      setSelectedBill(bill);
      setPaymentAmount((bill.total - (bill.paid_amount || 0)).toString());
      setPaymentMethod('CASH');
      setSelectedBankId('');
      setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBill) return;
      const amount = parseInt(paymentAmount);
      
      await payBill(selectedBill.id, amount, paymentMethod, selectedBankId);
      setShowPaymentModal(false);
      
      // Refresh detail modal content after payment
      if (selectedResidentDetail) {
          const remainingItems = selectedResidentDetail.items.filter(item => item.id !== selectedBill.id);
          setSelectedResidentDetail(prev => prev ? { ...prev, items: remainingItems } : null);
          
          if (remainingItems.length === 0) {
              setShowDetailModal(false);
          }
      }
  };

  // Import Handler
  const handleImportArrears = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        
        let successCount = 0;
        let skippedCount = 0;
        
        for (const row of jsonData) {
            if (row.NOMOR_RUMAH && row.JUMLAH) {
                const resident = residents.find(r => r.houseNo.toLowerCase() === String(row.NOMOR_RUMAH).toLowerCase());
                
                if (resident) {
                    const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                    const month = parseInt(row.BULAN) || (new Date().getMonth() + 1);
                    const year = parseInt(row.TAHUN) || new Date().getFullYear();

                    // Import Check Duplicate (Silent skip/log)
                    const existing = bills.find(b => 
                        b.residentId === resident.id && 
                        b.period_month === month && 
                        b.period_year === year
                    );

                    if (existing) {
                        skippedCount++;
                        continue;
                    }

                    if (!isNaN(amount) && amount > 0) {
                        const newBill: Bill = {
                            id: `imp-arr-${Date.now()}-${Math.random()}`,
                            residentId: resident.id,
                            period_month: month,
                            period_year: year,
                            prev_meter: 0,
                            curr_meter: 0,
                            water_usage: 0,
                            water_cost: 0,
                            ipl_cost: 0,
                            kas_rt_cost: 0,
                            abodemen_cost: 0,
                            extra_cost: 0,
                            arrears: 0,
                            total: amount,
                            status: 'UNPAID',
                            created_at: new Date().toISOString()
                        };
                        await addBill(newBill);
                        successCount++;
                    }
                }
            }
        }
        
        if (skippedCount > 0) {
            addNotification(`${successCount} data diimpor. ${skippedCount} data ganda dilewati.`, "warning");
        } else {
            addNotification(`${successCount} Data tunggakan berhasil diimport.`, "success");
        }
        setShowImportModal(false);
      } catch (error) {
        addNotification("Gagal mengimport file. Pastikan format Excel benar.", "error");
      } finally {
        setIsImporting(false);
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadArrearsTemplate = () => {
    const data = [
        { "NOMOR_RUMAH": "A-01", "BULAN": 1, "TAHUN": 2025, "JUMLAH": 150000 },
        { "NOMOR_RUMAH": "B-05", "BULAN": 2, "TAHUN": 2025, "JUMLAH": 200000 }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_tunggakan.xlsx");
  };
  
  const handleOpenDetail = (resident: any) => {
      const items = getResidentUnpaidBills(resident.id);
      setSelectedResidentDetail({
          name: resident.name,
          houseNo: resident.houseNo,
          items: items
      });
      setShowDetailModal(true);
  };

  const handleDeleteItem = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin menghapus data tunggakan ini?")) {
          await deleteBill(id);
          // Refresh Detail Modal
          if (selectedResidentDetail) {
              const updatedItems = selectedResidentDetail.items.filter(item => item.id !== id);
              setSelectedResidentDetail({
                  ...selectedResidentDetail,
                  items: updatedItems
              });
              
              if (updatedItems.length === 0) {
                  setShowDetailModal(false);
              }
          }
      }
  };

  const handleDeleteAllForResident = async (residentId: string) => {
      if (window.confirm("PERINGATAN: Aksi ini akan MENGHAPUS SEMUA tagihan tertunggak untuk warga ini. Yakin lanjutkan?")) {
          const items = getResidentUnpaidBills(residentId);
          for (const item of items) {
              await deleteBill(item.id);
          }
          addNotification("Semua data tunggakan warga ini telah dihapus.", "success");
      }
  };

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Data Tunggakan</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monitoring Pembayaran Tertunggak</p>
        </div>
        
        {!isResident && (
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Upload size={14} /> Import Data
            </button>
            <button 
              onClick={() => setShowInputModal(true)}
              className="px-4 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={14} /> Input Manual
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50/50 shrink-0">
             <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                <div className="relative w-full md:w-64">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                   <input 
                      type="text" 
                      placeholder="Cari nama / unit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                   />
                </div>
                {!isResident && (
                  <select 
                    value={filterRT}
                    onChange={(e) => setFilterRT(e.target.value)}
                    className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Semua RT</option>
                    {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                )}
                {/* Year Filter */}
                <select 
                   value={selectedYear}
                   onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                   className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer"
                >
                   <option value={-1}>Semua Tahun</option>
                   {years.map(year => (
                       <option key={year} value={year}>{year}</option>
                   ))}
                </select>
             </div>
          </div>

          <div className="overflow-auto flex-1 relative">
             <table className="w-full text-left min-w-[800px]">
               <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20 shadow-sm">
                 <tr>
                   <th className="px-6 py-5 bg-slate-50 sticky left-0 z-30 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] min-w-[150px]">No. Rumah</th>
                   
                   {/* Conditional Header based on Year Selection & Data Presence */}
                   {selectedYear !== -1 ? (
                       activeMonthIndices.length > 0 ? (
                           activeMonthIndices.map((monthIndex) => (
                               <th key={monthIndex} className="px-4 py-5 bg-slate-50 text-center min-w-[80px]">
                                   {MONTHS[monthIndex].substring(0, 3)}
                               </th>
                           ))
                       ) : (
                           <th className="px-4 py-5 bg-slate-50 text-center text-slate-300">-</th>
                       )
                   ) : (
                       <th className="px-6 py-5 bg-slate-50">Periode Tunggakan</th>
                   )}

                   <th className="px-6 py-5 bg-slate-50 text-right min-w-[150px]">Total Tunggakan</th>
                   <th className="px-6 py-5 bg-slate-50 text-center sticky right-0 z-30 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)]">Aksi</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {filteredResidents.length > 0 ? (
                    filteredResidents.map(r => {
                     const totalArrears = calculateTotalArrears(r.id);
                     if (totalArrears <= 0) return null; 

                     return (
                         <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5 sticky left-0 bg-white z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] align-top">
                               <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-slate-800 uppercase tracking-wider">{r.houseNo}</span>
                               </div>
                            </td>
                            
                            {/* Conditional Row Content */}
                            {selectedYear !== -1 ? (
                                // Matrix Cells (Dynamically rendered based on active months)
                                activeMonthIndices.length > 0 ? (
                                    activeMonthIndices.map((monthIndex) => {
                                        const bill = getMonthlyBill(r.id, monthIndex + 1, selectedYear);
                                        return (
                                            <td key={monthIndex} className="px-4 py-5 text-center border-l border-slate-50 align-top">
                                                {bill ? (
                                                    <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded">
                                                        {(bill.total - (bill.paid_amount||0)) >= 1000000 
                                                            ? `${((bill.total - (bill.paid_amount||0))/1000000).toFixed(1)}jt` 
                                                            : `${((bill.total - (bill.paid_amount||0))/1000).toFixed(0)}k`}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-200 text-xs">-</span>
                                                )}
                                            </td>
                                        );
                                    })
                                ) : (
                                    <td className="px-4 py-5 text-center text-slate-300 italic align-top">-</td>
                                )
                            ) : (
                                // List View (All Years Summary)
                                <td className="px-6 py-5 align-top" onClick={() => handleOpenDetail(r)}>
                                    {getArrearsSummary(r.id)}
                                </td>
                            )}

                            <td className="px-6 py-5 text-right font-black text-sm text-rose-600 align-top">
                               Rp {totalArrears.toLocaleString('id-ID')}
                            </td>
                            
                            <td className="px-6 py-5 sticky right-0 bg-white z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] align-top text-center">
                                <div className="relative action-dropdown inline-block">
                                    <button 
                                        onClick={() => setActiveDropdown(activeDropdown === r.id ? null : r.id)}
                                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    
                                    {activeDropdown === r.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in zoom-in-95 duration-200 text-left">
                                            <button 
                                                onClick={() => { handleOpenDetail(r); setActiveDropdown(null); }}
                                                className="w-full px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <List size={14} className="text-blue-500"/> Lihat Rincian
                                            </button>
                                            
                                            {!isResident && (
                                                <>
                                                    <button 
                                                        onClick={() => { handleDeleteAllForResident(r.id); setActiveDropdown(null); }}
                                                        className="w-full px-4 py-3 text-[10px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                                    >
                                                        <Trash2 size={14}/> Hapus
                                                    </button>
                                                    <button 
                                                        onClick={() => { sendReminder(r); setActiveDropdown(null); }}
                                                        className="w-full px-4 py-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                    >
                                                        <MessageCircle size={14} className="text-emerald-500"/> WA
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </td>
                         </tr>
                     );
                 })
                ) : (
                    <tr>
                        <td colSpan={selectedYear !== -1 ? (activeMonthIndices.length + 4) : 4} className="px-6 py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                            Tidak ada data tunggakan
                        </td>
                    </tr>
                )}
               </tbody>
             </table>
          </div>
      </div>

      {/* Manual Input Modal */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                <div><h3 className="font-black text-lg">Input Tunggakan Manual</h3></div>
                <button onClick={() => setShowInputModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
             </div>
             <form onSubmit={handleManualSubmit} className="p-8 space-y-5">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih Warga</label>
                   <select required value={manualArrear.residentId} onChange={e => setManualArrear({...manualArrear, residentId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                      <option value="">-- Pilih Warga --</option>
                      {residents.map(r => <option key={r.id} value={r.id}>{r.houseNo} - {r.name}</option>)}
                   </select>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bulan</label>
                        <select value={manualArrear.month} onChange={e => setManualArrear({...manualArrear, month: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tahun</label>
                        <input type="number" value={manualArrear.year} onChange={e => setManualArrear({...manualArrear, year: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label>
                    <input type="number" required value={manualArrear.amount} onChange={e => setManualArrear({...manualArrear, amount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <button type="submit" className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Simpan</button>
             </form>
          </div>
        </div>
      )}

      {/* Duplicate Conflict Modal */}
      {showDuplicateModal && conflictBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><AlertTriangle size={24} /></div>
                <div>
                    <h3 className="font-black text-lg text-amber-900">Input Ganda Terdeteksi</h3>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Konfirmasi Data</p>
                </div>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="space-y-4 text-center">
                    <p className="text-sm font-bold text-slate-600">
                        Data untuk <span className="text-slate-900 font-black">{residents.find(r => r.id === conflictBill.residentId)?.houseNo}</span> periode <span className="text-slate-900 font-black">{MONTHS[conflictBill.period_month-1]} {conflictBill.period_year}</span> sudah ada di database.
                    </p>
                    
                    <div className="flex items-center justify-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Data Lama</p>
                            <p className="text-lg font-black text-slate-800">Rp {(conflictBill.total - (conflictBill.paid_amount||0)).toLocaleString('id-ID')}</p>
                        </div>
                        <ArrowRight className="text-slate-300" />
                        <div className="text-center">
                            <p className="text-[9px] font-black text-emerald-500 uppercase">Input Baru</p>
                            <p className="text-lg font-black text-emerald-600">Rp {parseInt(manualArrear.amount).toLocaleString('id-ID')}</p>
                        </div>
                    </div>

                    <p className="font-black text-slate-800 uppercase tracking-widest text-xs bg-red-50 text-red-600 p-2 rounded-lg">
                        TERDAPAT INPUT GANDA, MAU DIHAPUS SALAH SATU ?
                    </p>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={handleKeepOld}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Hapus Input Baru (Batal)
                    </button>
                    <button 
                        onClick={handleReplace}
                        className="w-full py-3 bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                    >
                        Hapus Data Lama (Ganti)
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-sm w-full overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                <div><h3 className="font-black text-lg">Edit Data Tunggakan</h3></div>
                <button onClick={() => setShowEditModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
             </div>
             <form onSubmit={handleUpdateItemSubmit} className="p-8 space-y-5">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            {editFormData.year === 2023 ? 'Bulan (Non-Aktif)' : 'Bulan'}
                        </label>
                        <select 
                            value={editFormData.month} 
                            onChange={e => setEditFormData({...editFormData, month: parseInt(e.target.value)})} 
                            disabled={editFormData.year === 2023}
                            className={`w-full p-3 border border-slate-200 rounded-xl font-bold text-xs ${editFormData.year === 2023 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'}`}
                        >
                            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tahun</label>
                        <input type="number" value={editFormData.year} onChange={e => setEditFormData({...editFormData, year: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label>
                    <input type="number" required value={editFormData.amount} onChange={e => setEditFormData({...editFormData, amount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Simpan Perubahan</button>
             </form>
          </div>
        </div>
      )}

      {/* Import Data Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <FileText size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Import Data Tunggakan</h3>
                <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
                    Gunakan template Excel (.xlsx) untuk upload massal. Format kolom harus sesuai dengan template.
                </p>
                
                <input 
                    type="file"
                    ref={importFileRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImportArrears}
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
                        onClick={downloadArrearsTemplate}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> Download Template
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

      {/* Detail Modal */}
      {showDetailModal && selectedResidentDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <div>
                          <h3 className="font-black text-lg text-slate-800">Rincian Tunggakan</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedResidentDetail.houseNo}</p>
                      </div>
                      <button onClick={() => setShowDetailModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="overflow-y-auto">
                      {selectedResidentDetail.items.length > 0 ? (
                          <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-wider">
                                  <tr>
                                      <th className="p-4">Periode</th>
                                      <th className="p-4 text-right">Tagihan</th>
                                      <th className="p-4 text-center">Aksi</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {selectedResidentDetail.items.map(item => (
                                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4 font-bold text-slate-700">
                                              {item.period_year === 2023 ? '2023' : `${MONTHS[item.period_month-1]} ${item.period_year}`}
                                          </td>
                                          <td className="p-4 text-right">
                                              <span className="font-black text-rose-600">Rp {(item.total - (item.paid_amount||0)).toLocaleString('id-ID')}</span>
                                          </td>
                                          <td className="p-4 text-center">
                                              <div className="flex items-center justify-center gap-2">
                                                  <button 
                                                    onClick={() => handleOpenPayment(item)}
                                                    className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                    title="Bayar"
                                                  >
                                                      <Wallet size={14} />
                                                  </button>
                                                  {!isResident && (
                                                      <>
                                                          <button 
                                                            onClick={() => handleEditItemClick(item)}
                                                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                          >
                                                              <Edit size={14} />
                                                          </button>
                                                          <button 
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Hapus"
                                                          >
                                                              <Trash2 size={14} />
                                                          </button>
                                                      </>
                                                  )}
                                              </div>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot className="bg-slate-50 border-t border-slate-200">
                                  <tr>
                                      <td className="p-4 font-black text-slate-800 uppercase text-xs tracking-widest">Total</td>
                                      <td className="p-4 text-right font-black text-rose-600 text-sm">
                                          Rp {selectedResidentDetail.items.reduce((acc, curr) => acc + (curr.total - (curr.paid_amount||0)), 0).toLocaleString('id-ID')}
                                      </td>
                                      <td></td>
                                  </tr>
                              </tfoot>
                          </table>
                      ) : (
                          <div className="text-center py-12 text-slate-400">
                              <CheckCircle2 size={48} className="mx-auto mb-2 text-emerald-300" />
                              <p className="text-sm font-bold">Tidak ada tunggakan.</p>
                          </div>
                      )}
                  </div>
                  {/* DETAIL MODAL FOOTER - PRINT & SHARE */}
                  {selectedResidentDetail.items.length > 0 && (
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                          <button 
                            onClick={() => handlePrintDetail(selectedResidentDetail)}
                            className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                              <Printer size={16} /> Cetak
                          </button>
                          <button 
                            onClick={() => handleShareDetail(selectedResidentDetail)}
                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                          >
                              <Share2 size={16} /> Share WA
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                <div>
                   <h3 className="font-black text-lg">Input Pembayaran</h3>
                   <p className="text-[10px] uppercase tracking-widest opacity-60">{MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
             </div>
             
             <form onSubmit={handlePaymentSubmit} className="p-8 space-y-5 pt-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200"><span className="font-bold text-slate-500">Sisa Tagihan</span><span className="font-black text-slate-700">Rp {(selectedBill.total - (selectedBill.paid_amount||0)).toLocaleString()}</span></div>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metode</label>
                   <div className="flex gap-2">
                        <button type="button" onClick={() => setPaymentMethod('CASH')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>Cash</button>
                        <button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>Transfer</button>
                   </div>
                </div>

                {paymentMethod === 'TRANSFER' && (
                    <select required value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs">
                        <option value="">-- Pilih Rekening --</option>
                        {billingBankAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                        ))}
                    </select>
                )}

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah Dibayar (Rp)</label>
                   <input type="number" required autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none" />
                </div>

                <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    Konfirmasi Pembayaran
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Arrears;
