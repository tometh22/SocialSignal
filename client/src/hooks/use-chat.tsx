import { createContext, ReactNode, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Tipos de mensajes y conversaciones
export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  imageUrl?: string | null;
  createdAt: Date;
  seen: boolean;
  sender?: {
    id: number;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface ChatParticipant {
  id: number;
  userId: number;
  conversationId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface ChatConversation {
  id: number;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  createdBy: number;
  projectId?: number | null;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  _count?: {
    messages: number;
    unreadMessages: number;
  };
}

// Tipo para nuevos mensajes
interface NewMessagePayload {
  conversationId: number;
  message: string;
  imageUrl?: string;
}

// Tipo para crear nueva conversación
interface NewConversationPayload {
  title: string;
  receiverId?: number; // Para conversaciones directas
  userIds?: number[]; // Para grupos
  isGroup?: boolean;
  projectId?: number;
}

// Tipo para respuestas de WebSocket
interface WebSocketResponse {
  type: string;
  message?: any;
  conversation?: ChatConversation;
  messageId?: number;
  conversationId?: number;
}

// Contexto para el chat
interface ChatContextType {
  conversations: ChatConversation[];
  activeConversation: ChatConversation | null;
  isLoadingConversations: boolean;
  createConversation: (data: NewConversationPayload) => void;
  sendMessage: (data: NewMessagePayload) => void;
  markConversationAsRead: (conversationId: number) => void;
  setActiveConversationId: (id: number | null) => void;
  isConnected: boolean;
  isConnecting: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Obtener todas las conversaciones
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<ChatConversation[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
  });

  // Obtener conversación activa con mensajes
  useEffect(() => {
    if (activeConversationId && user) {
      const fetchConversation = async () => {
        try {
          const response = await fetch(`/api/conversations/${activeConversationId}`);
          if (response.ok) {
            const data = await response.json();
            setActiveConversation(data);
          } else {
            console.error("Error al obtener la conversación");
            setActiveConversation(null);
          }
        } catch (error) {
          console.error("Error al obtener la conversación:", error);
          setActiveConversation(null);
        }
      };

      fetchConversation();
    } else {
      setActiveConversation(null);
    }
  }, [activeConversationId, user]);

  // Configurar WebSocket con backoff exponencial
  useEffect(() => {
    if (!user) return;

    let retryCount = 0;
    const MAX_RETRIES = 5;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connectWebSocket = () => {
      if (cancelled) return;
      setIsConnecting(true);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;

      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onopen = () => {
        retryCount = 0; // Reset on successful connection
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketResponse = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error("Error al procesar mensaje WebSocket:", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        if (cancelled) return;
        // Exponential backoff: 3s, 6s, 12s, 24s, 48s — then stop
        if (retryCount < MAX_RETRIES) {
          const delay = 3000 * Math.pow(2, retryCount);
          retryCount++;
          retryTimeout = setTimeout(() => {
            if (user && !cancelled) connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    };

    connectWebSocket();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [user]);

  // Manejador de mensajes WebSocket
  const handleWebSocketMessage = useCallback((data: WebSocketResponse) => {
    switch (data.type) {
      case "new_message":
        // Actualizar la conversación con el nuevo mensaje
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        if (activeConversationId === data.message.conversationId) {
          setActiveConversation(prev => {
            if (!prev) return null;
            return {
              ...prev,
              messages: [...prev.messages, data.message],
              lastMessageAt: new Date(),
            };
          });
        }
        
        // Mostrar notificación
        if (data.message.senderId !== user?.id) {
          toast({
            title: "Nuevo mensaje",
            description: data.message.content.substring(0, 50) + (data.message.content.length > 50 ? "..." : ""),
          });
        }
        break;
      
      case "conversation_created":
        // Actualizar lista de conversaciones
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        toast({
          title: "Nueva conversación",
          description: `Se ha creado la conversación "${data.conversation?.title || 'Sin título'}"`,
        });
        break;

      case "messages_read":
        // Actualizar estado de mensajes leídos
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        break;

      case "error":
        toast({
          title: "Error",
          description: data.message || "Ha ocurrido un error",
          variant: "destructive",
        });
        break;
    }
  }, [activeConversationId, toast, user?.id]);

  // Crear nueva conversación
  const createConversation = useCallback((data: NewConversationPayload) => {
    if (!user || !webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "create_conversation",
      title: data.title,
      isGroup: data.isGroup || false,
      receiverId: data.receiverId,
      userIds: data.userIds,
      projectId: data.projectId,
    };

    webSocketRef.current.send(JSON.stringify(payload));
  }, [user]);

  // Enviar mensaje
  const sendMessage = useCallback((data: NewMessagePayload) => {
    if (!user || !webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "new_message",
      conversationId: data.conversationId,
      message: data.message,
      imageUrl: data.imageUrl,
    };

    webSocketRef.current.send(JSON.stringify(payload));
  }, [user]);

  // Marcar conversación como leída
  const markConversationAsRead = useCallback((conversationId: number) => {
    if (!user || !webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "read_messages",
      conversationId,
    };

    webSocketRef.current.send(JSON.stringify(payload));
  }, [user]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        isLoadingConversations,
        createConversation,
        sendMessage,
        markConversationAsRead,
        setActiveConversationId,
        isConnected,
        isConnecting,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat debe ser usado dentro de un ChatProvider");
  }
  return context;
}