import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { useGroupStore } from "@stores/group-store";
import { fetchUserGroups } from "@lib/groups-service";
import type { UserGroup } from "@lib/groups-service";

type UseActiveGroupResult = {
  activeGroupId: string | null;
  activeGroup: UserGroup | null;
  groups: UserGroup[];
  setActiveGroupId: (id: string) => void;
  isLoading: boolean;
};

export function useActiveGroup(): UseActiveGroupResult {
  const { user, isInitialized } = useAuth();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const setStoreGroupId = useGroupStore((s) => s.setActiveGroupId);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Use a ref to read activeGroupId inside loadGroups without adding it as
  // a dependency (avoids double-fetch when auto-selecting the first group).
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;

  const loadGroups = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchUserGroups(user.id);
      setGroups(data);

      // Auto-select first group if none active
      if (!activeGroupIdRef.current && data.length > 0) {
        setStoreGroupId(data[0].id);
      }
    } catch {
      // Silently fail — groups list will be empty
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, setStoreGroupId]);

  useEffect(() => {
    if (!isInitialized) return;
    loadGroups();
  }, [isInitialized, loadGroups]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return {
    activeGroupId,
    activeGroup,
    groups,
    setActiveGroupId: setStoreGroupId,
    isLoading,
  };
}
