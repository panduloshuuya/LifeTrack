// Shared presentational pieces.
//
// Theme colours are chosen at runtime, so anything tinted by one is styled
// inline rather than with Tailwind classes, which are generated at build time.

import React from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import {
  getTheme,
  readableOn,
  THEME_COLORS,
  themeText,
  ThemeColorId,
  withAlpha,
} from '../theme';

export const card = (isDarkMode: boolean) =>
  isDarkMode
    ? 'bg-gray-800 border border-gray-700'
    : 'bg-white border border-gray-100 shadow-sm';

export const inputClass = (isDarkMode: boolean) =>
  `w-full p-3 rounded-xl border-2 outline-none transition-colors ${
    isDarkMode
      ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-gray-500'
      : 'bg-gray-50 border-gray-100 text-gray-800 placeholder:text-gray-400 focus:border-gray-300'
  }`;

export const mutedText = (isDarkMode: boolean) =>
  isDarkMode ? 'text-gray-400' : 'text-gray-500';

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs font-semibold text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
      {message}
    </p>
  );
}

/** Solid button painted in a runtime theme colour. */
export function ThemeButton({
  colorId,
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  colorId: ThemeColorId;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const theme = getTheme(colorId);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ backgroundColor: theme.primary, color: readableOn(theme.primary) }}
      className={`py-3 px-5 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Swatch grid for picking a theme colour. `takenColor` is the partner's colour,
 * which is locked out because a pair may not share one.
 */
export function ColorPicker({
  value,
  onChange,
  takenColor,
  takenLabel,
  isDarkMode,
}: {
  value: ThemeColorId;
  onChange: (id: ThemeColorId) => void;
  takenColor?: ThemeColorId | null;
  takenLabel?: string;
  isDarkMode: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {THEME_COLORS.map((theme) => {
          const taken = takenColor === theme.id;
          const selected = value === theme.id && !taken;
          return (
            <button
              key={theme.id}
              type="button"
              disabled={taken}
              onClick={() => onChange(theme.id)}
              title={taken ? `${takenLabel ?? 'Your partner'} uses ${theme.label}` : theme.label}
              style={{
                backgroundColor: taken ? withAlpha(theme.primary, 0.25) : theme.primary,
                outlineColor: theme.primary,
              }}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-transform ${
                taken ? 'cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              } ${selected ? 'outline outline-2 outline-offset-2' : ''}`}
            >
              {taken ? (
                <Lock size={16} className={isDarkMode ? 'text-gray-300' : 'text-gray-700'} />
              ) : (
                selected && <Check size={18} strokeWidth={4} color={readableOn(theme.primary)} />
              )}
              <span
                className="text-[8px] font-black uppercase tracking-wider leading-none px-1 text-center"
                style={{
                  color: taken
                    ? isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                    : readableOn(theme.primary),
                }}
              >
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
      {takenColor && (
        <p className={`text-[10px] font-semibold ${mutedText(isDarkMode)}`}>
          {takenLabel ?? 'Your partner'} already uses{' '}
          {THEME_COLORS.find((t) => t.id === takenColor)?.label}, so a pair never shares a
          colour.
        </p>
      )}
    </div>
  );
}

const SETUP_STEPS = ['Profile', 'Partner', 'Dashboard'];

/**
 * Progress rail shown across the two setup screens, so creating a profile and
 * finding a partner read as one path rather than two unrelated pages.
 */
export function SetupSteps({
  current,
  colorId,
  isDarkMode,
}: {
  /** 1-based index of the step being shown. */
  current: number;
  colorId: ThemeColorId;
  isDarkMode: boolean;
}) {
  const theme = getTheme(colorId);

  return (
    <ol className="flex items-center gap-2">
      {SETUP_STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        const filled = done || active;

        return (
          <li key={label} className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                style={
                  filled
                    ? { backgroundColor: theme.primary, color: readableOn(theme.primary) }
                    : undefined
                }
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  filled ? '' : isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {done ? <Check size={11} strokeWidth={4} /> : step}
              </span>
              <span
                style={active ? { color: themeText(theme, isDarkMode) } : undefined}
                className={`text-[10px] font-black uppercase tracking-widest truncate ${
                  active ? '' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {step < SETUP_STEPS.length && (
              <span
                aria-hidden
                className={`h-px w-3 sm:w-5 shrink-0 ${
                  done ? '' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}
                style={done ? { backgroundColor: theme.primary } : undefined}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Circular avatar showing the person's initial in their theme colour. */
export function Avatar({
  name,
  colorId,
  size = 40,
  photoURL,
}: {
  name: string;
  colorId: ThemeColorId;
  size?: number;
  photoURL?: string | null;
}) {
  const theme = getTheme(colorId);
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderColor: theme.primary }}
        className="rounded-full object-cover border-2 shrink-0"
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: theme.primary,
        color: readableOn(theme.primary),
        fontSize: size * 0.42,
      }}
      className="rounded-full flex items-center justify-center font-black shrink-0"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}
