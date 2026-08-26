// The shared home screen: both people's weekly progress and today's tasks side
// by side, plus the pair's upcoming calendar entries.

import React, { useMemo } from 'react';
import { format, isAfter, isSameDay, parseISO, startOfToday } from 'date-fns';
import { Bell, Calendar, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { getTheme, themeText, withAlpha } from '../theme';
import { Activity, DayOfWeek, DAYS, TrackerData, UserProfile } from '../types';
import { Avatar, card, mutedText } from './ui';

interface DashboardProps {
  me: UserProfile;
  partner: UserProfile;
  myTracker: TrackerData;
  partnerTracker: TrackerData;
  activities: Activity[];
  isDarkMode: boolean;
  onDismissMessage: () => void;
}

/** Percentage of habit checkboxes ticked across the whole week. */
export function weeklyPercentage(tracker: TrackerData): number {
  if (tracker.habits.length === 0) return 0;
  const total = tracker.habits.length * DAYS.length;
  let completed = 0;
  tracker.habits.forEach((habit) => {
    DAYS.forEach((day) => {
      if (habit.completed[day]) completed++;
    });
  });
  return Math.round((completed / total) * 100);
}

function PersonCard({
  profile,
  tracker,
  dayName,
  isDarkMode,
  isMe,
  onDismissMessage,
}: {
  profile: UserProfile;
  tracker: TrackerData;
  dayName: DayOfWeek;
  isDarkMode: boolean;
  isMe: boolean;
  onDismissMessage?: () => void;
}) {
  const theme = getTheme(profile.themeColor);
  const progress = weeklyPercentage(tracker);
  const tasks = tracker.weeklySchedule[dayName].tasks;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] transition-colors duration-300 ${card(
        isDarkMode,
      )}`}
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            name={profile.displayName}
            colorId={profile.themeColor}
            photoURL={profile.photoURL}
            size={44}
          />
          <div className="min-w-0">
            <h3
              className={`text-base md:text-xl font-bold truncate ${
                isDarkMode ? 'text-gray-100' : 'text-gray-800'
              }`}
            >
              {profile.displayName}
            </h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
              {isMe ? 'You' : 'Partner'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-lg md:text-2xl font-black leading-none"
            style={{ color: themeText(theme, isDarkMode) }}
          >
            {progress}%
          </p>
          <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">
            Weekly
          </p>
        </div>
      </div>

      {isMe && profile.hasNewMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-2.5 bg-red-600 text-white rounded-2xl flex items-center justify-between gap-2 shadow-lg shadow-red-600/30"
        >
          <div className="flex items-center gap-2 pl-1">
            <Bell size={14} className="animate-bounce" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              New ChatDesk message
            </span>
          </div>
          <button
            onClick={onDismissMessage}
            aria-label="Dismiss new message notice"
            className="p-1 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm active:scale-95 flex items-center justify-center"
          >
            <Check size={11} strokeWidth={4} />
          </button>
        </motion.div>
      )}

      <div
        className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden mb-4 md:mb-6 ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          style={{ backgroundColor: theme.primary }}
          className="h-full"
        />
      </div>

      <h4
        className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-3 ${
          isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'
        }`}
      >
        Today's focus
      </h4>
      <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <p className="text-[10px] md:text-xs text-gray-400 italic">
            No tasks set for today.
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: task.completed ? theme.primary : '#D1D5DB' }}
              />
              <span
                className={`text-[10px] md:text-xs font-medium break-words leading-tight ${
                  task.completed
                    ? 'line-through text-gray-500'
                    : isDarkMode
                      ? 'text-gray-300'
                      : 'text-gray-700'
                }`}
              >
                {task.name}
              </span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

export default function Dashboard({
  me,
  partner,
  myTracker,
  partnerTracker,
  activities,
  isDarkMode,
  onDismissMessage,
}: DashboardProps) {
  const today = startOfToday();
  const dayName = format(today, 'EEE') as DayOfWeek;

  // Not keyed on `today`: the page remounts on navigation, which is often
  // enough to pick up a date change for a list of upcoming events.
  const upcoming = useMemo(() => {
    return activities
      .filter((activity) => {
        const date = parseISO(activity.date);
        if (Number.isNaN(date.getTime())) return false;
        return isAfter(date, today) || isSameDay(date, today);
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .slice(0, 6);
  }, [activities]);

  const ownerOf = (ownerId: string) => (ownerId === me.uid ? me : partner);

  return (
    <div
      className={`h-full w-full p-4 md:p-6 overflow-y-auto transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h2
              className={`text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              {me.displayName} &amp; {partner.displayName}
            </h2>
            <p className={`text-[10px] md:text-sm font-medium italic mt-1 ${mutedText(isDarkMode)}`}>
              Habit and task accountability. Two people, one shared plan.
            </p>
          </div>
          <div
            className="flex md:block items-center justify-between p-2 md:p-0 rounded-xl md:bg-transparent"
            style={{ backgroundColor: withAlpha(getTheme(me.themeColor).primary, 0.1) }}
          >
            <p
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: themeText(getTheme(me.themeColor), isDarkMode) }}
            >
              {format(today, 'EEEE')}
            </p>
            <p className={`text-sm md:text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {format(today, 'MMMM d')}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <PersonCard
            profile={me}
            tracker={myTracker}
            dayName={dayName}
            isDarkMode={isDarkMode}
            isMe
            onDismissMessage={onDismissMessage}
          />
          <PersonCard
            profile={partner}
            tracker={partnerTracker}
            dayName={dayName}
            isDarkMode={isDarkMode}
            isMe={false}
          />

          <motion.div
            whileHover={{ y: -4 }}
            className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] ${card(isDarkMode)}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}
              >
                <Calendar className="text-gray-500" size={20} />
              </div>
              <h3 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Shared calendar
              </h3>
            </div>

            <h4
              className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b pb-2 mb-3 ${
                isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-100'
              }`}
            >
              Upcoming events
            </h4>
            <div className="space-y-3 max-h-80 md:max-h-96 overflow-y-auto pr-1">
              {upcoming.length === 0 ? (
                <p className="text-[10px] md:text-xs text-gray-400 italic">
                  No upcoming activities.
                </p>
              ) : (
                upcoming.map((activity) => {
                  const owner = ownerOf(activity.ownerId);
                  const theme = getTheme(owner.themeColor);
                  return (
                    <div
                      key={activity.id}
                      style={{ borderLeftColor: theme.primary }}
                      className={`p-3 rounded-xl border-l-4 ${
                        isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <span
                          className="text-[8px] font-black uppercase tracking-widest truncate"
                          style={{ color: themeText(theme, isDarkMode) }}
                        >
                          {owner.displayName}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400 shrink-0">
                          {format(parseISO(activity.date), 'MMM d')}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] font-bold break-words leading-tight ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                      >
                        {activity.name}
                      </p>
                      <p className="text-[9px] text-gray-400 font-medium">{activity.time}</p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
