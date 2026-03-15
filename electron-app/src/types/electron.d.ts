export {};

declare global {
  interface Window {
    electronAPI: {
      login: () => Promise<void>;
      onAuthSuccess: (callback: (data: {
        profile: any;
        googleAccessToken: string;
        googleRefreshToken: string;
      }) => void) => void;
      onUserProfile: (callback: (profile: any) => void) => void;
    };
  }
}