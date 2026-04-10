export default new Proxy({}, {
  get: function(target, name) {
    // Return a dummy function for everything to satisfy instanceof checks
    return function() {};
  }
});
