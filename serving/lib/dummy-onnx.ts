export default new Proxy({}, {
  // Return a dummy function for everything to satisfy instanceof checks
  get: () => () => {}
});
