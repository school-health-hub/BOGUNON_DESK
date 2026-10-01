import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createChatGptConnectionService,
  disconnectedChatGptState,
} from "./chatgptConnectionService";
import type { ChatGptConnectionService, ChatGptConnectionState } from "./types";

type ChatGptConnectionContextValue = {
  readonly state: ChatGptConnectionState;
  readonly refresh: () => Promise<void>;
  readonly startSignIn: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

const ChatGptConnectionContext = createContext<ChatGptConnectionContextValue | null>(null);

type ChatGptConnectionProviderProps = {
  readonly children: ReactNode;
  readonly createService?: () => ChatGptConnectionService;
};

export function ChatGptConnectionProvider({
  children,
  createService = createChatGptConnectionService,
}: ChatGptConnectionProviderProps) {
  const [service] = useState(createService);
  const [state, setState] = useState<ChatGptConnectionState>(disconnectedChatGptState);

  useEffect(() => service.subscribe(setState), [service]);

  useEffect(() => {
    void service.refresh();
  }, [service]);

  const value = useMemo<ChatGptConnectionContextValue>(() => ({
    state,
    refresh: service.refresh,
    startSignIn: service.startSignIn,
    disconnect: service.disconnect,
  }), [service, state]);

  return (
    <ChatGptConnectionContext.Provider value={value}>
      {children}
    </ChatGptConnectionContext.Provider>
  );
}

export const useChatGptConnection = (): ChatGptConnectionContextValue => {
  const value = useContext(ChatGptConnectionContext);
  if (value === null) throw new Error("ChatGptConnectionProvider가 필요합니다.");
  return value;
};
