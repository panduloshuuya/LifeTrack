// Step 2 of setup: find a partner and connect.
//
// Shown whenever the signed-in user has no partner, so it doubles as the
// re-pairing screen after a disconnect. Requests are two-sided: one person
// sends, the other accepts, and only then does the shared workspace exist.

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Clock,
  LogOut,
  Moon,
  Search,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getTheme, ThemeColorId, withAlpha } from '../theme';
import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  declineConnectionRequest,
  PairingError,
  searchUsers,
  SearchResult,
  sendConnectionRequest,
} from '../services/db';
import { ConnectionRequest, UserProfile } from '../types';
import {
  Avatar,
  ColorPicker,
  ErrorNote,
  SetupSteps,
  Spinner,
  ThemeButton,
  card,
  inputClass,
  mutedText,
} from './ui';

interface PairSetupProps {
  profile: UserProfile;
  incoming: ConnectionRequest[];
  outgoing: ConnectionRequest[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSignOut: () => void;
}

export default function PairSetup({
  profile,
  incoming,
  outgoing,
  isDarkMode,
  onToggleDarkMode,
  onSignOut,
}: PairSetupProps) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when accepting a request needs the user to resolve a colour clash. */
  const [colorClash, setColorClash] = useState<ConnectionRequest | null>(null);
  const [newColor, setNewColor] = useState<ThemeColorId>(profile.themeColor);

