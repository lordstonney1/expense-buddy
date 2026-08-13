import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.ceditrack",
  appName: "CediTrack",
  webDir: "dist/client",
  // To live-reload against the Lovable preview on a real device, uncomment:
  // server: {
  //   url: "https://id-preview--ccd8ab7c-243d-4c6a-98cb-75bc11dde80f.lovable.app",
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#1e3a8a",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1e3a8a",
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
