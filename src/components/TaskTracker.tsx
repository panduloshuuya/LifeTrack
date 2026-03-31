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
  startOfToday
} from 'date-fns';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  LayoutGrid,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserData, DayOfWeek, Habit, Task, ClassEvent } from '../types';

interface TaskTrackerProps {
  name: string;
  colorScheme: 'pink' | 'blue';
  data: UserData;
  onUpdate: (newData: UserData) => void;
  isDarkMode: boolean;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TaskTracker({ name, colorScheme, data, onUpdate, isDarkMode }: TaskTrackerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
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
    const name = prompt('Enter habit name:');
    if (!name) return;
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      name,
      completed: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false }
    };
    onUpdate({ ...data, habits: [...data.habits, newHabit] });
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
    const name = prompt('Enter class/event name:');
    if (!name) return;
    const newClass: ClassEvent = { id: crypto.randomUUID(), name };
    const newSchedule = { ...data.weeklySchedule };
    newSchedule[day].classes.push(newClass);
    onUpdate({ ...data, weeklySchedule: newSchedule });
  };

  const addTask = (day: DayOfWeek) => {
    const name = prompt('Enter task name:');
    if (!name) return;
    const newTask: Task = { id: crypto.randomUUID(), name, completed: false };
    const newSchedule = { ...data.weeklySchedule };
    newSchedule[day].tasks.push(newTask);
    onUpdate({ ...data, weeklySchedule: newSchedule });
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
    <div className={`h-full w-full flex flex-col overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`}>
      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-[300px_1fr] h-full">
        
        {/* Left Sidebar */}
        <div className={`border-r-2 flex flex-col h-full transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-pink-200'}`}>
          {/* Weekly Planner Header */}
          <div className={`${colors.accent} text-white p-4 text-center font-bold text-xl uppercase tracking-widest`}>
            Weekly Planner
          </div>

          {/* Calendar Section */}
          <div className={`p-4 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'}`}>
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
              {calendarDays.map(day => (
                <div 
                  key={day.toISOString()} 
                  className={`
                    aspect-square flex items-center justify-center text-[10px] rounded-full transition-colors
                    ${isToday(day) ? colors.primary + ' text-white font-bold' : (isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600')}
                  `}
                >
                  {format(day, 'd')}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Habits Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className={`p-2 border-b flex justify-between items-center transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
              <span className={`font-bold text-xs uppercase tracking-tighter ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Weekly Habits</span>
              <button onClick={addHabit} className={`p-1 rounded transition-colors ${isDarkMode ? 'text-pink-400 hover:bg-gray-700' : 'text-pink-600 hover:bg-white'}`}>
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
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
                      <td className="p-1 truncate max-w-[100px] flex items-center gap-1">
                        <button onClick={() => removeHabit(habit.id)} className="opacity-0 group-hover:opacity-100 text-red-400"><Trash2 size={10}/></button>
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{habit.name}</span>
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

          {/* Weekly Progress Section */}
          <div className={`p-4 border-t-2 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
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

        {/* Right Content Area (Days Grid) */}
        <div className={`grid grid-cols-7 h-full transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {DAYS.map((day, index) => (
            <div key={day} className={`flex flex-col border-r transition-colors duration-300 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} ${index === 6 ? 'border-r-0' : ''}`}>
              {/* Day Header */}
              <div className={`${colors.accent} text-white p-2 text-center font-bold text-xs uppercase border-b border-white/20`}>
                {day === 'Mon' ? 'Monday' : day === 'Tue' ? 'Tuesday' : day === 'Wed' ? 'Wednesday' : day === 'Thu' ? 'Thursday' : day === 'Fri' ? 'Friday' : day === 'Sat' ? 'Saturday' : 'Sunday'}
              </div>

              {/* Classes Section */}
              <div className={`${colors.secondary} p-1 text-[10px] font-bold text-center border-b flex justify-between items-center px-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'}`}>
                <span className="uppercase tracking-widest">{(day === 'Sat' || day === 'Sun') ? 'Events' : 'Classes'}</span>
                <button onClick={() => addClass(day)} className={`rounded p-0.5 transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'}`}><Plus size={10}/></button>
              </div>
              <div className={`h-40 overflow-y-auto p-2 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
                <AnimatePresence>
                  {data.weeklySchedule[day].classes.map(c => (
                    <motion.div 
                      key={c.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`text-[11px] mb-1 p-1 rounded border flex justify-between items-center group transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'}`}
                    >
                      <span className="truncate">{c.name}</span>
                      <button onClick={() => removeClass(day, c.id)} className="opacity-0 group-hover:opacity-100 text-red-400"><Trash2 size={10}/></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Tasks Section */}
              <div className={`${colors.secondary} p-1 text-[10px] font-bold text-center border-b flex justify-between items-center px-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'}`}>
                <span className="uppercase tracking-widest">Tasks</span>
                <button onClick={() => addTask(day)} className={`rounded p-0.5 transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'}`}><Plus size={10}/></button>
              </div>
              <div className={`flex-1 overflow-y-auto p-2 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                <AnimatePresence>
                  {data.weeklySchedule[day].tasks.map(t => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-start gap-2 mb-2 group"
                    >
                      <button 
                        onClick={() => toggleTask(day, t.id)}
                        className={`mt-0.5 flex-shrink-0 transition-colors ${t.completed ? colors.text : (isDarkMode ? 'text-gray-600' : 'text-gray-300')}`}
                      >
                        {t.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] leading-tight break-words transition-colors ${t.completed ? 'line-through text-gray-500' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {t.name}
                        </p>
                      </div>
                      <button onClick={() => removeTask(day, t.id)} className="opacity-0 group-hover:opacity-100 text-red-400 mt-0.5"><Trash2 size={10}/></button>
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
          ))}
        </div>
      </div>
    </div>
  );
}
