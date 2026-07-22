export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  sort_order: number;
};

export type AvailabilitySlot = {
  time: string;
  startsAt: string;
  endsAt: string;
  staffId: string;
  staffName: string;
};

export type AvailabilityResponse = {
  date: string;
  timezone: string;
  serviceDurationMinutes: number;
  slots: AvailabilitySlot[];
};
