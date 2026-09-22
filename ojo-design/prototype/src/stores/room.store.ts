import { create } from 'zustand';

export interface Message {
  id: string;
  roleId: string;
  text: string;
  time: string;
  type: 'ai' | 'human' | 'system';
  thinkingText?: string;
}

export interface Participant {
  id: string;
  name: string;
  duty: string;
  color: string;
  status: 'thinking' | 'competing' | 'speaking' | 'idle';
}

interface RoomState {
  title: string;
  topic: string;
  messages: Message[];
  participants: Participant[];
  currentSpeakerId: string | null;
  phase: 'idle' | 'thinking' | 'competing' | 'speaking';
  isDrawerOpen: boolean;
  selectedParticipantId: string | null;
  
  addMessage: (msg: Message) => void;
  setPhase: (phase: RoomState['phase']) => void;
  setCurrentSpeaker: (id: string | null) => void;
  setParticipantStatus: (id: string, status: Participant['status']) => void;
  setDrawerOpen: (open: boolean) => void;
  setSelectedParticipant: (id: string | null) => void;
  initData: (params?: any) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  title: '',
  topic: '',
  messages: [],
  participants: [],
  currentSpeakerId: null,
  phase: 'idle',
  isDrawerOpen: false,
  selectedParticipantId: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setPhase: (phase) => set({ phase }),
  setCurrentSpeaker: (id) => set({ currentSpeakerId: id }),
  setParticipantStatus: (id, status) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    })),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setSelectedParticipant: (id) => set({ selectedParticipantId: id }),

  initData: (params) =>
    set((state) => {
      const appStore = (window as any).App?.store;
      if (!appStore) return state;

      const title = params?.title || appStore.meetingConfig?.title || '未命名会议';
      const topic = params?.topic || appStore.meetingConfig?.topic || '';
      const roleIds = params?.selectedRoleIds || appStore.meetingConfig?.selectedRoleIds || [];
      
      const participants: Participant[] = (appStore.roles || [])
        .filter((r: any) => roleIds.includes(r.id))
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          duty: r.duty,
          color: r.color,
          status: 'idle',
        }));

      // Ensure "You" is always a participant
      if (!participants.some(p => p.id === 'human')) {
          participants.unshift({
              id: 'human',
              name: '你',
              duty: '主持人',
              color: 'hue-0',
              status: 'idle'
          });
      }

      return {
        ...state,
        title,
        topic,
        participants: state.participants.length > 0 ? state.participants : participants,
      };
    }),
}));
