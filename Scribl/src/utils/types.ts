export interface SocketState {
    isConnected: boolean;
    userCount: number;
    requiresPassword: boolean;
    error: string | null;
    inputPassword: string;
  }
  
  export interface EditorProps {
    sessionId: string;
  }
  
  export interface File {
    fileId: string;
    fileName: string;
  }