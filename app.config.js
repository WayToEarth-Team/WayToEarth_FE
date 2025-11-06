// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "WayToEarth",
    slug: "waytoearth",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    scheme: "waytoearth",
    owner: "waytoearth",
    jsEngine: "hermes",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    ios: {
      bundleIdentifier: "com.waytoearth", // ???�수 추�?
      supportsTablet: true,
      config: { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY },
    },

    android: {
      package: "cloud.waytoearth",
      googleServicesFile: "./google-services.json",
      // Android 권한: 백그?�운???�치/?��? ?�치/FG ?�비???�림
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "POST_NOTIFICATIONS",
      ],
      config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },

    web: { favicon: "./assets/favicon.png" },

    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.0.21",
            gradlePluginVersion: "8.6.1",
            useNativeModules: true,
          },
        },
      ],
      [
        "@react-native-seoul/kakao-login",
        { kakaoAppKey: process.env.KAKAO_NATIVE_APP_KEY },
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
    ],

    extra: {
      kakaoNativeAppKey: process.env.KAKAO_NATIVE_APP_KEY,
      kakaoRestApiKey: process.env.KAKAO_REST_API_KEY,
      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.waytoearth.cloud",
      mockEnabled: process.env.EXPO_PUBLIC_API_MOCK === "1",
      crewMockEnabled: false, // ?�제 ?�루 API ?�동 ?�용
      eas: { projectId: "7a5e6a60-69ad-4ddc-8301-9aaf03e404a6" },
    },
  },
};

