import { create } from "zustand";

export type GroupState = {
  activeGroupId: string | null;
};

export type GroupActions = {
  setActiveGroupId: (id: string | null) => void;
};

export type GroupStore = GroupState & GroupActions;

export const useGroupStore = create<GroupStore>()((set) => ({
  activeGroupId: null,

  setActiveGroupId: (id) => {
    set({ activeGroupId: id });
  },
}));
