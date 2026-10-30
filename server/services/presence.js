const ONLINE_WINDOW_MS = 30 * 1000;

const getOnlineCutoff = (now = new Date()) =>
  new Date(now.getTime() - ONLINE_WINDOW_MS);

const isUserOnline = (user, now = new Date()) =>
  Boolean(
    user.isOnline &&
    !user.isBlocked &&
    user.lastSeenAt &&
    user.lastSeenAt >= getOnlineCutoff(now)
  );

module.exports = {
  ONLINE_WINDOW_MS,
  getOnlineCutoff,
  isUserOnline,
};
