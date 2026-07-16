export function formatRelativeTime(isoDate: string): string {
  const date: Date = new Date(isoDate);
  const diffMs: number = Date.now() - date.getTime();
  const diffMinutes: number = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "たった今";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }
  const diffHours: number = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