  const theme = getTheme(profile.themeColor);
  const pendingTo = new Set(outgoing.map((r) => r.toUid));

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (term.trim().length < 2) {
      setError('Type at least 2 characters to search.');
      return;
    }
    setSearching(true);
    try {
      setResults(await searchUsers(term, profile.uid));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Search failed. Please try again.',
      );
    } finally {
      setSearching(false);
    }
  };

  const invite = async (target: SearchResult) => {
    setError(null);
    setNotice(null);
    setBusyUid(target.uid);
    try {
      await sendConnectionRequest(profile, target);
      setNotice(`Request sent to ${target.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
    } finally {
      setBusyUid(null);
    }
  };

  const accept = async (request: ConnectionRequest, colorOverride?: ThemeColorId) => {
    setError(null);
    setNotice(null);
    if (!colorOverride && request.fromColor === profile.themeColor) {
      setNewColor(profile.themeColor);
      setColorClash(request);
      return;
    }
    setBusyUid(request.fromUid);
    try {
      await acceptConnectionRequest(profile.uid, request.fromUid, colorOverride);
      setColorClash(null);
      // App re-renders into the paired experience once the profile updates.
    } catch (err) {
      setError(
        err instanceof PairingError || err instanceof Error
          ? err.message
          : 'Could not accept the request.',
      );
    } finally {
      setBusyUid(null);
    }
  };

  const decline = async (request: ConnectionRequest) => {
    setBusyUid(request.fromUid);
    try {
      await declineConnectionRequest(request.fromUid, request.toUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline the request.');
    } finally {
      setBusyUid(null);
    }
  };

  const cancel = async (request: ConnectionRequest) => {
    setBusyUid(request.toUid);
    try {
      await cancelConnectionRequest(request.fromUid, request.toUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the request.');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 pb-16">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              name={profile.displayName}
              colorId={profile.themeColor}
              photoURL={profile.photoURL}
              size={44}
            />
            <div className="min-w-0">
              <h1
                className={`text-lg font-black truncate ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}
              >
                {profile.displayName}
              </h1>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText(isDarkMode)}`}>
                Not connected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleDarkMode}
              aria-label="Toggle dark mode"
              className={`p-2 rounded-xl transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
              }`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              className={`p-2 rounded-xl transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 text-gray-400 hover:text-red-400'
                  : 'bg-white text-gray-500 hover:text-red-500 border border-gray-100'
              }`}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <SetupSteps current={2} colorId={profile.themeColor} isDarkMode={isDarkMode} />

        {/* Explainer */}
        <div
          className="rounded-3xl p-5 md:p-6"
          style={{ backgroundColor: withAlpha(theme.primary, 0.1) }}
        >
          <h2
            className={`text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            <Users size={22} style={{ color: theme.primary }} />
            Find your partner
          </h2>
          <p className={`text-xs md:text-sm font-medium mt-1 ${mutedText(isDarkMode)}`}>
            Search for your accountability partner by their email address, send a request,
            and your shared dashboard opens as soon as they accept. LifeTrack is built for
            two — you can disconnect and pair with someone else at any time.
          </p>
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Requests for you
            </h3>
            {incoming.map((request) => (
              <div
                key={request.id}
                className={`rounded-2xl p-4 flex items-center gap-3 ${card(isDarkMode)}`}
              >
                <Avatar name={request.fromName} colorId={request.fromColor} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={`font-bold text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    {request.fromName}
                  </p>
                  <p className={`text-[11px] truncate ${mutedText(isDarkMode)}`}>
                    {request.fromEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => accept(request)}
                    disabled={busyUid === request.fromUid}
                    aria-label={`Accept request from ${request.fromName}`}
                    className="p-2 rounded-xl bg-emerald-500 text-white shadow transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {busyUid === request.fromUid ? <Spinner size={16} /> : <Check size={16} strokeWidth={3} />}
                  </button>
                  <button
                    onClick={() => decline(request)}
                    disabled={busyUid === request.fromUid}
                    aria-label={`Decline request from ${request.fromName}`}
                    className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${
                      isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:text-red-400'
                        : 'bg-gray-100 text-gray-500 hover:text-red-500'
                    }`}
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Waiting on them
            </h3>
            {outgoing.map((request) => (
              <div
                key={request.id}
                className={`rounded-2xl p-4 flex items-center gap-3 ${card(isDarkMode)}`}
              >
                <Clock size={18} className="text-gray-400 shrink-0" />
                <p className={`flex-1 text-sm font-bold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {request.toName || 'Pending request'}
                </p>
                <button
                  onClick={() => cancel(request)}
                  disabled={busyUid === request.toUid}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:text-red-400'
                      : 'bg-gray-100 text-gray-500 hover:text-red-500'
                  }`}
                >
                  Cancel
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Search */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Search by email
          </h3>
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              type="search"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="partner@example.com"
              aria-label="Search for a partner by email address or name"
              className={inputClass(isDarkMode)}
            />
            <ThemeButton colorId={profile.themeColor} type="submit" disabled={searching}>
              {searching ? <Spinner size={16} /> : <Search size={16} />}
            </ThemeButton>
          </form>
          <p className={`text-[10px] font-semibold ${mutedText(isDarkMode)}`}>
            Their name works too. Both match from the beginning, so "grace@" finds
            grace@example.com.
          </p>

          <ErrorNote message={error} />
          {notice && (
            <p className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2">
              {notice}
            </p>
          )}

          {results !== null && results.length === 0 && !searching && (
            <div className={`text-center py-8 space-y-1 ${mutedText(isDarkMode)}`}>
              <p className="text-sm italic">Nobody matched "{term.trim()}".</p>
              <p className="text-[11px]">
                They need a LifeTrack account before you can connect — ask them to sign up
                with this email first.
              </p>
            </div>
          )}

          {results?.map((result) => {
            const alreadyAsked = pendingTo.has(result.uid);
            return (
              <div
                key={result.uid}
                className={`rounded-2xl p-4 flex items-center gap-3 ${card(isDarkMode)}`}
              >
                <Avatar
                  name={result.displayName}
                  colorId={result.themeColor}
                  photoURL={result.photoURL}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className={`font-bold text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    {result.displayName}
                  </p>
                  <p className={`text-[11px] truncate ${mutedText(isDarkMode)}`}>
                    {result.unavailable ? 'Already in a pair' : result.email}
                  </p>
                </div>
                <button
                  onClick={() => invite(result)}
                  disabled={result.unavailable || alreadyAsked || busyUid === result.uid}
                  className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
                    isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-900 text-white'
                  }`}
                >
                  {busyUid === result.uid ? <Spinner size={12} /> : <UserPlus size={12} />}
                  {alreadyAsked ? 'Sent' : 'Connect'}
                </button>
              </div>
            );
          })}
        </section>
      </div>

      {/* Colour clash resolution */}
      <AnimatePresence>
        {colorClash && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setColorClash(null)}
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
              <div>
                <h3 className={`text-lg font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Pick a new colour
                </h3>
                <p className={`text-xs font-medium mt-1 ${mutedText(isDarkMode)}`}>
                  {colorClash.fromName} uses the same colour as you. Choose another one to
                  connect.
                </p>
              </div>

              <ColorPicker
                value={newColor}
                onChange={setNewColor}
                takenColor={colorClash.fromColor}
                takenLabel={colorClash.fromName}
                isDarkMode={isDarkMode}
              />

              <ErrorNote message={error} />

              <div className="flex gap-3">
                <button
                  onClick={() => setColorClash(null)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <ThemeButton
                  colorId={newColor}
                  className="flex-1"
                  disabled={newColor === colorClash.fromColor || busyUid !== null}
                  onClick={() => accept(colorClash, newColor)}
                >
                  <span className="flex items-center justify-center gap-2">
                    {busyUid !== null && <Spinner size={14} />}
                    Connect
                  </span>
                </ThemeButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
