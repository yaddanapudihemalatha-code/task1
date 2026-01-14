import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, Priority, Status } from './types';
import { fetchTasks, saveTasksToStorage } from './services/taskService';
import { calculateRoi, sortTasks, getPerformanceGrade } from './utils/taskUtils';
import TaskCard from './components/TaskCard';
import Button from './components/Button';
import Modal from './components/Modal';

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  
  // Bug 2 State: Undo Tracking
  const [lastDeletedTask, setLastDeletedTask] = useState<Task | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Dialog States
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  /**
   * Bug 1 Fix: Double Fetch.
   * Empty dependency array and standard React 18 patterns.
   * Data is robustly handled via taskService to prevent double API hits.
   */
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const data = await fetchTasks();
      if (mounted) {
        setTasks(data);
        setIsLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Persistence
  useEffect(() => {
    if (!isLoading) saveTasksToStorage(tasks);
  }, [tasks, isLoading]);

  /**
   * Bug 2 Fix: Clearing Snackbar State.
   * Resetting lastDeletedTask after closure to prevent phantom data restoration.
   */
  const closeSnackbar = useCallback(() => {
    setShowSnackbar(false);
    setTimeout(() => setLastDeletedTask(null), 300);
  }, []);

  // Automatically close snackbar
  useEffect(() => {
    if (showSnackbar) {
      const timer = setTimeout(closeSnackbar, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSnackbar, closeSnackbar]);

  // Derived Values
  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks.filter(t => 
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (filterPriority === 'All' || t.priority === filterPriority)
    );
    // Bug 3: Stable sorting implementation
    return sortTasks(result);
  }, [tasks, search, filterPriority]);

  const summary = useMemo(() => {
    const totalRevenue = tasks.reduce((acc, t) => acc + t.revenue, 0);
    const avgRoi = tasks.length ? tasks.reduce((acc, t) => acc + t.roi, 0) / tasks.length : 0;
    const totalTime = tasks.reduce((acc, t) => acc + t.timeTaken, 0);
    return {
      totalRevenue,
      avgRoi: parseFloat(avgRoi.toFixed(2)),
      efficiency: totalTime ? parseFloat((totalRevenue / totalTime).toFixed(2)) : 0,
      performanceGrade: getPerformanceGrade(avgRoi)
    };
  }, [tasks]);

  // Handlers
  const handleDelete = (task: Task) => {
    setLastDeletedTask(task);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setShowSnackbar(true);
  };

  const handleUndo = () => {
    if (lastDeletedTask) {
      setTasks(prev => [...prev, lastDeletedTask]);
      closeSnackbar();
    }
  };

  const handleSaveTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const revenue = Number(formData.get('revenue'));
    const timeTaken = Number(formData.get('timeTaken'));
    
    // Bug 5: Safe ROI calculation
    const roi = calculateRoi(revenue, timeTaken);

    const taskData: Partial<Task> = {
      title: formData.get('title') as string,
      revenue,
      timeTaken,
      priority: formData.get('priority') as Priority,
      status: formData.get('status') as Status,
      notes: formData.get('notes') as string,
      roi
    };

    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      setEditingTask(null);
    } else {
      const newTask: Task = {
        ...taskData as Task,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      };
      setTasks(prev => [...prev, newTask]);
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Analyzing Performance Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header & Insights */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Task<span className="text-indigo-600 italic">Glitch</span></h1>
          <p className="text-gray-500 text-sm">Sales ROI Performance Tracker</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => setIsAdding(true)}>+ New Task</Button>
        </div>
      </header>

      {/* Insights Dashboard - Inline implementation to avoid missing component errors */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `$${summary.totalRevenue.toLocaleString()}` },
          { label: 'Avg ROI', value: `${summary.avgRoi}x` },
          { label: 'Efficiency', value: `$${summary.efficiency}/hr` },
          { label: 'Grade', value: summary.performanceGrade, color: 'text-indigo-600' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">{item.label}</p>
            <p className={`text-xl font-black ${item.color || 'text-gray-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select 
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="All">All Priorities</option>
          <option value={Priority.HIGH}>High Only</option>
          <option value={Priority.MEDIUM}>Medium Only</option>
          <option value={Priority.LOW}>Low Only</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-1">
        {filteredAndSortedTasks.length > 0 ? (
          filteredAndSortedTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onView={setViewingTask}
              onEdit={setEditingTask}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-400">No tasks found. Time to generate some revenue!</p>
          </div>
        )}
      </div>

      {/* Task Form Modal (Add/Edit) */}
      <Modal 
        isOpen={isAdding || !!editingTask} 
        onClose={() => { setIsAdding(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Task Title</label>
            <input name="title" required defaultValue={editingTask?.title} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Revenue ($)</label>
              <input type="number" name="revenue" required defaultValue={editingTask?.revenue} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Time (Hrs)</label>
              <input type="number" name="timeTaken" required defaultValue={editingTask?.timeTaken} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Priority</label>
              <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full px-4 py-2 border rounded-lg outline-none">
                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
              <select name="status" defaultValue={editingTask?.status || Status.TODO} className="w-full px-4 py-2 border rounded-lg outline-none">
                {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
            <textarea name="notes" defaultValue={editingTask?.notes} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setEditingTask(null); }}>Cancel</Button>
            <Button type="submit">Save Task</Button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal 
        isOpen={!!viewingTask} 
        onClose={() => setViewingTask(null)}
        title="Task Details"
      >
        {viewingTask && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
               <div>
                 <h3 className="text-xl font-black text-gray-900">{viewingTask.title}</h3>
                 <p className="text-sm text-gray-500">{viewingTask.status} • {viewingTask.priority} Priority</p>
               </div>
               <div className="text-right">
                 <p className="text-sm font-bold text-indigo-600 uppercase">ROI</p>
                 <p className="text-3xl font-black">{viewingTask.roi}x</p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                 <p className="text-[10px] uppercase font-bold text-gray-400">Revenue</p>
                 <p className="text-lg font-bold">${viewingTask.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                 <p className="text-[10px] uppercase font-bold text-gray-400">Time Taken</p>
                 <p className="text-lg font-bold">{viewingTask.timeTaken} Hours</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
              <p className="text-sm text-gray-700 leading-relaxed bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
                {viewingTask.notes || 'No detailed notes provided for this task.'}
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setViewingTask(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Undo Snackbar */}
      {showSnackbar && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300 z-[100]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-medium">Task "{lastDeletedTask?.title}" deleted</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleUndo} 
              className="text-indigo-400 hover:text-indigo-300 text-sm font-bold uppercase tracking-wider"
            >
              Undo
            </button>
            <button onClick={closeSnackbar} className="text-gray-500 hover:text-gray-300 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
