
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Task, AppState, Priority, Status } from './types';
import { generateId, sortTasks, exportTasksToCSV, calculateROI } from './utils/helpers';
import SummaryCards from './components/SummaryCards';
import TaskCard from './components/TaskCard';
import TaskDialog from './components/TaskDialog';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tasks: [],
    lastDeletedTask: null,
    isUndoVisible: false,
    isLoading: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'All'>('All');
  const [filterPriority, setFilterPriority] = useState<Priority | 'All'>('All');
  
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'add' | 'edit' | 'view';
    selectedTask: Task | null;
  }>({
    isOpen: false,
    type: 'add',
    selectedTask: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * BUG 1 FIX: Use a ref to prevent double-initialization in StrictMode.
   */
  const isFetched = useRef(false);

  useEffect(() => {
    if (isFetched.current) return;
    isFetched.current = true;

    const loadTasks = () => {
      const saved = localStorage.getItem('task_glitch_v3');
      if (saved) {
        setState(prev => ({ ...prev, tasks: JSON.parse(saved), isLoading: false }));
      } else {
        const initialTasks: Task[] = [
          { id: generateId(), title: 'Enterprise Sales Deck', revenue: 15000, timeTaken: 20, roi: 750, priority: 'High', status: 'In Progress', notes: 'Key account review.', createdAt: Date.now() },
          { id: generateId(), title: 'Lead Outreach Phase 1', revenue: 2500, timeTaken: 10, roi: 250, priority: 'Medium', status: 'Completed', notes: 'Standard outreach.', createdAt: Date.now() - 5000 },
          { id: generateId(), title: 'Admin & Reporting', revenue: 0, timeTaken: 5, roi: 0, priority: 'Low', status: 'Pending', notes: 'Monthly cleanup.', createdAt: Date.now() - 10000 },
        ];
        setState(prev => ({ ...prev, tasks: initialTasks, isLoading: false }));
      }
    };

    // Simulate network delay for a better UX feel
    setTimeout(loadTasks, 600);
  }, []);

  useEffect(() => {
    if (!state.isLoading) {
      localStorage.setItem('task_glitch_v3', JSON.stringify(state.tasks));
    }
  }, [state.tasks, state.isLoading]);

  /**
   * BUG 2 FIX: Reset lastDeletedTask state when snackbar closes.
   */
  const closeUndoSnackbar = useCallback(() => {
    setState(prev => ({
      ...prev,
      isUndoVisible: false,
      lastDeletedTask: null
    }));
  }, []);

  useEffect(() => {
    if (state.isUndoVisible) {
      const timer = setTimeout(closeUndoSnackbar, 6000);
      return () => clearTimeout(timer);
    }
  }, [state.isUndoVisible, closeUndoSnackbar]);

  const addTask = (data: Partial<Task>) => {
    const newTask: Task = {
      id: generateId(),
      createdAt: Date.now(),
      title: data.title || 'New Task',
      revenue: data.revenue || 0,
      timeTaken: data.timeTaken || 0,
      roi: data.roi || 0,
      priority: data.priority || 'Low',
      status: data.status || 'Pending',
      notes: data.notes || '',
    };
    setState(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const updateTask = (data: Partial<Task>) => {
    if (!dialogConfig.selectedTask) return;
    const updatedTasks = state.tasks.map(t => 
      t.id === dialogConfig.selectedTask?.id ? { ...t, ...data } : t
    );
    setState(prev => ({ ...prev, tasks: updatedTasks }));
    setDialogConfig({ ...dialogConfig, isOpen: false, selectedTask: null });
  };

  const deleteTask = (task: Task) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== task.id),
      lastDeletedTask: task,
      isUndoVisible: true,
    }));
  };

  const undoDelete = () => {
    if (state.lastDeletedTask) {
      setState(prev => ({
        ...prev,
        tasks: [...prev.tasks, prev.lastDeletedTask!],
        lastDeletedTask: null,
        isUndoVisible: false,
      }));
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newTasks: Task[] = [];
      
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple comma split (doesn't handle quoted commas for simplicity here)
        const parts = line.split(',');
        if (parts.length >= 6) {
          const rev = parseFloat(parts[1]) || 0;
          const time = parseFloat(parts[2]) || 0;
          newTasks.push({
            id: generateId(),
            title: parts[0].replace(/"/g, ''),
            revenue: rev,
            timeTaken: time,
            roi: calculateROI(rev, time),
            priority: (parts[4] as Priority) || 'Low',
            status: (parts[5] as Status) || 'Pending',
            notes: (parts[6] || '').replace(/"/g, ''),
            createdAt: Date.now() - (i * 1000)
          });
        }
      }
      if (newTasks.length > 0) {
        setState(prev => ({ ...prev, tasks: [...newTasks, ...prev.tasks] }));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayTasks = useMemo(() => {
    let filtered = state.tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
      const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    // BUG 3 FIX: Stable sorting applied in useMemo
    return sortTasks(filtered);
  }, [state.tasks, searchQuery, filterStatus, filterPriority]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Task<span className="text-indigo-600">Glitch</span></span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportTasksToCSV(state.tasks)}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Import
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv" />
            
            <button 
              onClick={() => setDialogConfig({ isOpen: true, type: 'add', selectedTask: null })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              New Task
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {state.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium tracking-wide uppercase text-xs">Loading Workspace...</p>
          </div>
        ) : (
          <>
            <SummaryCards tasks={state.tasks} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative group">
                  <svg className="w-5 h-5 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Search by title or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 lg:pb-0">
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as Status | 'All')}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">Doing</option>
                    <option value="Completed">Done</option>
                  </select>
                  <select 
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as Priority | 'All')}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="All">All Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {displayTasks.length > 0 ? (
                displayTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onView={(t) => setDialogConfig({ isOpen: true, type: 'view', selectedTask: t })}
                    onEdit={(t) => setDialogConfig({ isOpen: true, type: 'edit', selectedTask: t })}
                    onDelete={deleteTask}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="bg-slate-50 p-6 rounded-full mb-4">
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-700">No matching tasks</h3>
                  <p className="text-slate-400 mt-1">Try adjusting your filters or search query.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* BUG 2 FIX: Unified snackbar logic */}
      {state.isUndoVisible && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="font-medium text-sm">Task moved to trash</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={undoDelete}
              className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors text-sm uppercase tracking-widest px-2"
            >
              Undo
            </button>
            <button onClick={closeUndoSnackbar} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* BUG 4 FIX: Dialog state management */}
      <TaskDialog
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        task={dialogConfig.selectedTask}
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false, selectedTask: null })}
        onSubmit={dialogConfig.type === 'add' ? addTask : updateTask}
      />
    </div>
  );
};

export default App;
