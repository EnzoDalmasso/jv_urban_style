export const demoServices = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Corte urbano',
    description: 'Fade, tijera y terminacion con navaja.',
    duration_minutes: 45,
    price: 9500,
    sort_order: 1
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Barba premium',
    description: 'Perfilado, vapor y producto final.',
    duration_minutes: 30,
    price: 6500,
    sort_order: 2
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Corte + barba',
    description: 'Servicio completo con terminacion prolija.',
    duration_minutes: 75,
    price: 14500,
    sort_order: 3
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Color express',
    description: 'Tono, matiz o cobertura rapida.',
    duration_minutes: 60,
    price: 18000,
    sort_order: 4
  }
];

export const demoStaff = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    full_name: 'Joel',
    role: 'barber',
    timezone: 'America/Argentina/Buenos_Aires'
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    full_name: 'Gino',
    role: 'barber',
    timezone: 'America/Argentina/Buenos_Aires'
  }
];

export const demoSettings = {
  cancellation_notice_minutes: 120,
  deposit_percentage: 50,
  require_deposit_for_late_cancellation: true,
  transfer_holder: 'JV Urban Style Barberia',
  transfer_alias: 'JVURBANSTYLE',
  transfer_cbu: 'Configurar en admin'
};

export const demoBusinessHours: Array<{
  id: number;
  staff_id: string | null;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
}> = Array.from({ length: 7 }, (_, day) => ({
  id: day + 1,
  staff_id: null,
  day_of_week: day,
  opens_at: day === 0 ? '10:00:00' : '10:00:00',
  closes_at: day === 0 ? '14:00:00' : '19:00:00',
  is_closed: day === 0
}));

export const demoSpecialBusinessHours: Array<{
  id: string;
  staff_id: string | null;
  date: string;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  reason: string | null;
}> = [];

export const demoAppointments: unknown[] = [];
