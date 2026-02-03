
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Droplets, 
  Camera, 
  Image as ImageIcon, 
  Save, 
  User as UserIcon, 
  Search,
  CheckCircle2,
  Trash2,
  X,
  AlertTriangle,
  Info,
  ArrowRight,
  Plus,
  Minus,
  Upload,
  FileText,
  Download,
  Loader2,
  Phone,
  Lock,
  Edit,
  ChevronDown,
  Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MONTHS } from '../constants';
import { MeterReading } from '../types';
import * as XLSX from 'xlsx';

interface MeterInputProps {
  user: any;
}

const MeterInput: React.FC<MeterInputProps> = ({ user }) => {
  const { residents, bills, settings, addNotification, addMeterReading, updateMeterReading, deleteMeterReading, meterReadings } = useApp();
  
  // Current Date Info
  const now = new Date();
  const currentRealMonth = now.getMonth() + 1;
  const currentRealYear = now.getFullYear();

  // State for Main Input
  const [selectedUnit, setSelectedUnit] = useState('');
  const [month, setMonth] = useState(currentRealMonth); 
  const [year, setYear] = useState(currentRealYear);
  
  const [meterValue, setMeterValue] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Local filtered history view
  const [historyView, setHistoryView] = useState<MeterReading[]>([]);
  
  // States for derived values
  const [meterAwal, setMeterAwal] = useState(0);
  const [usage, setUsage] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Photo Modal State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); 
  
  const [importMonth, setImportMonth] = useState(currentRealMonth);
  const [importYear, setImportYear] = useState(currentRealYear);
  
  const importFileRef = useRef<HTMLInputElement>(null);

  // Searchable Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [filterUnrecorded, setFilterUnrecorded] = useState(false); 
  const dropdownRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Determine if current selected unit has existing data
  const existingData = useMemo(() => {
      if (!selectedUnit) return null;
      return meterReadings.find(r => r.residentId === selectedUnit && r.month === month && r.year === year);
  }, [selectedUnit, month, year, meterReadings]);

  // Sync local history view with context meter readings
  useEffect(() => {
      const recent = meterReadings.filter(r => r.month === month && r.year === year).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistoryView(recent);
  }, [meterReadings, month, year]);

  // AUTO-POPULATE LOGIC
  useEffect(() => {
    if (selectedUnit) {
      if (existingData) {
        if (editingId !== existingData.id) {
             setMeterValue(existingData.meterValue.toString());
             setPhoto(existingData.photoUrl || null);
             setMeterAwal(existingData.prevMeterValue);
        }
      } else {
        if (!editingId) {
            setMeterValue('');
            setPhoto(null);
            const resident = residents.find(r => r.id === selectedUnit);
            if (resident) {
                const lastReading = meterReadings
                    .filter(r => r.residentId === selectedUnit && (r.year < year || (r.year === year && r.month < month)))
                    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                const initialValue = lastReading ? lastReading.meterValue : resident.initialMeter;
                setMeterAwal(initialValue);
            }
        }
      }
    } else {
      if (!editingId) {
          setMeterAwal(0);
          setMeterValue('');
          setPhoto(null);
      }
    }
  }, [selectedUnit, existingData, residents, meterReadings, month, year, editingId]);

  // Calculate usage and cost
  useEffect(() => {
    const val = parseInt(meterValue) || 0;
    const diff = Math.max(0, val - meterAwal);
    setUsage(diff);
    let cost = settings.water_abodemen;
    const limit = settings.water_rate_threshold || 10;
    if (diff > 0) {
        if (diff <= limit) cost += diff * settings.water_rate_low;
        else cost += (limit * settings.water_rate_low) + ((diff - limit) * settings.water_rate_high);
    }
    setEstimatedCost(cost);
  }, [meterValue, meterAwal, settings]);

  const startCamera = async () => {
    if (existingData && !editingId) return;
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      addNotification("Gagal mengakses kamera.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setPhoto(canvas.toDataURL('image/jpeg'));
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream && stream.getTracks) stream.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // Fix: Implemented handleEdit to set up the form for editing an existing reading
  const handleEdit = (reading: MeterReading) => {
    setEditingId(reading.id);
    setSelectedUnit(reading.residentId);
    setMonth(reading.month);
    setYear(reading.year);
    setMeterValue(reading.meterValue.toString());
    setPhoto(reading.photoUrl || null);
    setMeterAwal(reading.prevMeterValue);
  };

  // Fix: Implemented handleDelete to remove a meter reading after confirmation
  const handleDelete = async (reading: MeterReading) => {
    if (window.confirm(`Hapus data meteran unit ${residents.find(r => r.id === reading.residentId)?.houseNo}?`)) {
      await deleteMeterReading(reading.id, reading.residentId, reading.month, reading.year);
    }
  };

  // Fix: Implemented handleImport to process Excel file for batch meter input
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
        let processed = 0;
        const total = jsonData.length;

        for (const row of jsonData) {
          if (row.NO_RUMAH && row.METER_AKHIR !== undefined) {
            const resident = residents.find(r => r.houseNo.toLowerCase() === String(row.NO_RUMAH).toLowerCase());
            if (resident) {
              const meterValue = parseInt(row.METER_AKHIR);
              if (!isNaN(meterValue)) {
                const lastReading = meterReadings
                  .filter(r => r.residentId === resident.id && (r.year < importYear || (r.year === importYear && r.month < importMonth)))
                  .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                const prevMeter = lastReading ? lastReading.meterValue : resident.initialMeter;
                const usage = Math.max(0, meterValue - prevMeter);

                const newReading: MeterReading = {
                  id: `imp-mtr-${Date.now()}-${Math.random()}`,
                  residentId: resident.id,
                  month: importMonth,
                  year: importYear,
                  meterValue,
                  prevMeterValue: prevMeter,
                  usage,
                  photoUrl: null,
                  timestamp: new Date().toISOString(),
                  operator: user.username
                };
                await addMeterReading(newReading);
                successCount++;
              }
            }
          }
          processed++;
          setImportProgress(Math.round((processed / total) * 100));
        }
        addNotification(`${successCount} data meteran berhasil diimport.`, "success");
        setShowImportModal(false);
      } catch (error) {
        addNotification("Gagal memproses file import.", "error");
      } finally {
        setIsImporting(false);
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Fix: Implemented downloadTemplate to provide an example Excel for imports
  const downloadTemplate = () => {
    const data = [
      { "NO_RUMAH": "A-01", "METER_AKHIR": 150 },
      { "NO_RUMAH": "B-05", "METER_AKHIR": 210 }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Meteran");
    XLSX.writeFile(wb, "template_input_meteran.xlsx");
  };

  const handleSave = async () => {
    if (!selectedUnit || !meterValue || parseInt(meterValue) < meterAwal || !photo) return;
    setIsSubmitting(true);
    try {
      const entryData: MeterReading = {
        id: editingId || Math.random().toString(36).substr(2, 9),
        residentId: selectedUnit,
        month, year, meterValue: parseInt(meterValue),
        prevMeterValue: meterAwal,
        usage, photoUrl: photo,
        timestamp: new Date().toISOString(),
        operator: user.username 
      };
      if (editingId) await updateMeterReading(entryData);
      else await addMeterReading(entryData);
      setEditingId(null); setSelectedUnit(''); setMeterValue(''); setPhoto(null);
    } catch (error) {
      addNotification("Gagal menyimpan data.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredResidents = useMemo(() => {
      const completedIds = new Set(meterReadings.filter(r => r.month === month && r.year === year).map(r => r.residentId));
      return residents.filter(r => {
          const matchesSearch = r.houseNo.toLowerCase().includes(unitSearch.toLowerCase());
          if (!matchesSearch) return false;
          if (filterUnrecorded && completedIds.has(r.id)) return false;
          return true;
      });
  }, [residents, unitSearch, filterUnrecorded, meterReadings, month, year]);

  const isReadOnly = !!existingData && !editingId;

  return (
    <div className="space-y-4 pb-20 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="card p-4 md:p-8 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Droplets size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Input Meter Air</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Catat Pemakaian {MONTHS[month-1]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowImportModal(true)} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
                <Upload size={14} /> <span className="text-[10px] font-black uppercase">Import</span>
             </button>
             <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex items-center space-x-2">
                <UserIcon size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black text-slate-600 uppercase">{user.username}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Input Controls (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Unit Selector */}
                <div className="col-span-2" ref={dropdownRef}>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pilih Unit Rumah</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => !editingId && setIsDropdownOpen(!isDropdownOpen)}
                            className={`w-full p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-left transition-all font-black text-slate-700 text-sm shadow-sm ${!!editingId ? 'opacity-70' : 'hover:bg-slate-100'}`}
                        >
                            <span>{residents.find(r => r.id === selectedUnit)?.houseNo || '-- Pilih --'}</span>
                            <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-2 bg-slate-50 border-b border-slate-100 space-y-1">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                        <input type="text" autoFocus placeholder="Cari..." className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} />
                                    </div>
                                    <button onClick={() => setFilterUnrecorded(!filterUnrecorded)} className={`w-full py-1.5 px-2 rounded-lg text-[9px] font-black uppercase transition-all ${filterUnrecorded ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                        {filterUnrecorded ? 'Menampilkan Belum Input' : 'Filter: Belum Input'}
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 p-1">
                                    {filteredResidents.map(r => (
                                        <button key={r.id} onClick={() => { setSelectedUnit(r.id); setIsDropdownOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex justify-between items-center ${selectedUnit === r.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                            <span>{r.houseNo}</span>
                                            {historyView.some(h => h.residentId === r.id) && <CheckCircle2 size={12} className="text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Period Selector */}
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bulan</label>
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} disabled={!!editingId} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs">
                        {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tahun</label>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} disabled={!!editingId} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs">
                        <option value={currentRealYear}>{currentRealYear}</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Meter Awal</p>
                    <p className="text-3xl font-black text-blue-600">{meterAwal}</p>
                </div>
                <div className="relative">
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1 ml-1">Meter Akhir</label>
                    <input 
                        type="number" 
                        value={meterValue} 
                        onChange={(e) => setMeterValue(e.target.value)} 
                        readOnly={isReadOnly}
                        className={`w-full p-4 border-4 rounded-2xl text-4xl font-black text-center outline-none ${isReadOnly ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-slate-100 focus:border-emerald-500'}`}
                        placeholder="0"
                    />
                </div>
            </div>

            {selectedUnit && (
                <div className="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between border border-emerald-100">
                    <div className="flex items-center gap-3">
                        <Info size={18} className="text-emerald-500" />
                        <div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase">Estimasi Pemakaian & Biaya</p>
                            <p className="text-lg font-black text-emerald-800">{usage} m³ <span className="text-xs text-emerald-600/60 mx-1">|</span> Rp {estimatedCost.toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Photo Section (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bukti Foto</label>
            <div 
                onClick={!photo && !cameraActive && !isReadOnly ? startCamera : undefined}
                className={`relative h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden ${photo || cameraActive ? 'border-blue-200' : 'border-slate-200 hover:border-emerald-400 cursor-pointer bg-slate-50/30'}`}
            >
                {cameraActive ? (
                    <div className="absolute inset-0 bg-black">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); capturePhoto(); }} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full border-2 border-blue-500 flex items-center justify-center">
                            <div className="w-6 h-6 bg-red-500 rounded-full" />
                        </button>
                    </div>
                ) : photo ? (
                    <div className="absolute inset-0">
                        <img src={photo} className="w-full h-full object-cover" />
                        {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); setPhoto(null); }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"><X size={14} /></button>}
                    </div>
                ) : (
                    <>
                        <Camera size={28} className="text-slate-300 mb-2" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ambil Foto</span>
                    </>
                )}
            </div>
            <button 
                onClick={handleSave}
                disabled={!selectedUnit || !meterValue || (parseInt(meterValue) < meterAwal && !existingData) || isSubmitting || (!!existingData && !editingId)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
            >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{editingId ? 'Update Data' : 'Simpan Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* History Table - Compact */}
      <div className="card border border-slate-100 shadow-sm overflow-hidden bg-white">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Input Terkini</h3>
            <span className="bg-white px-3 py-1 rounded-lg border text-[9px] font-black text-slate-400 uppercase">{historyView.length} Data</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Meter</th>
                        <th className="px-4 py-3">Pakai</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {historyView.slice(0, 10).map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-black text-slate-700">{residents.find(r => r.id === row.residentId)?.houseNo}</td>
                            <td className="px-4 py-3 font-bold text-slate-500">{row.prevMeterValue} ➔ {row.meterValue}</td>
                            <td className="px-4 py-3 font-black text-blue-600">{row.usage} m³</td>
                            <td className="px-4 py-3">
                                <div className="flex justify-center gap-1.5">
                                    <button onClick={() => handleEdit(row)} className="p-1.5 text-blue-500 bg-blue-50 rounded-lg"><Edit size={14}/></button>
                                    <button onClick={() => handleDelete(row)} className="p-1.5 text-rose-500 bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {historyView.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-300 font-bold italic">Belum ada input periode ini</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODALS (Import, Photo Preview) remain functionally same but styled compact */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-slate-800">Import Meteran</h3>
                    <button onClick={() => setShowImportModal(false)} className="p-1.5 bg-slate-100 rounded-full"><X size={16} /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <select value={importMonth} onChange={e => setImportMonth(parseInt(e.target.value))} className="p-2 bg-slate-50 rounded-lg text-xs font-bold">{MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}</select>
                        <select value={importYear} className="p-2 bg-slate-50 rounded-lg text-xs font-bold"><option value={currentRealYear}>{currentRealYear}</option></select>
                    </div>
                    <input type="file" ref={importFileRef} className="hidden" onChange={handleImport} />
                    {isImporting && <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${importProgress}%`}} /></div>}
                    <button onClick={() => importFileRef.current?.click()} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                        {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Pilih File Excel
                    </button>
                    <button onClick={downloadTemplate} className="w-full py-2.5 text-blue-600 font-bold text-[10px] uppercase tracking-widest">Download Template</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeterInput;
