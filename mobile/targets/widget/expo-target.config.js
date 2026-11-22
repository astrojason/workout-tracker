/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "WorkoutWidget",
  displayName: "Workout",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  colors: {
    $accent: "#4f46e5",
    $widgetBackground: { color: "#ffffff", darkColor: "#111827" },
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.com.astrojason.workout"],
  },
};
