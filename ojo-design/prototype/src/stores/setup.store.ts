import { create } from 'zustand';

interface Role {
  id: string;
  name: string;
  duty: string;
  personality: string;
  style: string;
  color: string;
  groupId: string;
}

interface SetupState {
  title: string;
  topic: string;
  background: string;
  selectedRoleIds: string[];
  deepThinking: boolean;
  roles: Role[];
  setTitle: (t: string) => void;
  setTopic: (t: string) => void;
  setBackground: (b: string) => void;
  toggleRole: (id: string) => void;
  setDeepThinking: (v: boolean) => void;
  initData: () => void;
}

export const useSetupStore = create<SetupState>((set, get) => ({
  title: '',
  topic: '',
  background: '',
  selectedRoleIds: [],
  deepThinking: false,
  roles: [],

  setTitle: (t) => set({ title: t }),
  setTopic: (t) => set({ topic: t }),
  setBackground: (b) => set({ background: b }),
  toggleRole: (id) =>
    set((state) => ({
      selectedRoleIds: state.selectedRoleIds.includes(id)
        ? state.selectedRoleIds.filter((rid) => rid !== id)
        : [...state.selectedRoleIds, id],
    })),
  setDeepThinking: (v) => set({ deepThinking: v }),
  
  initData: () =>
    set((state) => {
      const appStore = (window as any).App?.store;
      if (!appStore) return state;
      return {
        ...state,
        roles: appStore.roles || [],
        title: state.title || appStore.meetingConfig?.title || '',
        topic: state.topic || appStore.meetingConfig?.topic || '',
        background: state.background || appStore.meetingConfig?.background || '',
        selectedRoleIds: state.selectedRoleIds.length > 0 ? state.selectedRoleIds : (appStore.meetingConfig?.selectedRoleIds || []),
        deepThinking: appStore.meetingConfig?.deepThinking ?? false,
      };
    }),
}));
