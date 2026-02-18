import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { createLogger } from "./logger";

const log = createLogger("socket");

let io: Server | null = null;

interface AuthPayload {
  userId: number;
  role: string;
}

/**
 * Initialize Socket.io server with JWT authentication.
 * Rooms: user:{userId} (personal), order:{orderId} (participants)
 */
export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // JWT authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as any).userId = decoded.userId;
      (socket as any).userRole = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    log.info({ userId, socketId: socket.id }, "Client connected");

    // Join personal room
    socket.join(`user:${userId}`);

    // Join order rooms
    socket.on("join:order", (orderId: number) => {
      socket.join(`order:${orderId}`);
      log.debug({ userId, orderId }, "Joined order room");
    });

    socket.on("leave:order", (orderId: number) => {
      socket.leave(`order:${orderId}`);
    });

    // Typing indicator
    socket.on("chat:typing", (data: { orderId: number; isTyping: boolean }) => {
      socket.to(`order:${data.orderId}`).emit("chat:typing", {
        userId,
        orderId: data.orderId,
        isTyping: data.isTyping,
      });
    });

    socket.on("disconnect", (reason) => {
      log.debug({ userId, socketId: socket.id, reason }, "Client disconnected");
    });
  });

  log.info("Socket.io server initialized");
  return io;
}

/**
 * Get the Socket.io server instance. Throws if not initialized.
 */
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initializeSocket() first.");
  }
  return io;
}

/**
 * Emit event to a specific user's personal room.
 */
export function emitToUser(userId: number, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit event to all participants in an order room.
 */
export function emitToOrder(orderId: number, event: string, data: any): void {
  if (!io) return;
  io.to(`order:${orderId}`).emit(event, data);
}
