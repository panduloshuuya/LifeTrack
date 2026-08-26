import { ThemeColorId } from './theme';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/**
 * Canonical week order. The planner columns, the habit grid and the weekly
 * reset all iterate this, so changing it changes all three together.
 */
export const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface Habit {
  id: string;
  name: string;
  completed: Record<DayOfWeek, boolean>;
}

/** A recurring commitment. Survives the weekly reset. */
export interface ClassEvent {
  id: string;
  name: string;
  time?: string;
}

/** A one-off to-do. Cleared by the weekly reset. */
export interface Task {
  id: string;
  name: string;
  completed: boolean;
}

export interface DayData {
  classes: ClassEvent[];
  tasks: Task[];
}

/** `trackers/{uid}` — one person's habits and weekly plan. */
export interface TrackerData {
  habits: Habit[];
  weeklySchedule: Record<DayOfWeek, DayData>;
  /** ISO date of the last weekly rollover, used to make it happen once. */
  lastResetDate: string;
}

/** `users/{uid}` — public profile plus pairing state. */
export interface UserProfile {
  uid: string;
  displayName: string;
  /** Lower-cased copy of displayName; the field prefix search ranges over. */
  displayNameLower: string;
  /** Stored lower-cased so email search can use the same prefix range. */
  email: string;
  photoURL: string | null;
  themeColor: ThemeColorId;
  /** The one partner's uid, or null when unpaired. */
  partnerId: string | null;
  /** The shared `pairs/{pairId}` document, or null when unpaired. */
  pairId: string | null;
  /** Unread badge, raised by the partner when they send a message. */
  hasNewMessage: boolean;
  createdAt: string;
}

/** `pairs/{pairId}` — the link between exactly two accounts. */
export interface PairDoc {
  id: string;
  members: string[];
  createdAt: string;
}

/**
 * `connectionRequests/{fromUid}_{toUid}` — a pairing invitation.
 *
 * The composite id makes duplicate invites impossible and lets the security
 * rules find the request by path when authorising the write that links the two
 * profiles together.
 */
export interface ConnectionRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromEmail: string;
  fromColor: ThemeColorId;
  toUid: string;
  toName: string;
  /** Set to 'accepted' inside the pairing transaction, then deleted. */
  status: 'pending' | 'accepted';
  createdAt: string;
}

/** `pairs/{pairId}/activities/{id}` — an entry on the shared calendar. */
export interface Activity {
  id: string;
  name: string;
  time: string;
  date: string;
  /** Which of the two members the entry belongs to; drives its colour. */
  ownerId: string;
  createdAt: string;
}

/** `pairs/{pairId}/messages/{id}` — one ChatDesk message. */
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: string;
}
