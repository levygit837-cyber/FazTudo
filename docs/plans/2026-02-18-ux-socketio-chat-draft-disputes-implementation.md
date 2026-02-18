# UX Refinement: Socket.io, Flash Fix, Chat DRAFT & Delay Disputes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Socket.io real-time infrastructure, eliminate UI flashes, add pre-payment chat via DRAFT orders, and build professional delay detection with automated dispute flow.

**Architecture:** Incremental layered approach — Socket.io foundation first, then flash fixes with OrderBrief display, then Chat DRAFT system, then delay/dispute flow. Each layer depends on the previous.

**Tech Stack:** Socket.io 4.x, Express 5, React 18, Prisma 7.3, TypeScript, TailwindCSS

---

## Task 1: Install Socket.io Dependencies

**Files:**
- Modify: `backend/package.json`
- Modify: `frontend/package.json`

**Step 1: Install backend Socket.io**

Run: `cd /home/levybonito/faztudo-main/backend && npm install socket.io`

Expected: socket.io added to dependencies

**Step 2: Install frontend Socket.io client**

Run: `cd /home/levybonito/faztudo-main/frontend && npm install socket.io-client`

Expected: socket.io-client added to dependencies

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "feat: add socket.io dependencies for real-time communication"
```

---

## Task 2: Create Socket.io Server Singleton

**Files:**
- Create: `backend/src/lib/socket.ts`

**Step 1: Create the Socket.io server module**

Create `backend/src/lib/socket.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/lib/socket.ts
git commit -m "feat: create Socket.io server singleton with JWT auth and room management"
```

---

## Task 3: Integrate Socket.io with Express Server

**Files:**
- Modify: `backend/src/index.ts`

**Step 1: Modify index.ts to use HTTP server with Socket.io**

In `backend/src/index.ts`, make these changes:

1. Add import at top: `import { createServer } from "http";`
2. Add import: `import { initializeSocket } from "./lib/socket";`
3. After `const app = express();` add: `const httpServer = createServer(app);`
4. Before the server starts, add: `initializeSocket(httpServer);`
5. Change `app.listen(PORT, ...)` to `httpServer.listen(PORT, ...)`
6. Update `server.close()` reference in gracefulShutdown

The key changes:
- `const httpServer = createServer(app);` — wrap Express in HTTP server
- `initializeSocket(httpServer);` — attach Socket.io to HTTP server
- `const server = httpServer.listen(PORT, ...)` — listen via HTTP server
- Add `connectSrc: ["'self'", "ws:", "wss:"]` to Helmet CSP for WebSocket

**Step 2: Verify server starts**

Run: `cd /home/levybonito/faztudo-main/backend && timeout 5 npm run dev || true`

Expected: Server starts on port 3001 with "Socket.io server initialized" log

**Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: integrate Socket.io with Express HTTP server"
```

---

## Task 4: Create Frontend Socket Context & Hook

**Files:**
- Create: `frontend/src/context/SocketContext.tsx`
- Create: `frontend/src/hooks/useSocket.ts`

**Step 1: Create SocketContext**

Create `frontend/src/context/SocketContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocketContext = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const newSocket = io(apiUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
```

**Step 2: Create useSocket hook**

Create `frontend/src/hooks/useSocket.ts`:

```typescript
import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";

/**
 * Hook to subscribe to Socket.io events.
 * Automatically subscribes on mount and unsubscribes on unmount.
 *
 * @example
 * useSocket("notification:new", (data) => {
 *   console.log("New notification:", data);
 * });
 */
export function useSocket<T = any>(event: string, handler: (data: T) => void): void {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}

/**
 * Hook to join/leave an order room for real-time updates.
 */
export function useOrderRoom(orderId: number | undefined): void {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket || !orderId) return;

    socket.emit("join:order", orderId);
    return () => {
      socket.emit("leave:order", orderId);
    };
  }, [socket, orderId]);
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/context/SocketContext.tsx frontend/src/hooks/useSocket.ts
git commit -m "feat: create SocketContext provider and useSocket/useOrderRoom hooks"
```

---

## Task 5: Wire SocketProvider into App & Layout

**Files:**
- Modify: `frontend/src/App.tsx` — wrap routes with `<SocketProvider>`
- Modify: `frontend/src/components/Layout.tsx` — use Socket for notification badge

**Step 1: Add SocketProvider to App.tsx**

In `frontend/src/App.tsx`:
1. Import `SocketProvider` from `./context/SocketContext`
2. Wrap the content inside `<AuthProvider>` with `<SocketProvider>`:
   ```tsx
   <AuthProvider>
     <SocketProvider>
       {/* existing ThemeProvider, ToastProvider, Router content */}
     </SocketProvider>
   </AuthProvider>
   ```

**Step 2: Use Socket for real-time notification count in Layout.tsx**

In `frontend/src/components/Layout.tsx`:
1. Import `useSocket` from `../hooks/useSocket`
2. Add a `useSocket("notification:new", callback)` that increments `unreadNotifications`
3. Keep polling as fallback but increase interval from 300000ms (5min) to 60000ms (1min)

```tsx
// Add inside Layout component, after existing notification polling
useSocket("notification:new", () => {
  setUnreadNotifications((prev) => prev + 1);
});
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: wire SocketProvider into App and add real-time notification badge"
```

---

