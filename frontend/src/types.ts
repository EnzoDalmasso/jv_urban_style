export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  sort_order: number;
  is_active?: boolean;
};

export type AvailabilitySlot = {
  time: string;
  startsAt: string;
  endsAt: string;
  staffId: string;
  staffName: string;
  isAvailable: boolean;
  reason?: string;
};

export type AvailabilityResponse = {
  date: string;
  timezone: string;
  serviceDurationMinutes: number;
  slots: AvailabilitySlot[];
};

export type Staff = {
  id: string;
  full_name: string;
  role?: string;
  timezone: string;
  is_active?: boolean;
};

export type ShopSettings = {
  cancellation_notice_minutes: number;
  deposit_percentage: number;
  require_deposit_for_late_cancellation: boolean;
  transfer_holder: string;
  transfer_alias: string;
  transfer_cbu: string;
  whatsapp_phone: string;
};

export type BusinessHours = {
  id: number;
  staff_id: string | null;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

export type SpecialHours = {
  id: string;
  staff_id: string | null;
  date: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  reason: string | null;
};

export type PublicSchedule = {
  timezone: string;
  businessHours: BusinessHours[];
  specialHours: SpecialHours[];
  staff: Array<{
    id: string;
    full_name: string;
  }>;
};

export type FixedAppointment = {
  id: string;
  staff_id: string;
  day_of_week: number;
  starts_at: string;
  duration_minutes: number;
  client_name: string;
  note: string | null;
  is_active: boolean;
};

export type AdminAppointment = {
  id: string;
  publicCode: string;
  startsAt: string;
  endsAt: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  totalDurationMinutes: number;
  totalPrice: number;
  depositRequired: boolean;
  depositAmount: number;
  depositStatus: string;
  clientName: string;
  clientPhone: string;
  staffId: string;
  staffName: string;
  services: Array<{
    name: string;
    durationMinutes: number;
    price: number;
  }>;
};

export type AdminSummary = {
  settings: ShopSettings;
  services: Service[];
  staff: Staff[];
  businessHours: BusinessHours[];
  specialHours: SpecialHours[];
  fixedAppointments: FixedAppointment[];
  appointments: AdminAppointment[];
  upcomingAppointments: AdminAppointment[];
};

export type CreateAppointmentResponse = {
  appointment: {
    publicCode: string;
    startsAt: string;
    endsAt: string;
    staffName: string;
    totalPrice: number;
    depositRequired: boolean;
    depositAmount: number;
    depositStatus: string;
    cancellationCutoffAt: string | null;
    businessWhatsappPhone?: string;
    transfer: {
      holder: string;
      alias: string;
      cbu: string;
    };
  };
};
