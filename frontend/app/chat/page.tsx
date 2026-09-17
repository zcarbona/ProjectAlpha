'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/RoleGuard';

interface ChatMessage {
  id: number;
  fromDriver: boolean;
  text: string;
  time: string;
  suggestions?: string[];
}

const FAQ_DATA = [
  { q: 'Where is my truck?', a: 'I am on my way! ETA: 8 minutes 🚛' },
  { q: 'Can I change the address?', a: 'Yes, contact your driver directly. خدمه عملاد 01555444333' },
  { q: 'What is the price?', a: 'Final price: 2,450 EGP. The driver will confirm on arrival.' },
  { q: 'Need packing help?', a: 'My team can help with packing. خدمه عملاد 015555444333' },
  { q: 'Cancel request?', a: 'You can cancel free of charge up to 10 minutes after booking.' },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, fromDriver: true, text: 'Hello! I am Ahmad. How can I help you with your truck request?', time: '9:30 AM' },
  { id: 2, fromDriver: true, text: 'I am waiting for your pickup. Please let me know if you need anything!', time: '9:32 AM' },
];

function ChatPageContent() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [showFaq, setShowFaq] = useState(true);
  const { token } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now(),
      fromDriver: false,
      text: text.trim(),
      time: 'Now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setShowFaq(false);

    const suggestionTexts = FAQ_DATA.slice(0, 3).map((f) => f.q);
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        fromDriver: true,
        text: 'I will get back to you shortly. Meanwhile, you can call خدمه عملاد 01555444333.',
        time: 'Now',
        suggestions: suggestionTexts,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 800);
  };

  const askFaq = (faq: { q: string; a: string }) => {
    const otherFaqs = FAQ_DATA.filter((f) => f.q !== faq.q).slice(0, 3);
    const suggestions = otherFaqs.map((f) => f.q);

    const userMsg: ChatMessage = {
      id: Date.now(),
      fromDriver: false,
      text: faq.q,
      time: 'Now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setShowFaq(false);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        fromDriver: true,
        text: faq.a,
        time: 'Now',
        suggestions,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="border-b border-gray-200 p-4 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#ffebee', color: '#e53935' }}>
            AR
          </div>
          <div>
            <div className="font-semibold text-gray-900">Ahmad Al-Rashid</div>
            <div className="text-sm text-red-600">Online · Driver</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div
                className={`flex ${msg.fromDriver ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                    msg.fromDriver
                      ? 'bg-gray-100 text-gray-900 rounded-bl-none'
                      : 'text-white rounded-br-none'
                  }`}
                  style={{
                    background: msg.fromDriver ? '#f4f4f5' : '#e53935',
                  }}
                >
                  {msg.text}
                </div>
              </div>
              {msg.fromDriver && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 ml-2">
                  {msg.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const faq = FAQ_DATA.find((f) => f.q === sug);
                        if (faq) askFaq(faq);
                        else sendMessage(sug);
                      }}
                      className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {showFaq && (
        <div className="border-t border-gray-200 p-3 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {FAQ_DATA.map((faq, i) => (
                <button
                  key={i}
                  onClick={() => askFaq(faq)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {faq.q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendMessage(input);
                setInput('');
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-1"
            style={{ borderColor: '#e53935', '--tw-ring-color': '#e53935' } as React.CSSProperties}
          />
          <button
            onClick={() => {
              sendMessage(input);
              setInput('');
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: '#e53935' }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <ChatPageContent />
    </RoleGuard>
  );
}
