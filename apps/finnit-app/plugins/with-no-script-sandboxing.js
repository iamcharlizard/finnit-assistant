// Xcode's "User Script Sandboxing" stops React Native's "Bundle React
// Native code and images" phase from writing into the app bundle (ip.txt,
// the Mac's address for Metro on a device). The native project is
// generated (CNG), so the setting is turned off here on every prebuild.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withNoScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });
};
