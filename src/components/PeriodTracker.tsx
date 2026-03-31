/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  format, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  startOfToday,
  differenceInDays,
  parseISO,
  isWithinInterval
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Droplets } from 'lucide-react';
import { motion } from 'motion/react';

interface PeriodTrackerProps {
  startDate: string | null;
  endDate: string | null;
  onUpdate: (start: string | null, end: string | null) => void;
  isDarkMode: boolean;
}

export default function PeriodTracker({ startDate, endDate, onUpdate, isDarkMode }: PeriodTrackerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfToday();

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getDayPhase = (date: Date) => {
    if (!startDate) return 'normal';
    
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : null;
    
    const periodDuration = end ? differenceInDays(end, start) + 1 : 5;
    const diff = differenceInDays(date, start);
    const cycleDay = ((diff % 28) + 28) % 28;

    if (end && isWithinInterval(date, { start, end })) {
      return 'period';
    }
    
    if (!end && isSameDay(date, start)) {
      return 'period';
    }

    if (cycleDay < periodDuration) return 'period';
    if (cycleDay < 12) return 'follicular';
    if (cycleDay < 16) return 'ovulation';
    if (cycleDay < 28) return 'luteal';
    return 'normal';
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'period': return isDarkMode ? 'bg-pink-900/40 text-pink-300 border-pink-800' : 'bg-pink-200 text-pink-700 border-pink-300';
      case 'follicular': return isDarkMode ? 'bg-green-900/40 text-green-300 border-green-800' : 'bg-green-100 text-green-700 border-green-200';
      case 'ovulation': return isDarkMode ? 'bg-blue-900/40 text-blue-300 border-blue-800' : 'bg-blue-100 text-blue-700 border-blue-200';
      case 'luteal': return isDarkMode ? 'bg-purple-900/40 text-purple-300 border-purple-800' : 'bg-purple-100 text-purple-700 border-purple-200';
      default: return isDarkMode ? 'bg-gray-900 text-gray-600 border-gray-800' : 'bg-white text-gray-400 border-gray-100';
    }
  };

  const handleDateClick = (date: Date) => {
    const iso = date.toISOString();
    if (!startDate || (startDate && endDate)) {
      onUpdate(iso, null);
    } else {
      if (date < parseISO(startDate)) {
        onUpdate(iso, null);
      } else {
        onUpdate(startDate, iso);
      }
    }
  };

  return (
    <div className={`h-full w-full flex flex-col md:flex-row overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`}>
      {/* Sidebar - Desktop: Left, Mobile: Top */}
      <div className={`w-full md:w-[300px] border-b-2 md:border-b-0 md:border-r-2 flex flex-col h-auto md:h-full transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50 border-purple-900/50' : 'bg-gray-50/50 border-purple-200'}`}>
        {/* Header */}
        <div className="bg-purple-500 text-white p-4 text-center font-bold text-lg md:text-xl uppercase tracking-widest">
          Period Tracker
        </div>

        {/* Month Navigation */}
        <div className={`p-4 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-bold text-sm uppercase tracking-tight ${isDarkMode ? 'text-purple-400' : 'text-purple-900'}`}>
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentMonth(addDays(startOfMonth(currentMonth), -1))}
                className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-purple-900/50 text-purple-400' : 'hover:bg-purple-100 text-purple-700'}`}
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setCurrentMonth(addDays(endOfMonth(currentMonth), 1))}
                className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-purple-900/50 text-purple-400' : 'hover:bg-purple-100 text-purple-700'}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Cycle Overview</div>
        </div>

        {/* Current Status & Legend - Grid on mobile, Stack on desktop */}
        <div className="flex flex-col md:flex-1 overflow-y-auto">
          <div className={`p-4 border-b-2 transition-colors duration-300 ${isDarkMode ? 'border-purple-900/30 bg-purple-900/10' : 'border-purple-100 bg-purple-50/30'}`}>
            <h2 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-purple-500' : 'text-purple-400'}`}>Current Status</h2>
            <div className={`p-3 rounded-xl border shadow-sm flex items-center gap-3 transition-colors duration-300 ${getPhaseColor(getDayPhase(today))}`}>
              <Droplets size={20} />
              <div>
                <p className="text-[11px] font-black uppercase tracking-tighter">
                  {getDayPhase(today) === 'period' ? 'Menstrual Phase' : 
                   getDayPhase(today) === 'follicular' ? 'Follicular Phase' :
                   getDayPhase(today) === 'ovulation' ? 'Ovulation Phase' :
                   getDayPhase(today) === 'luteal' ? 'Luteal Phase' : 'Normal'}
                </p>
                <p className="text-[9px] opacity-70 font-bold">Today: {format(today, 'MMM d')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <h2 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>Cycle Phases</h2>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              {[
                { label: 'Menstrual', color: isDarkMode ? 'bg-pink-900/40' : 'bg-pink-200', text: 'text-pink-400', desc: 'Active Period' },
                { label: 'Follicular', color: isDarkMode ? 'bg-green-900/40' : 'bg-green-100', text: 'text-green-400', desc: 'Pre-Ovulation' },
                { label: 'Ovulation', color: isDarkMode ? 'bg-blue-900/40' : 'bg-blue-100', text: 'text-blue-400', desc: 'Fertile Window' },
                { label: 'Luteal', color: isDarkMode ? 'bg-purple-900/40' : 'bg-purple-100', text: 'text-purple-400', desc: 'Post-Ovulation' },
              ].map((item) => (
                <div 
                  key={item.label} 
                  className={`flex items-center gap-2 p-2 rounded-lg border shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                >
                  <div className={`w-6 h-6 ${item.color} rounded-md shadow-inner flex items-center justify-center shrink-0`}>
                    <div className="w-1 h-1 bg-white/50 rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider block ${item.text}`}>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions - Hidden on mobile */}
        <div className={`hidden md:block p-4 border-t-2 transition-colors duration-300 ${isDarkMode ? 'bg-purple-900/20 border-purple-900/50' : 'bg-purple-50 border-purple-100'}`}>
          <div className={`text-[10px] leading-relaxed font-medium italic ${isDarkMode ? 'text-purple-400/70' : 'text-purple-800/70'}`}>
            "Click a date to mark the start of your period. Click a later date to mark the end. 
            The cycle adjusts automatically."
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`flex-1 flex flex-col transition-colors duration-300 pb-20 md:pb-0 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 shrink-0">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="bg-[#8B5CF6] text-white p-2 text-center font-bold text-[10px] md:text-xs uppercase border-r border-white/20 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={`grid grid-cols-7 flex-1 min-h-0 border-b transition-colors duration-300 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
            <div key={`pad-${i}`} className={`border-r border-b transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/20 border-gray-800' : 'bg-gray-50/50 border-gray-100'}`} />
          ))}

          {days.map(day => {
            const phase = getDayPhase(day);
            const isTodayDate = isToday(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                className={`
                  flex flex-col items-center justify-center relative transition-all border-r border-b group min-h-[60px] md:min-h-0
                  ${getPhaseColor(phase)}
                  ${isTodayDate ? (isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50') : ''}
                  hover:bg-opacity-80
                `}
              >
                <span className={`text-lg md:text-xl font-bold transition-colors ${isTodayDate ? (isDarkMode ? 'text-purple-400' : 'text-purple-600') : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                  {format(day, 'd')}
                </span>
                
                {phase === 'period' && (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-pink-500 rounded-full mt-1 shadow-sm" />
                )}

                {isTodayDate && (
                  <div className="absolute top-1 right-1 md:top-2 md:right-2">
                    <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`}>Today</span>
                  </div>
                )}

                <div className={`absolute inset-0 border-2 border-transparent group-hover:border-purple-300 pointer-events-none`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