## Task 6: Emit Socket Events from Backend Controllers

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts` — emit on accept/reject/status changes
- Modify: `backend/src/controllers/service/messageController.ts` — emit on new message
- Modify: `backend/src/controllers/service/notificationController.ts` — emit after creating notification

**Step 1: Add Socket emissions to orderController**

In `backend/src/controllers/service/orderController.ts`:
1. Import `emitToUser, emitToOrder` from `../../lib/socket`
2. In `acceptServiceOrder()` after creating notification, add:
   ```typescript
   emitToUser(serviceOrder.clientId, "order:accepted", {
     orderId: serviceOrder.id,
     title: serviceOrder.title,
     professionalName: req.user.name,
   });
   emitToOrder(serviceOrder.id, "order:statusChanged", {
     orderId: serviceOrder.id,
     status: "ACCEPTED",
   });
   ```
3. In `cancelServiceOrder()` add similar emissions for ORDER_CANCELLED
4. In `startServiceOrder()` add emission for IN_PROGRESS
5. In `completeServiceOrder()` add emission for status changes

**Step 2: Add Socket emissions to messageController**

In `backend/src/controllers/service/messageController.ts`:
1. Import `emitToOrder` from `../../lib/socket`
2. After creating a message, add:
   ```typescript
   emitToOrder(serviceOrder.id, "chat:message", {
     id: message.id,
     content: message.content,
     type: message.type,
     senderId: message.senderId,
     createdAt: message.createdAt,
   });
   ```

**Step 3: Add Socket emission to notification creation**

In the local `createNotification` utility in `orderController.ts`, add:
```typescript
emitToUser(userId, "notification:new", { id: notification.id, type, title, message });
```

Do the same in `backend/src/services/notificationService.ts` `createNotification()`.

**Step 4: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/controllers/service/orderController.ts backend/src/controllers/service/messageController.ts backend/src/services/notificationService.ts
git commit -m "feat: emit Socket.io events from order, message, and notification controllers"
```

---

## Task 7: Fix Flash in OrderDetails — Optimistic Updates

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Step 1: Add Socket.io integration and optimistic updates**

In `frontend/src/pages/orders/OrderDetails.tsx`:

1. Import `useSocket, useOrderRoom` from `../../hooks/useSocket`
2. Call `useOrderRoom(orderId)` to join the order room
3. Add `useSocket("order:statusChanged", callback)` that updates order state locally without re-fetch
4. Modify `loadOrder()`:
   - Add a parameter `isRefresh: boolean = false`
   - Only set `setLoading(true)` when `!isRefresh`
   - For refreshes, update state silently
5. Modify `handleAction()`:
   - Before calling the API, save current order state: `const previousOrder = { ...order }`
   - After calling the API action, do NOT call `loadOrder()` — the Socket event will update the state
   - If the API call fails, revert: `setOrder(previousOrder)` + toast error
6. For accept action specifically:
   - Optimistically set `order.status = "ACCEPTED"` immediately
   - The Socket event `order:statusChanged` will confirm

**Step 2: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "fix: eliminate flash on order status changes with optimistic updates and Socket.io"
```

---

## Task 8: Fix Flash in ServiceOrdersList — Optimistic Updates

**Files:**
- Modify: `frontend/src/components/orders/ServiceOrdersList.tsx`
- Modify: `frontend/src/components/orders/OrderCard.tsx`

**Step 1: Add optimistic updates to ServiceOrdersList**

In `frontend/src/components/orders/ServiceOrdersList.tsx`:

1. Import `useSocket` from `../../hooks/useSocket`
2. Add `useSocket("order:statusChanged", callback)` that updates the specific order in the `orders` array without full reload
3. Modify `handleAcceptOrder`:
   - Set loading state on the specific card (pass `actionLoadingId` state)
   - Optimistically move the order to ACCEPTED status in local state
   - Call API in background
   - If fail, revert + toast error
4. Modify `handleRejectOrder` similarly:
   - Optimistically remove from list (or mark as CANCELLED)
   - Call API in background
   - If fail, revert

**Step 2: Add button-level loading to OrderCard**

In `frontend/src/components/orders/OrderCard.tsx`:
1. Add prop `isActionLoading?: boolean`
2. When `isActionLoading`, show spinner on accept/reject buttons and disable them
3. Add subtle transition: when status changes, card smoothly animates out of PENDING tab

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/orders/ServiceOrdersList.tsx frontend/src/components/orders/OrderCard.tsx
git commit -m "fix: eliminate flash in order list with optimistic updates and card-level loading"
```

---

## Task 9: Backend — Include OrderBrief in API Responses

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Add brief to getServiceOrder Prisma include**

In `backend/src/controllers/service/orderController.ts`:

1. Find `getServiceOrder()` function
2. In the `prisma.serviceOrder.findUnique({ include: {...} })` call, add:
   ```typescript
   brief: {
     include: {
       category: true,
     },
   },
   ```
3. Do the same in `acceptServiceOrder()` response include
4. Do the same in `getUserServiceOrders()` for list queries (include brief in the findMany)

