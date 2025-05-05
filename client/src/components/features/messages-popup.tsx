import { useState } from "react";
import { 
  MessageSquare, 
  User, 
  Send, 
  ChevronsRight, 
  MessageCircleMore, 
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Message = {
  id: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
  };
  content: string;
  timestamp: Date;
  read: boolean;
  conversation: string;
};

type Conversation = {
  id: string;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
    initials: string;
  }>;
  lastMessage?: Message;
  unreadCount: number;
};

export function MessagesPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [, navigate] = useLocation();

  // Datos de ejemplo
  const conversations: Conversation[] = [
    {
      id: "1",
      participants: [
        { id: "2", name: "María López", initials: "ML" }
      ],
      lastMessage: {
        id: "101",
        sender: { id: "2", name: "María López", initials: "ML" },
        content: "¿Cuándo estará lista la propuesta para el cliente?",
        timestamp: new Date(Date.now() - 3600000), // 1 hora atrás
        read: false,
        conversation: "1"
      },
      unreadCount: 2
    },
    {
      id: "2",
      participants: [
        { id: "3", name: "Carlos Ruiz", initials: "CR" }
      ],
      lastMessage: {
        id: "201",
        sender: { id: "1", name: "Usuario Actual", initials: "YO" },
        content: "Revisaré los cambios y te aviso",
        timestamp: new Date(Date.now() - 86400000), // 1 día atrás
        read: true,
        conversation: "2"
      },
      unreadCount: 0
    }
  ];

  const messages: Record<string, Message[]> = {
    "1": [
      {
        id: "100",
        sender: { id: "2", name: "María López", initials: "ML" },
        content: "Hola, necesito actualizar el calendario del proyecto",
        timestamp: new Date(Date.now() - 7200000), // 2 horas atrás
        read: true,
        conversation: "1"
      },
      {
        id: "101",
        sender: { id: "2", name: "María López", initials: "ML" },
        content: "¿Cuándo estará lista la propuesta para el cliente?",
        timestamp: new Date(Date.now() - 3600000), // 1 hora atrás
        read: false,
        conversation: "1"
      }
    ],
    "2": [
      {
        id: "200",
        sender: { id: "3", name: "Carlos Ruiz", initials: "CR" },
        content: "Te envío los cambios solicitados para el proyecto",
        timestamp: new Date(Date.now() - 172800000), // 2 días atrás
        read: true,
        conversation: "2"
      },
      {
        id: "201",
        sender: { id: "1", name: "Usuario Actual", initials: "YO" },
        content: "Revisaré los cambios y te aviso",
        timestamp: new Date(Date.now() - 86400000), // 1 día atrás
        read: true,
        conversation: "2"
      }
    ]
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeConversation) return;
    
    // Aquí se implementaría el envío real del mensaje
    setMessageInput("");
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
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
        <Tabs defaultValue={activeConversation || "list"} onValueChange={(value) => {
          if (value !== "list") setActiveConversation(value);
        }}>
          <div className="border-b p-3 flex items-center justify-between">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="text-xs">Conversaciones</TabsTrigger>
              <TabsTrigger value={activeConversation || "list"} disabled={!activeConversation} className="text-xs">
                {activeConversation ? conversations.find(c => c.id === activeConversation)?.participants[0].name : "Chat"}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="list" className="focus:outline-none max-h-[400px] overflow-auto">
            <div className="py-2">
              {conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <DropdownMenuItem 
                    key={conversation.id}
                    className="px-4 py-2 focus:bg-muted cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      setActiveConversation(conversation.id);
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className={conversation.unreadCount > 0 ? "bg-primary text-primary-foreground" : ""}>
                          {conversation.participants[0].initials}
                        </AvatarFallback>
                        {conversation.participants[0].avatar && (
                          <AvatarImage src={conversation.participants[0].avatar} />
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn(
                            "text-sm truncate",
                            conversation.unreadCount > 0 ? "font-medium" : ""
                          )}>
                            {conversation.participants[0].name}
                          </p>
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(conversation.lastMessage.timestamp)}
                            </span>
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <p className={cn(
                            "text-xs truncate mt-0.5",
                            conversation.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {conversation.lastMessage.sender.id === "1" && (
                              <span className="mr-1 text-muted-foreground flex-shrink-0 inline-block">
                                <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                              </span>
                            )}
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                      {conversation.unreadCount > 0 && (
                        <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="py-8 text-center">
                  <MessageCircleMore className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          {activeConversation && (
            <TabsContent value={activeConversation} className="focus:outline-none">
              <div className="h-[300px] flex flex-col">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {messages[activeConversation]?.map((message) => (
                    <div 
                      key={message.id}
                      className={cn(
                        "flex gap-2 max-w-[85%]",
                        message.sender.id === "1" ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      {message.sender.id !== "1" && (
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarFallback>{message.sender.initials}</AvatarFallback>
                          {message.sender.avatar && (
                            <AvatarImage src={message.sender.avatar} />
                          )}
                        </Avatar>
                      )}
                      <div>
                        <div className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          message.sender.id === "1" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        )}>
                          {message.content}
                        </div>
                        <p className={cn(
                          "text-[10px] mt-1",
                          "text-muted-foreground",
                          message.sender.id === "1" ? "text-right" : ""
                        )}>
                          {formatTimestamp(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
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
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      className="h-9 w-9"
                      disabled={!messageInput.trim()}
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