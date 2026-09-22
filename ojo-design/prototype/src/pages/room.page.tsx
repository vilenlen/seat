import React, { useEffect, useRef, useState } from 'react';
import { useRoomStore, Participant } from '../stores/room.store';
import { Play, Pause, X, User, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock messages as provided in requirements
const MOCK_MESSAGES: Record<string, string[]> = {
  r1: ["延期三周是对的。支付链路不通，上线就是灾难。去年 Q2 就是前车之鉴。", "用户容忍一次延期，不会容忍上线后闪退。我们要的是口碑，不是节点。"],
  r2: ["技术层面，支付 SDK 对接还差两个接口。乐观估计两周，留一周 buffer，三周是合理的。", "延期之外，我更关心测试覆盖率。现在只有 60%，不够。"],
  r3: ["用户调研显示支付流程是最大摩擦点。延期，但要用这三周把 checkout 体验做对。", "设计稿已经改了 4 版了。我支持延期，但请给我们稳定的需求。"],
  r4: ["延期对 Q3 的投放节奏有影响。我需要至少两周提前量重排 campaign。", "品牌层面，主动延期配合一篇「为什么我们选择等待」的文章，可能反而加分。"],
  r5: ["核心问题：延期的机会成本是什么？竞品 8 月会不会上线？如果是，三周代价很高。", "建议做个决策矩阵：延期 vs 灰度发布 vs 功能裁剪上线，三条路的风险收益对比。"],
  r6: ["运营侧已经预热了 2 万用户，延期需要给个说法。建议发公告，主动管理预期。", "三周够吗？上线第一周的客服和 bug 处理人力排好了吗？"],
};

export default function RoomPage() {
  const store = useRoomStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    store.initData();
    // Start simulation when component mounts
    startSimulation();
    
    return () => {
      if (simulationInterval.current) clearInterval(simulationInterval.current);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages]);

  const startSimulation = () => {
    if (store.phase !== 'idle' && store.messages.length > 0) return; // Prevent multiple starts if already running
    
    let step = 0;
    
    const runCycle = () => {
      const state = useRoomStore.getState();
      const aiParticipants = state.participants.filter(p => p.id !== 'human');
      if (aiParticipants.length === 0) return;

      if (step === 0) {
        store.setPhase('thinking');
        aiParticipants.forEach(p => store.setParticipantStatus(p.id, 'thinking'));
        step = 1;
        simulationInterval.current = setTimeout(runCycle, 2000);
      } else if (step === 1) {
        store.setPhase('competing');
        // Randomly select 1-3 to compete
        const numCompeting = Math.floor(Math.random() * 2) + 1;
        const shuffled = [...aiParticipants].sort(() => 0.5 - Math.random());
        const competingIds = shuffled.slice(0, numCompeting).map(p => p.id);
        
        aiParticipants.forEach(p => {
          store.setParticipantStatus(p.id, competingIds.includes(p.id) ? 'competing' : 'idle');
        });
        
        step = 2;
        simulationInterval.current = setTimeout(runCycle, 1500);
      } else if (step === 2) {
        const competing = state.participants.filter(p => p.status === 'competing');
        if (competing.length > 0) {
          const speaker = competing[Math.floor(Math.random() * competing.length)];
          store.setPhase('speaking');
          store.setCurrentSpeaker(speaker.id);
          
          aiParticipants.forEach(p => {
             store.setParticipantStatus(p.id, p.id === speaker.id ? 'speaking' : 'idle');
          });

          // System message
          store.addMessage({
            id: `sys-${Date.now()}`,
            roleId: 'system',
            text: `${speaker.name} 获得本轮发言权`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system'
          });

          // Simulate typing delay
          step = 3;
          simulationInterval.current = setTimeout(() => {
            const msgs = MOCK_MESSAGES[speaker.id] || ["同意。"];
            const text = msgs[Math.floor(Math.random() * msgs.length)];
            store.addMessage({
              id: `msg-${Date.now()}`,
              roleId: speaker.id,
              text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'ai',
              thinkingText: "评估了目前的风险因素，认为质量优先级高于时间。"
            });
            runCycle();
          }, 2000);

        } else {
           // Skip to thinking if no one competes
           step = 0;
           runCycle();
        }
      } else if (step === 3) {
         // Post speaking wait
         store.setPhase('idle');
         store.setCurrentSpeaker(null);
         aiParticipants.forEach(p => store.setParticipantStatus(p.id, 'idle'));
         step = 0;
         simulationInterval.current = setTimeout(runCycle, 3000);
      }
    };

    runCycle();
  };

  const handlePause = () => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
      store.setPhase('idle');
      store.setCurrentSpeaker(null);
      store.participants.forEach(p => store.setParticipantStatus(p.id, 'idle'));
    } else {
      startSimulation();
    }
  };

  const handleEnd = () => {
    if (simulationInterval.current) clearInterval(simulationInterval.current);
    (window as any).App?.transitionTo('setup');
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    store.addMessage({
      id: `msg-${Date.now()}`,
      roleId: 'human',
      text: inputValue.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'human'
    });
    setInputValue('');
  };

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

  const getParticipantStatus = (p: Participant) => p.status;

  const activeSpeaker = store.currentSpeakerId 
    ? store.participants.find(p => p.id === store.currentSpeakerId) 
    : null;

  return (
    <div className="flex flex-col h-screen bg-surface-canvas font-body text-text-primary overflow-hidden relative">
      {/* Background Halos */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, 40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-accent-peach rounded-full mix-blend-multiply filter blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-accent-sky rounded-full mix-blend-multiply filter blur-[120px]"
        />
      </div>

      {/* Top Bar - Layer 1 */}
      <header className="h-[52px] bg-surface-header-dark text-text-on-dark px-comfortable flex items-center justify-between shrink-0 z-20 border-b border-white/10">
        <div className="flex items-center gap-snug text-caption">
          <span className="font-bold">Seat 一席</span>
          <span className="text-text-muted">|</span>
          <span className="font-medium truncate max-w-[200px]">会议标题：{store.title}</span>
          <span className="text-text-muted">·</span>
          <span className="truncate max-w-[300px]">议题：{store.topic}</span>
        </div>
        <div className="flex items-center gap-snug">
          <button 
            onClick={handlePause}
            className="flex items-center gap-1 text-caption text-text-on-dark hover:text-brand-accent-sky transition-colors"
          >
            {simulationInterval.current ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {simulationInterval.current ? '暂停' : '恢复'}
          </button>
          <button 
            onClick={handleEnd}
            className="flex items-center gap-1 text-caption text-status-error hover:opacity-80 transition-opacity"
          >
            <X className="w-3 h-3" /> 结束会议
          </button>
        </div>
      </header>

      {/* Top Bar - Layer 2 (Metronome) */}
      <div className="h-[44px] bg-surface-card border-b border-border-subtle flex items-center justify-between px-comfortable shrink-0 z-20 shadow-elevation-1">
        
        {/* Stages */}
        <div className="flex items-center gap-snug text-caption font-medium">
          <div className={`flex items-center gap-1 transition-opacity duration-300 ${store.phase === 'thinking' ? 'text-brand-primary' : 'text-text-muted'}`}>
            {store.phase === 'thinking' && (
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '0ms'}}/>
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '150ms'}}/>
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '300ms'}}/>
              </span>
            )}
            {!store.phase && <span>●</span>}
            思考中
          </div>
          <span className="text-border-strong">──→</span>
          <div className={`transition-opacity duration-300 ${store.phase === 'competing' ? 'text-brand-primary animate-pulse' : 'text-text-muted'}`}>
            举手竞争
          </div>
          <span className="text-border-strong">──→</span>
          <div className={`transition-opacity duration-300 ${store.phase === 'speaking' ? 'text-brand-primary' : 'text-text-muted'}`}>
            发言中
          </div>
        </div>

        {/* Lock Chip */}
        <div className="flex items-center">
          {activeSpeaker ? (
            <div className="inline-flex items-center gap-tight px-snug py-1 bg-brand-accent-peach/15 text-[#8B5D5D] text-caption font-medium rounded-full border border-brand-accent-peach/30 shadow-sm">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-text-primary ${getAvatarColor(activeSpeaker.color)}`}>
                {activeSpeaker.name[0]}
              </div>
              <span>{activeSpeaker.name} 正在发言…</span>
            </div>
          ) : (
            <div className="inline-flex items-center px-snug py-1 border border-dashed border-border-strong rounded-full text-caption text-text-muted">
              — 等待发言 —
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="flex items-center gap-snug text-caption text-text-secondary">
          <div className="flex items-center gap-1">
            深度思考 ⊙
          </div>
          <button className="flex items-center gap-1 hover:text-brand-primary transition-colors">
            <Settings className="w-3 h-3" /> 引擎
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative z-10">
        {/* Sidebar Roster */}
        <motion.aside 
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 48 }}
          className="bg-surface-card/80 backdrop-blur-md border-r border-border-subtle flex flex-col shrink-0 overflow-hidden"
        >
          <div className="p-tight flex justify-end">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-tight pb-comfortable flex flex-col gap-1">
            {store.participants.map(p => {
              const status = getParticipantStatus(p);
              return (
              <div 
                key={p.id}
                onClick={() => { store.setSelectedParticipant(p.id); store.setDrawerOpen(true); }}
                className={`flex items-center gap-snug p-2 rounded-card cursor-pointer transition-colors ${
                  status === 'speaking' ? 'bg-surface-hover' : 'hover:bg-surface-canvas'
                }`}
                title={!sidebarOpen ? `${p.name} - ${status}` : undefined}
              >
                <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-caption font-bold text-text-primary ${getAvatarColor(p.color)} relative`}>
                  {p.name[0]}
                  {status === 'speaking' && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-status-success border-2 border-surface-card animate-pulse" />
                  )}
                </div>
                
                {sidebarOpen && (
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="truncate">
                      <div className="font-zh text-body font-medium leading-tight truncate">{p.name}</div>
                      <div className="text-caption text-text-secondary truncate">{p.duty}</div>
                    </div>
                    
                    {/* Status Indicator */}
                    <div className="ml-2 shrink-0">
                      {status === 'thinking' && (
                         <span className="flex gap-0.5 text-text-muted">
                           <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '0ms'}}/>
                           <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '150ms'}}/>
                           <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{animationDelay: '300ms'}}/>
                         </span>
                      )}
                      {status === 'competing' && <span className="text-lg animate-pulse text-brand-primary font-bold">手</span>}
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </motion.aside>

        {/* Message Flow */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
          <div className="flex-1 overflow-y-auto p-comfortable flex flex-col gap-loose">
            
            {store.messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                 <p>会议已开始，等待 AI 角色思考…</p>
                 <span className="flex gap-1 mt-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay: '0ms'}}/>
                   <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay: '150ms'}}/>
                   <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{animationDelay: '300ms'}}/>
                 </span>
              </div>
            )}

            {store.messages.map((msg, i) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-caption text-text-muted font-medium px-snug py-1">
                      ──────── {msg.text} ────────
                    </span>
                  </div>
                );
              }

              if (msg.type === 'human') {
                return (
                  <div key={msg.id} className="flex flex-col items-end gap-tight max-w-[80%] self-end">
                    <div className="text-caption text-text-muted text-center w-full mb-1">
                      ───── 你 ─────
                    </div>
                    <div className="bg-surface-card border-l-2 border-brand-accent-sky shadow-card-soft rounded-card p-snug text-body text-text-primary whitespace-pre-wrap">
                      {msg.text}
                    </div>
                    <div className="text-caption text-text-secondary flex items-center gap-1">
                       {msg.time} · 你（主持）
                    </div>
                  </div>
                );
              }

              // AI Message
              const participant = store.participants.find(p => p.id === msg.roleId);
              if (!participant) return null;

              return (
                <div key={msg.id} className="flex gap-snug max-w-[80%]">
                  <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-caption font-bold text-text-primary ${getAvatarColor(participant.color)} mt-1`}>
                    {participant.name[0]}
                  </div>
                  <div className="flex flex-col gap-tight min-w-0">
                    <div className="flex items-baseline gap-snug">
                      <span className="font-zh font-medium text-body">{participant.name}</span>
                      <span className="text-caption text-text-secondary">{participant.duty}</span>
                      <span className="text-caption text-text-muted ml-2">{msg.time}</span>
                    </div>
                    
                    {msg.thinkingText && (
                      <details className="group cursor-pointer">
                        <summary className="text-caption text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 list-none">
                           ▶ {participant.name}的思考过程 <span className="text-[10px] bg-surface-hover px-1 rounded">展开</span>
                        </summary>
                        <div className="mt-1 pl-2 border-l border-border-subtle text-caption text-text-secondary italic">
                          {msg.thinkingText}
                        </div>
                      </details>
                    )}

                    <div className="relative pl-3">
                      <div className={`absolute left-0 top-1 bottom-1 w-[2px] rounded-full ${getAvatarColor(participant.color)} opacity-50`} />
                      <div className="text-body text-text-primary bg-surface-card/60 backdrop-blur shadow-sm rounded-card p-snug border border-border-subtle inline-block">
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="h-[64px] bg-surface-card border-t border-border-subtle px-comfortable flex items-center gap-snug shrink-0 z-20">
             <form onSubmit={handleSend} className="flex-1 flex items-center gap-snug relative group">
               <input 
                 type="text" 
                 value={inputValue}
                 onChange={e => setInputValue(e.target.value)}
                 disabled={!simulationInterval.current && store.phase === 'idle' && store.messages.length > 0} // simple heuristic
                 placeholder={simulationInterval.current ? "作为「你」发言（回车发送）" : "会议暂停中..."}
                 className="flex-1 px-snug py-2 bg-surface-canvas border border-border-strong rounded-input text-body focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all disabled:opacity-50"
               />
               <button 
                 type="submit"
                 disabled={!inputValue.trim()}
                 className="px-base py-2 bg-brand-primary text-text-on-dark rounded-button text-body font-medium hover:bg-black transition-colors disabled:opacity-50 flex shrink-0"
               >
                 发送
               </button>
             </form>
          </div>
        </main>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {store.isDrawerOpen && store.selectedParticipantId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => store.setDrawerOpen(false)}
              className="absolute inset-0 z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-[270px] bg-surface-card border-l border-border-subtle shadow-elevation-1 z-50 p-comfortable flex flex-col gap-snug"
            >
               <div className="flex justify-between items-start">
                 <h2 className="text-h3 font-zh">角色档案</h2>
                 <button onClick={() => store.setDrawerOpen(false)} className="text-text-muted hover:text-text-primary">
                   <X className="w-4 h-4" />
                 </button>
               </div>
               
               {(() => {
                 const p = store.participants.find(x => x.id === store.selectedParticipantId);
                 if (!p) return null;
                 const fullRole = (window as any).App?.store?.roles?.find((r:any) => r.id === p.id);

                 return (
                   <div className="flex flex-col gap-stack-sm mt-4">
                     <div className="flex flex-col items-center gap-2">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-h2 font-bold text-text-primary ${getAvatarColor(p.color)}`}>
                          {p.name[0]}
                        </div>
                        <div className="text-center">
                          <div className="text-h3 font-zh">{p.name}</div>
                          <div className="text-body text-text-secondary">{p.duty}</div>
                        </div>
                     </div>
                     
                     {fullRole && (
                       <div className="flex flex-col gap-snug">
                         <div>
                           <div className="text-caption text-text-muted mb-1">性格</div>
                           <div className="text-body text-text-primary bg-surface-canvas p-2 rounded-card border border-border-subtle">{fullRole.personality}</div>
                         </div>
                         <div>
                           <div className="text-caption text-text-muted mb-1">说话风格</div>
                           <div className="text-body text-text-primary bg-surface-canvas p-2 rounded-card border border-border-subtle">{fullRole.style}</div>
                         </div>
                       </div>
                     )}

                     <div className="mt-auto pt-comfortable">
                       <button onClick={() => {}} className="w-full py-2 border border-border-strong rounded-button text-body text-text-primary hover:bg-surface-hover transition-colors">
                         编辑此角色
                       </button>
                     </div>
                   </div>
                 )
               })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
