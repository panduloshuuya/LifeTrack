// Profile settings and the one place a pairing can be ended.
//
// Disconnecting is destructive: it deletes the shared calendar and chat for
// both people, so it is behind a confirmation.

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, LogOut, Unlink } from 'lucide-react';
import { ThemeColorId } from '../theme';
import { disconnectPair, PairingError, updateProfileSettings } from '../services/db';
import { UserProfile } from '../types';
import {
  Avatar,
  ColorPicker,
  ErrorNote,
  Spinner,
  ThemeButton,
  card,
  inputClass,
  mutedText,
} from './ui';

interface SettingsPanelProps {
  profile: UserProfile;
  partner: UserProfile;
  isDarkMode: boolean;
  onSignOut: () => void;
}

export default function SettingsPanel({
  profile,
  partner,
  isDarkMode,
  onSignOut,
}: SettingsPanelProps) {
  const [name, setName] = useState(profile.displayName);
  const [color, setColor] = useState<ThemeColorId>(profile.themeColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const dirty = name.trim() !== profile.displayName || color !== profile.themeColor;

  const save = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await updateProfileSettings(
        profile.uid,
        { displayName: name, themeColor: color },
        partner.themeColor,
      );
      setNotice('Saved.');
    } catch (err) {
      setError(
        err instanceof PairingError || err instanceof Error
          ? err.message
          : 'Could not save your changes.',
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!profile.pairId || !profile.partnerId) return;
    setError(null);
    setDisconnecting(true);
    try {
      await disconnectPair(profile.uid, profile.partnerId, profile.pairId);
      // App drops back to the pairing screen when the profile update lands.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the connection.');
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  return (
    <div className={`h-full w-full overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 pb-28 md:pb-12">
        <header>
          <h2
            className={`text-2xl md:text-3xl font-black uppercase tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            Settings
          </h2>
          <p className={`text-xs font-medium ${mutedText(isDarkMode)}`}>
            Your profile and your accountability connection.
          </p>
        </header>

        {/* Profile */}
        <section className={`rounded-3xl p-5 md:p-6 space-y-5 ${card(isDarkMode)}`}>
          <div className="flex items-center gap-3">
            <Avatar
              name={name || profile.displayName}
              colorId={color}
              photoURL={profile.photoURL}
              size={48}
            />
            <div className="min-w-0">
              <p className={`font-bold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {profile.displayName}
              </p>
              <p className={`text-[11px] truncate ${mutedText(isDarkMode)}`}>{profile.email}</p>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Display name
            </span>
            <input
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className={inputClass(isDarkMode)}
            />
          </label>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Theme colour
            </span>
            <ColorPicker
              value={color}
              onChange={setColor}
              takenColor={partner.themeColor}
              takenLabel={partner.displayName}
              isDarkMode={isDarkMode}
            />
          </div>

          <ErrorNote message={error} />
          {notice && (
            <p className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2">
              {notice}
            </p>
          )}

          <ThemeButton
            colorId={color}
            onClick={save}
            disabled={!dirty || saving}
            className="w-full"
          >
            <span className="flex items-center justify-center gap-2">
              {saving && <Spinner size={14} />}
              Save changes
            </span>
          </ThemeButton>
        </section>

        {/* Connection */}
        <section className={`rounded-3xl p-5 md:p-6 space-y-4 ${card(isDarkMode)}`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Accountability partner
          </h3>
          <div className="flex items-center gap-3">
            <Avatar
              name={partner.displayName}
              colorId={partner.themeColor}
              photoURL={partner.photoURL}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className={`font-bold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {partner.displayName}
              </p>
              <p className={`text-[11px] truncate ${mutedText(isDarkMode)}`}>{partner.email}</p>
            </div>
          </div>

          <button
            onClick={() => setConfirmDisconnect(true)}
            className="w-full py-3 rounded-xl border-2 border-red-500/40 text-red-500 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
          >
            <Unlink size={14} />
            End this connection
          </button>
          <p className={`text-[10px] leading-relaxed ${mutedText(isDarkMode)}`}>
            Ending the connection deletes your shared calendar and chat for both of you.
            Each person keeps their own habits and weekly plan, and is then free to pair
            with someone new.
          </p>
        </section>

        <button
          onClick={onSignOut}
          className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
            isDarkMode
              ? 'bg-gray-800 text-gray-400 hover:text-white'
              : 'bg-white border border-gray-100 text-gray-500 hover:text-gray-900'
          }`}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <AnimatePresence>
        {confirmDisconnect && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !disconnecting && setConfirmDisconnect(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className={`relative w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3
                    className={`text-lg font-black uppercase tracking-tighter ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Disconnect from {partner.displayName}?
                  </h3>
                  <p className={`text-xs font-medium mt-1 ${mutedText(isDarkMode)}`}>
                    Your shared calendar and chat will be permanently deleted for both of
                    you. This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={disconnecting}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Keep it
                </button>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {disconnecting && <Spinner size={14} />}
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
