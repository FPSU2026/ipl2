import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Download,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Calendar,
  PieChart as PieChartIcon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useApp } from '../context/AppContext';
import { MONTHS, REVENUE_DISTRIBUTION } from '../constants';
import { UserRole } from '../types';
import * as XLSX from 'xlsx';

// Compact Clickable StatsCard Component
const StatsCard: React.FC<{ 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  color: string, 
  onClick?: () => void 
}> = ({ title, value, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className={`card p-4 flex items-center border border-slate-100 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-95' : ''}`}
  >
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mr-3 shadow-md shrink-0`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) : icon}
    </div>
    <div className="overflow-hidden">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
      <p className="text-lg font-black text-slate-800 tracking-tight truncate">{value}</p>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const lineChartRef = useRef<HTMLDivElement>(null);
  const piePaymentRef = useRef<HTMLDivElement>(null);
  const pieAllocationRef = useRef<HTMLDivElement>(null);
  
  const [showExportLine, setShowExportLine] = useState(false);
  const [showExportPayment, setShowExportPayment] = useState(false);
  const [showExportAllocation, setShowExportAllocation] = useState(false);
  
  const [dashboardMonth, setDashboardMonth] = useState(new Date().getMonth() + 1);
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());

  const { transactions, residents, bills, currentUser } = useApp();
  const isResident = currentUser?.role === UserRole.RESIDENT;

  // --- LOGIC CALCULATIONS ---
  const totalResidents = residents.length;

  const { totalIncome, totalExpense } = useMemo(() => {
      const filtered = transactions.filter(t => {
          const d = new Date(t.date);
          return (d.getMonth() + 1) === dashboardMonth && d.getFullYear() === dashboardYear;
      });
      const inc = filtered.filter(t => t.type === 'INCOME' && t.category !== 'Saldo Awal');
      const exp = filtered.filter(t => t.type === 'EXPENSE');
      return { 
        totalIncome: inc.reduce((acc, t) => acc + t.amount, 0), 
        totalExpense: exp.reduce((acc, t) => acc + t.amount, 0)
      };
  }, [transactions, dashboardMonth, dashboardYear]);

  const arrearsStats = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();
      const overdueBills = bills.filter(b => {
          if (b.status !== 'UNPAID') return false;
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });
      return { total: overdueBills.reduce((acc, b) => acc + (b.total - (b.paid_amount || 0)), 0) };
  }, [bills]);

  const chartData = useMemo(() => {
      const data = MONTHS.map(m => ({ name: m.substring(0, 3), income: 0, expense: 0 }));
      transactions.forEach(t => {
          const d = new Date(t.date);
          if (d.getFullYear() === dashboardYear) {
              const monthIndex = d.getMonth();
              if (t.type === 'INCOME' && t.category !== 'Saldo Awal') data[monthIndex].income += t.amount;
              else if (t.
