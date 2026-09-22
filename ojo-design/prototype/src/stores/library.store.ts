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

interface Group {
  id: string;
  name: string;
}

interface LibraryState {
  roles: Role[];
  groups: Group[];
  activeGroupId: string | null;
  setActiveGroup: (id: string | null) => void;
  initData: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  roles: [],
  groups: [],
  activeGroupId: null,

  setActiveGroup: (id) => set({ activeGroupId: id }),

  initData: () =>
    set((state) => {
      const appStore = (window as any).App?.store;
      if (!appStore) return state;
      return {
        ...state,
        roles: state.roles.length > 0 ? state.roles : (appStore.roles || []),
        groups: state.groups.length > 0 ? state.groups : (appStore.groups || []),
      };
    }),
}));
