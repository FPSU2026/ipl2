
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  RESIDENT = 'RESIDENT'
}

export type Role = UserRole | 'ADMIN' | 'OPERATOR' | 'RESIDENT';
export type Language = 'id' | 'en'; // Added Language Type

export interface GlobalPopupRequest {
  title: string;
  message: string;
  type: 'PAYMENT' | 'FEATURE' | 'DATA' | 'INFO';
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
  read: boolean;
}

export interface User {
  id: string;
  username: string;
  role: Role;
  residentId?: string; // Optional link to resident data
  password?: string;
  permissions?: string[]; // Granular access rights
}

export interface Resident {
  id: string;
  houseNo: string;
  rt: string;
  rw: string;
  phone: string;
  name: string;
  initialMeter: number;
  initialArrears: number;
  status: 'PEMILIK' | 'PENYEWA' | 'AKTIF' | 'NONAKTIF' | string;
  password?: string;
  
  // Dispensasi (Pengurangan Biaya Rutin)
  isDispensation?: boolean; // Master toggle dispensasi
  dispensationNote?: string; // Keterangan
  exemptions?: string[]; // Array of Standard Fee IDs to WAIVE (Digratiskan)

  // Biaya Tambahan (Penambahan Biaya Kustom)
  activeCustomFees?: string[]; // Array of Custom Fee IDs to APPLY (Diterapkan)
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  balance: number;
  isActive?: boolean; // New Field for Payment Destination Toggle
}

export interface BankMutation {
  id: string;
  accountId: string;
  date: string;
  type: 'DEBIT' | 'KREDIT';
  amount: number;
  description: string;
  reference?: string;
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  expenseType?: 'RUTIN' | 'NON_RUTIN'; // Added subtype for Expenses
}

export interface ExtraFee {
  id: string;
  name: string;
  amount: number;
}

export interface WhatsAppTemplates {
  billMessage: string;
  receiptMessage: string;
  arrearsMessage: string;
}

export interface Settings {
  id: string;
  location_name: string;
  office_address?: string; // NEW FIELD
  logo_url?: string;
  
  // Address Details
  address_rw?: string;
  address_kelurahan?: string;
  address_kecamatan?: string;
  address_city?: string;
  address_province?: string;
  address_zip?: string;
  admin_contact?: string;

  ipl_base: number;
  kas_rt_base: number;
  water_abodemen: number;
  water_rate_low: number;
  water_rate_high: number;
  water_rate_threshold: number; // Added threshold for progressive rate
  extra_fees: ExtraFee[]; // Changed from single fee to array
  rtList: string[];
  rwList: string[];
  transactionCategories: TransactionCategory[];
  whatsappTemplates: WhatsAppTemplates;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  resident_id?: string;
  bill_id?: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  bankAccountId?: string; // Required if paymentMethod is TRANSFER
}

export interface MeterReading {
  id: string;
  residentId: string;
  month: number;
  year: number;
  meterValue: number;
  prevMeterValue: number;
  usage: number;
  photoUrl?: string;
  timestamp: string;
  operator?: string; // Added operator name
}

export interface Bill {
  id: string;
  residentId: string;
  period_month: number;
  period_year: number;
  prev_meter: number;
  curr_meter: number;
  water_usage: number;
  water_cost: number;
  ipl_cost: number;
  kas_rt_cost: number;
  abodemen_cost: number;
  extra_cost: number;
  arrears: number;
  total: number;
  status: 'PAID' | 'UNPAID';
  paid_amount?: number;
  paid_at?: string; // Date when bill was paid
  payment_edit_count?: number; // TRACK EDIT COUNT
  photo_url?: string; // Bukti Bayar
  meter_photo_url?: string; // Bukti Meteran
  operator?: string; // Added operator name
  created_at: string;
}

export interface Complaint {
  id: string;
  resident_id: string;
  title: string;
  description: string;
  category: 'KELUHAN' | 'MASUKAN' | 'LAINNYA';
  status: 'PENDING' | 'PROCESSED' | 'DONE';
  admin_response?: string;
  created_at: string;
  updated_at: string;
}
