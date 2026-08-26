// Root of the app and the only place that decides which screen you see.
//
// Access is a ladder, and each rung is a hard gate: signed in -> has a profile
// -> has a partner. LifeTrack is only usable by a pair, so everything past the
// pairing screen assumes both `profile` and `partner` exist.
//
// This is also the single owner of the Firestore subscriptions. Children take
// plain props and call back up, so no component below reaches for the database
// on its own.

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorInfo, ReactNode } from 'react';
import { format, isBefore, isValid, parseISO, startOfToday, startOfWeek } from 'date-fns';
import {
  Calendar,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Settings as SettingsIcon,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  auth,
  isFirebaseConfigured,
  logFirestoreError,
  missingFirebaseVars,
  OperationType,
} from './firebase';
import {
  activitiesCol,
  clearMessageFlag,
  addActivity,
  deleteActivity,
  deleteMessage,
  emptyTracker,
  messagesCol,
  normalizeActivity,
  normalizeMessage,
  normalizeProfile,
  normalizeRequest,
  normalizeTracker,
  requestsCol,
  saveTracker,
  sendMessage,
  trackerDoc,
  userDoc,
} from './services/db';
import { getTheme, readableOn } from './theme';
import {
  Activity,
  ChatMessage,
  ConnectionRequest,
  DAYS,
  TrackerData,
  UserProfile,
} from './types';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import PairSetup from './components/PairSetup';
import SettingsPanel from './components/SettingsPanel';
import Dashboard from './components/Dashboard';
import TaskTracker from './components/TaskTracker';
import Activities from './components/Activities';
import ChatDesk from './components/ChatDesk';
import { Avatar, Spinner, mutedText } from './components/ui';

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-red-50 p-8 text-center overflow-y-auto">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto max-w-full text-left">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reload application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Page = 'dashboard' | 'me' | 'partner' | 'activities' | 'chat' | 'settings';

/**
 * Habits and tasks roll over once per calendar week (weeks start on Monday, the
 * same order the planner columns use). Comparing against the start of the
 * current week makes the check idempotent, so two devices open at once cannot
 * reset twice.
 */
function needsWeeklyReset(lastResetDate: string, now: Date): boolean {
  const last = parseISO(lastResetDate);
  if (!isValid(last)) return true;
  return isBefore(last, startOfWeek(now, { weekStartsOn: 1 }));
}

function resetTracker(data: TrackerData): TrackerData {
  const weeklySchedule = { ...data.weeklySchedule };
  DAYS.forEach((day) => {
    // Classes repeat every week; only the one-off tasks are cleared.
    weeklySchedule[day] = { ...weeklySchedule[day], tasks: [] };
  });
  return {
    ...data,
    weeklySchedule,
    habits: data.habits.map((habit) => ({
      ...habit,
      completed: DAYS.reduce(
        (acc, day) => ({ ...acc, [day]: false }),
        {} as (typeof habit)['completed'],
      ),
    })),
    lastResetDate: startOfToday().toISOString(),
  };
}

/**
 * The centred single-column layout every pre-dashboard screen uses: loading,
 * setup notices and recoverable errors.
 */
