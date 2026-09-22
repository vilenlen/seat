import React, { useEffect } from 'react';
import { useLibraryStore } from '../stores/library.store';
import { Header } from '@components/Header';
import { Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LibraryPage() {
  const store = useLibraryStore();

  useEffect(() => {
    store.initData();
  }, []);

  const getAvatarColor = (colorClass: string) => {
    const map: Record<string, string> = {
      'hue-210': 'bg-brand-accent-sky',
      'hue-150': 'bg-brand-accent-mint',
      'hue-320': 'bg-brand-accent-peach',
      'hue-40': 'bg-brand-accent-mint', // Fallback
      'hue-280': 'bg-brand-accent-lavender',
      'hue-180': 'bg-status-success',
      'hue-0': 'bg-surface-hover',
    };
    return map[colorClass] || 'bg-surface-hover';
  };

  const getFilteredRoles = () => {
    if (!store.activeGroupId) return store.roles;
    if (store.activeGroupId === 'unassigned') {
      return store.roles.filter(r => !r.groupId);
    }
    return store.roles.filter(r => r.groupId === store.activeGroupId);
  };

  const filteredRoles = getFilteredRoles();

  return (
    <div className="min-h-screen bg-surface-canvas font-body text-text-primary antialiased">
      <Header active="library" />
      
      <main className="max-w-[1200px] mx-auto px-comfortable py-stack-md flex gap-loose items-start">
        
        {/* Left Sidebar - Groups */}
        <aside className="w-[220px] shrink-0 flex flex-col gap-snug sticky top-stack-md">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-caption font-bold text-text-muted uppercase tracking-wider">分组管理</h2>
          </div>
          
          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => store.setActiveGroup(null)}
              className={`flex items-center justify-between px-snug py-2 rounded-card text-body transition-colors ${
                store.activeGroupId === null ? 'bg-surface-card border border-border-strong shadow-sm font-medium' : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span>全部角色</span>
              <span className="text-caption text-text-muted bg-border-subtle px-1.5 rounded">{store.roles.length}</span>
            </button>
            
            {store.groups.map(g => {
              const count = store.roles.filter(r => r.groupId === g.id).length;
              const isActive = store.activeGroupId === g.id;
              return (
                <button 
                  key={g.id}
                  onClick={() => store.setActiveGroup(g.id)}
                  className={`group flex items-center justify-between px-snug py-2 rounded-card text-body transition-colors ${
                    isActive ? 'bg-surface-card border border-border-strong shadow-sm font-medium' : 'hover:bg-surface-hover text-text-secondary border border-transparent'
                  }`}
                >
                  <span className="truncate pr-2">{g.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-caption transition-opacity ${isActive ? 'text-text-secondary' : 'text-text-muted'} bg-border-subtle px-1.5 rounded group-hover:hidden`}>
                      {count}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1 text-text-muted">
                       <button onClick={() => {}} className="p-1 hover:text-brand-primary"><Edit2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                </button>
              );
            })}

            <button 
              onClick={() => store.setActiveGroup('unassigned')}
              className={`flex items-center justify-between px-snug py-2 rounded-card text-body transition-colors ${
                store.activeGroupId === 'unassigned' ? 'bg-surface-card border border-border-strong shadow-sm font-medium' : 'hover:bg-surface-hover text-text-secondary border border-transparent'
              }`}
            >
              <span>未分组</span>
              <span className="text-caption text-text-muted bg-border-subtle px-1.5 rounded">
                {store.roles.filter(r => !r.groupId).length}
              </span>
            </button>
          </nav>

          <button onClick={() => {}} className="flex items-center gap-tight px-snug py-2 text-body text-brand-primary hover:bg-brand-accent-sky/20 rounded-card transition-colors mt-2">
             <Plus className="w-4 h-4" /> 新建分组
          </button>
        </aside>

        {/* Right Content - Grid */}
        <section className="flex-1 min-w-0 flex flex-col gap-stack-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-h2 font-zh text-text-primary">
              {store.activeGroupId === null ? '全部角色' : 
               store.activeGroupId === 'unassigned' ? '未分组' : 
               store.groups.find(g => g.id === store.activeGroupId)?.name || ''}
            </h1>
            <button onClick={() => {}} className="flex items-center gap-tight px-base py-2 bg-brand-primary text-text-on-dark rounded-button shadow-sm hover:bg-black transition-colors">
              <Plus className="w-4 h-4" /> 新建角色
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-comfortable">
            {filteredRoles.map(role => {
               const group = store.groups.find(g => g.id === role.groupId);
               return (
                 <div key={role.id} className="group relative bg-surface-card rounded-card border border-border-subtle shadow-card-soft hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col h-[280px]">
                    {/* Top Color Area */}
                    <div className={`h-24 ${getAvatarColor(role.color)} opacity-50 w-full shrink-0 relative`}>
                       {/* Floating actions */}
                       <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => {}} className="p-1.5 bg-surface-card/80 backdrop-blur rounded hover:bg-surface-card text-text-secondary">
                             <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => {}} className="p-1.5 bg-surface-card/80 backdrop-blur rounded hover:bg-status-error hover:text-white text-text-secondary transition-colors">
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                    
                    {/* Content */}
                    <div className="px-comfortable pb-comfortable pt-2 flex-1 flex flex-col">
                       {/* Avatar overlapping border */}
                       <div className={`w-14 h-14 rounded-full flex items-center justify-center text-h3 font-bold text-text-primary ${getAvatarColor(role.color)} border-4 border-surface-card -mt-10 mb-2 shadow-sm`}>
                         {role.name[0]}
                       </div>
                       
                       <div className="mb-2">
                         <div className="text-h3 font-zh leading-tight mb-1">{role.name}</div>
                         <div className="text-caption text-text-secondary flex items-center gap-2">
                           {role.duty}
                           {group && (
                             <span className="bg-surface-canvas border border-border-subtle px-1.5 py-0.5 rounded text-[11px]">
                               {group.name}
                             </span>
                           )}
                         </div>
                       </div>
                       
                       <div className="mt-auto flex flex-col gap-1">
                          <p className="text-caption text-text-muted line-clamp-2">
                            <span className="font-medium">性格：</span>{role.personality}
                          </p>
                       </div>
                    </div>
                 </div>
               )
            })}

            {/* Add New Card Placeholder */}
            <button onClick={() => {}} className="h-[280px] bg-surface-canvas border-2 border-dashed border-border-strong rounded-card flex flex-col items-center justify-center gap-snug text-text-muted hover:text-brand-primary hover:border-brand-primary hover:bg-brand-accent-sky/5 transition-colors">
               <div className="w-12 h-12 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center shadow-sm">
                 <Plus className="w-6 h-6" />
               </div>
               <span className="font-medium text-body">新建角色</span>
            </button>
          </div>
        </section>
        
      </main>
    </div>
  );
}
