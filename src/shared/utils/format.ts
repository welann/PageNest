export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffInMinutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  }

  const diffInDays = Math.round(diffInHours / 24);
  return `${diffInDays} day ago`;
}

