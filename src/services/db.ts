// Every Firestore read and write in the app.
//
// Two rules shape this module. Documents coming back are treated as untrusted
// shapes and pass through a normaliser, because a partial write must not crash
// a screen. And anything touching a pairing runs as a transaction or a batch,
// because two people act on the same documents at the same time.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from '../firebase';
import { DEFAULT_THEME_COLOR, isThemeColorId, ThemeColorId } from '../theme';
import {
  Activity,
  ChatMessage,
  ConnectionRequest,
  DayData,
  DayOfWeek,
  DAYS,
  Habit,
  PairDoc,
  TrackerData,
  UserProfile,
} from '../types';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Thrown for conditions the user can act on; the message is shown verbatim. */
export class PairingError extends Error {}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const userDoc = (uid: string) => doc(db, 'users', uid);
export const trackerDoc = (uid: string) => doc(db, 'trackers', uid);
const pairDoc = (pairId: string) => doc(db, 'pairs', pairId);
export const activitiesCol = (pairId: string) =>
  collection(db, 'pairs', pairId, 'activities');
export const messagesCol = (pairId: string) =>
  collection(db, 'pairs', pairId, 'messages');
export const requestsCol = () => collection(db, 'connectionRequests');
const requestId = (fromUid: string, toUid: string) => `${fromUid}_${toUid}`;
const requestDoc = (fromUid: string, toUid: string) =>
  doc(db, 'connectionRequests', requestId(fromUid, toUid));

// ---------------------------------------------------------------------------
// Normalisers - documents read back from Firestore are untrusted shapes
// ---------------------------------------------------------------------------

function emptySchedule(): Record<DayOfWeek, DayData> {
  return DAYS.reduce((acc, day) => {
    acc[day] = { classes: [], tasks: [] };
    return acc;
  }, {} as Record<DayOfWeek, DayData>);
}

export function emptyTracker(): TrackerData {
  return {
    habits: [],
    weeklySchedule: emptySchedule(),
    lastResetDate: new Date().toISOString(),
  };
}

function normalizeHabit(raw: unknown): Habit | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Partial<Habit>;
  if (typeof h.name !== 'string') return null;
  const completed = DAYS.reduce((acc, day) => {
    acc[day] = Boolean(h.completed?.[day]);
    return acc;
  }, {} as Record<DayOfWeek, boolean>);
  return { id: typeof h.id === 'string' ? h.id : newId(), name: h.name, completed };
}

/**
 * Guarantees every field the UI indexes into exists. Without this, a document
 * written by an older version of the app (or a partial write) crashes the
 * dashboard on `weeklySchedule[today]`.
 */
export function normalizeTracker(raw: unknown): TrackerData {
  const base = emptyTracker();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<TrackerData>;

  const habits = Array.isArray(data.habits)
    ? data.habits.map(normalizeHabit).filter((h): h is Habit => h !== null)
    : [];

  const weeklySchedule = emptySchedule();
  DAYS.forEach((day) => {
    const dayData = data.weeklySchedule?.[day];
    weeklySchedule[day] = {
      classes: Array.isArray(dayData?.classes)
        ? dayData.classes.filter((c) => c && typeof c.name === 'string')
        : [],
      tasks: Array.isArray(dayData?.tasks)
        ? dayData.tasks
            .filter((t) => t && typeof t.name === 'string')
            .map((t) => ({ ...t, completed: Boolean(t.completed) }))
        : [],
    };
  });

  return {
    habits,
    weeklySchedule,
    lastResetDate:
      typeof data.lastResetDate === 'string' && data.lastResetDate
        ? data.lastResetDate
        : base.lastResetDate,
  };
}

export function normalizeProfile(uid: string, raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<UserProfile>;
  if (typeof data.displayName !== 'string' || !data.displayName) return null;
  return {
    uid,
    displayName: data.displayName,
    displayNameLower: (data.displayNameLower || data.displayName).toLowerCase(),
    email: typeof data.email === 'string' ? data.email : '',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    themeColor: isThemeColorId(data.themeColor) ? data.themeColor : DEFAULT_THEME_COLOR,
    partnerId: typeof data.partnerId === 'string' ? data.partnerId : null,
    pairId: typeof data.pairId === 'string' ? data.pairId : null,
    hasNewMessage: Boolean(data.hasNewMessage),
    createdAt:
      typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
  };
}

