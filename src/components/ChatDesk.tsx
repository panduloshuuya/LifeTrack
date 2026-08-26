// The pair's chat. The sender is always the signed-in user, and each side is
// bubbled in their own theme colour.

import React, { useEffect, useRef, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getTheme, readableOn } from '../theme';
import { ChatMessage, UserProfile } from '../types';
import { mutedText } from './ui';

interface ChatDeskProps {
  messages: ChatMessage[];
  me: UserProfile;
  partner: UserProfile;
  onSend: (text: string) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

export default function ChatDesk({
  messages,
  me,
  partner,
  onSend,
  onDelete,
  isDarkMode,
}: ChatDeskProps) {
  const [inputText, setInputText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myTheme = getTheme(me.themeColor);
  const partnerTheme = getTheme(partner.themeColor);

  const send = () => {
    const text = inputText.trim();
    if (!text) return;
    onSend(text);
    setInputText('');
  };

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <header
        className={`p-4 md:p-6 border-b ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <h2
          className={`text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}
        >
          <MessageSquare size={24} style={{ color: myTheme.primary }} />
          ChatDesk
        </h2>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${mutedText(isDarkMode)}`}>
          Accountability pit stop with {partner.displayName}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center ${mutedText(isDarkMode)}`}>
            <MessageSquare size={48} className="mb-2 opacity-30" />
            <p className="text-sm font-bold uppercase tracking-widest text-center opacity-60">
              No messages yet.
              <br />
              Start the conversation.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === me.uid;
            const author = mine ? me : partner;
            const theme = mine ? myTheme : partnerTheme;
            const stamp = parseISO(message.timestamp);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[80%] md:max-w-[60%] group">
                  <div
                    style={{
                      backgroundColor: theme.primary,
                      color: readableOn(theme.primary),
                    }}
                    className={`p-3 md:p-4 rounded-2xl shadow-sm text-sm md:text-base font-medium break-words ${
                      mine ? 'rounded-tr-none' : 'rounded-tl-none'
                    }`}
                  >
                    {message.text}
                  </div>
                  <div
                    className={`mt-1 flex items-center gap-2 ${
                      mine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest ${mutedText(
                        isDarkMode,
                      )}`}
                    >
                      {author.displayName}
                      {isValid(stamp) ? ` • ${format(stamp, 'h:mm a')}` : ''}
                    </span>
                    {mine && (
                      <button
                        onClick={() => onDelete(message.id)}
                        aria-label="Delete message"
                        className="md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 text-red-500 rounded-full"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className={`p-4 md:p-6 pb-24 md:pb-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
        <div className="max-w-4xl mx-auto flex items-center gap-2 md:gap-4">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder={`Message ${partner.displayName}...`}
            className={`flex-1 p-3 md:p-4 rounded-2xl border-2 outline-none transition-colors ${
              isDarkMode
                ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-600'
                : 'bg-gray-50 border-gray-100 text-gray-800 placeholder:text-gray-400'
            }`}
          />
          <button
            onClick={send}
            disabled={!inputText.trim()}
            aria-label="Send message"
            style={{ backgroundColor: myTheme.primary, color: readableOn(myTheme.primary) }}
            className="p-3 md:p-4 rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
