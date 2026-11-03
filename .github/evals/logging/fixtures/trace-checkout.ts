declare const tracer: {
  startActiveSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
};

type Span = {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: unknown): void;
  setStatus(status: { code: number }): void;
  end(): void;
};

declare function reserveStock(orderId: string): Promise<void>;
declare function chargeCard(orderId: string): Promise<void>;

export async function checkout(orderId: string): Promise<void> {
  await reserveStock(orderId);
  await chargeCard(orderId);
}
