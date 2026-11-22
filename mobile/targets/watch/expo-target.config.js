/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "WorkoutWatch",
  displayName: "Workout",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WatchConnectivity", "UserNotifications"],
};
