export type CommunityType = "RecoverWell" | "StudyWell" | "RetireWell";
export type UnitType = "studio" | "1br" | "2br";
export type RentType = "private_pay" | "government_supported";
export type MaintenanceStatus = "open" | "in_progress" | "resolved";
export type PaymentStatus = "pending" | "paid" | "overdue";

export interface Community {
  community_id: number;
  property_id: number;
  community_type: CommunityType;
  name: string;
}

export interface Unit {
  unit_id: number;
  community_id: number;
  unit_number: string;
  unit_type: UnitType;
  bed_count: number;
  sqft: string;
  monthly_rent: string;
  is_occupied: boolean;
}

export interface Resident {
  resident_id: number;
  community_id: number;
  unit_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  bed_number: string;
  rent_type: RentType;
  move_in_date: string;
  move_out_date: string | null;
}

export interface RentPayment {
  payment_id: number;
  resident_id: number;
  amount: string;
  payment_date: string;
  period_month: number;
  period_year: number;
  status: PaymentStatus;
}

export interface MaintenanceRequest {
  request_id: number;
  property_id: number;
  resident_id: number | null;
  description: string;
  status: MaintenanceStatus;
  created_at: string;
  resolved_at: string | null;
}
