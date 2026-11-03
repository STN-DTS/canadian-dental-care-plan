declare function reserveStock(orderId: string): Promise<void>;
declare function chargeCard(orderId: string): Promise<void>;

export async function checkout(orderId: string): Promise<void> {
  await reserveStock(orderId);
  await chargeCard(orderId);
}
