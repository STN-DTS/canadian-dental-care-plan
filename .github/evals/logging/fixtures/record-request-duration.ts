declare const meter: {
  createHistogram(name: string, options: { unit: string; description: string }): { record(value: number, attributes: Record<string, string | number>): void };
};

type Request = { method: string; routeTemplate: string };

export async function timed(request: Request, handler: () => Promise<number>): Promise<number> {
  return handler();
}