export function normalizeActivity(id: string, raw: unknown): Activity | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<Activity>;
  if (typeof data.name !== 'string' || typeof data.date !== 'string') return null;
  if (Number.isNaN(new Date(data.date).getTime())) return null;
  return {
    id,
    name: data.name,
    time: typeof data.time === 'string' && data.time ? data.time : 'All Day',
    date: data.date,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    createdAt:
      typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString(),
  };
}

export function normalizeMessage(id: string, raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<ChatMessage>;
  if (typeof data.text !== 'string' || typeof data.senderId !== 'string') return null;
  const timestamp =
    typeof data.timestamp === 'string' &&
    !Number.isNaN(new Date(data.timestamp).getTime())
      ? data.timestamp
      : new Date(0).toISOString();
  return { id, text: data.text, senderId: data.senderId, timestamp };
}

export function normalizeRequest(id: string, raw: unknown): ConnectionRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<ConnectionRequest>;
  if (typeof data.fromUid !== 'string' || typeof data.toUid !== 'string') return null;
  return {
    id,
    fromUid: data.fromUid,
    toUid: data.toUid,
    fromName: typeof data.fromName === 'string' ? data.fromName : 'Someone',
    fromEmail: typeof data.fromEmail === 'string' ? data.fromEmail : '',
    fromColor: isThemeColorId(data.fromColor) ? data.fromColor : DEFAULT_THEME_COLOR,
    toName: typeof data.toName === 'string' ? data.toName : '',
    status: data.status === 'accepted' ? 'accepted' : 'pending',
    createdAt:
      typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Creates the signed-in user's profile, or repairs it if one is already there.
 *
 * This has to be safe to run more than once. Setup is shown whenever no usable
 * profile could be loaded, which includes the case where a document exists but
 * is incomplete, so a blind overwrite would either be rejected by the rules or
 * silently wipe an existing pairing.
 */
export async function createProfile(
  user: FirebaseUser,
  displayName: string,
  themeColor: ThemeColorId,
): Promise<UserProfile> {
  const name = displayName.trim();
  const ref = userDoc(user.uid);

  const existing = await getDoc(ref).catch(() => null);
  const previous =
    existing?.exists() ? normalizeProfile(user.uid, existing.data()) : null;

  const profile: UserProfile = {
    uid: user.uid,
    displayName: name,
    displayNameLower: name.toLowerCase(),
    email: (user.email ?? '').toLowerCase(),
    photoURL: user.photoURL ?? null,
    themeColor,
    // Carried over, never reset: re-running setup must not dissolve a pairing
    // or backdate the account.
    partnerId: previous?.partnerId ?? null,
    pairId: previous?.pairId ?? null,
    hasNewMessage: previous?.hasNewMessage ?? false,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
  };
  await setDoc(ref, profile);

  // The app's tracker listener creates this on demand too, so a failure here
  // must not strand the user on the setup screen.
  await setDoc(trackerDoc(user.uid), emptyTracker(), { merge: true }).catch((error) =>
    console.warn('Could not pre-create tracker document', error),
  );

  return profile;
}

export async function updateProfileSettings(
  uid: string,
  updates: { displayName?: string; themeColor?: ThemeColorId },
  partnerColor?: ThemeColorId | null,
): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (updates.displayName !== undefined) {
    const name = updates.displayName.trim();
    if (name.length < 2) throw new PairingError('Your name needs at least 2 characters.');
    patch.displayName = name;
    patch.displayNameLower = name.toLowerCase();
  }

  if (updates.themeColor !== undefined) {
    if (partnerColor && updates.themeColor === partnerColor) {
      throw new PairingError(
        'Your partner already uses that colour. Pick a different one.',
      );
    }
    patch.themeColor = updates.themeColor;
  }

  if (Object.keys(patch).length === 0) return;
  await updateDoc(userDoc(uid), patch);
}

