type Request = { method: string; routeTemplate: string };

export async function timed(request: Request, handler: () => Promise<number>): Promise<number> {
  return await handler();
}
