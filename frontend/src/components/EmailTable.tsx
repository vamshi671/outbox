import { Email } from '../types';

interface EmailTableProps {
  emails: Email[];
  loading: boolean;
  type: 'scheduled' | 'sent';
}

export function EmailTable({ emails, loading, type }: EmailTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No {type} emails yet</p>
        <p className="text-sm mt-1">Schedule some emails to see them here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">{type === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {emails.map((email) => (
            <tr key={email.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{email.to}</td>
              <td className="px-4 py-3 text-gray-600">{email.subject}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(type === 'scheduled' ? email.scheduledAt : email.sentAt || email.scheduledAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={email.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: Email['status'] }) {
  const styles: Record<string, string> = {
    SCHEDULED: 'bg-yellow-100 text-yellow-800',
    QUEUED: 'bg-blue-100 text-blue-800',
    SENDING: 'bg-purple-100 text-purple-800',
    SENT: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
      {status}
    </span>
  );
}
