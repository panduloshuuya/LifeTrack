// The pair's shared calendar. Either member can add an entry for either
// person, and the owner's theme colour is what distinguishes them.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfToday,
  subMonths,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getTheme, readableOn, themeText, withAlpha } from '../theme';
import { Activity, UserProfile } from '../types';
import { Avatar, inputClass, mutedText } from './ui';

interface ActivitiesProps {
  activities: Activity[];
  members: UserProfile[]; // exactly the two pair members
  currentUid: string;
  onAdd: (activity: { name: string; time: string; date: string; ownerId: string }) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
  highlightDate: string | null;
  onClearHighlight: () => void;
}

interface ModalState {
  isOpen: boolean;
  date: Date | null;
  ownerId: string | null;
  name: string;
  time: string;
}

const CLOSED_MODAL: ModalState = {
  isOpen: false,
  date: null,
  ownerId: null,
  name: '',
  time: '',
};

export default function Activities({
  activities,
  members,
  currentUid,
  onAdd,
  onDelete,
  isDarkMode,
  highlightDate,
  onClearHighlight,
}: ActivitiesProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfToday());
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Keeping the callback in a ref stops the effect below from re-running (and
  // re-arming its timers) every time the parent re-renders.
  const clearHighlightRef = useRef(onClearHighlight);
  clearHighlightRef.current = onClearHighlight;

  const today = startOfToday();

  const memberById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    members.forEach((member) => map.set(member.uid, member));
    return map;
  }, [members]);

  const ownerOf = (ownerId: string) => memberById.get(ownerId) ?? members[0];

  const upcoming = useMemo(
    () =>
      activities
        .filter((activity) => {
          const date = parseISO(activity.date);
          return isAfter(date, today) || isSameDay(date, today);
        })
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()),
    [activities],
  );

  // Jump to, and briefly glow, the activity clicked on a mini calendar.
  //
  // Keyed on the highlight alone. Adding `activities` would re-run this on
  // every snapshot and restart both timers, so the glow would never end.
  useEffect(() => {
    if (!highlightDate) return;
    const target = parseISO(highlightDate);
    if (Number.isNaN(target.getTime())) return;

    setCurrentMonth(target);

    const scrollTimer = window.setTimeout(() => {
      const match = activities.find((a) => isSameDay(parseISO(a.date), target));
      if (match) {
        activityRefs.current[match.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 120);
    const clearTimer = window.setTimeout(() => clearHighlightRef.current(), 3000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightDate]);

  const calendarCells = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end: endOfMonth(currentMonth) });
    const padding: (Date | null)[] = Array.from({ length: start.getDay() }, () => null);
    return [...padding, ...days];
  }, [currentMonth]);

  const openModal = (date: Date) =>
    setModal({ isOpen: true, date, ownerId: currentUid, name: '', time: '' });

  const save = () => {
    if (!modal.date || !modal.ownerId || !modal.name.trim()) return;
    onAdd({
      name: modal.name.trim(),
      time: modal.time.trim() || 'All Day',
      date: modal.date.toISOString(),
      ownerId: modal.ownerId,
    });
    setModal(CLOSED_MODAL);
  };

  const modalOwner = modal.ownerId ? ownerOf(modal.ownerId) : null;
  const modalTheme = getTheme(modalOwner?.themeColor);

  return (
    <div
      className={`h-full w-full flex flex-col-reverse md:flex-row overflow-y-auto md:overflow-hidden font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'
      }`}
    >
      {/* Upcoming list */}
      <div
        className={`w-full md:w-80 border-t md:border-t-0 md:border-r flex flex-col h-auto md:h-full shrink-0 ${
          isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-gray-200'
        }`}
      >
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Clock size={20} />
            Upcoming
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {upcoming.length === 0 ? (
            <p className={`text-sm italic text-center py-8 ${mutedText(isDarkMode)}`}>
              No upcoming activities. Tap a date to add one.
            </p>
          ) : (
            upcoming.map((activity) => {
              const owner = ownerOf(activity.ownerId);
              const theme = getTheme(owner?.themeColor);
              const highlighted =
                !!highlightDate &&
                isSameDay(parseISO(activity.date), parseISO(highlightDate));

              return (
                <motion.div
                  key={activity.id}
                  ref={(el) => {
                    activityRefs.current[activity.id] = el;
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    boxShadow: highlighted
                      ? `0 0 20px ${withAlpha(theme.primary, 0.45)}`
                      : '0 0 0 rgba(0,0,0,0)',
                    scale: highlighted ? 1.04 : 1,
                  }}
                  style={{ borderLeftColor: theme.primary }}
                  className={`p-3 rounded-2xl border-l-4 shadow-sm ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span
                      className="text-[10px] font-black uppercase tracking-widest truncate"
                      style={{ color: themeText(theme, isDarkMode) }}
                    >
                      {owner?.displayName ?? 'Unknown'}
                    </span>
                    <button
                      onClick={() => onDelete(activity.id)}
                      aria-label={`Delete ${activity.name}`}
                      className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm leading-tight break-words">
                    {activity.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-gray-400">
                    <CalendarIcon size={12} />
                    <span>{format(parseISO(activity.date), 'MMM d, yyyy')}</span>
                    <span>&bull;</span>
                    <span>{activity.time}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Month grid */}
      <div className="flex-1 flex flex-col shrink-0 md:overflow-hidden">
        <header
          className={`p-4 md:p-6 flex items-center justify-between border-b gap-2 ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tighter truncate">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1 shrink-0">
              <button
                aria-label="Previous month"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                aria-label="Next month"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setCurrentMonth(startOfToday())}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 rounded-xl transition-colors shrink-0 ${
              isDarkMode
                ? 'border-gray-700 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-100'
            }`}
          >
            Today
          </button>
        </header>

        <div className="flex-1 md:overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-2 md:gap-4 md:h-full">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div
                key={label}
                className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400 py-2"
              >
                {label}
              </div>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) return <div key={`pad-${index}`} className="aspect-square" />;

              const dayActivities = activities.filter((a) =>
                isSameDay(parseISO(a.date), day),
              );
              const isTodayCell = isSameDay(day, today);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => openModal(day)}
                  className={`aspect-square p-1 md:p-2 border rounded-2xl cursor-pointer transition-all relative group overflow-hidden ${
                    isDarkMode
                      ? 'border-gray-800 hover:bg-gray-800/50'
                      : 'border-gray-100 hover:bg-gray-50'
                  } ${isTodayCell ? (isDarkMode ? 'ring-2 ring-white' : 'ring-2 ring-black') : ''}`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isTodayCell
                        ? isDarkMode
                          ? 'text-white'
                          : 'text-black'
                        : 'text-gray-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="mt-1 space-y-1">
                    {dayActivities.slice(0, 3).map((activity) => {
                      const theme = getTheme(ownerOf(activity.ownerId)?.themeColor);
                      return (
                        <div
                          key={activity.id}
                          style={{
                            backgroundColor: theme.primary,
                            color: readableOn(theme.primary),
                          }}
                          className="text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded truncate"
                        >
                          {activity.name}
                        </div>
                      );
                    })}
                    {dayActivities.length > 3 && (
                      <div className="text-[8px] font-bold text-gray-400 text-center">
                        +{dayActivities.length - 3} more
                      </div>
                    )}
                  </div>

                  {dayActivities.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Plus size={24} className="text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add activity modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(CLOSED_MODAL)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <div
                className={`p-4 text-center border-b ${
                  isDarkMode ? 'border-gray-700' : 'border-gray-100'
                }`}
              >
                <h3 className="font-black uppercase tracking-widest text-sm">
                  {modal.date ? format(modal.date, 'MMMM d, yyyy') : 'Add activity'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Who is this for?
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {members.map((member) => {
                      const theme = getTheme(member.themeColor);
                      const selected = modal.ownerId === member.uid;
                      return (
                        <button
                          key={member.uid}
                          onClick={() => setModal((m) => ({ ...m, ownerId: member.uid }))}
                          style={{
                            backgroundColor: selected
                              ? theme.primary
                              : withAlpha(theme.primary, 0.12),
                            color: selected
                              ? readableOn(theme.primary)
                              : themeText(theme, isDarkMode),
                            outlineColor: theme.primary,
                          }}
                          className={`p-3 rounded-2xl font-black uppercase tracking-widest text-[11px] flex flex-col items-center gap-2 transition-transform active:scale-95 ${
                            selected ? 'outline outline-2 outline-offset-2' : ''
                          }`}
                        >
                          <Avatar
                            name={member.displayName}
                            colorId={member.themeColor}
                            photoURL={member.photoURL}
                            size={32}
                          />
                          <span className="truncate max-w-full">
                            {member.uid === currentUid ? 'Me' : member.displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Activity name
                  </span>
                  <input
                    autoFocus
                    value={modal.name}
                    onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && save()}
                    className={inputClass(isDarkMode)}
                    placeholder="e.g. Math test, gym session"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Time (optional)
                  </span>
                  <input
                    value={modal.time}
                    onChange={(e) => setModal((m) => ({ ...m, time: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && save()}
                    className={inputClass(isDarkMode)}
                    placeholder="e.g. 10:00 AM"
                  />
                </label>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setModal(CLOSED_MODAL)}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    disabled={!modal.name.trim() || !modal.ownerId}
                    style={{
                      backgroundColor: modalTheme.primary,
                      color: readableOn(modalTheme.primary),
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
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
