
export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  title: string;
  revenue: number;
  timeTaken: number;
  roi: number;
  priority: Priority;
  status: Status;
  notes: string;
  createdAt: number;
}

export interface AppState {
  tasks: Task[];
  lastDeletedTask: Task | null;
  isUndoVisible: boolean;
  isLoading: boolean;
}

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  'High': 3,
  'Medium': 2,
  'Low': 1
};
