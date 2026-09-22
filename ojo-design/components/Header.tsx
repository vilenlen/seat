import React from 'react';
import { User } from 'lucide-react';

interface HeaderProps {
  active: 'setup' | 'library';
}

export function Header({ active }: HeaderProps) {
  return (
    <header className="h-[52px] bg-surface-card border-b border-border-subtle px-comfortable flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-loose">
        <div className="font-zh font-bold text-body-lg tracking-tight text-text-primary flex items-center gap-2">
          <span className="font-bold">Seat 一席</span>
        </div>
        <nav className="flex items-center gap-comfortable">
          <button 
            onClick={() => (window as any).App?.transitionTo('setup')}
            className={`text-body transition-colors ${
              active === 'setup' ? 'text-brand-primary font-medium' : 'text-text-secondary hover:text-brand-primary'
            }`}
          >
            会议设置
          </button>
          <button 
            onClick={() => (window as any).App?.transitionTo('library')}
            className={`text-body transition-colors ${
              active === 'library' ? 'text-brand-primary font-medium' : 'text-text-secondary hover:text-brand-primary'
            }`}
          >
            角色库
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-snug">
        <button className="flex items-center gap-2 px-snug py-1.5 rounded-full hover:bg-surface-hover transition-colors border border-transparent hover:border-border-subtle">
           <div className="w-6 h-6 rounded-full bg-brand-accent-lavender flex items-center justify-center text-caption font-medium text-brand-primary">
             U
           </div>
           <span className="text-caption font-medium text-text-secondary">user@example.com</span>
        </button>
      </div>
    </header>
  );
}
