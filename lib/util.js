module.exports = {
  isProduction: () => process.env.NODE_ENV === 'production',

  getTimer: () => {
    const timer = {};
    timer.now = Date.now();
    timer.duration = function duration() {
      const diff = Date.now() - this.now;
      this.now = Date.now();
      if (diff >= 60 * 1000) {
        return `${Math.round(diff / 1000 / 60)} minutes`;
      }
      if (diff >= 1000) {
        return `${Math.round(diff / 1000)} seconds`;
      }
      return `${diff} ms`;
    };
    return timer;
  },

  getIdFromUri: (context, uri) => {
    if (!uri || uri.indexOf('/') === -1) {
      context.log.error({ uri }, 'wrong parameter');
    }
    const termArray = uri.split('/');
    return termArray[termArray.length - 1];
  },
};
