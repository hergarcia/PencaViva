const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(""),
};
export default Clipboard;
