import React, { useEffect, useState } from 'react';
import { useSetupStore } from '../stores/setup.store';
import { Header } from '@components/Header';
import { Check, Settings, Info, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SetupPage() {
  const store = useSetupStore();

  useEffect(() => {
    store.initData();
  }, []);

  const isFormValid = store.title.trim() !== '' && store.topic.trim() !== '';

  const handleStart = () => {
    if (isFormValid) {
      (window as any).App?.transitionTo('room', {
        title: store.title,
        topic: store.topic,
        selectedRoleIds: store.selectedRoleIds,
      });
    }
  };

  const getAvatarColor = (colorClass: string) => {
    const map: Record<string, string> = {
      'hue-210': 'bg-brand-accent-sky',
      'hue-150': 'bg-brand-accent-mint',
      'hue-320': 'bg-brand-accent-peach',
      'hue-40': 'bg-brand-accent-mint', // Fallback as yellow wasn't in theme
      'hue-280': 'bg-brand-accent-lavender',
      'hue-180': 'bg-status-success',
      'hue-0': 'bg-surface-hover',
    };
    return map[colorClass] || 'bg-surface-hover';
  };

  return (
    <div className="min-h-screen bg-surface-canvas font-body text-text-primary antialiased relative overflow-hidden">
      {/* Background Halos */}
      <div className="absolute inset-0 opacity-40 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [-20, 20, -20], y: [-20, 20, -20] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-brand-accent-lavender rounded-full mix-blend-multiply filter blur-[120px]"
        />
        <motion.div
          animate={{ x: [20, -20, 20], y: [20, -20, 20] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent-peach rounded-full mix-blend-multiply filter blur-[100px]"
        />
      </div>

      <Header active="setup" />

      <main className="relative z-10 max-w-[680px] mx-auto px-comfortable pt-section pb-section-y">
        <div className="mb-stack-md text-center">
          <p className="text-caption text-text-muted font-medium mb-tight uppercase tracking-wider">
            Seat 一席
          </p>
          <h1 className="text-h1 font-zh mb-snug text-text-primary">
            开始一场新会议
          </h1>
          <p className="text-body text-text-secondary">
            选好角色，说清议题，让圆桌转起来
          </p>
        </div>

        <div className="flex flex-col gap-stack-sm bg-surface-card rounded-card border border-border-subtle shadow-card-soft p-comfortable">
          {/* Meeting Info */}
          <div className="flex flex-col gap-snug">
            <h2 className="text-h3 font-zh">会议信息</h2>
            
            <div className="flex flex-col gap-micro">
              <label className="text-caption text-text-secondary">会议标题 *</label>
              <input
                type="text"
                value={store.title}
                onChange={(e) => store.setTitle(e.target.value)}
                placeholder="如「Q3 产品路线复盘」"
                className="px-snug py-tight bg-surface-card border border-border-strong rounded-input text-body placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-micro">
              <label className="text-caption text-text-secondary">核心议题 *</label>
              <input
                type="text"
                value={store.topic}
                onChange={(e) => store.setTopic(e.target.value)}
                placeholder="如「是否延期发布新版本」"
                className="px-snug py-tight bg-surface-card border border-border-strong rounded-input text-body placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-micro">
              <label className="text-caption text-text-secondary">背景说明（选填）</label>
              <textarea
                value={store.background}
                onChange={(e) => store.setBackground(e.target.value)}
                placeholder="关键背景、数据、约束条件"
                rows={3}
                className="px-snug py-tight bg-surface-card border border-border-strong rounded-input text-body placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all resize-none"
              />
            </div>
          </div>

          <hr className="border-border-subtle my-snug" />

          {/* Roles */}
          <div className="flex flex-col gap-snug">
            <div className="flex items-center justify-between">
              <h2 className="text-h3 font-zh">与会角色</h2>
              <button
                onClick={() => (window as any).App?.transitionTo('library')}
                className="text-caption text-text-muted hover:text-text-primary transition-colors flex items-center"
              >
                管理角色库 <ChevronRight className="w-3 h-3 ml-1" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-snug">
              {/* Fixed You Role */}
              <div className="relative rounded-card border-2 border-brand-primary bg-surface-canvas p-snug flex flex-col gap-tight opacity-90">
                <div className="flex items-center gap-tight">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold text-text-primary bg-border-strong`}>
                    你
                  </div>
                  <div>
                    <div className="font-zh font-medium text-body leading-tight">你</div>
                    <div className="text-caption text-text-secondary">主持人</div>
                  </div>
                </div>
                <div className="text-caption text-text-muted mt-auto">固定参会</div>
                <div className="absolute top-snug right-snug w-5 h-5 rounded-full bg-brand-primary text-text-on-dark flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              </div>

              {store.roles.slice(0, 5).map((role) => {
                const isSelected = store.selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    onClick={() => store.toggleRole(role.id)}
                    className={`relative text-left rounded-card border p-snug flex flex-col gap-tight transition-all duration-200 ease-out hover:shadow-sm ${
                      isSelected ? 'border-brand-primary bg-surface-canvas' : 'border-border-subtle bg-surface-card hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-tight">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold text-text-primary ${getAvatarColor(role.color)}`}>
                        {role.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-zh font-medium text-body leading-tight truncate">{role.name}</div>
                        <div className="text-caption text-text-secondary truncate">{role.duty}</div>
                      </div>
                    </div>
                    <div className="text-caption text-text-muted truncate mt-auto">{role.personality}</div>
                    
                    <div className={`absolute top-snug right-snug w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-brand-primary text-text-on-dark' : 'border border-border-strong text-transparent'
                    }`}>
                      <Check className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-border-subtle my-snug" />

          {/* Parameters */}
          <div className="flex flex-col gap-snug">
            <h2 className="text-h3 font-zh">参数配置</h2>
            
            <div className="flex items-center justify-between p-snug bg-surface-canvas rounded-card border border-border-subtle">
              <div className="flex flex-col gap-micro">
                <div className="flex items-center gap-tight">
                  <span className="font-medium text-body">深度思考</span>
                  <Info className="w-4 h-4 text-text-muted" />
                </div>
                <span className="text-caption text-text-secondary">开启后 AI 思考更充分，每轮约 +3s</span>
              </div>
              <button
                role="switch"
                aria-checked={store.deepThinking}
                onClick={() => store.setDeepThinking(!store.deepThinking)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                  store.deepThinking ? 'bg-brand-primary' : 'bg-border-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    store.deepThinking ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-snug bg-surface-canvas rounded-card border border-border-subtle">
              <div className="flex flex-col gap-micro">
                <div className="flex items-center gap-tight">
                  <Settings className="w-4 h-4 text-text-muted" />
                  <span className="font-medium text-body">推理引擎</span>
                </div>
                <span className="text-caption text-text-secondary">托管 AI (gpt-4o-mini)</span>
              </div>
              <button 
                onClick={() => {}} // TODO: implement config modal
                className="text-caption text-brand-primary font-medium hover:underline"
              >
                配置 →
              </button>
            </div>
          </div>

          {/* Start Button */}
          <div className="pt-snug">
            <button
              onClick={handleStart}
              disabled={!isFormValid}
              className="w-full inline-flex items-center justify-center gap-tight px-base py-3 bg-brand-primary text-text-on-dark font-zh font-medium text-body-lg rounded-button shadow-sm transition-all duration-200 ease-out hover:bg-black hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              开始会议
            </button>
          </div>
          
        </div>
      </main>
    </div>
  );
}