**Step 2: Verify with type check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "feat: include OrderBrief data in order API responses"
```

---

## Task 10: Frontend — Add OrderBrief Type and Display

**Files:**
- Modify: `frontend/src/types/entities.ts`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Step 1: Add OrderBrief interface to entities.ts**

In `frontend/src/types/entities.ts`, add the `OrderBrief` interface:

```typescript
export interface OrderBrief {
  id: number;
  serviceOrderId: number;
  categoryId?: number;
  urgencyLevel: string; // LOW, NORMAL, HIGH, URGENT
  priceRangeMin?: number;
  priceRangeMax?: number;
  briefData: Record<string, any>;
  mediaUrls?: string[];
  notes?: string;
  category?: ServiceCategory;
  createdAt: string;
}
```

Add `brief?: OrderBrief;` field to the `ServiceOrder` interface.

**Step 2: Display OrderBrief in OrderDetails after acceptance**

In `frontend/src/pages/orders/OrderDetails.tsx`, when `order.status === "ACCEPTED"` and user is professional:

Add a new section below the status change confirmation:

```tsx
{/* Client Instructions Section */}
{order.status === "ACCEPTED" && isProfessionalView && order.brief && (
  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 space-y-4">
    <h3 className="text-lg font-semibold flex items-center gap-2">
      <ClipboardList className="text-blue-600" size={20} />
      Instrucoes do Cliente
    </h3>

    <p className="text-sm text-slate-600 dark:text-slate-400">
      Pedido aceito! Veja as instrucoes do cliente abaixo e inicie uma conversa para combinar os detalhes.
    </p>

    {/* Urgency badge */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Urgencia:</span>
      <UrgencyBadge level={order.brief.urgencyLevel} />
    </div>

    {/* Price range */}
    {(order.brief.priceRangeMin || order.brief.priceRangeMax) && (
      <div className="flex items-center gap-2">
        <DollarSign size={16} />
        <span>Faixa de preco: R$ {order.brief.priceRangeMin?.toFixed(2)} - R$ {order.brief.priceRangeMax?.toFixed(2)}</span>
      </div>
    )}

    {/* Brief data rendered dynamically */}
    {order.brief.briefData && Object.entries(order.brief.briefData).map(([key, value]) => (
      <div key={key} className="flex justify-between py-1 border-b border-slate-200">
        <span className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
        <span className="text-sm">{String(value)}</span>
      </div>
    ))}

    {/* Media thumbnails */}
    {order.brief.mediaUrls && order.brief.mediaUrls.length > 0 && (
      <div className="space-y-2">
        <span className="text-sm font-medium">Fotos/Videos:</span>
        <div className="flex gap-2 flex-wrap">
          {order.brief.mediaUrls.map((url, i) => (
            <img key={i} src={url} alt={`Midia ${i+1}`} className="w-20 h-20 rounded-lg object-cover" />
          ))}
        </div>
      </div>
    )}

    {/* Notes */}
    {order.brief.notes && (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
        <span className="text-sm font-medium">Notas:</span>
        <p className="text-sm mt-1">{order.brief.notes}</p>
      </div>
    )}

    {/* Start conversation button */}
    <button
      onClick={() => navigate(`/professional/services/${order.id}/chat`)}
      className="w-full btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
    >
      <MessageCircle size={18} />
      Iniciar conversa com o cliente
    </button>
  </div>
)}
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/types/entities.ts frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: display OrderBrief instructions to professional after order acceptance"
```

---

## Task 11: Backend — Add DRAFT Status and Create Draft Order Endpoint

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/service/orderController.ts`
- Modify: `backend/src/routes/orderRoutes.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Add DRAFT to ServiceOrderStatus enum**

In `backend/prisma/schema.prisma`, add `DRAFT` to `ServiceOrderStatus`:

```prisma
enum ServiceOrderStatus {
  DRAFT     // Rascunho - chat de duvidas pre-pagamento
  PENDING
  ACCEPTED
  IN_PROGRESS
  AWAITING_CLIENT_CONFIRMATION
  AWAITING_PROFESSIONAL_CONFIRMATION
  COMPLETED
  CANCELLED
  EXPIRED
  DISPUTED
}
```

**Step 2: Add conversion fields to ServiceOrder model**

In `backend/prisma/schema.prisma`, add to the `ServiceOrder` model:

```prisma
  // DRAFT conversion flow
  convertProposedBy  Int?     // userId who proposed converting DRAFT to order
  convertStatus      String?  // "PROPOSED", "ACCEPTED", "REJECTED"

  // Professional en-route tracking
  enRouteAt          DateTime?
```

**Step 3: Push schema**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`

Expected: Schema pushed successfully

**Step 4: Add validation schema**

In `backend/src/middleware/validation.ts`, add:

```typescript
export const createDraftOrderSchema = z.object({
  serviceListingId: z.number().int().positive(),
  message: z.string().min(1).max(2000),
});

export const convertToOrderSchema = z.object({
  action: z.enum(["propose", "accept", "reject"]),
});
```

**Step 5: Add createDraftOrder controller function**

In `backend/src/controllers/service/orderController.ts`, add:

```typescript
export const createDraftOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceListingId, message } = req.body;
  const userId = req.user!.id;

  // Find the listing
  const listing = await prisma.serviceListing.findUnique({
    where: { id: serviceListingId },
    include: { professional: true },
  });

  if (!listing) {
    res.status(404).json({ success: false, message: "Servico nao encontrado" });
    return;
  }

  if (listing.professionalId === userId) {
    res.status(400).json({ success: false, message: "Voce nao pode iniciar chat com voce mesmo" });
    return;
  }

  // Check if there's already a DRAFT order between this client and this listing
  const existingDraft = await prisma.serviceOrder.findFirst({
    where: {
      clientId: userId,
      serviceListingId,
      status: "DRAFT",
    },
  });

  if (existingDraft) {
    // Return existing draft instead of creating new one
    res.json({ success: true, message: "Chat existente encontrado", data: existingDraft });
    return;
  }

  // Create DRAFT order + first message in transaction
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.create({
      data: {
        title: `Duvidas: ${listing.title}`,
        description: `Chat de duvidas sobre "${listing.title}"`,
        price: listing.price,
        status: "DRAFT",
        clientId: userId,
        professionalId: listing.professionalId,
        serviceListingId,
      },
    });

    // Create the first message
    await tx.message.create({
      data: {
        content: message,
        type: "TEXT",
        senderId: userId,
        recipientId: listing.professionalId,
        serviceOrderId: order.id,
      },
    });

    // System message
    await tx.message.create({
      data: {
        content: `💬 Nova conversa de duvidas sobre "${listing.title}". Este chat ainda nao e um pedido formal.`,
        type: "SYSTEM",
        senderId: userId,
        recipientId: listing.professionalId,
        serviceOrderId: order.id,
      },
    });

    return order;
  });

  // Notify professional
  await createNotification(
    listing.professionalId,
    "NEW_MESSAGE",
    "Nova conversa de duvidas",
    `${req.user!.name} quer tirar duvidas sobre "${listing.title}"`,
    result.id
  );

  emitToUser(listing.professionalId, "notification:new", {
    type: "NEW_MESSAGE",
    title: "Nova conversa de duvidas",
  });

  res.status(201).json({ success: true, message: "Chat criado com sucesso", data: result });
};
```

**Step 6: Add convertDraftToOrder controller function**

```typescript
export const convertDraftToOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const orderId = parseInt(req.params.id);
  const userId = req.user!.id;
  const { action } = req.body; // "propose", "accept", "reject"

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { client: true, professional: true },
  });

  if (!order || order.status !== "DRAFT") {
    res.status(404).json({ success: false, message: "Pedido DRAFT nao encontrado" });
    return;
  }

  if (order.clientId !== userId && order.professionalId !== userId) {
    res.status(403).json({ success: false, message: "Sem permissao" });
    return;
  }

  if (action === "propose") {
    if (order.convertStatus === "PROPOSED") {
      res.status(400).json({ success: false, message: "Ja existe uma proposta pendente" });
      return;
    }

    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { convertProposedBy: userId, convertStatus: "PROPOSED" },
    });

    const otherUserId = userId === order.clientId ? order.professionalId! : order.clientId;
    const proposerName = userId === order.clientId ? order.client.name : order.professional!.name;

    // System message in chat
    await prisma.message.create({
      data: {
        content: `🛒 ${proposerName} propôs converter esta conversa em um pedido formal. Aguardando confirmacao.`,
        type: "SYSTEM",
        senderId: userId,
        recipientId: otherUserId,
        serviceOrderId: orderId,
      },
    });

    emitToUser(otherUserId, "order:convertProposal", { orderId, proposedBy: userId, proposerName });
    emitToOrder(orderId, "chat:message", { type: "SYSTEM", content: `🛒 ${proposerName} propôs converter em pedido.` });

    res.json({ success: true, message: "Proposta enviada" });
  } else if (action === "accept") {
    if (order.convertStatus !== "PROPOSED" || order.convertProposedBy === userId) {
      res.status(400).json({ success: false, message: "Nao ha proposta para aceitar" });
      return;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { status: "PENDING", convertStatus: "ACCEPTED" },
    });

    await prisma.message.create({
      data: {
        content: "✅ Proposta aceita! O pedido agora e formal. O cliente sera redirecionado para o checkout.",
        type: "SYSTEM",
        senderId: userId,
        recipientId: order.convertProposedBy!,
        serviceOrderId: orderId,
      },
    });

    emitToOrder(orderId, "order:statusChanged", { orderId, status: "PENDING" });
    emitToUser(order.clientId, "order:convertAccepted", { orderId });

    res.json({ success: true, message: "Pedido convertido para PENDING", data: updated });
  } else if (action === "reject") {
    if (order.convertStatus !== "PROPOSED" || order.convertProposedBy === userId) {
      res.status(400).json({ success: false, message: "Nao ha proposta para rejeitar" });
      return;
    }

    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { convertProposedBy: null, convertStatus: "REJECTED" },
    });

    await prisma.message.create({
      data: {
        content: "❌ A proposta de pedido foi recusada. A conversa continua normalmente.",
        type: "SYSTEM",
        senderId: userId,
        recipientId: order.convertProposedBy!,
        serviceOrderId: orderId,
      },
    });

    emitToOrder(orderId, "chat:message", { type: "SYSTEM", content: "❌ Proposta recusada." });

    res.json({ success: true, message: "Proposta recusada" });
  }
};
```

**Step 7: Add routes**

In `backend/src/routes/orderRoutes.ts`, add:

```typescript
router.post("/orders/draft", verifyToken, requireVerified, validateBody(createDraftOrderSchema), createDraftOrder);
router.post("/orders/:id/convert", verifyToken, requireVerified, validateBody(convertToOrderSchema), convertDraftToOrder);
```

**IMPORTANT**: Place these routes BEFORE any `/:id` routes to avoid conflicts.

**Step 8: Run type check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/service/orderController.ts backend/src/routes/orderRoutes.ts backend/src/middleware/validation.ts
git commit -m "feat: add DRAFT order status with create, convert, and dual-confirmation endpoints"
```

---

## Task 12: Backend — Allow Chat Messages for DRAFT Orders

**Files:**
- Modify: `backend/src/controllers/service/messageController.ts`
- Modify: `backend/src/controllers/service/chatController.ts`

**Step 1: Modify sendMessage to allow DRAFT orders**

In `backend/src/controllers/service/messageController.ts`:

Find the payment gate check:
```typescript
if (!isAdmin && serviceOrder.payments.length === 0) {
  // 403 error
}
```

Change to:
```typescript
const isDraft = serviceOrder.status === "DRAFT";
if (!isAdmin && !isDraft && serviceOrder.payments.length === 0) {
  res.status(403).json({ success: false, message: "Chat disponivel apenas apos pagamento ser aprovado" });
  return;
}

// For DRAFT orders, only allow TEXT messages
if (isDraft && type !== "TEXT") {
  res.status(400).json({ success: false, message: "Apenas mensagens de texto sao permitidas em conversas de duvidas" });
  return;
}
```

**Step 2: Modify getUserChats to include DRAFT orders**

In `backend/src/controllers/service/chatController.ts`:

Find the payment filter in `getUserChats`:
```typescript
payments: {
  some: {
    status: { in: ["HELD", "RELEASED", "PARTIALLY_REFUNDED"] },
  },
},
```

Change to use an OR clause:
```typescript
OR: [
  {
    payments: {
      some: {
        status: { in: ["HELD", "RELEASED", "PARTIALLY_REFUNDED"] },
      },
    },
  },
  {
    status: "DRAFT",
  },
],
```

**Step 3: Run type check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/controllers/service/messageController.ts backend/src/controllers/service/chatController.ts
git commit -m "feat: allow text-only chat messages for DRAFT orders without payment"
```

---

## Task 13: Frontend — Add DRAFT Enum and Update ServiceDetails Modal

**Files:**
- Modify: `frontend/src/types/enums.ts`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`
- Modify: `frontend/src/services/serviceService.ts`

**Step 1: Add DRAFT to ServiceOrderStatus enum**

In `frontend/src/types/enums.ts`, add `DRAFT = "DRAFT"` as the first value:

```typescript
export enum ServiceOrderStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  // ... rest unchanged
}
```

**Step 2: Add API call to create draft order**

In `frontend/src/services/serviceService.ts`, add:

```typescript
export const createDraftOrder = async (serviceListingId: number, message: string) => {
  const response = await api.post("/services/orders/draft", { serviceListingId, message });
  return response.data.data;
};

