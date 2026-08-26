// Step 0: sign in or create an account, by email/password or Google.
//
// Nothing is written to Firestore here. A Firebase Auth account is not yet a
// LifeTrack user; the profile arrives in Onboarding.

import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { Heart, Mail, Lock, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, friendlyAuthError, googleProvider } from '../firebase';
import { ErrorNote, Spinner, inputClass } from './ui';

type Mode = 'sign-in' | 'sign-up';

export default function AuthScreen({ isDarkMode }: { isDarkMode: boolean }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'sign-up') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // The auth listener in App takes over from here.
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const withGoogle = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto flex items-center justify-center p-4 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md rounded-3xl overflow-hidden shadow-xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        <div className="bg-violet-500 text-white p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Heart size={22} className="fill-white" />
            <h1 className="text-xl font-black uppercase tracking-widest">LifeTrack</h1>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
            Accountability, in pairs
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
            {(['sign-in', 'sign-up'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                  mode === m
                    ? isDarkMode
                      ? 'bg-gray-800 text-violet-300 shadow'
                      : 'bg-white text-violet-600 shadow'
                    : 'text-gray-500'
                }`}
              >
                {m === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
              <Mail size={11} /> Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass(isDarkMode)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
              <Lock size={11} /> Password
            </span>
            <input
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass(isDarkMode)}
              placeholder="At least 6 characters"
            />
          </label>

          <ErrorNote message={error} />

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-violet-500 text-white font-bold text-sm uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Spinner size={16} />}
            {mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>

          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              or
            </span>
            <div className={`h-px flex-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          </div>

          <button
            type="button"
            onClick={withGoogle}
            disabled={busy}
            className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-widest border-2 transition-colors disabled:opacity-50 ${
              isDarkMode
                ? 'border-gray-700 text-gray-200 hover:bg-gray-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Continue with Google
          </button>

          <p className="text-[10px] leading-relaxed text-center text-gray-400 font-medium flex items-start gap-2 justify-center pt-1">
            <Users size={14} className="shrink-0 mt-px" />
            <span>
              LifeTrack only works in pairs. After signing in you will search for your
              accountability partner and connect with them.
            </span>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
