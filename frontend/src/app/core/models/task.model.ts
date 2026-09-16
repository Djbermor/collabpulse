export type TaskStatus = 'Pending' | 'InProgress' | 'Completed' | 'Postponed';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskItem {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  assigneeId?: string;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  creator: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  tenantId: string;
  workspaceId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrenceRule?: string;
  organizerId: string;
  organizerName?: string;
  attendees: {
    userId: string;
    fullName: string;
    email: string;
    status: 'Accepted' | 'Declined' | 'Pending';
  }[];
  createdAt: string;
}

export type MeetingProvider = 'Internal' | 'LiveKit' | 'Zoom' | 'GoogleMeet';
export type MeetingStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';

export interface Meeting {
  id: string;
  tenantId: string;
  workspaceId: string;
  channelId?: string;
  title: string;
  provider: MeetingProvider;
  status: MeetingStatus;
  roomId: string;
  passcode?: string;
  joinUrl: string;
  hostId: string;
  hostName?: string;
  scheduledStartTime: string;
  actualStartTime?: string;
  endedAt?: string;
  participantCount: number;
  createdAt: string;
}
