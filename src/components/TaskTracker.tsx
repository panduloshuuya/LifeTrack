/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  isToday, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameDay,
  startOfToday,
  parseISO
} from 'date-fns';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserData, DayOfWeek, Habit, Task, ClassEvent, Activity } from '../types';

interface TaskTrackerProps {
  name: string;
  colorScheme: 'pink' | 'blue';
  data: UserData;
  onUpdate: (newData: UserData) => void;
  isDarkMode: boolean;
  activities: Activity[];
  onActivityClick: (date: string) => void;
}

const DAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskTracker({ 
  name, 
  colorScheme, 
  data, 
  onUpdate, 
  isDarkMode,
  activities,
  onActivityClick
}: TaskTrackerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(format(startOfToday(), 'EEE') as DayOfWeek);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    value: '',
    onConfirm: () => {},
  });

  const today = startOfToday();

  const colors = {
    primary: colorScheme === 'pink' ? 'bg-pink-500' : 'bg-blue-500',
    secondary: colorScheme === 'pink' 
      ? (isDarkMode ? 'bg-pink-900/30' : 'bg-pink-100') 
      : (isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'),
    text: colorScheme === 'pink' ? 'text-pink-500' : 'text-blue-500',
    border: colorScheme === 'pink' 
      ? (isDarkMode ? 'border-pink-900/50' : 'border-pink-200') 
      : (isDarkMode ? 'border-blue-900/50' : 'border-blue-200'),
    hover: colorScheme === 'pink' 
      ? (isDarkMode ? 'hover:bg-pink-900/50' : 'hover:bg-pink-200') 
      : (isDarkMode ? 'hover:bg-blue-900/50' : 'hover:bg-blue-200'),
    accent: colorScheme === 'pink' ? 'bg-[#D24D74]' : 'bg-[#4D74D2]',
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const calculateWeeklyPercentage = () => {
    if (data.habits.length === 0) return 0;
    let total = data.habits.length * 7;
    let completed = 0;
    data.habits.forEach(habit => {
      DAYS.forEach(day => {
        if (habit.completed[day]) completed++;
      });
    });
    return Math.round((completed / total) * 100);
  };

  const calculateDailyPercentage = (day: DayOfWeek) => {
    const dayData = data.weeklySchedule[day];
    const total = dayData.tasks.length;
    const completed = dayData.tasks.filter(t => t.completed).length;
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  };

  const addHabit = () => {
    setModal({
      isOpen: true,
      title: 'Add New Habit',
      value: '',
      onConfirm: (val) => {
        if (!val.trim()) return;
        const newHabit: Habit = {
          id: crypto.randomUUID(),
          name: val.trim(),
          completed: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false }
        };
        onUpdate({ ...data, habits: [...data.habits, newHabit] });
      }
    });
  };

  const editHabit = (habitId: string, currentName: string) => {
    setModal({
      isOpen: true,
      title: 'Edit Habit',
      value: currentName,
      onConfirm: (val) => {
        if (!val.trim() || val.trim() === currentName) return;
        const newHabits = data.habits.map(h => 
          h.id === habitId ? { ...h, name: val.trim() } : h
        );
        onUpdate({ ...data, habits: newHabits });
      }
    });
  };

  const editClass = (day: DayOfWeek, classId: string, currentName: string) => {
    setModal({
      isOpen: true,
      title: 'Edit Class/Event',
      value: currentName,
      onConfirm: (val) => {
        if (!val.trim() || val.trim() === currentName) return;
        const newSchedule = { ...data.weeklySchedule };
        newSchedule[day].classes = newSchedule[day].classes.map(c => 
          c.id === classId ? { ...c, name: val.trim() } : c
        );
        onUpdate({ ...data, weeklySchedule: newSchedule });
      }
    });
  };

  const editTask = (day: DayOfWeek, taskId: string, currentName: string) => {
    setModal({
      isOpen: true,
      title: 'Edit Task',
      value: currentName,
      onConfirm: (val) => {
        if (!val.trim() || val.trim() === currentName) return;
        const newSchedule = { ...data.weeklySchedule };
        newSchedule[day].tasks = newSchedule[day].tasks.map(t => 
          t.id === taskId ? { ...t, name: val.trim() } : t
        );
        onUpdate({ ...data, weeklySchedule: newSchedule });
      }
    });
  };

  const toggleHabit = (habitId: string, day: DayOfWeek) => {
    const newHabits = data.habits.map(h => {
      if (h.id === habitId) {
        return { ...h, completed: { ...h.completed, [day]: !h.completed[day] } };
      }
      return h;
    });
    onUpdate({ ...data, habits: newHabits });
  };

  const addClass = (day: DayOfWeek) => {
    setModal({
      isOpen: true,
      title: `Add to ${day}`,
      value: '',
      onConfirm: (val) => {
        if (!val.trim()) return;
        const newClass: ClassEvent = { id: crypto.randomUUID(), name: val.trim() };
        const newSchedule = { ...data.weeklySchedule };
        newSchedule[day].classes.push(newClass);
        onUpdate({ ...data, weeklySchedule: newSchedule });
      }
    });
  };

  const addTask = (day: DayOfWeek) => {
    setModal({
      isOpen: true,
      title: `New Task for ${day}`,
      value: '',
      onConfirm: (val) => {
        if (!val.trim()) return;
        const newTask: Task = { id: crypto.randomUUID(), name: val.trim(), completed: false };
        const newSchedule = { ...data.weeklySchedule };
        newSchedule[day].tasks.push(newTask);
        onUpdate({ ...data, weeklySchedule: newSchedule });
      }
    });
  };

  const toggleTask = (day: DayOfWeek, taskId: string) => {
    const newSchedule = { ...data.weeklySchedule };
    newSchedule[day].tasks = newSchedule[day].tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    onUpdate({ ...data, weeklySchedule: newSchedule });
  };

  const removeHabit = (id: string) => {
    onUpdate({ ...data, habits: data.habits.filter(h => h.id !== id) });
  };

  const removeClass = (day: DayOfWeek, id: string) => {
    const newSchedule = { ...data.weeklySchedule };
    newSchedule[day].classes = newSchedule[day].classes.filter(c => c.id !== id);
    onUpdate({ ...data, weeklySchedule: newSchedule });
  };

  const removeTask = (day: DayOfWeek, id: string) => {
    const newSchedule = { ...data.weeklySchedule };
    newSchedule[day].tasks = newSchedule[day].tasks.filter(t => t.id !== id);
    onUpdate({ ...data, weeklySchedule: newSchedule });
  };

  return (
    <div className={`h-full w-full flex flex-col md:flex-row md:overflow-hidden overflow-y-auto font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`}>
      {/* Sidebar - Desktop: Left, Mobile: Top/Collapsible (simplified for mobile) */}
      <div className={`w-full md:w-80 border-b-2 md:border-b-0 md:border-r-2 flex flex-col h-auto md:h-full shrink-0 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-pink-200'}`}>
        {/* Weekly Planner Header */}
        <div className={`${colors.accent} text-white p-4 text-center font-bold text-lg md:text-xl uppercase tracking-widest`}>
          {name}'s Planner
        </div>

        {/* Mobile Day Selector */}
        <div className="md:hidden flex overflow-x-auto p-2 gap-2 bg-black/5 no-scrollbar">
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`
                flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all
                ${selectedDay === d ? colors.primary + ' text-white shadow-lg' : (isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600')}
              `}
            >
              <span className="text-[10px] font-black uppercase leading-none mb-1">{d}</span>
              <span className="text-xs font-bold leading-none">{calculateDailyPercentage(d)}%</span>
            </button>
          ))}
        </div>

        {/* Calendar Section - Hidden on mobile to save space, or can be made collapsible */}
        <div className={`hidden md:block p-4 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold text-sm uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{format(currentMonth, 'MMMM yyyy')}</span>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(addDays(startOfMonth(currentMonth), -1))} className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentMonth(addDays(endOfMonth(currentMonth), 1))} className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}><ChevronRight size={16}/></button>
            </div>
          </div>
          <div className={`grid grid-cols-7 gap-1 text-[10px] text-center font-bold mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={i} />)}
            {calendarDays.map(day => {
              if (!day) return <div key={Math.random()} />;
              const hasActivity = activities.some(a => 
                a.owner.toLowerCase() === name.toLowerCase() && 
                isSameDay(parseISO(a.date), day)
              );
              
              return (
                <div 
                  key={day.toISOString()} 
                  onClick={() => hasActivity && onActivityClick(day.toISOString())}
                  className={`
                    aspect-square flex flex-col items-center justify-center text-[10px] rounded-full transition-colors relative
                    ${isToday(day) ? colors.primary + ' text-white font-bold' : (isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600')}
                    ${hasActivity ? 'cursor-pointer' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {hasActivity && (
                    <div className={`w-1 h-1 rounded-full absolute bottom-1 ${colorScheme === 'pink' ? 'bg-pink-500' : 'bg-blue-500'} ${isToday(day) ? 'bg-white' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Habits Section */}
        <div className="flex-none md:flex-1 flex flex-col">
          <div className={`p-2 border-b flex justify-between items-center transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
            <span className={`font-bold text-xs uppercase tracking-tighter ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Weekly Habits</span>
            <button onClick={addHabit} className={`p-1 rounded transition-colors ${isDarkMode ? 'text-pink-400 hover:bg-gray-700' : 'text-pink-600 hover:bg-white'}`}>
              <Plus size={14} />
            </button>
          </div>
          <div className="md:flex-1 md:overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className={`sticky top-0 shadow-sm z-10 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`p-1 text-left ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Habit</th>
                  {['M','T','W','T','F','S','S'].map((d, i) => (
                    <th key={i} className={`p-1 text-center w-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.habits.map(habit => (
                  <tr key={habit.id} className={`border-b group transition-colors duration-300 ${isDarkMode ? 'border-gray-800 hover:bg-gray-800/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <td className="p-1 flex items-start gap-1">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                        <button onClick={() => editHabit(habit.id, habit.name)} className="text-blue-400 hover:text-blue-500"><Pencil size={10}/></button>
                        <button onClick={() => removeHabit(habit.id)} className="text-red-400 hover:text-red-500"><Trash2 size={10}/></button>
                      </div>
                      <span className={`break-words whitespace-normal leading-tight ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{habit.name}</span>
                    </td>
                    {DAYS.map(day => (
                      <td key={day} className="p-1 text-center">
                        <button 
                          onClick={() => toggleHabit(habit.id, day)}
                          className={`w-4 h-4 rounded border transition-colors ${habit.completed[day] ? colors.primary : (isDarkMode ? 'border-gray-600' : 'border-gray-300')} flex items-center justify-center`}
                        >
                          {habit.completed[day] && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly Progress Section - Desktop only in sidebar */}
        <div className={`hidden md:block p-4 border-t-2 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-xs font-bold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Weekly Progress</span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{calculateWeeklyPercentage()}%</span>
          </div>
          <div className={`w-full h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${calculateWeeklyPercentage()}%` }}
              className={`h-full ${colors.primary}`}
            />
          </div>
        </div>
      </div>

      {/* Right Content Area - Desktop: Days Grid, Mobile: Selected Day View */}
      <div className="flex-none md:flex-1 md:overflow-y-auto pb-24 md:pb-0">
        {/* Desktop View: 7-column grid */}
        <div className={`hidden md:grid grid-cols-7 h-full transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {DAYS.map((day, index) => (
            <DayColumn 
              key={day} 
              day={day} 
              index={index} 
              colors={colors} 
              isDarkMode={isDarkMode} 
              data={data}
              addClass={addClass}
              editClass={editClass}
              addTask={addTask}
              editTask={editTask}
              toggleTask={toggleTask}
              removeClass={removeClass}
              removeTask={removeTask}
              calculateDailyPercentage={calculateDailyPercentage}
            />
          ))}
        </div>

        {/* Mobile View: Single Day View */}
        <div className="md:hidden h-full">
          <DayColumn 
            day={selectedDay} 
            index={0} 
            colors={colors} 
            isDarkMode={isDarkMode} 
            data={data}
            addClass={addClass}
            editClass={editClass}
            addTask={addTask}
            editTask={editTask}
            toggleTask={toggleTask}
            removeClass={removeClass}
            removeTask={removeTask}
            calculateDailyPercentage={calculateDailyPercentage}
            isMobile
          />
        </div>
      </div>

      {/* Input Modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal({ ...modal, isOpen: false })}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <div className={`${colors.accent} p-4 text-white text-center font-bold uppercase tracking-widest`}>
                {modal.title}
              </div>
              <div className="p-6">
                <input 
                  autoFocus
                  type="text"
                  value={modal.value}
                  onChange={(e) => setModal({ ...modal, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      modal.onConfirm(modal.value);
                      setModal({ ...modal, isOpen: false });
                    } else if (e.key === 'Escape') {
                      setModal({ ...modal, isOpen: false });
                    }
                  }}
                  className={`w-full p-3 rounded-xl border-2 outline-none transition-all mb-6 ${
                    isDarkMode 
                      ? `bg-gray-900 border-gray-700 text-white focus:border-${colorScheme === 'pink' ? 'pink' : 'blue'}-500` 
                      : `bg-gray-50 border-gray-100 text-gray-800 focus:border-${colorScheme === 'pink' ? 'pink' : 'blue'}-500`
                  }`}
                  placeholder="Type something..."
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setModal({ ...modal, isOpen: false })}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors ${
                      isDarkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      modal.onConfirm(modal.value);
                      setModal({ ...modal, isOpen: false });
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-lg transition-transform active:scale-95 ${colors.primary}`}
                  >
                    Enter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DayColumn({ 
  day, 
  index, 
  colors, 
  isDarkMode, 
  data, 
  addClass, 
  editClass,
  addTask, 
  editTask,
  toggleTask, 
  removeClass, 
  removeTask, 
  calculateDailyPercentage,
  isMobile = false
}: {
  day: DayOfWeek;
  index: number;
  colors: any;
  isDarkMode: boolean;
  data: UserData;
  addClass: (day: DayOfWeek) => void;
  editClass: (day: DayOfWeek, id: string, name: string) => void;
  addTask: (day: DayOfWeek) => void;
  editTask: (day: DayOfWeek, id: string, name: string) => void;
  toggleTask: (day: DayOfWeek, id: string) => void;
  removeClass: (day: DayOfWeek, id: string) => void;
  removeTask: (day: DayOfWeek, id: string) => void;
  calculateDailyPercentage: (day: DayOfWeek) => number;
  isMobile?: boolean;
}) {
  return (
    <div className={`flex flex-col border-r transition-colors duration-300 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} ${index === 6 ? 'border-r-0' : ''} ${isMobile ? 'border-r-0 h-full' : ''}`}>
      {/* Day Header */}
      <div className={`${colors.accent} text-white p-2 text-center font-bold text-xs uppercase border-b border-white/20`}>
        {day === 'Mon' ? 'Monday' : day === 'Tue' ? 'Tuesday' : day === 'Wed' ? 'Wednesday' : day === 'Thu' ? 'Thursday' : day === 'Fri' ? 'Friday' : day === 'Sat' ? 'Saturday' : 'Sunday'}
      </div>

      {/* Classes Section */}
      <div className={`${colors.secondary} p-1 text-[10px] md:text-[10px] font-bold text-center border-b flex justify-between items-center px-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'}`}>
        <span className="uppercase tracking-widest">{(day === 'Sat' || day === 'Sun') ? 'Events' : 'Classes'}</span>
        <button onClick={() => addClass(day)} className={`rounded p-1 transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'}`}><Plus size={14}/></button>
      </div>
      <div className={`${isMobile ? 'min-h-[100px]' : 'h-40 overflow-y-auto'} p-2 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
        <AnimatePresence>
          {data.weeklySchedule[day].classes.map(c => (
            <motion.div 
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`text-[12px] md:text-[11px] mb-1 p-2 md:p-1 rounded border flex justify-between items-start gap-2 group transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-100 text-gray-700'}`}
            >
              <span className="break-words whitespace-normal flex-1 leading-tight">{c.name}</span>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                <button onClick={() => editClass(day, c.id, c.name)} className="text-blue-400 hover:text-blue-500 p-1"><Pencil size={12}/></button>
                <button onClick={() => removeClass(day, c.id)} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={12}/></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Tasks Section */}
      <div className={`${colors.secondary} p-1 text-[10px] md:text-[10px] font-bold text-center border-b flex justify-between items-center px-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'}`}>
        <span className="uppercase tracking-widest">Tasks</span>
        <button onClick={() => addTask(day)} className={`rounded p-1 transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'}`}><Plus size={14}/></button>
      </div>
      <div className={`flex-none md:flex-1 md:overflow-y-auto p-2 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <AnimatePresence>
          {data.weeklySchedule[day].tasks.map(t => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-start gap-2 mb-3 md:mb-2 group"
            >
              <button 
                onClick={() => toggleTask(day, t.id)}
                className={`mt-0.5 flex-shrink-0 transition-colors ${t.completed ? colors.text : (isDarkMode ? 'text-gray-600' : 'text-gray-300')}`}
              >
                {t.completed ? <CheckSquare size={18} className="md:w-3.5 md:h-3.5" /> : <Square size={18} className="md:w-3.5 md:h-3.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm md:text-[11px] leading-tight break-words whitespace-normal transition-colors ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                  {t.name}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-0.5">
                <button onClick={() => editTask(day, t.id, t.name)} className="text-blue-400 hover:text-blue-500 p-1"><Pencil size={12}/></button>
                <button onClick={() => removeTask(day, t.id)} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={12}/></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Daily Progress Bar */}
      <div className={`p-2 border-t transition-colors duration-300 ${isDarkMode ? 'border-gray-800 bg-gray-800/30' : 'border-gray-100 bg-gray-50'}`}>
        <div className={`flex justify-between text-[9px] font-bold mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <span>DONE</span>
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{calculateDailyPercentage(day)}%</span>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${calculateDailyPercentage(day)}%` }}
            className={`h-full ${colors.primary}`}
          />
        </div>
      </div>
    </div>
  );
}