function CenteredPane({
  isDarkMode,
  children,
}: {
  isDarkMode: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`h-full w-full flex items-center justify-center p-6 overflow-y-auto ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-md w-full flex flex-col items-center text-center gap-4">
        {children}
      </div>
    </div>
  );
}

function PaneTitle({ isDarkMode, children }: { isDarkMode: boolean; children: ReactNode }) {
  return (
    <h1
      className={`text-xl font-black uppercase tracking-tighter ${
        isDarkMode ? 'text-white' : 'text-gray-900'
      }`}
    >
      {children}
    </h1>
  );
}

/**
 * Shown instead of the app when the Firebase env vars are absent. Rendered
 * outside AppContent, which is why it cannot read the dark-mode preference.
 */
function ConfigNotice() {
  return (
    <CenteredPane isDarkMode={false}>
      <PaneTitle isDarkMode={false}>Firebase is not configured</PaneTitle>
      <p className="text-sm text-gray-600">
        LifeTrack keeps every account, pairing and shared board in Firebase, so it cannot
        run without credentials. Copy <code>.env.example</code> to <code>.env.local</code>{' '}
        and fill in your project values.
      </p>
      {missingFirebaseVars.length > 0 && (
        <ul className="text-xs font-mono bg-white border border-gray-200 rounded-xl p-3 space-y-1 text-left">
          {missingFirebaseVars.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </CenteredPane>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <ErrorBoundary>
      {isFirebaseConfigured ? <AppContent /> : <ConfigNotice />}
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('darkMode') ?? 'false');
    } catch {
      return false;
    }
  });

  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Tagged with the uid it belongs to, so a profile never leaks across a
  // sign-out and a repeated auth event cannot strand the loading state.
  const [profileState, setProfileState] = useState<{
    uid: string | null;
    profile: UserProfile | null;
    failed: boolean;
  }>({ uid: null, profile: null, failed: false });
  // Bumped to re-subscribe after a failed profile read.
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [partner, setPartner] = useState<UserProfile | null>(null);

  const [myTracker, setMyTracker] = useState<TrackerData>(emptyTracker);
  const [partnerTracker, setPartnerTracker] = useState<TrackerData>(emptyTracker);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequest[]>([]);

  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // --- Auth -----------------------------------------------------------------

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setAuthUser(user);
        setAuthReady(true);
      }),
    [],
  );

  const authUid = authUser?.uid ?? null;

  // --- My profile -----------------------------------------------------------

  useEffect(() => {
    if (!authUid) {
      setProfileState({ uid: null, profile: null, failed: false });
      return;
    }
    return onSnapshot(
      userDoc(authUid),
      (snapshot) =>
        setProfileState({
          uid: authUid,
          profile: snapshot.exists() ? normalizeProfile(authUid, snapshot.data()) : null,
          failed: false,
        }),
      (error) => {
        logFirestoreError(error, OperationType.GET, `users/${authUid}`);
        // Deliberately NOT treated as "no account yet": sending someone whose
        // profile merely failed to load into setup would have them rewrite a
        // document they cannot see.
        setProfileState({ uid: authUid, profile: null, failed: true });
      },
    );
  }, [authUid, profileAttempt]);

  // Only trust the profile once it has arrived for the account now signed in.
  const profileReady = profileState.uid === authUid;
  const profile = profileReady ? profileState.profile : null;

  const uid = profile?.uid ?? null;
  const partnerId = profile?.partnerId ?? null;
  const pairId = profile?.pairId ?? null;

  // --- Partner profile ------------------------------------------------------

  useEffect(() => {
    if (!partnerId) {
      setPartner(null);
      return;
    }
    return onSnapshot(
      userDoc(partnerId),
      (snapshot) =>
        setPartner(snapshot.exists() ? normalizeProfile(partnerId, snapshot.data()) : null),
      (error) => logFirestoreError(error, OperationType.GET, `users/${partnerId}`),
    );
  }, [partnerId]);

  // --- Trackers -------------------------------------------------------------

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      trackerDoc(uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setMyTracker(normalizeTracker(snapshot.data()));
        } else {
          const fresh = emptyTracker();
          setMyTracker(fresh);
          saveTracker(uid, fresh).catch((error) =>
            logFirestoreError(error, OperationType.WRITE, `trackers/${uid}`),
          );
        }
      },
      (error) => logFirestoreError(error, OperationType.GET, `trackers/${uid}`),
    );
  }, [uid]);

  useEffect(() => {
    if (!partnerId) {
      setPartnerTracker(emptyTracker());
      return;
    }
    return onSnapshot(
      trackerDoc(partnerId),
      (snapshot) =>
        setPartnerTracker(snapshot.exists() ? normalizeTracker(snapshot.data()) : emptyTracker()),
      (error) => logFirestoreError(error, OperationType.GET, `trackers/${partnerId}`),
    );
  }, [partnerId]);

  // --- Shared pair data -----------------------------------------------------

  useEffect(() => {
    if (!pairId) {
      setActivities([]);
      return;
    }
    return onSnapshot(
      activitiesCol(pairId),
      (snapshot) =>
        setActivities(
          snapshot.docs
            .map((d) => normalizeActivity(d.id, d.data()))
            .filter((a): a is Activity => a !== null),
        ),
      (error) => logFirestoreError(error, OperationType.LIST, `pairs/${pairId}/activities`),
    );
  }, [pairId]);

  useEffect(() => {
    if (!pairId) {
      setMessages([]);
      return;
    }
    return onSnapshot(
      query(messagesCol(pairId), orderBy('timestamp', 'asc')),
      (snapshot) =>
        setMessages(
          snapshot.docs
            .map((d) => normalizeMessage(d.id, d.data()))
            .filter((m): m is ChatMessage => m !== null),
        ),
      (error) => logFirestoreError(error, OperationType.LIST, `pairs/${pairId}/messages`),
    );
  }, [pairId]);

  // --- Connection requests (only while unpaired) ----------------------------

  useEffect(() => {
    if (!uid || partnerId) {
      setIncoming([]);
      setOutgoing([]);
      return;
    }
    const unsubIncoming = onSnapshot(
      query(requestsCol(), where('toUid', '==', uid)),
      (snapshot) =>
        setIncoming(
          snapshot.docs
            .map((d) => normalizeRequest(d.id, d.data()))
            .filter((r): r is ConnectionRequest => r !== null && r.status === 'pending'),
        ),
      (error) => logFirestoreError(error, OperationType.LIST, 'connectionRequests(incoming)'),
    );
    const unsubOutgoing = onSnapshot(
      query(requestsCol(), where('fromUid', '==', uid)),
      (snapshot) =>
        setOutgoing(
          snapshot.docs
            .map((d) => normalizeRequest(d.id, d.data()))
            .filter((r): r is ConnectionRequest => r !== null && r.status === 'pending'),
        ),
      (error) => logFirestoreError(error, OperationType.LIST, 'connectionRequests(outgoing)'),
    );
    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [uid, partnerId]);

  // --- Weekly reset (own tracker only) --------------------------------------

  const trackerRef = useRef(myTracker);
  trackerRef.current = myTracker;

  useEffect(() => {
    if (!uid) return;

    const check = () => {
      const current = trackerRef.current;
      if (!needsWeeklyReset(current.lastResetDate, new Date())) return;
      const reset = resetTracker(current);
      setMyTracker(reset);
      saveTracker(uid, reset).catch((error) =>
        logFirestoreError(error, OperationType.WRITE, `trackers/${uid}`),
      );
    };

    check();
    const interval = window.setInterval(check, 1000 * 60 * 30);
    return () => window.clearInterval(interval);
  }, [uid, myTracker.lastResetDate]);

  // --- Actions --------------------------------------------------------------

  const handleSignOut = useCallback(() => {
    signOut(auth).catch((error) => console.error('Sign out failed', error));
  }, []);

  const updateMyTracker = useCallback(
    (data: TrackerData) => {
      if (!uid) return;
      setMyTracker(data); // optimistic; the snapshot confirms it
      saveTracker(uid, data).catch((error) =>
        logFirestoreError(error, OperationType.WRITE, `trackers/${uid}`),
      );
    },
    [uid],
  );

  const handleAddActivity = useCallback(
    (activity: { name: string; time: string; date: string; ownerId: string }) => {
      if (!pairId) return;
      addActivity(pairId, activity).catch((error) =>
        logFirestoreError(error, OperationType.CREATE, `pairs/${pairId}/activities`),
      );
    },
    [pairId],
  );

  const handleDeleteActivity = useCallback(
    (id: string) => {
      if (!pairId) return;
      deleteActivity(pairId, id).catch((error) =>
        logFirestoreError(error, OperationType.DELETE, `pairs/${pairId}/activities/${id}`),
      );
    },
    [pairId],
  );

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!pairId || !uid || !partnerId) return;
      sendMessage(pairId, uid, partnerId, text).catch((error) =>
        logFirestoreError(error, OperationType.CREATE, `pairs/${pairId}/messages`),
      );
    },
    [pairId, uid, partnerId],
  );

  const handleDeleteMessage = useCallback(
    (id: string) => {
      if (!pairId) return;
      deleteMessage(pairId, id).catch((error) =>
        logFirestoreError(error, OperationType.DELETE, `pairs/${pairId}/messages/${id}`),
      );
    },
    [pairId],
  );

  const dismissMessageFlag = useCallback(() => {
    if (!uid) return;
    clearMessageFlag(uid).catch((error) =>
      logFirestoreError(error, OperationType.UPDATE, `users/${uid}`),
    );
  }, [uid]);

  const openActivityFor = useCallback((date: string) => {
    setHighlightDate(date);
    setActivePage('activities');
  }, []);

  // A new pairing always starts on the dashboard, never on whatever page was
  // open when the previous connection ended.
  useEffect(() => setActivePage('dashboard'), [pairId]);

  // Opening the chat clears the unread badge.
  useEffect(() => {
    if (activePage === 'chat' && profile?.hasNewMessage) dismissMessageFlag();
  }, [activePage, profile?.hasNewMessage, dismissMessageFlag]);

  const members = useMemo(
    () => (profile && partner ? [profile, partner] : []),
    [profile, partner],
  );

  // --- Gating ---------------------------------------------------------------

  if (!authReady || (authUser && !profileReady)) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <CenteredPane isDarkMode={isDarkMode}>
          <Spinner size={28} className={mutedText(isDarkMode)} />
        </CenteredPane>
      </Shell>
    );
  }

  if (!authUser) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <AuthScreen isDarkMode={isDarkMode} />
      </Shell>
    );
  }

  // A profile that could not be READ is a different situation from one that
  // does not exist yet, and must not be routed into setup.
  if (profileState.failed) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <CenteredPane isDarkMode={isDarkMode}>
          <PaneTitle isDarkMode={isDarkMode}>Could not load your profile</PaneTitle>
          <p className={`text-sm ${mutedText(isDarkMode)}`}>
            Your account is fine, we just could not reach it. Check your connection and
            try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setProfileAttempt((n) => n + 1)}
              className="px-5 py-3 rounded-xl bg-violet-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95"
            >
              Try again
            </button>
            <button
              onClick={handleSignOut}
              className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 text-gray-400 hover:text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign out
            </button>
          </div>
        </CenteredPane>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <Onboarding
          user={authUser}
          isDarkMode={isDarkMode}
          onDone={(created) =>
            setProfileState({ uid: created.uid, profile: created, failed: false })
          }
          onSignOut={handleSignOut}
        />
      </Shell>
    );
  }

  if (!profile.partnerId || !profile.pairId) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <PairSetup
          profile={profile}
          incoming={incoming}
          outgoing={outgoing}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((v) => !v)}
          onSignOut={handleSignOut}
        />
      </Shell>
    );
  }

  if (!partner) {
    return (
      <Shell isDarkMode={isDarkMode}>
        <CenteredPane isDarkMode={isDarkMode}>
          <Spinner size={28} className={mutedText(isDarkMode)} />
          <p className={`text-xs font-black uppercase tracking-widest ${mutedText(isDarkMode)}`}>
            Loading your partner
          </p>
        </CenteredPane>
      </Shell>
    );
  }

  // --- Paired experience ----------------------------------------------------

  const myTheme = getTheme(profile.themeColor);
  const partnerTheme = getTheme(partner.themeColor);

  const navItems: { page: Page; label: string; icon: ReactNode; color: string }[] = [
    { page: 'dashboard', label: 'Home', icon: <LayoutDashboard size={18} />, color: myTheme.primary },
    { page: 'me', label: 'Me', icon: <User size={18} />, color: myTheme.primary },
    {
      page: 'partner',
      label: partner.displayName.split(' ')[0],
      icon: <Users size={18} />,
      color: partnerTheme.primary,
    },
    { page: 'activities', label: 'Events', icon: <Calendar size={18} />, color: myTheme.primary },
    { page: 'chat', label: 'Chat', icon: <MessageSquare size={18} />, color: myTheme.primary },
    { page: 'settings', label: 'Settings', icon: <SettingsIcon size={18} />, color: myTheme.primary },
  ];

  const pageContent: Record<Page, ReactNode> = {
    dashboard: (
      <Dashboard
        me={profile}
        partner={partner}
        myTracker={myTracker}
        partnerTracker={partnerTracker}
        activities={activities}
        isDarkMode={isDarkMode}
        onDismissMessage={dismissMessageFlag}
      />
    ),
    me: (
      <TaskTracker
        profile={profile}
        data={myTracker}
        onUpdate={updateMyTracker}
        isDarkMode={isDarkMode}
        activities={activities}
        onActivityClick={openActivityFor}
      />
    ),
    partner: (
      <TaskTracker
        profile={partner}
        data={partnerTracker}
        onUpdate={() => {}}
        isDarkMode={isDarkMode}
        activities={activities}
        onActivityClick={openActivityFor}
        readOnly
      />
    ),
    activities: (
      <Activities
        activities={activities}
        members={members}
        currentUid={profile.uid}
        onAdd={handleAddActivity}
        onDelete={handleDeleteActivity}
        isDarkMode={isDarkMode}
        highlightDate={highlightDate}
        onClearHighlight={() => setHighlightDate(null)}
      />
    ),
    chat: (
      <ChatDesk
        messages={messages}
        me={profile}
        partner={partner}
        onSend={handleSendMessage}
        onDelete={handleDeleteMessage}
        isDarkMode={isDarkMode}
      />
    ),
    settings: (
      <SettingsPanel
        profile={profile}
        partner={partner}
        isDarkMode={isDarkMode}
        onSignOut={handleSignOut}
      />
    ),
  };

  return (
    <Shell isDarkMode={isDarkMode}>
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Desktop navigation */}
        <nav
          className={`hidden md:flex px-6 py-3 items-center justify-between shadow-sm z-50 ${
            isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: myTheme.primary }}
            >
              <Heart size={18} color={readableOn(myTheme.primary)} className="fill-current" />
            </div>
            <span className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              LifeTrack
            </span>
          </div>

          <div className={`flex items-center gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
            {navItems.map((item) => {
              const active = activePage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => setActivePage(item.page)}
                  style={active ? { color: item.color } : undefined}
                  className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-all text-sm font-bold ${
                    active
                      ? isDarkMode
                        ? 'bg-gray-800 shadow-sm'
                        : 'bg-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item.icon}
                  <span className="hidden lg:inline max-w-[9ch] truncate">{item.label}</span>
                  {item.page === 'chat' && profile.hasNewMessage && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode((v) => !v)}
              aria-label="Toggle dark mode"
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-400 hover:text-red-400'
                  : 'bg-gray-100 text-gray-600 hover:text-red-500'
              }`}
            >
              <LogOut size={18} />
            </button>
            <div className="hidden xl:flex items-center gap-2">
              <Avatar
                name={profile.displayName}
                colorId={profile.themeColor}
                photoURL={profile.photoURL}
                size={34}
              />
              <div className="text-right">
                <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {profile.displayName}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {format(new Date(), 'MMM d')}
                </p>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-x-0 top-0 bottom-[68px] md:bottom-0"
            >
              {pageContent[activePage]}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile navigation */}
        <nav
          className={`md:hidden fixed bottom-0 left-0 right-0 z-50 px-1 py-2 flex items-center justify-around shadow-[0_-4px_10px_rgba(0,0,0,0.05)] ${
            isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'
          }`}
        >
          {navItems.map((item) => {
            const active = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                style={active ? { color: item.color } : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-1 py-1 min-w-0 flex-1 ${
                  active ? '' : 'text-gray-400'
                }`}
              >
                {item.icon}
                <span className="text-[9px] font-bold uppercase tracking-tighter truncate max-w-full">
                  {item.label}
                </span>
                {item.page === 'chat' && profile.hasNewMessage && (
                  <span className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </Shell>
  );
}

function Shell({ isDarkMode, children }: { isDarkMode: boolean; children: ReactNode }) {
  return (
    <div
      className={`h-[100dvh] w-screen overflow-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      {children}
    </div>
  );
}
