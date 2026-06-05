export const SUPABASE_STORAGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

export function formatPrice(price: number): string {
  return (
    Math.round(price)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + // non-breaking space as thousands sep
    ' DZD'
  );
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3_600_000);
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / 60_000);
      return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    }
    return `about ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function getListingImageUrl(images: string[], index = 0): string | null {
  if (!images?.length) return null;
  const path = images[index] ?? images[0];
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SUPABASE_STORAGE_URL}/listing-images/${path}`;
}

export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${SUPABASE_STORAGE_URL}/avatars/${avatarUrl}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
