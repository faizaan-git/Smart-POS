const test = require("node:test");
const assert = require("node:assert/strict");
const { getOnlineCutoff, isUserOnline, ONLINE_WINDOW_MS } = require("../services/presence");

test("online status expires after the heartbeat window", () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const recentUser = {
    isOnline: true,
    isBlocked: false,
    lastSeenAt: new Date(now.getTime() - ONLINE_WINDOW_MS + 1),
  };
  const expiredUser = {
    ...recentUser,
    lastSeenAt: new Date(now.getTime() - ONLINE_WINDOW_MS - 1),
  };

  assert.equal(isUserOnline(recentUser, now), true);
  assert.equal(isUserOnline(expiredUser, now), false);
  assert.equal(getOnlineCutoff(now).getTime(), now.getTime() - ONLINE_WINDOW_MS);
});

test("blocked users and users without a recent heartbeat are offline", () => {
  const now = new Date("2026-10-14T12:00:00.000Z");
  const recentHeartbeat = new Date(now.getTime() - 1);

  assert.equal(
    isUserOnline({ isOnline: true, isBlocked: true, lastSeenAt: recentHeartbeat }, now),
    false
  );
  assert.equal(
    isUserOnline({ isOnline: true, isBlocked: false, lastSeenAt: null }, now),
    false
  );
  assert.equal(
    isUserOnline({ isOnline: false, isBlocked: false, lastSeenAt: recentHeartbeat }, now),
    false
  );
});
