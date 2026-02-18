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
