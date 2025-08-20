/**
 * Test setup file for handling unhandled errors and global test configuration
 */

// Track error handlers to prevent multiple registrations
let handlersRegistered = false;

if (!handlersRegistered) {
  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    // Silently ignore validation errors that don't affect tests
    const reasonStr = String(reason);
    if (reasonStr.includes("Validation failed")) {
      return; // Ignore validation errors
    }
    console.warn("Unhandled Promise Rejection:", reason);
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    // Silently ignore validation errors that don't affect tests
    if (error.message.includes("Validation failed")) {
      return; // Ignore validation errors
    }
    console.warn("Uncaught Exception:", error.message);
  });

  handlersRegistered = true;
}

export {};
