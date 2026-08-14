// Single source of truth for bcrypt's cost factor, shared by every place a
// password gets hashed (signup, self-service profile updates, admin-driven
// updates). Without this, each call site hardcoded its own literal `10`, so a
// future policy change (e.g. raising the cost factor) could silently apply
// to only some password-setting paths and leave others weaker with no test
// catching the drift.
export const BCRYPT_SALT_ROUNDS = 10;
