export type CommunityType = "RecoverWell" | "StudyWell" | "RetireWell";
export type UnitType = "studio" | "1br" | "2br" | "3br" | "suite" | "shared";
export type RentType = "private_pay" | "government_supported" | "shared_room" | "transitional";
export type BedStatus = "available" | "occupied" | "reserved" | "maintenance";
export type MaintenanceStatus = "open" | "in_progress" | "resolved";
export type PaymentStatus = "pending" | "paid" | "overdue";

export interface Community {
  community_id: number;
  community_type: CommunityType;
  name: string;
  city: string;
  province: string;
  operator_id: number | null;
  has_meal_plan: boolean;
  meal_plan_monthly_cost: string | null;
  target_occupancy_percent: string | null;
  description: string | null;
}

export interface Unit {
  unit_id: number;
  community_id: number;
  unit_number: string;
  unit_type: UnitType;
  bed_count: number;
  sqft: string;
  is_occupied: boolean;
}

export interface Bed {
  bed_id: number;
  unit_id: number;
  bed_label: string;
  monthly_rent: string;
  rent_type: RentType;
  status: BedStatus;
}

export interface Resident {
  resident_id: number;
  community_id: number;
  unit_id: number;
  bed_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  bed_number: string;
  rent_type: RentType;
  move_in_date: string;
  move_out_date: string | null;
  enrolled_meal_plan: boolean;
}

export interface RentPayment {
  payment_id: number;
  resident_id: number;
  bed_id: number | null;
  amount: string;
  payment_date: string;
  period_month: number;
  period_year: number;
  status: PaymentStatus;
  includes_meal_plan: boolean;
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
