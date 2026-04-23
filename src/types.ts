/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Habit {
  id: string;
  name: string;
  completed: Record<DayOfWeek, boolean>;
}

export interface ClassEvent {
  id: string;
  name: string;
  time?: string;
}

export interface Task {
  id: string;
  name: string;
  completed: boolean;
}

export interface DayData {
  classes: ClassEvent[];
  tasks: Task[];
}

export interface Activity {
  id: string;
  name: string;
  time: string;
  date: string; // ISO string
  owner: 'grace' | 'tanga';
}

export interface UserData {
  habits: Habit[];
  weeklySchedule: Record<DayOfWeek, DayData>;
  lastResetDate: string; // ISO string to check for Sunday reset
}

export interface PeriodData {
  startDate: string | null; // ISO string
  endDate: string | null; // ISO string
  cycleLength: number; // default 28
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'grace' | 'tanga';
  timestamp: string; // ISO string
}

export interface AppData {
  grace: UserData;
  tanga: UserData;
  period: PeriodData;
  activities: Activity[];
  messages: ChatMessage[];
}
