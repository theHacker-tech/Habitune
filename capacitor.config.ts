import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.habitune.app',
  appName: 'Habitune',
  webDir: 'dist',
  bundledWebRuntime: false,

  server: isDev
    ? {
        // Replace with your machine's LAN IP when testing on a real device
        url: 'http://192.168.1.100:5173',
        cleartext: true,
        androidScheme: 'http',
      }
    : {
        androidScheme: 'https',
      },

  plugins: {
    CapacitorHealthkit: {
      healthSharePermissionDescription:
        'Habitune reads workouts, steps, and activity to auto-log your habits and grow Aura.',
      healthUpdatePermissionDescription:
        'Habitune can write hydration and mindfulness data back to Apple Health.',
    },

    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#386641',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#F2C46D',
    },

    StatusBar: {
      style: 'DARK',
      backgroundColor: '#386641',
      overlaysWebView: false,
    },

    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },

    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#386641',
      sound: 'beep.wav',
    },
  },
};

export default config;
