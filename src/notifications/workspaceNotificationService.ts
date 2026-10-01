import { nativeNotificationRepository } from "./notificationRepository";
import { createNotificationService } from "./notificationService";

export const notificationService = createNotificationService(nativeNotificationRepository);