export const convertDraftOrder = async (orderId: number, action: "propose" | "accept" | "reject") => {
  const response = await api.post(`/services/orders/${orderId}/convert`, { action });
  return response.data.data;
};
```

**Step 3: Fix the ServiceDetails contact modal**

In `frontend/src/pages/services/ServiceDetails.tsx`:

1. Add state: `const [contactMessage, setContactMessage] = useState("");`
2. Add state: `const [sendingMessage, setSendingMessage] = useState(false);`
3. Wire the textarea to state: `value={contactMessage} onChange={(e) => setContactMessage(e.target.value)}`
4. Wire the "Enviar" button:

```tsx
<button
  onClick={async () => {
    if (!contactMessage.trim()) return;
    setSendingMessage(true);
    try {
      const draft = await createDraftOrder(service.id, contactMessage.trim());
      setShowContactModal(false);
      setContactMessage("");
      toast.success("Mensagem enviada! Redirecionando para o chat...");
      const basePath = user?.role === "CLIENT" ? "/client/orders" : "/professional/services";
      navigate(`${basePath}/${draft.id}/chat`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao enviar mensagem");
    } finally {
      setSendingMessage(false);
    }
  }}
  disabled={!contactMessage.trim() || sendingMessage}
  className="flex-1 btn bg-blue-600 text-white disabled:opacity-50"
>
  {sendingMessage ? <Loader2 className="animate-spin" size={16} /> : "Enviar"}
</button>
```

**Step 4: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/types/enums.ts frontend/src/pages/services/ServiceDetails.tsx frontend/src/services/serviceService.ts
git commit -m "feat: wire 'Tirar Duvidas' modal to create DRAFT orders and navigate to chat"
```

---

## Task 14: Frontend — Update Chat for DRAFT Orders

**Files:**
- Modify: `frontend/src/pages/services/ServiceChat.tsx`
- Modify: `frontend/src/pages/Messages.tsx`

**Step 1: Update ServiceChat for DRAFT mode**

In `frontend/src/pages/services/ServiceChat.tsx`:

1. Import `useSocket, useOrderRoom` from hooks
2. Call `useOrderRoom(orderId)`
3. Use Socket for real-time messages instead of polling:
   ```tsx
   useSocket("chat:message", (msg) => {
     setMessages((prev) => [...prev, msg]);
   });
   ```
4. Keep polling as fallback but increase to 30s
5. When order status is DRAFT:
   - Hide upload and location buttons
   - Show banner at top:
     ```tsx
     {order?.status === "DRAFT" && (
       <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <MessageCircle size={16} className="text-amber-600" />
           <span className="text-sm text-amber-800 dark:text-amber-200">
             Conversa de duvidas — ainda nao e um pedido formal
           </span>
         </div>
         <button
           onClick={() => handleConvertProposal()}
           className="btn bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg"
         >
           Contratar servico →
         </button>
       </div>
     )}
     ```
6. Add `handleConvertProposal` function that calls `convertDraftOrder(orderId, "propose")`
7. Add `useSocket("order:convertProposal")` handler that shows accept/reject buttons in the banner
8. Add `useSocket("order:convertAccepted")` handler that redirects client to checkout

**Step 2: Update Messages page for DRAFT badge**

In `frontend/src/pages/Messages.tsx`:

When rendering conversation status, add DRAFT handling:
```tsx
{conv.orderStatus === "DRAFT" && (
  <span className="badge bg-amber-100 text-amber-800 text-xs">Duvidas</span>
)}
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/pages/services/ServiceChat.tsx frontend/src/pages/Messages.tsx
git commit -m "feat: update chat UI for DRAFT orders with convert-to-order flow"
```

---

## Task 15: Backend — Add En-Route and Delay Detection Endpoints

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts`
- Modify: `backend/src/routes/orderRoutes.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Add markEnRoute controller**

In `backend/src/controllers/service/orderController.ts`, add:

```typescript
export const markEnRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  const orderId = parseInt(req.params.id);
  const userId = req.user!.id;

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { client: true, professional: true },
  });

  if (!order) {
    res.status(404).json({ success: false, message: "Pedido nao encontrado" });
    return;
  }

  if (order.professionalId !== userId) {
    res.status(403).json({ success: false, message: "Apenas o profissional pode marcar trajeto" });
    return;
  }

  if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
    res.status(400).json({ success: false, message: "Status invalido para iniciar trajeto" });
    return;
  }

  const updated = await prisma.serviceOrder.update({
    where: { id: orderId },
    data: { enRouteAt: new Date() },
  });

  // Notify client
  await createNotification(
    order.clientId,
    "PROFESSIONAL_EN_ROUTE",
    "Profissional a caminho!",
    `${order.professional!.name} esta a caminho para realizar o servico "${order.title}"`,
    orderId
  );

  emitToUser(order.clientId, "order:enRoute", {
    orderId,
    professionalName: order.professional!.name,
  });

  res.json({ success: true, message: "Trajeto iniciado", data: updated });
};
```

**Step 2: Add delayResponse controller**

```typescript
export const delayResponse = async (req: AuthRequest, res: Response): Promise<void> => {
  const orderId = parseInt(req.params.id);
  const userId = req.user!.id;
  const { arrived, action } = req.body;

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { client: true, professional: true },
  });

  if (!order || order.clientId !== userId) {
    res.status(403).json({ success: false, message: "Sem permissao" });
    return;
  }

  if (arrived === true) {
    // Professional arrived, no action needed
    res.json({ success: true, message: "Ok, bom servico!" });
    return;
  }

  if (action === "message") {
    // Send system message in chat + notify professional
    await prisma.message.create({
      data: {
        content: "⏰ O cliente reportou que o profissional nao chegou no horario agendado.",
        type: "SYSTEM",
        senderId: userId,
        recipientId: order.professionalId!,
        serviceOrderId: orderId,
      },
    });

    await createNotification(
      order.professionalId!,
      "SYSTEM_ALERT",
      "Cliente aguardando",
      `O cliente reportou que voce nao chegou no horario agendado para "${order.title}"`,
      orderId
    );

    emitToUser(order.professionalId!, "notification:new", {
      type: "SYSTEM_ALERT",
      title: "Cliente aguardando",
    });
    emitToOrder(orderId, "chat:message", {
      type: "SYSTEM",
      content: "⏰ Cliente reportou atraso do profissional.",
    });

    res.json({ success: true, message: "Mensagem enviada ao profissional" });
  } else if (action === "dispute") {
    // Create automatic dispute
    const dispute = await prisma.dispute.create({
      data: {
        serviceOrderId: orderId,
        initiatorId: userId,
        reason: "Profissional nao compareceu",
        description: `O profissional nao chegou no horario agendado (${order.scheduledDate?.toISOString()}) e nao iniciou o trajeto apos 15 minutos.`,
        status: "OPEN",
      },
    });

    // Set order to DISPUTED
    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { status: "DISPUTED" },
    });

    // System message in chat
    await prisma.message.create({
      data: {
        content: "⚠️ Uma disputa foi aberta: Profissional nao compareceu no horario agendado.",
        type: "SYSTEM",
        senderId: userId,
        recipientId: order.professionalId!,
        serviceOrderId: orderId,
      },
    });

    // Notify both
    await createNotification(
      order.professionalId!,
      "SYSTEM_ALERT",
      "Disputa aberta",
      `Uma disputa foi aberta para "${order.title}": Profissional nao compareceu`,
      orderId
    );

    emitToUser(order.professionalId!, "notification:new", { type: "SYSTEM_ALERT", title: "Disputa aberta" });
    emitToUser(order.clientId, "notification:new", { type: "SYSTEM_ALERT", title: "Disputa registrada" });
    emitToOrder(orderId, "order:statusChanged", { orderId, status: "DISPUTED" });

    res.json({ success: true, message: "Disputa aberta com sucesso", data: dispute });
  }
};
```

**Step 3: Add validation schemas**

In `backend/src/middleware/validation.ts`:

```typescript
export const delayResponseSchema = z.object({
  arrived: z.boolean().optional(),
  action: z.enum(["message", "dispute"]).optional(),
}).refine(
  (data) => data.arrived !== undefined || data.action !== undefined,
  { message: "Informe 'arrived' ou 'action'" }
);
```

**Step 4: Add routes**

In `backend/src/routes/orderRoutes.ts`:

```typescript
router.post("/orders/:id/en-route", verifyToken, requireRole("PROFESSIONAL", "COMPANY"), requireVerified, markEnRoute);
router.post("/orders/:id/delay-response", verifyToken, requireVerified, validateBody(delayResponseSchema), delayResponse);
```

**Step 5: Run type check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add backend/src/controllers/service/orderController.ts backend/src/routes/orderRoutes.ts backend/src/middleware/validation.ts
git commit -m "feat: add en-route marking and delay response endpoints with auto-dispute"
```

---

## Task 16: Backend — Add Delay Detection Scheduler

**Files:**
- Modify: `backend/src/lib/scheduler.ts`

**Step 1: Add delay check to scheduler**

In `backend/src/lib/scheduler.ts`:

1. Import `emitToUser` from `./socket`
2. Import `prisma` from `./prisma`
3. Add a new cron task that runs every 60 seconds:

```typescript
// Every minute: check for late professionals
const delayCheck = cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Find orders where:
    // - scheduledDate has passed + 15 min
    // - professional hasn't marked en-route (enRouteAt is null)
    // - status is ACCEPTED or IN_PROGRESS
    // - hasn't been notified yet (no DEADLINE_WARNING for this in last hour)
    const lateOrders = await prisma.serviceOrder.findMany({
      where: {
        scheduledDate: { lte: fifteenMinutesAgo },
        enRouteAt: null,
        status: { in: ["ACCEPTED", "IN_PROGRESS"] },
        notifications: {
          none: {
            type: "DEADLINE_WARNING",
            createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) }, // no warning in last hour
          },
        },
      },
      include: { professional: true },
    });

    for (const order of lateOrders) {
      // Create notification
      await prisma.notification.create({
        data: {
          userId: order.clientId,
          type: "DEADLINE_WARNING",
          title: "Profissional atrasado",
          message: `O horario agendado para "${order.title}" ja passou e o profissional ainda nao confirmou que esta a caminho. O profissional ja chegou?`,
          serviceOrderId: order.id,
          metadata: JSON.stringify({ delayAlert: true, professionalName: order.professional?.name }),
        },
      });

      // Emit real-time alert
      emitToUser(order.clientId, "order:delayAlert", {
        orderId: order.id,
        orderTitle: order.title,
        professionalName: order.professional?.name,
        scheduledDate: order.scheduledDate?.toISOString(),
      });

      log.info({ orderId: order.id }, "Sent delay alert to client");
    }
  } catch (err) {
    log.error({ err }, "Failed to check for late professionals");
  }
});
```

4. Add `delayCheck` to the `tasks` array

**Step 2: Run type check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/lib/scheduler.ts
git commit -m "feat: add delay detection scheduler for late professionals (60s interval)"
```

