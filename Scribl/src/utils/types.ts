export interface SocketState {
    inputPassword: string;
    isConnected: boolean;
    userCount: number;
    requiresPassword: boolean;
    error: string | null;
  }
  
  export interface SocketActions {
    setIsConnected: (value: boolean) => void;
    setUserCount: (count: number) => void;
    setRequiresPassword: (value: boolean) => void;
    setError: (error: string | null) => void;
  }
  
  export interface EditorProps {
    sessionId: string;
  }