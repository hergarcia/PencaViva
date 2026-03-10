export const launchImageLibraryAsync = jest.fn().mockResolvedValue({
  canceled: true,
  assets: null,
});

export const requestMediaLibraryPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: "granted" });