---

## Task 17: Frontend — Create DelayAlertModal Component

**Files:**
- Create: `frontend/src/components/orders/DelayAlertModal.tsx`

**Step 1: Create the 2-step delay alert modal**

Create `frontend/src/components/orders/DelayAlertModal.tsx`:

```tsx
import React, { useState } from "react";
import { Clock, MessageCircle, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DelayAlertModalProps {
  orderId: number;
  orderTitle: string;
  professionalName: string;
  onRespond: (orderId: number, arrived: boolean, action?: "message" | "dispute") => Promise<void>;
  onClose: () => void;
}

type Step = "question" | "options";

const DelayAlertModal: React.FC<DelayAlertModalProps> = ({
  orderId,
  orderTitle,
  professionalName,
  onRespond,
  onClose,
}) => {
  const [step, setStep] = useState<Step>("question");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleArrived = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, true);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleNotArrived = () => {
    setStep("options");
  };

  const handleMessage = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, false, "message");
      onClose();
      // Navigate to chat
      navigate(`/client/orders/${orderId}/chat`);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, false, "dispute");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        {step === "question" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock size={32} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold">Ei! Tudo bem por ai?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              O horario agendado para <strong>"{orderTitle}"</strong> ja passou
              e ainda nao temos confirmacao de que <strong>{professionalName}</strong> esta
              a caminho. O profissional ja chegou?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleArrived}
                disabled={loading}
                className="flex-1 btn bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Sim, ja chegou
              </button>
              <button
                onClick={handleNotArrived}
                disabled={loading}
                className="flex-1 btn bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <X size={18} />
                Nao
              </button>
            </div>
          </div>
        )}

        {step === "options" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={32} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">Que pena!</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Vamos notificar <strong>{professionalName}</strong> para entender o que aconteceu.
              O que voce gostaria de fazer?
            </p>
            <div className="space-y-3">
              <button
                onClick={handleMessage}
                disabled={loading}
                className="w-full btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                Enviar mensagem e aguardar
              </button>
              <button
                onClick={handleDispute}
                disabled={loading}
                className="w-full btn bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <AlertTriangle size={18} />
                Abrir disputa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DelayAlertModal;
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/orders/DelayAlertModal.tsx
git commit -m "feat: create DelayAlertModal component with 2-step delay response flow"
```

