export function decideRisk(amountCents: number): "review" | "allow" {
  return amountCents >= 100000 ? "review" : "allow";
}
