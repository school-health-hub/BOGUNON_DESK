type NotificationListItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly relevantDate?: string | null;
  readonly tone: "info" | "warning" | "success";
};

type NotificationListProps = {
  readonly items: readonly NotificationListItem[];
  readonly onOpen?: (item: NotificationListItem) => Promise<void>;
};

export function NotificationList({ items, onOpen }: NotificationListProps) {
  return (
    <ul className="notification-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className={`notification-dot ${item.tone}`} aria-hidden="true" />
          {onOpen === undefined ? <div><strong>{item.title}</strong><p>{item.detail}</p></div> : (
            <button type="button" aria-label={`BOGUNON에서 ${item.title} 열기`} onClick={() => onOpen(item)}>
              <strong>{item.title}</strong><span>{item.detail}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