---

## Task 18: Frontend — Wire DelayAlertModal and En-Route Button

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Modify: `frontend/src/services/serviceService.ts`

**Step 1: Add API functions**

In `frontend/src/services/serviceService.ts`, add:

```typescript
export const markEnRoute = async (orderId: number) => {
  const response = await api.post(`/services/orders/${orderId}/en-route`);
  return response.data;
};

export const respondToDelay = async (orderId: number, arrived: boolean, action?: "message" | "dispute") => {
  const response = await api.post(`/services/orders/${orderId}/delay-response`, { arrived, action });
  return response.data;
};
```

**Step 2: Add en-route button for professional in OrderDetails**

In `frontend/src/pages/orders/OrderDetails.tsx`:

For professional view when status is ACCEPTED or IN_PROGRESS and `!order.enRouteAt`:

```tsx
{isProfessionalView && ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && !order.enRouteAt && (
  <button
    onClick={async () => {
      await markEnRoute(order.id);
      setOrder((prev) => prev ? { ...prev, enRouteAt: new Date().toISOString() } : prev);
      toast.success("Trajeto iniciado! O cliente foi notificado.");
    }}
    className="w-full btn bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
  >
    <Navigation size={18} />
    Iniciar trajeto
  </button>
)}
```

**Step 3: Add countdown timer**

