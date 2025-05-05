import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db";
import { chatMessages, chatConversations, chatConversationParticipants, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

// Tipos para los mensajes WebSocket
type WebSocketMessage = {
  type: "new_message" | "read_message" | "typing" | "stop_typing" | "connection_error";
  payload: any;
};

// Mapa para mantener las conexiones activas por usuario
const activeConnections = new Map<number, WebSocket[]>();

export function setupChatServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, request) => {
    // Extraer el ID de usuario de la cookie de sesión
    console.log("Nueva conexión WebSocket recibida");
    
    // Por ahora dejamos esto pendiente hasta implementar la autenticación
    let userId: number | null = null;
    
    // Si tenemos una sesión inválida o no hay usuario, cerramos la conexión
    if (!userId) {
      // Para desarrollo, permitimos conexiones sin autenticación
      // En producción, esto debería enviar un error y cerrar la conexión
      console.warn("Conexión WebSocket sin autenticación");
    }

    socket.on("message", async (message) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(message.toString());
        
        switch (parsedMessage.type) {
          case "new_message": {
            // Validar que el usuario tiene acceso a esta conversación
            const conversationId = parsedMessage.payload.conversationId;
            const messageContent = parsedMessage.payload.content;
            const imageUrl = parsedMessage.payload.imageUrl || null;
            
            if (!userId) {
              // Para desarrollo, asignamos un ID de usuario temporal
              userId = 1; // Esto se cambiará cuando implementemos la autenticación
            }
            
            // Verificar que el usuario es participante de la conversación
            const [participant] = await db
              .select()
              .from(chatConversationParticipants)
              .where(
                and(
                  eq(chatConversationParticipants.conversationId, conversationId),
                  eq(chatConversationParticipants.userId, userId)
                )
              );
            
            if (!participant) {
              socket.send(JSON.stringify({
                type: "connection_error",
                payload: { message: "No tienes acceso a esta conversación" }
              }));
              return;
            }
            
            // Guardar el mensaje en la base de datos
            const [newMessage] = await db
              .insert(chatMessages)
              .values({
                conversationId,
                senderId: userId,
                content: messageContent,
                imageUrl,
              })
              .returning();
            
            // Actualizar la fecha del último mensaje en la conversación
            await db
              .update(chatConversations)
              .set({ 
                lastMessageAt: new Date(),
                updatedAt: new Date() 
              })
              .where(eq(chatConversations.id, conversationId));
            
            // Obtener información del remitente
            const [sender] = await db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                avatar: users.avatar
              })
              .from(users)
              .where(eq(users.id, userId));
            
            // Obtener los participantes de la conversación
            const participants = await db
              .select({
                userId: chatConversationParticipants.userId
              })
              .from(chatConversationParticipants)
              .where(eq(chatConversationParticipants.conversationId, conversationId));
            
            // Preparar el mensaje completo con la información del remitente
            const completeMessage = {
              ...newMessage,
              sender: {
                id: sender.id,
                name: `${sender.firstName} ${sender.lastName}`,
                avatar: sender.avatar
              }
            };
            
            // Difundir a todos los participantes de la conversación
            participants.forEach(participant => {
              const connections = activeConnections.get(participant.userId);
              if (connections) {
                connections.forEach(conn => {
                  if (conn.readyState === WebSocket.OPEN) {
                    conn.send(JSON.stringify({
                      type: "new_message",
                      payload: completeMessage
                    }));
                  }
                });
              }
            });
            break;
          }
          
          case "read_message": {
            // Marcar mensajes como leídos
            const { conversationId } = parsedMessage.payload;
            
            if (!userId) {
              // Para desarrollo, asignamos un ID de usuario temporal
              userId = 1;
            }
            
            // Actualizar mensajes como leídos
            await db
              .update(chatMessages)
              .set({ seen: true })
              .where(
                and(
                  eq(chatMessages.conversationId, conversationId),
                  eq(chatMessages.seen, false)
                )
              );
            
            // Notificar a los remitentes que sus mensajes fueron leídos
            // (Implementación futura)
            break;
          }
          
          case "typing": {
            // Notificar que el usuario está escribiendo
            const { conversationId } = parsedMessage.payload;
            
            if (!userId) {
              userId = 1;
            }
            
            // Obtener los participantes de la conversación
            const participants = await db
              .select({
                userId: chatConversationParticipants.userId
              })
              .from(chatConversationParticipants)
              .where(eq(chatConversationParticipants.conversationId, conversationId));
            
            // Enviar notificación de escritura a todos los participantes
            participants.forEach(participant => {
              if (participant.userId !== userId) {
                const connections = activeConnections.get(participant.userId);
                if (connections) {
                  connections.forEach(conn => {
                    if (conn.readyState === WebSocket.OPEN) {
                      conn.send(JSON.stringify({
                        type: "typing",
                        payload: {
                          conversationId,
                          userId
                        }
                      }));
                    }
                  });
                }
              }
            });
            break;
          }
          
          case "stop_typing": {
            // Notificar que el usuario dejó de escribir
            const { conversationId } = parsedMessage.payload;
            
            if (!userId) {
              userId = 1;
            }
            
            // Obtener los participantes de la conversación
            const participants = await db
              .select({
                userId: chatConversationParticipants.userId
              })
              .from(chatConversationParticipants)
              .where(eq(chatConversationParticipants.conversationId, conversationId));
            
            // Enviar notificación de escritura a todos los participantes
            participants.forEach(participant => {
              if (participant.userId !== userId) {
                const connections = activeConnections.get(participant.userId);
                if (connections) {
                  connections.forEach(conn => {
                    if (conn.readyState === WebSocket.OPEN) {
                      conn.send(JSON.stringify({
                        type: "stop_typing",
                        payload: {
                          conversationId,
                          userId
                        }
                      }));
                    }
                  });
                }
              }
            });
            break;
          }
          
          default:
            console.warn(`Tipo de mensaje no reconocido: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error("Error procesando mensaje WebSocket:", error);
      }
    });

    socket.on("close", () => {
      console.log("Conexión WebSocket cerrada");
      if (userId) {
        // Eliminar esta conexión del mapa de conexiones activas
        const connections = activeConnections.get(userId);
        if (connections) {
          const index = connections.indexOf(socket);
          if (index !== -1) {
            connections.splice(index, 1);
            if (connections.length === 0) {
              activeConnections.delete(userId);
            }
          }
        }
      }
    });

    // Si tenemos un ID de usuario, guardamos la conexión
    if (userId) {
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, []);
      }
      activeConnections.get(userId)!.push(socket);
    }
  });

  console.log("Servidor WebSocket configurado en /ws");
  return wss;
}

// API endpoints para el chat
export function setupChatRoutes(app: any) {
  // Obtener todas las conversaciones del usuario
  app.get("/api/conversations", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userId = (req.user as any).id;
      
      // Buscar las conversaciones donde el usuario es participante
      const conversations = await db
        .select({
          id: chatConversations.id,
          title: chatConversations.title,
          isGroup: chatConversations.isGroup,
          createdAt: chatConversations.createdAt,
          updatedAt: chatConversations.updatedAt,
          lastMessageAt: chatConversations.lastMessageAt,
          createdBy: chatConversations.createdBy,
          projectId: chatConversations.projectId
        })
        .from(chatConversations)
        .innerJoin(
          chatConversationParticipants,
          eq(chatConversations.id, chatConversationParticipants.conversationId)
        )
        .where(eq(chatConversationParticipants.userId, userId))
        .orderBy(desc(chatConversations.lastMessageAt));
      
      // Para cada conversación, obtener el último mensaje y los participantes
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conversation) => {
          // Obtener el último mensaje
          const [lastMessage] = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, conversation.id))
            .orderBy(desc(chatMessages.createdAt))
            .limit(1);
          
          // Obtener los participantes
          const participants = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              avatar: users.avatar
            })
            .from(users)
            .innerJoin(
              chatConversationParticipants,
              eq(users.id, chatConversationParticipants.userId)
            )
            .where(eq(chatConversationParticipants.conversationId, conversation.id));
          
          // Si no es un grupo, computar el título como el nombre del otro participante
          let computedTitle = conversation.title;
          if (!conversation.isGroup && !computedTitle) {
            const otherParticipant = participants.find(p => p.id !== userId);
            if (otherParticipant) {
              computedTitle = `${otherParticipant.firstName} ${otherParticipant.lastName}`;
            }
          }
          
          // Contar mensajes no leídos
          const [{ count }] = await db
            .select({
              count: db.fn.count(chatMessages.id)
            })
            .from(chatMessages)
            .where(
              and(
                eq(chatMessages.conversationId, conversation.id),
                eq(chatMessages.seen, false),
                eq(chatMessages.senderId, userId)
              )
            );
          
          return {
            ...conversation,
            title: computedTitle,
            lastMessage: lastMessage || null,
            participants,
            unreadCount: Number(count) || 0
          };
        })
      );
      
      res.json(conversationsWithDetails);
      
    } catch (error) {
      console.error("Error al obtener conversaciones:", error);
      res.status(500).json({ message: "Error al obtener conversaciones" });
    }
  });

  // Obtener una conversación específica con sus mensajes
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userId = (req.user as any).id;
      const conversationId = parseInt(req.params.id);
      
      // Verificar que el usuario es participante
      const [participant] = await db
        .select()
        .from(chatConversationParticipants)
        .where(
          and(
            eq(chatConversationParticipants.conversationId, conversationId),
            eq(chatConversationParticipants.userId, userId)
          )
        );
      
      if (!participant) {
        return res.status(403).json({ message: "No tienes acceso a esta conversación" });
      }
      
      // Obtener la conversación
      const [conversation] = await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, conversationId));
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversación no encontrada" });
      }
      
      // Obtener los participantes
      const participants = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar
        })
        .from(users)
        .innerJoin(
          chatConversationParticipants,
          eq(users.id, chatConversationParticipants.userId)
        )
        .where(eq(chatConversationParticipants.conversationId, conversationId));
      
      // Obtener los mensajes
      const messages = await db
        .select({
          id: chatMessages.id,
          senderId: chatMessages.senderId,
          content: chatMessages.content,
          imageUrl: chatMessages.imageUrl,
          createdAt: chatMessages.createdAt,
          seen: chatMessages.seen
        })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(desc(chatMessages.createdAt));
      
      // Obtener información de todos los remitentes para los mensajes
      const senderIds = [...new Set(messages.map(message => message.senderId))];
      const senders = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar
        })
        .from(users)
        .where(users.id.in(senderIds));
      
      // Mapear la información de remitentes a los mensajes
      const messagesWithSenders = messages.map(message => {
        const sender = senders.find(s => s.id === message.senderId);
        return {
          ...message,
          sender: sender ? {
            id: sender.id,
            name: `${sender.firstName} ${sender.lastName}`,
            avatar: sender.avatar
          } : null
        };
      });
      
      // Si no es un grupo, computar el título como el nombre del otro participante
      let computedTitle = conversation.title;
      if (!conversation.isGroup && !computedTitle) {
        const otherParticipant = participants.find(p => p.id !== userId);
        if (otherParticipant) {
          computedTitle = `${otherParticipant.firstName} ${otherParticipant.lastName}`;
        }
      }
      
      res.json({
        ...conversation,
        title: computedTitle,
        participants,
        messages: messagesWithSenders
      });
      
    } catch (error) {
      console.error("Error al obtener conversación:", error);
      res.status(500).json({ message: "Error al obtener conversación" });
    }
  });

  // Crear una nueva conversación
  app.post("/api/conversations", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userId = (req.user as any).id;
      const { title, participantIds, isGroup, projectId } = req.body;
      
      // Validar que hay al menos otro participante
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ message: "Debe haber al menos un participante" });
      }
      
      // Si no es grupo y hay más de un participante, es un error
      if (!isGroup && participantIds.length > 1) {
        return res.status(400).json({ message: "Una conversación individual solo puede tener un participante además del creador" });
      }
      
      // Si no es grupo, verificar si ya existe una conversación entre estos dos usuarios
      if (!isGroup) {
        const otherUserId = participantIds[0];
        
        // Buscar conversaciones donde ambos usuarios son participantes y no es grupo
        const conversationsWithBothUsers = await db
          .select({ conversationId: chatConversationParticipants.conversationId })
          .from(chatConversationParticipants)
          .where(eq(chatConversationParticipants.userId, userId))
          .innerJoin(
            chatConversationParticipants.as("other"),
            and(
              eq(chatConversationParticipants.conversationId, db.ref("other.conversationId")),
              eq(db.ref("other.userId"), otherUserId)
            )
          )
          .innerJoin(
            chatConversations,
            and(
              eq(chatConversationParticipants.conversationId, chatConversations.id),
              eq(chatConversations.isGroup, false)
            )
          );
        
        if (conversationsWithBothUsers.length > 0) {
          // Ya existe una conversación entre estos usuarios
          return res.status(200).json({ 
            conversationId: conversationsWithBothUsers[0].conversationId,
            alreadyExists: true 
          });
        }
      }
      
      // Crear la nueva conversación
      const [newConversation] = await db
        .insert(chatConversations)
        .values({
          title: title || null,
          isGroup: isGroup || false,
          createdBy: userId,
          projectId: projectId || null,
          lastMessageAt: new Date()
        })
        .returning();
      
      // Añadir el creador como participante
      await db
        .insert(chatConversationParticipants)
        .values({
          conversationId: newConversation.id,
          userId
        });
      
      // Añadir los demás participantes
      for (const participantId of participantIds) {
        await db
          .insert(chatConversationParticipants)
          .values({
            conversationId: newConversation.id,
            userId: participantId
          });
      }
      
      res.status(201).json({
        ...newConversation,
        participants: [userId, ...participantIds]
      });
      
    } catch (error) {
      console.error("Error al crear conversación:", error);
      res.status(500).json({ message: "Error al crear conversación" });
    }
  });

  // Enviar un mensaje en una conversación
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userId = (req.user as any).id;
      const conversationId = parseInt(req.params.id);
      const { content, imageUrl } = req.body;
      
      // Verificar que el usuario es participante
      const [participant] = await db
        .select()
        .from(chatConversationParticipants)
        .where(
          and(
            eq(chatConversationParticipants.conversationId, conversationId),
            eq(chatConversationParticipants.userId, userId)
          )
        );
      
      if (!participant) {
        return res.status(403).json({ message: "No tienes acceso a esta conversación" });
      }
      
      // Crear el mensaje
      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          conversationId,
          senderId: userId,
          content,
          imageUrl: imageUrl || null
        })
        .returning();
      
      // Actualizar la fecha del último mensaje
      await db
        .update(chatConversations)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(chatConversations.id, conversationId));
      
      // Obtener información del remitente
      const [sender] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar
        })
        .from(users)
        .where(eq(users.id, userId));
      
      const messageWithSender = {
        ...newMessage,
        sender: {
          id: sender.id,
          name: `${sender.firstName} ${sender.lastName}`,
          avatar: sender.avatar
        }
      };
      
      res.status(201).json(messageWithSender);
      
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      res.status(500).json({ message: "Error al enviar mensaje" });
    }
  });
}