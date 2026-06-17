const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function fetchParksidePages() {
  const res = await fetch(`${API_BASE_URL}/pages`);
  if (!res.ok) {
    throw new Error(`Failed to fetch pages: ${res.status}`);
  }
  return res.json();
}

export async function fetchArchivedPages() {
  const res = await fetch(`${API_BASE_URL}/pages/archive`);
  if (!res.ok) {
    throw new Error(`Failed to fetch archived pages: ${res.status}`);
  }
  return res.json();
}
