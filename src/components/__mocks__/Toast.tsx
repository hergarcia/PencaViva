import React from "react";

const mockShowToast = jest.fn();

export function useToast() {
  return { showToast: mockShowToast };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
