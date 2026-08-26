// One person's planner: weekly habit grid, plus classes and tasks per day.
//
// Used for both members of the pair. The partner's board renders with
// `readOnly`, which hides every control rather than just disabling it, since
// the security rules would reject those writes anyway.

import React, { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  startOfToday,
  subMonths,
} from 'date-fns';
import {
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getTheme, readableOn, themeText, withAlpha } from '../theme';
import {
  Activity,
  ClassEvent,
  DayData,
  DayOfWeek,
  DAYS,
  Habit,
  Task,
  TrackerData,
  UserProfile,
} from '../types';
import { newId } from '../services/db';
import { mutedText } from './ui';

const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

interface TaskTrackerProps {
  profile: UserProfile;
  data: TrackerData;
  onUpdate: (data: TrackerData) => void;
  isDarkMode: boolean;
  activities: Activity[];
  onActivityClick: (date: string) => void;
  /** Partner boards are visible but not editable. */
  readOnly?: boolean;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  value: string;
  onConfirm: (value: string) => void;
}

/** Deep-ish clone of one day so updates never mutate the object held in state. */
function withDay(
  schedule: Record<DayOfWeek, DayData>,
  day: DayOfWeek,
  patch: Partial<DayData>,
): Record<DayOfWeek, DayData> {
  return { ...schedule, [day]: { ...schedule[day], ...patch } };
}

