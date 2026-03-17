import React from "react";
import { render, screen } from "@testing-library/react-native";
import { MemberRow } from "@components/groups/MemberRow";
import type { GroupMember } from "@lib/groups-service";

const baseMember: GroupMember = {
  user_id: "u1",
  display_name: "Alice Smith",
  username: "alice",
  avatar_url: null,
  points_total: 42,
  role: "admin",
  joined_at: "2024-01-01T00:00:00Z",
};

describe("MemberRow", () => {
  it("renders display_name and username", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("@alice")).toBeTruthy();
  });

  it("renders role badge", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByTestId("role-badge-u1")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("renders 'You' badge when isCurrentUser is true", () => {
    render(<MemberRow member={baseMember} isCurrentUser={true} />);
    expect(screen.getByTestId("you-badge-u1")).toBeTruthy();
  });

  it("does not render 'You' badge when isCurrentUser is false", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.queryByTestId("you-badge-u1")).toBeNull();
  });

  it("renders letter avatar from first char of display_name", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("renders 'Mod' label for moderator role", () => {
    render(
      <MemberRow
        member={{ ...baseMember, role: "moderator" }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("Mod")).toBeTruthy();
  });

  it("renders 'Member' label for member role", () => {
    render(
      <MemberRow
        member={{ ...baseMember, role: "member" }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("Member")).toBeTruthy();
  });

  it("has correct testID on the row container", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByTestId("member-row-u1")).toBeTruthy();
  });
});
