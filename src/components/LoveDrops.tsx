import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Trash2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types';
import { format, parseISO } from 'date-fns';

interface LoveDropsProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, sender: 'grace' | 'tanga') => void;
  onDeleteMessage: (id: string) => void;
  isDarkMode: boolean;
}

export default function LoveDrops({ messages, onSendMessage, onDeleteMessage, isDarkMode }: LoveDropsProps) {
  const [inputText, setInputText] = useState('');
  const [showSenderPrompt, setShowSenderPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendClick = () => {
    if (!inputText.trim()) return;
    setShowSenderPrompt(true);
  };

  const selectSenderAndSend = (sender: 'grace' | 'tanga') => {
    onSendMessage(inputText.trim(), sender);
    setInputText('');
    setShowSenderPrompt(false);
  };

  return (
    <div className={`h-full w-full flex flex-col font-sans transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Chat Header */}
      <header className={`p-4 md:p-6 border-b flex items-center justify-between transition-colors duration-300 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Heart size={24} className="text-pink-500 fill-pink-500" />
            Love Drops
            <span className="text-pink-500 text-xs lowercase animate-pulse">● live</span>
          </h2>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Grace & Tanga's Little Notes</p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <User size={48} className="mb-2" />
            <p className="text-sm font-bold uppercase tracking-widest text-center">No drops yet.<br/>Send a little love.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.sender === 'grace' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] md:max-w-[60%] group relative`}>
                <div 
                  className={`
                    p-3 md:p-4 rounded-2xl shadow-sm text-sm md:text-base font-medium break-words
                    ${msg.sender === 'grace' 
                      ? 'bg-pink-500 text-white rounded-tr-none' 
                      : 'bg-blue-500 text-white rounded-tl-none'}
                  `}
                >
                  {msg.text}
                </div>
                <div className={`mt-1 flex items-center gap-2 ${msg.sender === 'grace' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {msg.sender} • {format(parseISO(msg.timestamp), 'h:mm a')}
                  </span>
                  <button 
                    onClick={() => onDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`p-4 md:p-6 transition-colors duration-300 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
        <div className="max-w-4xl mx-auto flex items-center gap-2 md:gap-4">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendClick()}
            placeholder="Type a love drop..."
            className={`flex-1 p-3 md:p-4 rounded-2xl border-2 outline-none transition-all ${
              isDarkMode 
                ? 'bg-gray-900 border-gray-700 text-white focus:border-pink-500' 
                : 'bg-gray-50 border-gray-100 text-gray-800 focus:border-pink-500'
            }`}
          />
          <button 
            onClick={handleSendClick}
            disabled={!inputText.trim()}
            className="p-3 md:p-4 bg-pink-500 text-white rounded-2xl shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Sender Selection Prompt */}
      <AnimatePresence>
        {showSenderPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSenderPrompt(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center transition-colors duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <h3 className="text-xl font-black uppercase tracking-widest mb-2">Who is sending this?</h3>
              <p className={`text-xs font-bold mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>CHOOSE YOUR IDENTITY</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => selectSenderAndSend('grace')}
                  className="group relative h-32 flex flex-col items-center justify-center bg-pink-500 text-white rounded-3xl shadow-lg shadow-pink-500/20 hover:scale-105 transition-transform"
                >
                  <User size={32} className="mb-2" />
                  <span className="font-black uppercase tracking-widest">Grace</span>
                </button>
                <button 
                  onClick={() => selectSenderAndSend('tanga')}
                  className="group relative h-32 flex flex-col items-center justify-center bg-blue-500 text-white rounded-3xl shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform"
                >
                  <User size={32} className="mb-2" />
                  <span className="font-black uppercase tracking-widest">Tanga</span>
                </button>
              </div>
              
              <button 
                onClick={() => setShowSenderPrompt(false)}
                className={`mt-6 text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hover:text-red-500 transition-colors`}
              >
                Cancel Send
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
