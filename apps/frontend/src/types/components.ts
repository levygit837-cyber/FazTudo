import { ServiceListing, ServiceOrder, Review, Notification, Message } from "./entities";

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface ServiceCardProps {
  service: ServiceListing;
  onClick?: () => void;
  showProfessional?: boolean;
  showActions?: boolean;
}

export interface OrderCardProps {
  order: ServiceOrder;
  view?: "client" | "professional";
  onClick?: () => void;
  showStatus?: boolean;
  showActions?: boolean;
}

export interface ReviewCardProps {
  review: Review;
  showAuthor?: boolean;
  showTarget?: boolean;
  showServiceOrder?: boolean;
}

export interface NotificationItemProps {
  notification: Notification;
  onRead?: () => void;
  onArchive?: () => void;
}

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  showTime?: boolean;
}