export async function clearMessageFlag(uid: string): Promise<void> {
  await updateDoc(userDoc(uid), { hasNewMessage: false });
}

// ---------------------------------------------------------------------------
// Partner search + connection requests
// ---------------------------------------------------------------------------

export interface SearchResult extends UserProfile {
  /** True when this person is already paired with someone else. */
  unavailable: boolean;
}

/**
 * Upper bound for a prefix range query. U+F8FF is a private-use character
 * that sorts above ordinary text, so `[term, term + PREFIX_END]` covers every
 * string starting with `term`.
 */
const PREFIX_END = '';

/**
 * Finds candidate partners by email or by name.
 *
 * Both are prefix searches, so "grace@" finds "grace@example.com" without the
 * searcher having to type the whole address. Emails are stored lower-cased by
 * `createProfile`, which is what makes the range query work.
 */
export async function searchUsers(
  term: string,
  currentUid: string,
): Promise<SearchResult[]> {
  const trimmed = term.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const users = collection(db, 'users');
  const [byEmail, byName] = await Promise.all([
    getDocs(
      query(
        users,
        where('email', '>=', trimmed),
        where('email', '<=', trimmed + PREFIX_END),
        limit(15),
      ),
    ),
    getDocs(
      query(
        users,
        where('displayNameLower', '>=', trimmed),
        where('displayNameLower', '<=', trimmed + PREFIX_END),
        limit(15),
      ),
    ),
  ]);

  // Email matches are listed first: they are the unambiguous way to identify
  // the right person when two people share a name.
  const seen = new Map<string, SearchResult>();
  [...byEmail.docs, ...byName.docs].forEach((snap) => {
    if (snap.id === currentUid || seen.has(snap.id)) return;
    const profile = normalizeProfile(snap.id, snap.data());
    if (!profile) return;
    seen.set(snap.id, { ...profile, unavailable: profile.partnerId !== null });
  });

  return [...seen.values()];
}

export async function sendConnectionRequest(
  me: UserProfile,
  target: UserProfile,
): Promise<void> {
  if (me.partnerId) throw new PairingError('You are already connected to a partner.');
  if (target.uid === me.uid) throw new PairingError('You cannot connect with yourself.');
  if (target.partnerId) {
    throw new PairingError(`${target.displayName} is already in an accountability pair.`);
  }

  const request: ConnectionRequest = {
    id: requestId(me.uid, target.uid),
    fromUid: me.uid,
    fromName: me.displayName,
    fromEmail: me.email,
    fromColor: me.themeColor,
    toUid: target.uid,
    toName: target.displayName,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(requestDoc(me.uid, target.uid), request);
}

export async function cancelConnectionRequest(
  fromUid: string,
  toUid: string,
): Promise<void> {
  await deleteDoc(requestDoc(fromUid, toUid));
}

/** Declining is just deleting the request the other person sent. */
export const declineConnectionRequest = cancelConnectionRequest;

/**
 * Links two users into a pair. Runs in a transaction so two people accepting at
 * the same moment cannot both end up half-connected.
 *
 * `myNewColor` lets the accepting user resolve a colour clash in the same
 * write, because a pair may not share a theme colour.
 */
export async function acceptConnectionRequest(
  myUid: string,
  fromUid: string,
  myNewColor?: ThemeColorId,
): Promise<string> {
  const pairId = newId();

  await runTransaction(db, async (tx) => {
    const meRef = userDoc(myUid);
    const themRef = userDoc(fromUid);
    const reqRef = requestDoc(fromUid, myUid);

    // Every read must happen before any write inside a transaction.
    const meSnap = await tx.get(meRef);
    const themSnap = await tx.get(themRef);
    const reqSnap = await tx.get(reqRef);

    if (!reqSnap.exists()) {
      throw new PairingError('That request no longer exists.');
    }
    const me = normalizeProfile(myUid, meSnap.data());
    const them = normalizeProfile(fromUid, themSnap.data());
    if (!me) throw new PairingError('Your profile could not be loaded.');
    if (!them) throw new PairingError('That account no longer exists.');
    if (me.partnerId) throw new PairingError('You are already connected to a partner.');
    if (them.partnerId) {
      throw new PairingError(`${them.displayName} has already paired with someone else.`);
    }

    const myColor = myNewColor ?? me.themeColor;
    if (myColor === them.themeColor) {
      throw new PairingError(
        `${them.displayName} already uses that colour. Choose a different one to connect.`,
      );
    }

    const pair: PairDoc = {
      id: pairId,
      members: [myUid, fromUid],
      createdAt: new Date().toISOString(),
    };

    tx.set(pairDoc(pairId), pair);
    tx.update(meRef, {
      partnerId: fromUid,
      pairId,
      ...(myNewColor ? { themeColor: myNewColor } : {}),
    });
    tx.update(themRef, { partnerId: myUid, pairId });
    // Marked rather than deleted: the security rules read this document to
    // authorise the write to the other person's profile.
    tx.update(reqRef, { status: 'accepted' });
  });

  await clearRequestsFor([myUid, fromUid]);
  return pairId;
}

/** Removes every request involving these users once a pair is formed. */
async function clearRequestsFor(uids: string[]): Promise<void> {
  try {
    const results = await Promise.all([
      ...uids.map((uid) => getDocs(query(requestsCol(), where('fromUid', '==', uid)))),
      ...uids.map((uid) => getDocs(query(requestsCol(), where('toUid', '==', uid)))),
    ]);
    const ids = new Set<string>();
    results.forEach((snap) => snap.docs.forEach((d) => ids.add(d.id)));
    if (ids.size === 0) return;
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(doc(db, 'connectionRequests', id)));
    await batch.commit();
  } catch (error) {
    // Best effort: a leftover request does not break the pairing itself.
    console.warn('Could not clear connection requests', error);
  }
}

