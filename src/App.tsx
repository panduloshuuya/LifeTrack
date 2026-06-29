/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  startOfWeek, 
  isSunday, 
  isSameDay, 
  parseISO, 
  format, 
  startOfToday,
  isAfter,
  addDays,
  differenceInDays
} from 'date-fns';
import { 
  User, 
  Users, 
  Calendar, 
  Heart, 
  MessageSquare,
  LayoutDashboard,
  Settings,
  LogIn,
  LogOut,
  Loader2,
  Bell,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import TaskTracker from './components/TaskTracker';
import Activities from './components/Activities';
import LoveDrops from './components/LoveDrops';
import { UserData, PeriodData, DayOfWeek, Activity, ChatMessage } from './types';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <pre className="bg-white p-4 rounded border border-red-200 text-sm overflow-auto max-w-full text-left">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const INITIAL_USER_DATA: UserData = {
  habits: [],
  weeklySchedule: {
    Sun: { classes: [], tasks: [] },
    Mon: { classes: [], tasks: [] },
    Tue: { classes: [], tasks: [] },
    Wed: { classes: [], tasks: [] },
    Thu: { classes: [], tasks: [] },
    Fri: { classes: [], tasks: [] },
    Sat: { classes: [], tasks: [] },
  },
  lastResetDate: startOfWeek(new Date(), { weekStartsOn: 6 }).toISOString(), // Reset on Saturdays
  hasNewMessage: false,
};

const INITIAL_PERIOD_DATA: PeriodData = {
  startDate: null,
  endDate: null,
  cycleLength: 28,
};

type Page = 'dashboard' | 'grace' | 'raili' | 'activities' | 'love-drops';

function Dashboard({ 
  graceData, 
  railiData, 
  activities,
  isDarkMode,
  onUpdateGrace,
  onUpdateRaili
}: { 
  graceData: UserData, 
  railiData: UserData, 
  activities: Activity[],
  isDarkMode: boolean,
  onUpdateGrace: (data: UserData) => void,
  onUpdateRaili: (data: UserData) => void
}) {
  const today = startOfToday();
  const dayName = format(today, 'EEE') as DayOfWeek;
  
  const upcomingActivities = useMemo(() => {
    return activities
      .filter(a => isAfter(parseISO(a.date), startOfToday()) || isSameDay(parseISO(a.date), startOfToday()))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .slice(0, 4);
  }, [activities]);
  
  const calculatePercentage = (data: UserData) => {
    if (data.habits.length === 0) return 0;
    let total = data.habits.length * 7;
    let completed = 0;
    const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    data.habits.forEach(habit => {
      days.forEach(day => {
        if (habit.completed[day]) completed++;
      });
    });
    return Math.round((completed / total) * 100);
  };

  const graceProgress = calculatePercentage(graceData);
  const railiProgress = calculatePercentage(railiData);

  return (
    <div className={`h-full w-full p-4 md:p-6 overflow-y-auto transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-0">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h2 className={`text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Habit Tracker Hub</h2>
            <p className={`text-[10px] md:text-base font-medium italic mt-0.5 md:mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>"Habit and Task accountability tracker. Let's strive for Godly excellence!"</p>
          </div>
          <div className="flex md:block items-center justify-between bg-purple-500/10 md:bg-transparent p-2 md:p-0 rounded-xl">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">{format(today, 'EEEE')}</p>
            <p className={`text-sm md:text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{format(today, 'MMMM d')}</p>
          </div>
        </header>

        {/* Main Accountability Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Grace's Column */}
          <div className="space-y-4 md:space-y-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-none' : 'bg-white border-pink-100/50 shadow-pink-100/20'}`}
            >
              <div className="flex items-center justify-between mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-pink-900/10' : 'bg-pink-50'}`}>
                    <User className="text-pink-300 md:w-6 md:h-6" size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Grace</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg md:text-2xl font-black text-pink-300 leading-none">{graceProgress}%</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Weekly</p>
                </div>
              </div>

              {graceData.hasNewMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-2.5 bg-red-600 text-white rounded-2xl flex items-center justify-between gap-2 shadow-lg shadow-red-600/30"
                >
                  <div className="flex items-center gap-2 pl-1">
                    <Bell size={14} className="animate-bounce" />
                    <span className="text-[9px] font-black uppercase tracking-widest">New ChatDesk Message!</span>
                  </div>
                  <button 
                    onClick={() => onUpdateGrace({ ...graceData, hasNewMessage: false })}
                    className="p-1 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm active:scale-95 flex items-center justify-center"
                  >
                    <Check size={11} strokeWidth={4} />
                  </button>
                </motion.div>
              )}

              <div className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden mb-4 md:mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${graceProgress}%` }}
                  className="h-full bg-pink-300"
                />
              </div>

              <div className="space-y-3 md:space-y-4">
                <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-1 md:pb-2 ${isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'}`}>Today's Focus</h4>
                <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2">
                  {graceData.weeklySchedule[dayName].tasks.length === 0 ? (
                    <p className="text-[10px] md:text-xs text-gray-400 italic">No tasks set for today.</p>
                  ) : (
                    graceData.weeklySchedule[dayName].tasks.map(t => (
                      <div key={t.id} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${t.completed ? 'bg-pink-300' : 'bg-gray-300'}`} />
                        <span className={`text-[10px] md:text-xs font-medium break-words whitespace-normal leading-tight ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {t.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Raili's Column */}
          <div className="space-y-4 md:space-y-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-none' : 'bg-white border-violet-100 shadow-violet-100/30'}`}
            >
              <div className="flex items-center justify-between mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-violet-900/20' : 'bg-violet-100/60'}`}>
                    <Users className="text-violet-400 md:w-6 md:h-6" size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Raili</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg md:text-2xl font-black text-violet-400 leading-none">{railiProgress}%</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Weekly</p>
                </div>
              </div>

              {railiData.hasNewMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-2.5 bg-red-600 text-white rounded-2xl flex items-center justify-between gap-2 shadow-lg shadow-red-600/30"
                >
                  <div className="flex items-center gap-2 pl-1">
                    <Bell size={14} className="animate-bounce" />
                    <span className="text-[9px] font-black uppercase tracking-widest">New ChatDesk Message!</span>
                  </div>
                  <button 
                    onClick={() => onUpdateRaili({ ...railiData, hasNewMessage: false })}
                    className="p-1 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm active:scale-95 flex items-center justify-center"
                  >
                    <Check size={11} strokeWidth={4} />
                  </button>
                </motion.div>
              )}

              <div className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden mb-4 md:mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${railiProgress}%` }}
                  className="h-full bg-violet-400"
                />
              </div>

              <div className="space-y-3 md:space-y-4">
                <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-1 md:pb-2 ${isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'}`}>Today's Focus</h4>
                <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2">
                  {railiData.weeklySchedule[dayName].tasks.length === 0 ? (
                    <p className="text-[10px] md:text-xs text-gray-400 italic">No tasks set for today.</p>
                  ) : (
                    railiData.weeklySchedule[dayName].tasks.map(t => (
                      <div key={t.id} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${t.completed ? 'bg-violet-400' : 'bg-gray-300'}`} />
                        <span className={`text-[10px] md:text-xs font-medium break-words whitespace-normal leading-tight ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {t.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Upcoming Activities Column */}
          <div className="space-y-4 md:space-y-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-none' : 'bg-white border-gray-100 shadow-gray-100/50'}`}
            >
              <div className="flex items-center justify-between mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Calendar className="text-gray-500 md:w-6 md:h-6" size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Activities</h3>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-1 md:pb-2 ${isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'}`}>Upcoming Events</h4>
                <div className="space-y-3 max-h-80 md:max-h-96 overflow-y-auto pr-1 md:pr-2">
                  {upcomingActivities.length === 0 ? (
                    <p className="text-[10px] md:text-xs text-gray-400 italic">No upcoming activities.</p>
                  ) : (
                    upcomingActivities.map(a => (
                      <div key={a.id} className={`p-3 rounded-xl border-l-4 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} ${a.owner === 'grace' ? 'border-l-pink-300' : 'border-l-violet-400'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${a.owner === 'grace' ? 'text-pink-300' : 'text-violet-400'}`}>{a.owner}</span>
                          <span className="text-[8px] font-bold text-gray-400">{format(parseISO(a.date), 'MMM d')}</span>
                        </div>
                        <p className={`text-[11px] font-bold break-words whitespace-normal leading-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{a.name}</p>
                        <p className="text-[9px] text-gray-400 font-medium">{a.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [graceData, setGraceData] = useState<UserData>(INITIAL_USER_DATA);
  const [railiData, setRailiData] = useState<UserData>(INITIAL_USER_DATA);
  const [periodData, setPeriodData] = useState<PeriodData>(INITIAL_PERIOD_DATA);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Firestore Real-time Sync - Public Access
  useEffect(() => {
    const unsubGrace = onSnapshot(doc(db, 'trackers', 'grace'), (snapshot) => {
      if (snapshot.exists()) {
        setGraceData(snapshot.data() as UserData);
      } else {
        setDoc(doc(db, 'trackers', 'grace'), INITIAL_USER_DATA).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/grace'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/grace'));

    const unsubRaili = onSnapshot(doc(db, 'trackers', 'raili'), (snapshot) => {
      if (snapshot.exists()) {
        setRailiData(snapshot.data() as UserData);
      } else {
        setDoc(doc(db, 'trackers', 'raili'), INITIAL_USER_DATA).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/raili'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/raili'));

    const unsubPeriod = onSnapshot(doc(db, 'trackers', 'period'), (snapshot) => {
      if (snapshot.exists()) {
        setPeriodData(snapshot.data() as PeriodData);
      } else {
        setDoc(doc(db, 'trackers', 'period'), INITIAL_PERIOD_DATA).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/period'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/period'));

    const unsubActivities = onSnapshot(doc(db, 'trackers', 'activities'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActivities(data.list || []);
      } else {
        setDoc(doc(db, 'trackers', 'activities'), { list: [] }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/activities'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/activities'));

    const unsubMessages = onSnapshot(doc(db, 'trackers', 'messages'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMessages(data.list || []);
      } else {
        setDoc(doc(db, 'trackers', 'messages'), { list: [] }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/messages'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/messages'));

    return () => {
      unsubGrace();
      unsubRaili();
      unsubPeriod();
      unsubActivities();
      unsubMessages();
    };
  }, []);

  // Wednesday Reset Logic - Helper to clear tasks/checkboxes while keeping classes/habits
  const getResetData = (data: UserData): UserData => {
    // 1. Reset Weekly Schedule: Clear tasks, preserve classes
    const newSchedule = { ...data.weeklySchedule };
    (Object.keys(newSchedule) as DayOfWeek[]).forEach((day) => {
      newSchedule[day] = {
        ...newSchedule[day],
        tasks: [], // We only clear tasks as requested
      };
    });

    // 2. Reset Habits: Clear daily checkboxes, preserve habit names
    const newHabits = data.habits.map((habit) => ({
      ...habit,
      completed: {
        Sun: false, Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false
      },
    }));

    return {
      ...data,
      weeklySchedule: newSchedule,
      habits: newHabits,
      lastResetDate: startOfToday().toISOString(),
    };
  };

  // Reset Monitor for Grace
  useEffect(() => {
    if (!graceData.lastResetDate) return;

    const checkReset = () => {
      const today = startOfToday();
      const lastReset = parseISO(graceData.lastResetDate);
      const isSaturday = format(today, 'EEE') === 'Sat';
      const alreadyResetToday = isSameDay(today, lastReset);
      const daysSinceLastReset = differenceInDays(today, lastReset);

      if ((isSaturday && !alreadyResetToday) || daysSinceLastReset >= 7) {
        handleUpdateGrace(getResetData(graceData));
      }
    };

    checkReset();
    const interval = setInterval(checkReset, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, [graceData.lastResetDate, graceData.habits, graceData.weeklySchedule]);

  // Reset Monitor for Raili
  useEffect(() => {
    if (!railiData.lastResetDate) return;

    const checkReset = () => {
      const today = startOfToday();
      const lastReset = parseISO(railiData.lastResetDate);
      const isSaturday = format(today, 'EEE') === 'Sat';
      const alreadyResetToday = isSameDay(today, lastReset);
      const daysSinceLastReset = differenceInDays(today, lastReset);

      if ((isSaturday && !alreadyResetToday) || daysSinceLastReset >= 7) {
        handleUpdateRaili(getResetData(railiData));
      }
    };

    checkReset();
    const interval = setInterval(checkReset, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, [railiData.lastResetDate, railiData.habits, railiData.weeklySchedule]);

  const handleUpdateGrace = (newData: UserData) => {
    setGraceData(newData);
    setDoc(doc(db, 'trackers', 'grace'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/grace'));
  };

  const handleUpdateRaili = (newData: UserData) => {
    setRailiData(newData);
    setDoc(doc(db, 'trackers', 'raili'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/raili'));
  };

  const handleUpdatePeriod = (start: string | null, end: string | null) => {
    const newData = { ...periodData, startDate: start, endDate: end };
    setPeriodData(newData);
    setDoc(doc(db, 'trackers', 'period'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/period'));
  };

  const handleUpdateActivities = (newActivities: Activity[]) => {
    setActivities(newActivities);
    setDoc(doc(db, 'trackers', 'activities'), { list: newActivities }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/activities'));
  };

  const handleSendMessage = (text: string, sender: 'grace' | 'raili') => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      sender,
      timestamp: new Date().toISOString(),
    };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setDoc(doc(db, 'trackers', 'messages'), { list: newMessages }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/messages'));

    // Notify the other user
    if (sender === 'grace') {
      const newRailiData = { ...railiData, hasNewMessage: true };
      setRailiData(newRailiData);
      setDoc(doc(db, 'trackers', 'raili'), newRailiData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/raili'));
    } else {
      const newGraceData = { ...graceData, hasNewMessage: true };
      setGraceData(newGraceData);
      setDoc(doc(db, 'trackers', 'grace'), newGraceData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/grace'));
    }
  };

  const handleDeleteMessage = (id: string) => {
    const newMessages = messages.filter(m => m.id !== id);
    setMessages(newMessages);
    setDoc(doc(db, 'trackers', 'messages'), { list: newMessages }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/messages'));
  };

  const handleActivityClick = (date: string) => {
    setHighlightDate(date);
    setActivePage('activities');
  };

  return (
    <div className={`h-[100dvh] w-screen flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navigation Bar - Desktop */}
      <nav className={`hidden md:flex px-6 py-3 items-center justify-between shadow-sm z-50 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
            <Heart className="text-purple-500" size={20} />
          </div>
          <span className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Habit Tracker</span>
        </div>

        <div className={`flex items-center gap-2 p-1 rounded-xl transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <button
            onClick={() => setActivePage('dashboard')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'dashboard' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-purple-400' : 'bg-white shadow-sm text-purple-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            onClick={() => setActivePage('grace')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'grace' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-pink-300' : 'bg-white shadow-sm text-pink-400') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <User size={18} />
            Grace
          </button>
          <button
            onClick={() => setActivePage('raili')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'raili' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-violet-400' : 'bg-white shadow-sm text-violet-500') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Users size={18} />
            Raili
          </button>
          <button
            onClick={() => setActivePage('activities')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'activities' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-purple-400' : 'bg-white shadow-sm text-purple-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Calendar size={18} />
            Activities
          </button>
          <button
            onClick={() => setActivePage('love-drops')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'love-drops' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-pink-400' : 'bg-white shadow-sm text-pink-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <MessageSquare size={18} />
            ChatDesk
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(), 'EEEE')}</p>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 relative overflow-hidden pb-[72px] md:pb-0">
        <AnimatePresence mode="wait">
          {activePage === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0"
            >
              <Dashboard 
                graceData={graceData}
                railiData={railiData}
                activities={activities}
                isDarkMode={isDarkMode}
                onUpdateGrace={handleUpdateGrace}
                onUpdateRaili={handleUpdateRaili}
              />
            </motion.div>
          )}

          {activePage === 'activities' && (
            <motion.div
              key="activities"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0"
            >
              <Activities 
                activities={activities}
                onUpdate={onUpdate => handleUpdateActivities(onUpdate)}
                isDarkMode={isDarkMode}
                highlightDate={highlightDate}
                onClearHighlight={() => setHighlightDate(null)}
              />
            </motion.div>
          )}

          {activePage === 'grace' && (
            <motion.div
              key="grace"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="absolute inset-0"
            >
              <TaskTracker 
                name="Grace"
                colorScheme="pink"
                data={graceData}
                onUpdate={handleUpdateGrace}
                isDarkMode={isDarkMode}
                activities={activities}
                onActivityClick={handleActivityClick}
              />
            </motion.div>
          )}

          {activePage === 'raili' && (
            <motion.div
              key="raili"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="absolute inset-0"
            >
              <TaskTracker 
                name="Raili"
                colorScheme="blue"
                data={railiData}
                onUpdate={handleUpdateRaili}
                isDarkMode={isDarkMode}
                activities={activities}
                onActivityClick={handleActivityClick}
              />
            </motion.div>
          )}
          {activePage === 'love-drops' && (
            <motion.div
              key="love-drops"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0"
            >
              <LoveDrops 
                messages={messages}
                onSendMessage={handleSendMessage}
                onDeleteMessage={handleDeleteMessage}
                isDarkMode={isDarkMode}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-around shadow-[0_-4px_10px_rgba(0,0,0,0.05)] transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}>
        <button
          onClick={() => setActivePage('dashboard')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'dashboard' ? 'text-purple-500' : 'text-gray-400'}`}
        >
          <LayoutDashboard size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </button>
        <button
          onClick={() => setActivePage('grace')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'grace' ? 'text-pink-300' : 'text-gray-400'}`}
        >
          <User size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Grace</span>
        </button>
        <button
          onClick={() => setActivePage('raili')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'raili' ? 'text-violet-400' : 'text-gray-400'}`}
        >
          <Users size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Raili</span>
        </button>
        <button
          onClick={() => setActivePage('activities')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'activities' ? 'text-purple-500' : 'text-gray-400'}`}
        >
          <Calendar size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Events</span>
        </button>
        <button
          onClick={() => setActivePage('love-drops')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'love-drops' ? 'text-pink-400' : 'text-gray-400'}`}
        >
          <MessageSquare size={24} className={activePage === 'love-drops' ? 'fill-pink-400' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">ChatDesk</span>
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`flex flex-col items-center gap-1 transition-all ${isDarkMode ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          <span className="text-[10px] font-bold uppercase tracking-tighter">Theme</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
