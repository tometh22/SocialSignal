import { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  ChevronsRight, 
  MessageCircleMore, 
  CheckCircle2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChat, ChatConversation, ChatMessage } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";

export function MessagesPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [, navigate] = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  const { 
    conversations, 
    activeConversation,
    isLoadingConversations,
    sendMessage,
    markConversationAsRead,
    setActiveConversationId,
    isConnected
  } = useChat();

  // Scroll al último mensaje cuando se añade uno nuevo
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages]);

  // Marcar mensajes como leídos cuando se abre una conversación
  useEffect(() => {
    if (activeConversation && isOpen) {
      markConversationAsRead(activeConversation.id);
    }
  }, [activeConversation, isOpen, markConversationAsRead]);

  // Calcular el total de mensajes no leídos
  const totalUnread = conversations.reduce((sum, conv) => {
    return sum + (conv._count?.unreadMessages || 0);
  }, 0);

  // Función para obtener las iniciales de un nombre
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Función para enviar un mensaje
  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeConversation) return;
    
    sendMessage({
      conversationId: activeConversation.id,
      message: messageInput,
    });
    
    setMessageInput("");
  };

  // Formatear la marca de tiempo
  const formatTimestamp = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
    } else {
      return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
  };

  // Obtener nombre del participante (para conversaciones directas)
  const getParticipantName = (conversation: ChatConversation) => {
    if (!conversation.participants || conversation.participants.length === 0) return "Sin nombre";
    
    // Para conversaciones grupales, usar el título
    if (conversation.isGroup) return conversation.title || "Grupo";
    
    // Para conversaciones directas, mostrar el nombre del otro participante
    const otherParticipant = conversation.participants.find(p => p.userId !== user?.id);
    if (otherParticipant) {
      return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
    }
    
    return "Sin nombre";
  };

  // Obtener iniciales del participante
  const getParticipantInitials = (conversation: ChatConversation) => {
    if (!conversation.participants || conversation.participants.length === 0) return "--";
    
    // Para conversaciones grupales, usar las iniciales del título
    if (conversation.isGroup && conversation.title) {
      const words = conversation.title.split(' ');
      if (words.length >= 2) {
        return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
      }
      return conversation.title.substring(0, 2).toUpperCase();
    }
    
    // Para conversaciones directas, mostrar las iniciales del otro participante
    const otherParticipant = conversation.participants.find(p => p.userId !== user?.id);
    if (otherParticipant) {
      return getInitials(otherParticipant.user.firstName, otherParticipant.user.lastName);
    }
    
    return "--";
  };

  // Obtener el último mensaje de una conversación
  const getLastMessage = (conversation: ChatConversation) => {
    if (!conversation.messages || conversation.messages.length === 0) {
      return null;
    }
    
    // Ordenar mensajes por fecha y obtener el último
    const sortedMessages = [...conversation.messages].sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sortedMessages[0];
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 relative text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="h-4.5 w-4.5" />
          {totalUnread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <Tabs 
          defaultValue="list" 
          value={activeConversation ? activeConversation.id.toString() : "list"}
          onValueChange={(value) => {
            if (value !== "list") {
              setActiveConversationId(parseInt(value));
            } else {
              setActiveConversationId(null);
            }
          }}
        >
          <div className="border-b p-3 flex items-center justify-between">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="text-xs">Conversaciones</TabsTrigger>
              <TabsTrigger 
                value={activeConversation ? activeConversation.id.toString() : "list"} 
                disabled={!activeConversation} 
                className="text-xs"
              >
                {activeConversation ? getParticipantName(activeConversation) : "Chat"}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="list" className="focus:outline-none max-h-[400px] overflow-auto">
            {isLoadingConversations ? (
              <div className="py-8 text-center">
                <Loader2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Cargando conversaciones...</p>
              </div>
            ) : (
              <div className="py-2">
                {conversations.length > 0 ? (
                  conversations.map((conversation) => {
                    const lastMessage = getLastMessage(conversation);
                    const unreadCount = conversation._count?.unreadMessages || 0;
                    
                    return (
                      <DropdownMenuItem 
                        key={conversation.id}
                        className="px-4 py-2 focus:bg-muted cursor-pointer"
                        onSelect={(e) => {
                          e.preventDefault();
                          setActiveConversationId(conversation.id);
                        }}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarFallback className={unreadCount > 0 ? "bg-primary text-primary-foreground" : ""}>
                              {getParticipantInitials(conversation)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={cn(
                                "text-sm truncate",
                                unreadCount > 0 ? "font-medium" : ""
                              )}>
                                {getParticipantName(conversation)}
                              </p>
                              {lastMessage && (
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            {lastMessage && (
                              <p className={cn(
                                "text-xs truncate mt-0.5",
                                unreadCount > 0 ? "text-foreground" : "text-muted-foreground"
                              )}>
                                {lastMessage.senderId === user?.id && (
                                  <span className="mr-1 text-muted-foreground flex-shrink-0 inline-block">
                                    <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                                  </span>
                                )}
                                {lastMessage.content}
                              </p>
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="py-8 text-center">
                    <MessageCircleMore className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          {activeConversation && (
            <TabsContent value={activeConversation.id.toString()} className="focus:outline-none">
              <div className="h-[300px] flex flex-col">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {activeConversation.messages && activeConversation.messages.length > 0 ? (
                    <>
                      {activeConversation.messages.map((message) => (
                        <div 
                          key={message.id}
                          className={cn(
                            "flex gap-2 max-w-[85%]",
                            message.senderId === user?.id ? "ml-auto flex-row-reverse" : ""
                          )}
                        >
                          {message.senderId !== user?.id && (
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback>
                                {message.sender ? getInitials(message.sender.firstName, message.sender.lastName) : "--"}
                              </AvatarFallback>
                              {message.sender?.avatar && (
                                <AvatarImage src={message.sender.avatar} />
                              )}
                            </Avatar>
                          )}
                          <div>
                            <div className={cn(
                              "rounded-lg px-3 py-2 text-sm",
                              message.senderId === user?.id 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted"
                            )}>
                              {message.content}
                              {message.imageUrl && (
                                <img src={message.imageUrl} alt="Imagen adjunta" className="mt-2 rounded max-w-full" />
                              )}
                            </div>
                            <p className={cn(
                              "text-[10px] mt-1",
                              "text-muted-foreground",
                              message.senderId === user?.id ? "text-right" : ""
                            )}>
                              {formatTimestamp(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">No hay mensajes</p>
                    </div>
                  )}
                </div>
                
                <div className="p-3 border-t bg-background">
                  <form 
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                  >
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="flex-1 h-9"
                      disabled={!isConnected}
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      className="h-9 w-9"
                      disabled={!messageInput.trim() || !isConnected}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
          <button
            className="w-full px-4 py-2 text-xs text-center text-muted-foreground hover:text-primary flex items-center justify-center"
            onClick={() => {
              navigate('/messages');
              setIsOpen(false);
            }}
          >
            Ver todos los mensajes
            <ChevronsRight className="h-3.5 w-3.5 ml-1" />
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}