/**
 * Ends a pair and deletes everything the two people shared, so a later pairing
 * starts from a clean slate. Personal habit data is left untouched.
 */
export async function disconnectPair(
  myUid: string,
  partnerUid: string,
  pairId: string,
): Promise<void> {
  // Shared documents go first: the rule authorising their deletion reads the
  // pair document, which is removed at the end.
  const [activitySnap, messageSnap] = await Promise.all([
    getDocs(activitiesCol(pairId)),
    getDocs(messagesCol(pairId)),
  ]);

  const shared = [...activitySnap.docs, ...messageSnap.docs];
  for (let i = 0; i < shared.length; i += 400) {
    const batch = writeBatch(db);
    shared.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const batch = writeBatch(db);
  batch.update(userDoc(myUid), { partnerId: null, pairId: null });
  batch.update(userDoc(partnerUid), { partnerId: null, pairId: null });
  await batch.commit();

  await deleteDoc(pairDoc(pairId)).catch((error) => {
    // Both profiles are already unlinked; a leftover pair doc is harmless.
    console.warn('Could not delete pair document', error);
  });
}

// ---------------------------------------------------------------------------
// Tracker / activities / messages
// ---------------------------------------------------------------------------

export async function saveTracker(uid: string, data: TrackerData): Promise<void> {
  await setDoc(trackerDoc(uid), data);
}

export async function addActivity(
  pairId: string,
  activity: Omit<Activity, 'id' | 'createdAt'>,
): Promise<void> {
  const id = newId();
  await setDoc(doc(activitiesCol(pairId), id), {
    ...activity,
    id,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteActivity(pairId: string, id: string): Promise<void> {
  await deleteDoc(doc(activitiesCol(pairId), id));
}

export async function sendMessage(
  pairId: string,
  senderId: string,
  partnerId: string,
  text: string,
): Promise<void> {
  const id = newId();
  await setDoc(doc(messagesCol(pairId), id), {
    id,
    text,
    senderId,
    timestamp: new Date().toISOString(),
  });
  // Field-level update, so a stale local copy of the partner's profile can
  // never clobber the rest of their document.
  await updateDoc(userDoc(partnerId), { hasNewMessage: true }).catch((error) => {
    console.warn('Could not flag new message for partner', error);
  });
}

export async function deleteMessage(pairId: string, id: string): Promise<void> {
  await deleteDoc(doc(messagesCol(pairId), id));
}
