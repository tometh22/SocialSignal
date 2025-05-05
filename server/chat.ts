import { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { parse } from "url";
import { storage } from "./storage";
import { Server } from "http";
import { User } from "@shared/schema";

interface MessagePayload {
  type: string;
  conversationId?: number;
  receiverId?: number;
  message?: string;
  imageUrl?: string;
  title?: string;
  isGroup?: boolean;
  userIds?: number[];
  projectId?: number;
}

// Estructura para almacenar conexiones activas
interface ActiveConnection {
  userId: number;
  socket: WebSocket;
}

// Clase para gestionar las conexiones WebSocket
export class ChatManager {
  private connections: ActiveConnection[] = [];
  private wss: WebSocketServer;

  constructor(httpServer: Server, path: string = "/ws") {
    this.wss = new WebSocketServer({ server: httpServer, path });
    console.log("Servidor WebSocket configurado en", path);

    this.wss.on("connection", (ws, req) => {
      try {
        const { query } = parse(req.url || "", true);
        const userId = Number(query.userId);

        if (!userId || isNaN(userId)) {
          console.log("Conexión rechazada: userId no válido");
          ws.close(1008, "userId no válido");
          return;
        }

        this.handleConnection(ws, userId);
      } catch (error) {
        console.error("Error en la conexión WebSocket:", error);
        ws.close(1011, "Error interno");
      }
    });
  }

  private handleConnection(ws: WebSocket, userId: number) {
    console.log(`Usuario conectado: ${userId}`);
    
    // Almacenar la conexión
    this.connections.push({ userId, socket: ws });

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({ type: "connected", message: "Conectado al servidor de chat" }));

    // Manejar mensajes entrantes
    ws.on("message", async (data) => {
      try {
        const payload: MessagePayload = JSON.parse(data.toString());
        await this.handleMessage(payload, userId);
      } catch (error) {
        console.error("Error al procesar mensaje:", error);
        ws.send(JSON.stringify({ type: "error", message: "Error al procesar mensaje" }));
      }
    });

    // Manejar cierre de conexión
    ws.on("close", () => {
      console.log(`Usuario desconectado: ${userId}`);
      this.connections = this.connections.filter(conn => conn.userId !== userId || conn.socket !== ws);
    });

    // Manejar errores
    ws.on("error", (error) => {
      console.error(`Error en la conexión del usuario ${userId}:`, error);
      this.connections = this.connections.filter(conn => conn.userId !== userId || conn.socket !== ws);
    });
  }

  private async handleMessage(payload: MessagePayload, senderId: number) {
    const { type } = payload;

    switch (type) {
      case "new_message":
        await this.handleNewMessage(payload, senderId);
        break;
      case "create_conversation":
        await this.handleCreateConversation(payload, senderId);
        break;
      case "read_messages":
        await this.handleReadMessages(payload, senderId);
        break;
      default:
        console.warn(`Tipo de mensaje no reconocido: ${type}`);
    }
  }

  private async handleNewMessage(payload: MessagePayload, senderId: number) {
    try {
      if (!payload.conversationId || !payload.message) {
        throw new Error("Datos de mensaje incompletos");
      }

      // Verificar si el usuario es participante de la conversación
      const isParticipant = await storage.isConversationParticipant(payload.conversationId, senderId);
      if (!isParticipant) {
        throw new Error("No eres participante de esta conversación");
      }

      // Guardar el mensaje en la base de datos
      const message = await storage.createChatMessage({
        conversationId: payload.conversationId,
        senderId,
        content: payload.message,
        imageUrl: payload.imageUrl,
      });

      // Actualizar la última actividad de la conversación
      await storage.updateConversationLastActivity(payload.conversationId);

      // Obtener todos los participantes de la conversación
      const participants = await storage.getConversationParticipants(payload.conversationId);

      // Preparar el mensaje para enviar a los clientes
      const messageToSend = {
        type: "new_message",
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId,
          content: message.content,
          imageUrl: message.imageUrl,
          createdAt: message.createdAt,
          seen: message.seen,
        }
      };

      // Enviar el mensaje a todos los participantes conectados
      participants.forEach(participant => {
        if (participant.userId !== senderId) { // No enviamos al remitente original
          this.sendToUser(participant.userId, messageToSend);
        }
      });

      // Enviar confirmación al remitente
      this.sendToUser(senderId, {
        type: "message_sent",
        messageId: message.id,
        conversationId: message.conversationId,
      });
    } catch (error) {
      console.error("Error al manejar nuevo mensaje:", error);
      this.sendToUser(senderId, {
        type: "error",
        message: error instanceof Error ? error.message : "Error al enviar mensaje",
      });
    }
  }

  private async handleCreateConversation(payload: MessagePayload, creatorId: number) {
    try {
      if ((!payload.receiverId && !payload.userIds) || !payload.title) {
        throw new Error("Datos de conversación incompletos");
      }

      let conversation;
      let participants: { userId: number }[] = [];

      // Si es una conversación directa (1 a 1)
      if (payload.receiverId && !payload.isGroup) {
        // Verificar si ya existe una conversación entre estos usuarios
        const existingConversation = await storage.getDirectConversation(creatorId, payload.receiverId);

        if (existingConversation) {
          // Devolver la conversación existente
          conversation = existingConversation;
          participants = await storage.getConversationParticipants(existingConversation.id);
        } else {
          // Crear nueva conversación
          conversation = await storage.createChatConversation({
            title: payload.title,
            isGroup: false,
            createdBy: creatorId,
            projectId: payload.projectId,
          });

          // Agregar participantes
          await storage.addConversationParticipant({ conversationId: conversation.id, userId: creatorId });
          await storage.addConversationParticipant({ conversationId: conversation.id, userId: payload.receiverId });
          
          participants = [
            { userId: creatorId },
            { userId: payload.receiverId }
          ];
        }
      } 
      // Si es una conversación grupal
      else if (payload.userIds && payload.userIds.length > 0 && payload.isGroup) {
        // Crear conversación grupal
        conversation = await storage.createChatConversation({
          title: payload.title,
          isGroup: true,
          createdBy: creatorId,
          projectId: payload.projectId,
        });

        // Agregar al creador si no está en la lista
        const uniqueUserIds = new Set(payload.userIds);
        uniqueUserIds.add(creatorId);

        // Agregar participantes
        for (const userId of uniqueUserIds) {
          await storage.addConversationParticipant({ conversationId: conversation.id, userId });
          participants.push({ userId });
        }
      } else {
        throw new Error("Configuración de conversación inválida");
      }

      // Obtener detalles completos de la conversación
      const fullConversation = await storage.getChatConversationWithDetails(conversation.id);

      // Enviar notificación a todos los participantes
      participants.forEach(participant => {
        this.sendToUser(participant.userId, {
          type: "conversation_created",
          conversation: fullConversation,
        });
      });
    } catch (error) {
      console.error("Error al crear conversación:", error);
      this.sendToUser(creatorId, {
        type: "error",
        message: error instanceof Error ? error.message : "Error al crear conversación",
      });
    }
  }

  private async handleReadMessages(payload: MessagePayload, userId: number) {
    try {
      if (!payload.conversationId) {
        throw new Error("ID de conversación requerido");
      }

      // Verificar si el usuario es participante de la conversación
      const isParticipant = await storage.isConversationParticipant(payload.conversationId, userId);
      if (!isParticipant) {
        throw new Error("No eres participante de esta conversación");
      }

      // Marcar mensajes como leídos
      await storage.markConversationMessagesAsSeen(payload.conversationId, userId);

      // Notificar al remitente que sus mensajes han sido leídos
      this.sendToUser(userId, {
        type: "messages_read",
        conversationId: payload.conversationId,
      });
    } catch (error) {
      console.error("Error al marcar mensajes como leídos:", error);
      this.sendToUser(userId, {
        type: "error",
        message: error instanceof Error ? error.message : "Error al actualizar mensajes",
      });
    }
  }

  // Método para enviar mensajes a un usuario específico
  private sendToUser(userId: number, data: any) {
    this.connections
      .filter(conn => conn.userId === userId && conn.socket.readyState === WebSocket.OPEN)
      .forEach(conn => {
        conn.socket.send(JSON.stringify(data));
      });
  }
}

