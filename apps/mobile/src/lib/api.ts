export async function apiGet(path: string, token: string) {
  const res = await fetch(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function apiPost(path: string, token: string, body: any) {
  const res = await fetch(`http://localhost:8000${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return res.json();
}
