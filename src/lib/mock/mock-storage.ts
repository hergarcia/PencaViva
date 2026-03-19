const PLACEHOLDER_URL = "https://placehold.co/200x200/00D4AA/white?text=AV";

export function createMockStorage() {
  return {
    from(_bucket: string) {
      return {
        upload(path: string, _file: unknown, _opts?: Record<string, unknown>) {
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${PLACEHOLDER_URL}&path=${encodeURIComponent(path)}`,
            },
          };
        },
      };
    },
  };
}