// Middleware para establecer usuario en el request
export function setupChat(app: Express, httpServer: Server) {
  const chatManager = new ChatManager(httpServer);

  // API para obtener conversaciones de un usuario
  app.get("/api/conversations", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const conversations = await storage.getUserConversations(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Error al obtener conversaciones:", error);
      res.status(500).json({ message: "Error al obtener conversaciones" });
    }
  });

  // API para obtener una conversación específica con sus mensajes
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const conversationId = parseInt(req.params.id);
      
      // Verificar si el usuario es participante
      const isParticipant = await storage.isConversationParticipant(conversationId, req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "No tienes acceso a esta conversación" });
      }

      const conversation = await storage.getChatConversationWithDetails(conversationId);
      
      // Marcar los mensajes como leídos al acceder a la conversación
      await storage.markConversationMessagesAsSeen(conversationId, req.user.id);
      
      res.json(conversation);
    } catch (error) {
      console.error("Error al obtener conversación:", error);
      res.status(500).json({ message: "Error al obtener conversación" });
    }
  });

  // API para obtener mensajes de una conversación
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const conversationId = parseInt(req.params.id);
      
      // Verificar si el usuario es participante
      const isParticipant = await storage.isConversationParticipant(conversationId, req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "No tienes acceso a esta conversación" });
      }

      const messages = await storage.getChatMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error al obtener mensajes:", error);
      res.status(500).json({ message: "Error al obtener mensajes" });
    }
  });

  return chatManager;
}