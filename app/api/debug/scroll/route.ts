export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 });
  }

  try {
    const payload = await request.json();
    console.log('[debug/scroll]', JSON.stringify(payload));
  } catch {
    console.log('[debug/scroll]', 'invalid payload');
  }

  return new Response(null, { status: 204 });
}
