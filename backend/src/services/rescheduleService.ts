const RESCHEDULABLE_STATUSES = ["ACCEPTED", "IN_PROGRESS", "PENDING"];

export function canReschedule(status: string): boolean {
  return RESCHEDULABLE_STATUSES.includes(status);
}

export function validateRescheduleRequest(
  newDate: string | undefined | null
): { valid: true; date: Date } | { valid: false; error: string } {
  if (!newDate) {
    return { valid: false, error: "New date is required" };
  }

  const date = new Date(newDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  return { valid: true, date };
}

export function hasReschedulePermission(
  userId: number,
  userRole: string,
  clientId: number,
  professionalId: number | null
): boolean {
  return (
    userId === clientId ||
    userId === professionalId ||
    userRole === "ADMIN"
  );
}