For both client and professional when there's a `scheduledDate`:

```tsx
{order.scheduledDate && ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && (
  <CountdownBanner scheduledDate={order.scheduledDate} />
)}
```

Create a simple `CountdownBanner` inline or as a small component that shows "Faltam X horas e Y minutos" or "Atrasado por X minutos".

**Step 4: Wire DelayAlertModal via Socket**

In `frontend/src/pages/orders/OrderDetails.tsx` (or in Layout.tsx for global alerts):

```tsx
const [delayAlert, setDelayAlert] = useState<{orderId: number, orderTitle: string, professionalName: string} | null>(null);

useSocket("order:delayAlert", (data) => {
  setDelayAlert(data);
});

{delayAlert && (
  <DelayAlertModal
    orderId={delayAlert.orderId}
    orderTitle={delayAlert.orderTitle}
    professionalName={delayAlert.professionalName}
    onRespond={async (orderId, arrived, action) => {
      await respondToDelay(orderId, arrived, action);
    }}
    onClose={() => setDelayAlert(null)}
  />
)}
```

**Step 5: Add enRouteAt to ServiceOrder type**

In `frontend/src/types/entities.ts`, add to `ServiceOrder`:
```typescript
enRouteAt?: string;
convertProposedBy?: number;
convertStatus?: string;
```

