export const AndroidImportance = {
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
} as const;

export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn();
export const requestPermissionsAsync = jest.fn();
export const getExpoPushTokenAsync = jest.fn();
export const setNotificationChannelAsync = jest.fn();
export const addNotificationReceivedListener = jest.fn(() => ({
  remove: jest.fn(),
}));
export const addNotificationResponseReceivedListener = jest.fn(() => ({
  remove: jest.fn(),
}));
