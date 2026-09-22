import { get, post, patch, del } from "./client";

export interface Appointment {
  id: number;
  organization_id: number;
  agent_id: number;
  conversation_id?: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  service: string;
  slot_date: string;
  slot_time: string;
  status: "confirmed" | "rescheduled" | "cancelled" | "completed";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  service: string;
  slot_date: string;
  slot_time: string;
  notes?: string;
  agent_id?: number;
}

export async function getAppointments(): Promise<Appointment[]> {
  const res = await get<Appointment[] | { data: Appointment[] }>("/appointments");
  return Array.isArray(res) ? res : res.data;
}

export async function getAvailableSlots(date?: string): Promise<{ available_slots: string[]; timezone: string }> {
  return get<{ available_slots: string[]; timezone: string }>(
    `/appointments/available-slots${date ? `?date=${encodeURIComponent(date)}` : ""}`,
  );
}

export async function createAppointment(data: AppointmentCreate): Promise<Appointment> {
  return post<Appointment, AppointmentCreate>("/appointments", data);
}

export async function updateAppointment(id: number, data: Partial<Appointment>): Promise<Appointment> {
  return patch<Appointment, Partial<Appointment>>(`/appointments/${id}`, data);
}

export async function deleteAppointment(id: number): Promise<void> {
  return del(`/appointments/${id}`);
}
