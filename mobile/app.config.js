export default ({ config }) => {
  const plugins = [...(config.plugins || [])];
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;

  // Expo Go already includes map support for development. For standalone Android
  // builds, set GOOGLE_MAPS_API_KEY in the build environment to configure Maps.
  if (googleMapsKey) {
    plugins.push([
      "react-native-maps",
      { androidGoogleMapsApiKey: googleMapsKey },
    ]);
  }

  return { ...config, plugins };
};
