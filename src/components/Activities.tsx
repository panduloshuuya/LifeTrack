/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfToday,
  isAfter,
  parseISO,
  isBefore,
  endOfDay
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Clock,
  Calendar as CalendarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity } from '../types';

interface ActivitiesProps {
  activities: Activity[];
  onUpdate: (activities: Activity[]) => void;
  isDarkMode: boolean;
  highlightDate?: string | null;
  onClearHighlight?: () => void;
}

export default function Activities({ 
  activities, 
  onUpdate, 
  isDarkMode,
  highlightDate,
  onClearHighlight
}: ActivitiesProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightDate) {
      const date = parseISO(highlightDate);
      setCurrentMonth(date);
      
      // Wait for month change and render
      setTimeout(() => {
        const activityId = activities.find(a => isSameDay(parseISO(a.date), date))?.id;
        if (activityId && activityRefs.current[activityId]) {
          activityRefs.current[activityId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Clear highlight after some time
          setTimeout(() => {
            onClearHighlight?.();
          }, 3000);
        }
      }, 100);
    }
  }, [highlightDate, activities, onClearHighlight]);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    date: Date | null;
    owner: 'grace' | 'tanga' | null;
    name: string;
    time: string;
  }>({
    isOpen: false,
    date: null,
    owner: null,
    name: '',
    time: '',
  });

  const today = startOfToday();

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Pad start
    const startDay = start.getDay();
    const paddingStart = Array.from({ length: startDay }).map((_, i) => null);
    
    return [...paddingStart, ...days];
  }, [currentMonth]);

  const upcomingActivities = useMemo(() => {
    return activities
      .filter(a => isAfter(parseISO(a.date), startOfToday()) || isSameDay(parseISO(a.date), startOfToday()))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [activities]);

  const handleAddActivity = (date: Date) => {
    setModal({
      isOpen: true,
      date,
      owner: null,
      name: '',
      time: '',
    });
  };

  const saveActivity = () => {
    if (!modal.date || !modal.owner || !modal.name.trim()) return;

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      name: modal.name.trim(),
      time: modal.time || 'All Day',
      date: modal.date.toISOString(),
      owner: modal.owner,
    };

    onUpdate([...activities, newActivity]);
    setModal({ isOpen: false, date: null, owner: null, name: '', time: '' });
  };

  const removeActivity = (id: string) => {
    onUpdate(activities.filter(a => a.id !== id));
  };

  return (
    <div className={`h-full w-full flex flex-col md:flex-row font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`}>
      {/* Sidebar: Upcoming Activities */}
      <div className={`w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col h-auto md:h-full shrink-0 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-gray-200'}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Clock size={20} />
            Upcoming
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {upcomingActivities.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">No upcoming activities.</p>
          ) : (
            upcomingActivities.map(activity => {
              const isHighlighted = highlightDate && isSameDay(parseISO(activity.date), parseISO(highlightDate));
              
              return (
                <motion.div 
                  key={activity.id}
                  ref={el => { activityRefs.current[activity.id] = el; }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    boxShadow: isHighlighted ? (activity.owner === 'grace' ? '0 0 20px rgba(236, 72, 153, 0.4)' : '0 0 20px rgba(59, 130, 246, 0.4)') : 'none',
                    scale: isHighlighted ? 1.05 : 1
                  }}
                  className={`p-3 rounded-2xl border-l-4 shadow-sm transition-all duration-500 ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                  } ${activity.owner === 'grace' ? 'border-l-pink-500' : 'border-l-blue-500'} ${isHighlighted ? 'z-10' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${activity.owner === 'grace' ? 'text-pink-500' : 'text-blue-500'}`}>
                      {activity.owner}
                    </span>
                    <button onClick={() => removeActivity(activity.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm leading-tight">{activity.name}</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-gray-400">
                    <CalendarIcon size={12} />
                    <span>{format(parseISO(activity.date), 'MMM d, yyyy')}</span>
                    <span>•</span>
                    <span>{activity.time}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content: Monthly Calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 md:p-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black uppercase tracking-tighter">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Today
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-2 md:gap-4 h-full">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400 py-2">
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
              
              const dayActivities = activities.filter(a => isSameDay(parseISO(a.date), day));
              const isTodayDay = isSameDay(day, today);

              return (
                <div 
                  key={day.toISOString()}
                  onClick={() => handleAddActivity(day)}
                  className={`
                    aspect-square p-1 md:p-2 border rounded-2xl cursor-pointer transition-all relative group
                    ${isDarkMode ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'}
                    ${isTodayDay ? 'ring-2 ring-black dark:ring-white' : ''}
                  `}
                >
                  <span className={`text-xs font-bold ${isTodayDay ? 'text-black dark:text-white' : 'text-gray-400'}`}>
                    {format(day, 'd')}
                  </span>
                  
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayActivities.slice(0, 3).map(activity => (
                      <div 
                        key={activity.id}
                        className={`text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded truncate text-white ${
                          activity.owner === 'grace' ? 'bg-pink-500' : 'bg-blue-500'
                        }`}
                      >
                        {activity.name}
                      </div>
                    ))}
                    {dayActivities.length > 3 && (
                      <div className="text-[8px] font-bold text-gray-400 text-center">
                        +{dayActivities.length - 3} more
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Plus size={24} className="text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity Modal */}
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
              className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <div className="p-4 text-center border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-black uppercase tracking-widest text-sm">
                  {modal.date ? format(modal.date, 'MMMM d, yyyy') : 'Add Activity'}
                </h3>
              </div>

              <div className="p-6 space-y-6">
                {!modal.owner ? (
                  <div className="space-y-4">
                    <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Who is this for?</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setModal({ ...modal, owner: 'grace' })}
                        className="p-6 rounded-2xl bg-pink-500 text-white font-black uppercase tracking-widest shadow-lg shadow-pink-500/20 hover:scale-105 transition-transform"
                      >
                        Grace
                      </button>
                      <button 
                        onClick={() => setModal({ ...modal, owner: 'tanga' })}
                        className="p-6 rounded-2xl bg-blue-500 text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform"
                      >
                        Tanga
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${modal.owner === 'grace' ? 'text-pink-500' : 'text-blue-500'}`}>
                        Adding for {modal.owner}
                      </span>
                      <button 
                        onClick={() => setModal({ ...modal, owner: null })}
                        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 underline"
                      >
                        Change
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Activity Name</label>
                        <input 
                          autoFocus
                          type="text"
                          value={modal.name}
                          onChange={(e) => setModal({ ...modal, name: e.target.value })}
                          className={`w-full p-3 rounded-xl border-2 outline-none transition-all ${
                            isDarkMode 
                              ? 'bg-gray-900 border-gray-700 text-white focus:border-black' 
                              : 'bg-gray-50 border-gray-100 text-gray-800 focus:border-black'
                          }`}
                          placeholder="e.g. Math Test, Meeting..."
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Time (Optional)</label>
                        <input 
                          type="text"
                          value={modal.time}
                          onChange={(e) => setModal({ ...modal, time: e.target.value })}
                          className={`w-full p-3 rounded-xl border-2 outline-none transition-all ${
                            isDarkMode 
                              ? 'bg-gray-900 border-gray-700 text-white focus:border-black' 
                              : 'bg-gray-50 border-gray-100 text-gray-800 focus:border-black'
                          }`}
                          placeholder="e.g. 10:00 AM"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setModal({ ...modal, isOpen: false })}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                            isDarkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveActivity}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 ${
                            modal.owner === 'grace' ? 'bg-pink-500' : 'bg-blue-500'
                          }`}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
