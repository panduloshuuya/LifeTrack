/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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
  Droplets, 
  User, 
  Users, 
  Calendar, 
  Heart, 
  LayoutDashboard,
  Settings,
  LogIn,
  LogOut,
  Loader2,
  Bell,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import PeriodTracker from './components/PeriodTracker';
import TaskTracker from './components/TaskTracker';
import { UserData, PeriodData, DayOfWeek } from './types';

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
    Mon: { classes: [], tasks: [] },
    Tue: { classes: [], tasks: [] },
    Wed: { classes: [], tasks: [] },
    Thu: { classes: [], tasks: [] },
    Fri: { classes: [], tasks: [] },
    Sat: { classes: [], tasks: [] },
    Sun: { classes: [], tasks: [] },
  },
  lastResetDate: startOfWeek(new Date(), { weekStartsOn: 6 }).toISOString(), // Reset on Saturdays
};

const INITIAL_PERIOD_DATA: PeriodData = {
  startDate: null,
  endDate: null,
  cycleLength: 28,
};

type Page = 'dashboard' | 'period' | 'grace' | 'tanga';

function Dashboard({ 
  graceData, 
  tangaData, 
  periodData,
  isDarkMode
}: { 
  graceData: UserData, 
  tangaData: UserData, 
  periodData: PeriodData,
  isDarkMode: boolean
}) {
  const today = startOfToday();
  const dayName = format(today, 'EEE') as DayOfWeek;
  
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
  const tangaProgress = calculatePercentage(tangaData);

  const getPhaseInfo = () => {
    if (!periodData.startDate) return { name: 'Unknown', advice: 'Mark your period start to see cycle insights.' };
    
    const start = parseISO(periodData.startDate);
    const end = periodData.endDate ? parseISO(periodData.endDate) : null;
    const periodDuration = end ? differenceInDays(end, start) + 1 : 5;
    const diff = differenceInDays(today, start);
    const cycleDay = ((diff % 28) + 28) % 28;

    if (cycleDay < periodDuration) return { 
      name: 'Menstrual', 
      advice: 'Grace is on her period. Extra snacks and comfort needed!' 
    };
    if (cycleDay < 12) return { 
      name: 'Follicular', 
      advice: 'Grace is feeling more energetic. Plan a fun activity!' 
    };
    if (cycleDay < 16) return { 
      name: 'Ovulation', 
      advice: 'Grace is at her most social and vibrant phase!' 
    };
    return { 
      name: 'Luteal', 
      advice: 'Grace might be feeling sensitive. Patience and kindness go a long way.' 
    };
  };

  const phaseInfo = getPhaseInfo();

  return (
    <div className={`h-full w-full p-4 md:p-6 overflow-y-auto transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-0">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h2 className={`text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>LifeTrack Hub</h2>
            <p className={`text-[10px] md:text-base font-medium italic mt-0.5 md:mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>"Doing all we can in love and support of one another."</p>
          </div>
          <div className="flex md:block items-center justify-between bg-purple-500/10 md:bg-transparent p-2 md:p-0 rounded-xl">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">{format(today, 'EEEE')}</p>
            <p className={`text-sm md:text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{format(today, 'MMMM d')}</p>
          </div>
        </header>

        {/* Top Row: Cycle Awareness */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-6 rounded-3xl md:rounded-[2.5rem] text-white shadow-xl shadow-purple-200/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block">
            <Droplets size={120} />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-4 bg-white/20 rounded-xl md:rounded-2xl backdrop-blur-md">
                <Droplets size={20} className="md:w-8 md:h-8" />
              </div>
              <div>
                <p className="text-purple-200 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">Current Phase</p>
                <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight">{phaseInfo.name}</h3>
              </div>
            </div>
            
            <div className="flex-1 max-w-md bg-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[8px] md:text-[10px] font-bold text-purple-200 uppercase tracking-widest mb-0.5 md:mb-1">Daily Insight</p>
              <p className="text-[11px] md:text-sm font-medium leading-tight md:leading-relaxed">"{phaseInfo.advice}"</p>
            </div>

            <div className="flex gap-4 self-end md:self-auto">
              <div className="text-center">
                <p className="text-[8px] md:text-[10px] font-bold text-purple-200 uppercase">Cycle Day</p>
                <p className="text-lg md:text-2xl font-black">
                  {periodData.startDate ? (((differenceInDays(today, parseISO(periodData.startDate)) % 28) + 28) % 28) + 1 : '--'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Accountability Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Grace's Column */}
          <div className="space-y-4 md:space-y-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-none' : 'bg-white border-pink-50 shadow-pink-100/50'}`}
            >
              <div className="flex items-center justify-between mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-pink-900/30' : 'bg-pink-100'}`}>
                    <User className="text-pink-500 md:w-6 md:h-6" size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Grace</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg md:text-2xl font-black text-pink-500 leading-none">{graceProgress}%</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Weekly</p>
                </div>
              </div>

              <div className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden mb-4 md:mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${graceProgress}%` }}
                  className="h-full bg-pink-500"
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
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${t.completed ? 'bg-pink-500' : 'bg-gray-300'}`} />
                        <span className={`text-[10px] md:text-xs font-medium truncate ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {t.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tanga's Column */}
          <div className="space-y-4 md:space-y-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-none' : 'bg-white border-blue-50 shadow-blue-100/50'}`}
            >
              <div className="flex items-center justify-between mb-3 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                    <Users className="text-blue-500 md:w-6 md:h-6" size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Tanga</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg md:text-2xl font-black text-blue-500 leading-none">{tangaProgress}%</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Weekly</p>
                </div>
              </div>

              <div className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden mb-4 md:mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${tangaProgress}%` }}
                  className="h-full bg-blue-500"
                />
              </div>

              <div className="space-y-3 md:space-y-4">
                <h4 className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-1 md:pb-2 ${isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'}`}>Today's Focus</h4>
                <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2">
                  {tangaData.weeklySchedule[dayName].tasks.length === 0 ? (
                    <p className="text-[10px] md:text-xs text-gray-400 italic">No tasks set for today.</p>
                  ) : (
                    tangaData.weeklySchedule[dayName].tasks.map(t => (
                      <div key={t.id} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors duration-300 ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${t.completed ? 'bg-blue-500' : 'bg-gray-300'}`} />
                        <span className={`text-[10px] md:text-xs font-medium truncate ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {t.name}
                        </span>
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
  const [tangaData, setTangaData] = useState<UserData>(INITIAL_USER_DATA);
  const [periodData, setPeriodData] = useState<PeriodData>(INITIAL_PERIOD_DATA);

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

    const unsubTanga = onSnapshot(doc(db, 'trackers', 'tanga'), (snapshot) => {
      if (snapshot.exists()) {
        setTangaData(snapshot.data() as UserData);
      } else {
        setDoc(doc(db, 'trackers', 'tanga'), INITIAL_USER_DATA).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/tanga'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/tanga'));

    const unsubPeriod = onSnapshot(doc(db, 'trackers', 'period'), (snapshot) => {
      if (snapshot.exists()) {
        setPeriodData(snapshot.data() as PeriodData);
      } else {
        setDoc(doc(db, 'trackers', 'period'), INITIAL_PERIOD_DATA).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/period'));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, 'trackers/period'));

    return () => {
      unsubGrace();
      unsubTanga();
      unsubPeriod();
    };
  }, []);

  // Saturday Reset Logic
  useEffect(() => {
    const checkReset = () => {
      const today = startOfToday();
      const lastReset = parseISO(graceData.lastResetDate);
      
      // Reset if it's Saturday and we haven't reset today yet,
      // or if more than 7 days have passed for some reason.
      const isSaturday = format(today, 'EEE') === 'Sat';
      const alreadyResetToday = isSameDay(today, lastReset);
      const daysSinceLastReset = differenceInDays(today, lastReset);

      if ((isSaturday && !alreadyResetToday) || daysSinceLastReset >= 7) {
        const resetSchedule = (data: UserData): UserData => {
          const newSchedule = { ...data.weeklySchedule };
          (Object.keys(newSchedule) as DayOfWeek[]).forEach(day => {
            newSchedule[day].tasks = []; // Clear daily tasks
          });

          // Reset habit checkboxes but keep the habits themselves
          const newHabits = data.habits.map(habit => ({
            ...habit,
            completed: {
              Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false
            }
          }));

          return {
            ...data,
            weeklySchedule: newSchedule,
            habits: newHabits,
            lastResetDate: today.toISOString(),
          };
        };

        const newGrace = resetSchedule(graceData);
        const newTanga = resetSchedule(tangaData);

        setDoc(doc(db, 'trackers', 'grace'), newGrace).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/grace'));
        setDoc(doc(db, 'trackers', 'tanga'), newTanga).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/tanga'));
      }
    };

    checkReset();
    const interval = setInterval(checkReset, 1000 * 60 * 60); // Check every hour
    return () => clearInterval(interval);
  }, [graceData.lastResetDate]);

  const handleUpdateGrace = (newData: UserData) => {
    setGraceData(newData);
    setDoc(doc(db, 'trackers', 'grace'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/grace'));
  };

  const handleUpdateTanga = (newData: UserData) => {
    setTangaData(newData);
    setDoc(doc(db, 'trackers', 'tanga'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/tanga'));
  };

  const handleUpdatePeriod = (start: string | null, end: string | null) => {
    const newData = { ...periodData, startDate: start, endDate: end };
    setPeriodData(newData);
    setDoc(doc(db, 'trackers', 'period'), newData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'trackers/period'));
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Navigation Bar - Desktop */}
      <nav className={`hidden md:flex px-6 py-3 items-center justify-between shadow-sm z-50 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
            <Heart className="text-purple-500" size={20} />
          </div>
          <span className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>LifeTrack</span>
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
            onClick={() => setActivePage('period')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'period' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-purple-400' : 'bg-white shadow-sm text-purple-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Droplets size={18} />
            Period
          </button>
          <button
            onClick={() => setActivePage('grace')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'grace' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-pink-400' : 'bg-white shadow-sm text-pink-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <User size={18} />
            Grace
          </button>
          <button
            onClick={() => setActivePage('tanga')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold
              ${activePage === 'tanga' ? (isDarkMode ? 'bg-gray-800 shadow-sm text-blue-400' : 'bg-white shadow-sm text-blue-600') : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Users size={18} />
            Tanga
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
          onClick={() => setActivePage('period')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'period' ? 'text-purple-500' : 'text-gray-400'}`}
        >
          <Droplets size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Period</span>
        </button>
        <button
          onClick={() => setActivePage('grace')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'grace' ? 'text-pink-500' : 'text-gray-400'}`}
        >
          <User size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Grace</span>
        </button>
        <button
          onClick={() => setActivePage('tanga')}
          className={`flex flex-col items-center gap-1 transition-all ${activePage === 'tanga' ? 'text-blue-500' : 'text-gray-400'}`}
        >
          <Users size={24} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Tanga</span>
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`flex flex-col items-center gap-1 transition-all ${isDarkMode ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          <span className="text-[10px] font-bold uppercase tracking-tighter">Theme</span>
        </button>
      </nav>

      {/* Page Content */}
      <main className="flex-1 relative overflow-hidden">
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
                tangaData={tangaData}
                periodData={periodData}
                isDarkMode={isDarkMode}
              />
            </motion.div>
          )}

          {activePage === 'period' && (
            <motion.div
              key="period"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0"
            >
              <PeriodTracker 
                startDate={periodData.startDate}
                endDate={periodData.endDate}
                onUpdate={handleUpdatePeriod}
                isDarkMode={isDarkMode}
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
              />
            </motion.div>
          )}

          {activePage === 'tanga' && (
            <motion.div
              key="tanga"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="absolute inset-0"
            >
              <TaskTracker 
                name="Tanga"
                colorScheme="blue"
                data={tangaData}
                onUpdate={handleUpdateTanga}
                isDarkMode={isDarkMode}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
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
