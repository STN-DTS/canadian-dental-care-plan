type RequestContext = {
  requestId: string;
  method: string;
  routeTemplate: string;
  rawUrl: string;
  headers: Record<string, string>;
};

export async function handle(ctx: RequestContext): Promise<number> {
  const startedAt = Date.now();
  await Promise.resolve();
  const status = 204;
  void startedAt;
  return status;
}
