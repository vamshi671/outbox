import { useState, useEffect, useCallback } from 'react';
import { User, Email } from '../types';
import { api } from '../api';
import { Header } from '../components/Header';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [sent, setSent] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, sentRes] = await Promise.all([
        api.get('/emails/scheduled'),
        api.get('/emails/sent'),
      ]);
      setScheduled(schedRes.data);
      setSent(sentRes.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTab('scheduled')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === 'scheduled' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Scheduled ({scheduled.length})
            </button>
            <button
              onClick={() => setTab('sent')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === 'sent' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sent ({sent.length})
            </button>
          </div>

          <button
            onClick={() => setShowCompose(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Compose New Email
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          {tab === 'scheduled' ? (
            <EmailTable emails={scheduled} loading={loading} type="scheduled" />
          ) : (
            <EmailTable emails={sent} loading={loading} type="sent" />
          )}
        </div>
      </main>

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onSuccess={fetchEmails} />
      )}
    </div>
  );
}