**Step 6: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

**Step 7: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx frontend/src/services/serviceService.ts frontend/src/types/entities.ts
git commit -m "feat: add en-route button, countdown timer, and delay alert modal wiring"
```

---

## Task 19: Backend — Emit Socket on Notification Creation (Centralize)

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Update the local createNotification utility**

In `backend/src/controllers/service/orderController.ts`, update the local `createNotification` function (lines ~37-59) to also emit via Socket:

```typescript
import { emitToUser } from "../../lib/socket";

const createNotification = async (
  userId: number,
  type: string,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: any
) => {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, serviceOrderId, metadata: metadata ? JSON.stringify(metadata) : undefined },
  });

  // Emit real-time notification
  emitToUser(userId, "notification:new", {
    id: notification.id,
    type,
    title,
    message,
    serviceOrderId,
  });

  return notification;
};
```

**Step 2: Verify TypeScript**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "feat: centralize Socket.io emission in notification creation utility"
```

---

## Task 20: Integration Test — Full Flow Verification

**Files:**
- No new files (manual verification)

**Step 1: Ensure backend starts cleanly**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 2: Push schema changes**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`

Expected: Schema pushed successfully

**Step 3: Ensure frontend builds**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Run existing tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`

Expected: All existing tests pass (new features don't break existing code)

**Step 5: Seed database**

Run: `cd /home/levybonito/faztudo-main/backend && npm run db:seed`

Expected: Seed completes successfully with DRAFT status in enum

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete UX refinement - Socket.io, flash fix, chat DRAFT, delay disputes"
```

---

## Summary of All Changes

### New Files (4)
| File | Purpose |
|------|---------|
| `backend/src/lib/socket.ts` | Socket.io server singleton |
| `frontend/src/context/SocketContext.tsx` | React context for Socket.io |
| `frontend/src/hooks/useSocket.ts` | Hooks for socket events and order rooms |
| `frontend/src/components/orders/DelayAlertModal.tsx` | 2-step delay response modal |

### Modified Files (14)
| File | Changes |
|------|---------|
| `backend/package.json` | + socket.io |
| `frontend/package.json` | + socket.io-client |
| `backend/prisma/schema.prisma` | + DRAFT status, enRouteAt, convertProposedBy, convertStatus |
| `backend/src/index.ts` | HTTP server + Socket.io integration |
| `backend/src/lib/scheduler.ts` | + delay detection cron (every 60s) |
| `backend/src/middleware/validation.ts` | + createDraftOrder, convertToOrder, delayResponse schemas |
| `backend/src/routes/orderRoutes.ts` | + 4 new routes (draft, convert, en-route, delay-response) |
| `backend/src/controllers/service/orderController.ts` | + 4 new functions, Socket emissions, brief include |
| `backend/src/controllers/service/messageController.ts` | Allow DRAFT chat, text-only |
| `backend/src/controllers/service/chatController.ts` | Include DRAFT in getUserChats |
| `frontend/src/App.tsx` | + SocketProvider wrapper |
| `frontend/src/components/Layout.tsx` | + real-time notification via Socket |
| `frontend/src/pages/orders/OrderDetails.tsx` | Optimistic updates, OrderBrief display, en-route, countdown, delay alert |
| `frontend/src/pages/services/ServiceChat.tsx` | Socket.io messages, DRAFT banner, convert flow |
| `frontend/src/pages/Messages.tsx` | DRAFT badge |
| `frontend/src/pages/services/ServiceDetails.tsx` | Wire contact modal |
| `frontend/src/services/serviceService.ts` | + 4 new API functions |
| `frontend/src/types/entities.ts` | + OrderBrief interface, new fields |
| `frontend/src/types/enums.ts` | + DRAFT status |
| `frontend/src/components/orders/ServiceOrdersList.tsx` | Optimistic updates |
| `frontend/src/components/orders/OrderCard.tsx` | Button-level loading |
| `backend/src/services/notificationService.ts` | Socket emission |
