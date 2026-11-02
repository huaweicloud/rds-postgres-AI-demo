// Limits per agent from the spec. Whichever runs out first ends the agent cleanly.
export interface Limits {
  wallTimeMs: number;
  searches: number;
  pages: number;
  llmCalls: number;
}

export const AGENT_LIMITS: Limits = {
  wallTimeMs: 60_000,
  searches: 5,
  pages: 12,
  llmCalls: 8,
};

export type BudgetKind = "searches" | "pages" | "llmCalls";

export class BudgetExceeded extends Error {
  constructor(readonly kind: BudgetKind | "time") {
    super(`budget exceeded: ${kind}`);
  }
}

export class Budget {
  readonly used = { searches: 0, pages: 0, llmCalls: 0 };
  private readonly deadline: number;

  constructor(
    private readonly limits: Limits = AGENT_LIMITS,
    now = Date.now(),
  ) {
    this.deadline = now + limits.wallTimeMs;
  }

  remaining(kind: BudgetKind): number {
    return Math.max(0, this.limits[kind] - this.used[kind]);
  }

  timeLeftMs(now = Date.now()): number {
    return Math.max(0, this.deadline - now);
  }

  // Takes one unit or throws. Callers take before doing the work, so a parallel batch
  // can never overshoot the limit.
  take(kind: BudgetKind): void {
    if (this.timeLeftMs() === 0) throw new BudgetExceeded("time");
    if (this.remaining(kind) === 0) throw new BudgetExceeded(kind);
    this.used[kind] += 1;
  }

  tryTake(kind: BudgetKind): boolean {
    try {
      this.take(kind);
      return true;
    } catch (err) {
      if (err instanceof BudgetExceeded) return false;
      throw err;
    }
  }
}
