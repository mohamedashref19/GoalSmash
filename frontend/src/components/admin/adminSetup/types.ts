export interface Owner {
  _id: string;
  name: string;
  phone: string;
}

export interface Court {
  _id: string;
  name: string;
  pricePerHour?: number;
  priceMorning: number;
  priceEvening: number;
  sportType: string;
}

export interface Venue {
  _id: string;
  name: string;
  phone: string;
  operatingHours?: number;
  openTime?: string;
  closeTime?: string;
  eveningStartTime?: string;
  workingDays?: number[];
  address?: { area: string; city: string; details?: string };
  owner?: { _id: string; name: string; phone: string };
  courts?: Court[];
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bookingCount: number;
  createdAt: string;
}

export interface PaymentAccount {
  _id: string;
  type: string;
  identifier: string;
  accountName: string;
  isActive: boolean;
  lastUsedAt: string;
  lastTransferReceivedAt?: string;
  totalMoneyCollected?: number;
}

export interface CourtBlock {
  _id: string;
  venue: { _id: string; name: string };
  court: { _id: string; name: string; sportType: string };
  blockType: string;
  startTime: string;
  endTime: string;
  notes: string;
  recurrenceId?: string;
}

export interface GroupedCourtBlock {
  recurrenceId: string;
  venue: { _id: string; name: string };
  court: { _id: string; name: string; sportType: string };
  blockType: string;
  notes: string;
  startTimeHour: string;
  endTimeHour: string;
  minDate: Date;
  maxDate: Date;
  blocks: CourtBlock[];
}

export interface Employee {
  _id: string;
  name: string;
  email: string;
  phone: string;
  venue?: { _id: string; name: string };
  createdAt: string;
}

export type TabKey =
  "owner" | "employees" | "venue" | "court" | "manage" | "block" | "customers" | "accounts";
