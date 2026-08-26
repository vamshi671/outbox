export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Email {
  id: string;
  to: string;
  subject: string;
  body: string;
  sender: string;
  status: 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string;
  failedReason?: string;
  createdAt: string;
}
