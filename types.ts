
export type ServiceCategory = 'cortes_rosto' | 'quimica_estilo';

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number; // in minutes
  description: string;
  category: ServiceCategory;
  isPopular?: boolean;
}

export interface Barber {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface BookingState {
  step: 'home' | 'category' | 'service' | 'barber' | 'datetime' | 'details' | 'summary' | 'admin-login' | 'admin-dashboard' | 'check-booking';
  selectedCategory: ServiceCategory | null;
  selectedServices: Service[]; // Changed from single service to array
  selectedBarber: Barber | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  userName: string;
  userPhone: string; // Optional, just for record
}

export interface BookingRecord {
  id: string;
  userName: string;
  userPhone: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  price: number;
  createdAt: string;
  status?: 'pending' | 'completed' | 'cancelled';
  completedAt?: string; // Data real da conclusão do serviço (para financeiro)
}

export enum WeekDay {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}