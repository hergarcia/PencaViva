import { useGroupStore } from "@stores/group-store";

beforeEach(() => {
  useGroupStore.setState({
    activeGroupId: null,
  });
});

describe("useGroupStore", () => {
  it("has null activeGroupId by default", () => {
    expect(useGroupStore.getState().activeGroupId).toBeNull();
  });

  it("sets activeGroupId", () => {
    useGroupStore.getState().setActiveGroupId("group-123");
    expect(useGroupStore.getState().activeGroupId).toBe("group-123");
  });

  it("clears activeGroupId with null", () => {
    useGroupStore.getState().setActiveGroupId("group-123");
    useGroupStore.getState().setActiveGroupId(null);
    expect(useGroupStore.getState().activeGroupId).toBeNull();
  });
});