export default function TaskTracker({
  profile,
  data,
  onUpdate,
  isDarkMode,
  activities,
  onActivityClick,
  readOnly = false,
}: TaskTrackerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfToday());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(
    () => format(startOfToday(), 'EEE') as DayOfWeek,
  );
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    value: '',
    onConfirm: () => {},
  });

  const theme = getTheme(profile.themeColor);
  const onPrimary = readableOn(theme.primary);
  const accentText = themeText(theme, isDarkMode);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth],
  );

  const weeklyPercentage = () => {
    if (data.habits.length === 0) return 0;
    const total = data.habits.length * DAYS.length;
    let completed = 0;
    data.habits.forEach((habit) => {
      DAYS.forEach((day) => {
        if (habit.completed[day]) completed++;
      });
    });
    return Math.round((completed / total) * 100);
  };

  const dailyPercentage = (day: DayOfWeek) => {
    const tasks = data.weeklySchedule[day].tasks;
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
  };

  const prompt = (title: string, value: string, onConfirm: (val: string) => void) => {
    if (readOnly) return;
    setModal({ isOpen: true, title, value, onConfirm });
  };

  // --- Habits ---------------------------------------------------------------

  const addHabit = () =>
    prompt('Add new habit', '', (value) => {
      const name = value.trim();
      if (!name) return;
      const habit: Habit = {
        id: newId(),
        name,
        completed: DAYS.reduce(
          (acc, day) => ({ ...acc, [day]: false }),
          {} as Habit['completed'],
        ),
      };
      onUpdate({ ...data, habits: [...data.habits, habit] });
    });

  const editHabit = (habitId: string, currentName: string) =>
    prompt('Edit habit', currentName, (value) => {
      const name = value.trim();
      if (!name || name === currentName) return;
      onUpdate({
        ...data,
        habits: data.habits.map((h) => (h.id === habitId ? { ...h, name } : h)),
      });
    });

  const toggleHabit = (habitId: string, day: DayOfWeek) => {
    if (readOnly) return;
    onUpdate({
      ...data,
      habits: data.habits.map((h) =>
        h.id === habitId
          ? { ...h, completed: { ...h.completed, [day]: !h.completed[day] } }
          : h,
      ),
    });
  };

  const removeHabit = (habitId: string) => {
    if (readOnly) return;
    onUpdate({ ...data, habits: data.habits.filter((h) => h.id !== habitId) });
  };

  // --- Classes --------------------------------------------------------------

  const addClass = (day: DayOfWeek) =>
    prompt(`Add to ${DAY_LABELS[day]}`, '', (value) => {
      const name = value.trim();
      if (!name) return;
      const entry: ClassEvent = { id: newId(), name };
      onUpdate({
        ...data,
        weeklySchedule: withDay(data.weeklySchedule, day, {
          classes: [...data.weeklySchedule[day].classes, entry],
        }),
      });
    });

  const editClass = (day: DayOfWeek, classId: string, currentName: string) =>
    prompt('Edit class or event', currentName, (value) => {
      const name = value.trim();
      if (!name || name === currentName) return;
      onUpdate({
        ...data,
        weeklySchedule: withDay(data.weeklySchedule, day, {
          classes: data.weeklySchedule[day].classes.map((c) =>
            c.id === classId ? { ...c, name } : c,
          ),
        }),
      });
    });

  const removeClass = (day: DayOfWeek, classId: string) => {
    if (readOnly) return;
    onUpdate({
      ...data,
      weeklySchedule: withDay(data.weeklySchedule, day, {
        classes: data.weeklySchedule[day].classes.filter((c) => c.id !== classId),
      }),
    });
  };

  // --- Tasks ----------------------------------------------------------------

  const addTask = (day: DayOfWeek) =>
    prompt(`New task for ${DAY_LABELS[day]}`, '', (value) => {
      const name = value.trim();
      if (!name) return;
      const task: Task = { id: newId(), name, completed: false };
      onUpdate({
        ...data,
        weeklySchedule: withDay(data.weeklySchedule, day, {
          tasks: [...data.weeklySchedule[day].tasks, task],
        }),
      });
    });

  const editTask = (day: DayOfWeek, taskId: string, currentName: string) =>
    prompt('Edit task', currentName, (value) => {
      const name = value.trim();
      if (!name || name === currentName) return;
      onUpdate({
        ...data,
        weeklySchedule: withDay(data.weeklySchedule, day, {
          tasks: data.weeklySchedule[day].tasks.map((t) =>
            t.id === taskId ? { ...t, name } : t,
          ),
        }),
      });
    });

  const toggleTask = (day: DayOfWeek, taskId: string) => {
    if (readOnly) return;
    onUpdate({
      ...data,
      weeklySchedule: withDay(data.weeklySchedule, day, {
        tasks: data.weeklySchedule[day].tasks.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t,
        ),
      }),
    });
  };

  const removeTask = (day: DayOfWeek, taskId: string) => {
    if (readOnly) return;
    onUpdate({
      ...data,
      weeklySchedule: withDay(data.weeklySchedule, day, {
        tasks: data.weeklySchedule[day].tasks.filter((t) => t.id !== taskId),
      }),
    });
  };

  const dayProps = {
    colors: { primary: theme.primary, onPrimary, accentText },
    isDarkMode,
    data,
    readOnly,
    addClass,
    editClass,
    addTask,
    editTask,
    toggleTask,
    removeClass,
    removeTask,
    dailyPercentage,
  };

  return (
    <div
      className={`h-full w-full flex flex-col md:flex-row md:overflow-hidden overflow-y-auto font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'
      }`}
    >
      {/* Sidebar */}
      <div
        className={`w-full md:w-80 border-b-2 md:border-b-0 md:border-r-2 flex flex-col h-auto md:h-full shrink-0 ${
          isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'border-gray-100'
        }`}
        style={isDarkMode ? undefined : { backgroundColor: withAlpha(theme.primary, 0.04) }}
      >
        <div
          className="p-4 text-center font-bold text-lg md:text-xl uppercase tracking-widest"
          style={{ backgroundColor: theme.primary, color: onPrimary }}
        >
          {profile.displayName}'s Planner
        </div>

        {readOnly && (
          <div
            className={`px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${
              isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Eye size={13} /> View only
          </div>
        )}

        {/* Mobile day selector */}
        <div className="md:hidden flex overflow-x-auto p-2 gap-2 bg-black/5">
          {DAYS.map((day) => {
            const selected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                style={
                  selected
                    ? { backgroundColor: theme.primary, color: onPrimary }
                    : undefined
                }
                className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
                  selected
                    ? 'shadow-lg'
                    : isDarkMode
                      ? 'bg-gray-800 text-gray-400'
                      : 'bg-white text-gray-600'
                }`}
              >
                <span className="text-[10px] font-black uppercase leading-none mb-1">
                  {day}
                </span>
                <span className="text-xs font-bold leading-none">
                  {dailyPercentage(day)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Month calendar */}
        <div
          className={`hidden md:block p-4 border-b-2 ${
            isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`font-bold text-sm uppercase ${
                isDarkMode ? 'text-gray-300' : 'text-gray-900'
              }`}
            >
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <div className="flex gap-1">
              <button
                aria-label="Previous month"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Next month"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div
            className={`grid grid-cols-7 gap-1 text-[10px] text-center font-bold mb-1 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
              <div key={i}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {calendarDays.map((day) => {
              const hasActivity = activities.some(
                (a) => a.ownerId === profile.uid && isSameDay(parseISO(a.date), day),
              );
              const todayCell = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => hasActivity && onActivityClick(day.toISOString())}
                  style={
                    todayCell
                      ? { backgroundColor: theme.primary, color: onPrimary }
                      : undefined
                  }
                  className={`aspect-square flex flex-col items-center justify-center text-[10px] rounded-full transition-colors relative ${
                    todayCell
                      ? 'font-bold'
                      : isDarkMode
                        ? 'hover:bg-gray-700 text-gray-400'
                        : 'hover:bg-gray-200 text-gray-600'
                  } ${hasActivity ? 'cursor-pointer' : ''}`}
                >
                  {format(day, 'd')}
                  {hasActivity && (
                    <div
                      className="w-1 h-1 rounded-full absolute bottom-1"
                      style={{ backgroundColor: todayCell ? onPrimary : theme.primary }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Habits */}
        <div className="flex-none md:flex-1 flex flex-col min-h-0">
          <div
            className={`p-2 border-b flex justify-between items-center ${
              isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-100 border-gray-200'
            }`}
          >
            <span
              className={`font-bold text-xs uppercase tracking-tighter ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Weekly habits
            </span>
            {!readOnly && (
              <button
                onClick={addHabit}
                aria-label="Add habit"
                style={{ color: accentText }}
                className={`p-1 rounded transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-white'
                }`}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="overflow-x-auto md:flex-1 md:overflow-y-auto">
            <table className="w-full text-[10px] min-w-[280px]">
              <thead
                className={`sticky top-0 shadow-sm z-10 ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`p-1 text-left ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Habit
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      title={DAY_LABELS[day]}
                      className={`p-1 text-center w-6 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {day.charAt(0)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.habits.length === 0 && (
                  <tr>
                    <td colSpan={DAYS.length + 1} className="p-3">
                      <p className={`text-[10px] italic ${mutedText(isDarkMode)}`}>
                        {readOnly ? 'No habits yet.' : 'No habits yet. Add one above.'}
                      </p>
                    </td>
                  </tr>
                )}
                {data.habits.map((habit) => (
                  <tr
                    key={habit.id}
                    className={`border-b group ${
                      isDarkMode
                        ? 'border-gray-800 hover:bg-gray-800/30'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-1">
                      <div className="flex items-start gap-1">
                        {!readOnly && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                            <button
                              onClick={() => editHabit(habit.id, habit.name)}
                              aria-label={`Edit ${habit.name}`}
                              className="text-blue-400 hover:text-blue-500"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => removeHabit(habit.id)}
                              aria-label={`Delete ${habit.name}`}
                              className="text-red-400 hover:text-red-500"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                        <span
                          className={`break-words leading-tight ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          {habit.name}
                        </span>
                      </div>
                    </td>
                    {DAYS.map((day) => (
                      <td key={day} className="p-1 text-center">
                        <button
                          onClick={() => toggleHabit(habit.id, day)}
                          disabled={readOnly}
                          aria-label={`${habit.name} on ${DAY_LABELS[day]}`}
                          style={
                            habit.completed[day]
                              ? { backgroundColor: theme.primary, borderColor: theme.primary }
                              : undefined
                          }
                          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center mx-auto ${
                            habit.completed[day]
                              ? ''
                              : isDarkMode
                                ? 'border-gray-600'
                                : 'border-gray-300'
                          } ${readOnly ? 'cursor-default' : ''}`}
                        >
                          {habit.completed[day] && (
                            <Check size={10} strokeWidth={4} color={onPrimary} />
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly progress */}
        <div
          className={`hidden md:block p-4 border-t-2 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className={`text-xs font-bold uppercase ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Weekly progress
            </span>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {weeklyPercentage()}%
            </span>
          </div>
          <div
            className={`w-full h-3 rounded-full overflow-hidden ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyPercentage()}%` }}
              style={{ backgroundColor: theme.primary }}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Day columns */}
      <div className="flex-none md:flex-1 md:overflow-y-auto pb-24 md:pb-0">
        <div className={`hidden md:grid grid-cols-7 h-full ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          {DAYS.map((day, index) => (
            <DayColumn key={day} day={day} isLast={index === DAYS.length - 1} {...dayProps} />
          ))}
        </div>
        <div className="md:hidden h-full">
          <DayColumn day={selectedDay} isLast isMobile {...dayProps} />
        </div>
      </div>

      {/* Text input modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal((m) => ({ ...m, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <div
                className="p-4 text-center font-bold uppercase tracking-widest"
                style={{ backgroundColor: theme.primary, color: onPrimary }}
              >
                {modal.title}
              </div>
              <div className="p-6">
                <input
                  autoFocus
                  type="text"
                  value={modal.value}
                  onChange={(e) => setModal((m) => ({ ...m, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      modal.onConfirm(modal.value);
                      setModal((m) => ({ ...m, isOpen: false }));
                    } else if (e.key === 'Escape') {
                      setModal((m) => ({ ...m, isOpen: false }));
                    }
                  }}
                  className={`w-full p-3 rounded-xl border-2 outline-none mb-6 ${
                    isDarkMode
                      ? 'bg-gray-900 border-gray-700 text-white'
                      : 'bg-gray-50 border-gray-100 text-gray-800'
                  }`}
                  placeholder="Type something..."
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setModal((m) => ({ ...m, isOpen: false }))}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      modal.onConfirm(modal.value);
                      setModal((m) => ({ ...m, isOpen: false }));
                    }}
                    style={{ backgroundColor: theme.primary, color: onPrimary }}
                    className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg transition-transform active:scale-95"
                  >
                    Save
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

interface DayColumnProps {
  day: DayOfWeek;
  isLast: boolean;
  isMobile?: boolean;
  colors: { primary: string; onPrimary: string; accentText: string };
  isDarkMode: boolean;
  data: TrackerData;
  readOnly: boolean;
  addClass: (day: DayOfWeek) => void;
  editClass: (day: DayOfWeek, id: string, name: string) => void;
  addTask: (day: DayOfWeek) => void;
  editTask: (day: DayOfWeek, id: string, name: string) => void;
  toggleTask: (day: DayOfWeek, id: string) => void;
  removeClass: (day: DayOfWeek, id: string) => void;
  removeTask: (day: DayOfWeek, id: string) => void;
  dailyPercentage: (day: DayOfWeek) => number;
}

function DayColumn({
  day,
  isLast,
  isMobile = false,
  colors,
  isDarkMode,
  data,
  readOnly,
  addClass,
  editClass,
  addTask,
  editTask,
  toggleTask,
  removeClass,
  removeTask,
  dailyPercentage,
}: DayColumnProps) {
  const dayData = data.weeklySchedule[day];
  const isWeekend = day === 'Sat' || day === 'Sun';
  const sectionStyle = { backgroundColor: withAlpha(colors.primary, isDarkMode ? 0.15 : 0.1) };

  return (
    <div
      className={`flex flex-col border-r ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} ${
        isLast ? 'border-r-0' : ''
      } ${isMobile ? 'h-full' : ''}`}
    >
      <div
        className="p-2 text-center font-bold text-xs uppercase border-b border-white/20"
        style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
      >
        {DAY_LABELS[day]}
      </div>

      {/* Classes */}
      <div
        className={`p-1 text-[10px] font-bold border-b flex justify-between items-center px-2 ${
          isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
        }`}
        style={sectionStyle}
      >
        <span className="uppercase tracking-widest">{isWeekend ? 'Events' : 'Classes'}</span>
        {!readOnly && (
          <button
            onClick={() => addClass(day)}
            aria-label={`Add class to ${DAY_LABELS[day]}`}
            className={`rounded p-1 transition-colors ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'
            }`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div
        className={`${isMobile ? 'min-h-[100px]' : 'h-40 overflow-y-auto'} p-2 border-b-2 ${
          isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'
        }`}
      >
        <AnimatePresence initial={false}>
          {dayData.classes.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`text-[12px] md:text-[11px] mb-1 p-2 md:p-1 rounded border flex justify-between items-start gap-2 group ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300'
                  : 'bg-white border-gray-100 text-gray-700'
              }`}
            >
              <span className="break-words flex-1 leading-tight">{entry.name}</span>
              {!readOnly && (
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => editClass(day, entry.id, entry.name)}
                    aria-label={`Edit ${entry.name}`}
                    className="text-blue-400 hover:text-blue-500 p-1"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => removeClass(day, entry.id)}
                    aria-label={`Delete ${entry.name}`}
                    className="text-red-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Tasks */}
      <div
        className={`p-1 text-[10px] font-bold border-b flex justify-between items-center px-2 ${
          isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
        }`}
        style={sectionStyle}
      >
        <span className="uppercase tracking-widest">Tasks</span>
        {!readOnly && (
          <button
            onClick={() => addTask(day)}
            aria-label={`Add task to ${DAY_LABELS[day]}`}
            className={`rounded p-1 transition-colors ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-white/50'
            }`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div
        className={`flex-none md:flex-1 md:overflow-y-auto p-2 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        <AnimatePresence initial={false}>
          {dayData.tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-start gap-2 mb-3 md:mb-2 group"
            >
              <button
                onClick={() => toggleTask(day, task.id)}
                disabled={readOnly}
                aria-label={task.name}
                style={task.completed ? { color: colors.accentText } : undefined}
                className={`mt-0.5 flex-shrink-0 transition-colors ${
                  task.completed ? '' : isDarkMode ? 'text-gray-600' : 'text-gray-300'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                {task.completed ? (
                  <CheckSquare size={18} className="md:w-3.5 md:h-3.5" />
                ) : (
                  <Square size={18} className="md:w-3.5 md:h-3.5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm md:text-[11px] leading-tight break-words ${
                    task.completed
                      ? 'line-through text-gray-500'
                      : isDarkMode
                        ? 'text-gray-300'
                        : 'text-gray-700'
                  }`}
                >
                  {task.name}
                </p>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => editTask(day, task.id, task.name)}
                    aria-label={`Edit ${task.name}`}
                    className="text-blue-400 hover:text-blue-500 p-1"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => removeTask(day, task.id)}
                    aria-label={`Delete ${task.name}`}
                    className="text-red-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Daily progress */}
      <div
        className={`p-2 border-t ${
          isDarkMode ? 'border-gray-800 bg-gray-800/30' : 'border-gray-100 bg-gray-50'
        }`}
      >
        <div
          className={`flex justify-between text-[9px] font-bold mb-1 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          <span>DONE</span>
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            {dailyPercentage(day)}%
          </span>
        </div>
        <div
          className={`w-full h-1.5 rounded-full overflow-hidden ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dailyPercentage(day)}%` }}
            style={{ backgroundColor: colors.primary }}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
