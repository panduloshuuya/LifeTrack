// Step 1 of setup: choose a display name and a theme colour.
//
// This is what makes an account searchable, since name and email are what a
// partner looks you up by. It is also shown when a profile exists but could
// not be parsed, so submitting repairs a broken profile as well as creating a
// new one.

import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { motion } from 'motion/react';
import { LogOut, Sparkles } from 'lucide-react';
import { DEFAULT_THEME_COLOR, getTheme, ThemeColorId } from '../theme';
import { createProfile } from '../services/db';
import { UserProfile } from '../types';
import {
  ColorPicker,
  ErrorNote,
  SetupSteps,
  Spinner,
  ThemeButton,
  inputClass,
  mutedText,
} from './ui';

export default function Onboarding({
  user,
  isDarkMode,
  onDone,
  onSignOut,
}: {
  user: FirebaseUser;
  isDarkMode: boolean;
  onDone: (profile: UserProfile) => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(user.displayName ?? '');
  const [color, setColor] = useState<ThemeColorId>(DEFAULT_THEME_COLOR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) {
      setError('Please enter a name with at least 2 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const profile = await createProfile(user, name, color);
      onDone(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
      setBusy(false);
    }
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto flex items-center justify-center p-4 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md rounded-3xl overflow-hidden shadow-xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        <div className="p-6 space-y-5">
          <SetupSteps current={1} colorId={color} isDarkMode={isDarkMode} />

          <div>
            <h1
              className={`text-2xl font-black uppercase tracking-tighter flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              <Sparkles size={20} style={{ color: getTheme(color).primary }} />
              Set up your profile
            </h1>
            <p className={`text-xs font-medium mt-1 ${mutedText(isDarkMode)}`}>
              Next you'll look up your accountability partner by email. Your own name and
              email are how they'll find you back.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Display name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className={inputClass(isDarkMode)}
              placeholder="e.g. Grace"
            />
          </label>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Theme colour
            </span>
            <ColorPicker value={color} onChange={setColor} isDarkMode={isDarkMode} />
          </div>

          <ErrorNote message={error} />

          <ThemeButton colorId={color} type="submit" disabled={busy} className="w-full">
            <span className="flex items-center justify-center gap-2">
              {busy && <Spinner size={16} />}
              Continue to partner search
            </span>
          </ThemeButton>

          <button
            type="button"
            onClick={onSignOut}
            className={`w-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 ${mutedText(
              isDarkMode,
            )} hover:text-red-500 transition-colors`}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </motion.form>
    </div>
  );
}
