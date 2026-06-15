export interface SePayTopupOption {
  id: string;
  amount: number;
  credits: number;
}

export function parseSePayTopupCatalog(raw?: string): SePayTopupOption[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [id, amountRaw, creditsRaw] = entry.split(':');
      const amount = Number(amountRaw);
      const credits = Number(creditsRaw);
      if (
        !id ||
        !/^[a-z0-9_-]+$/i.test(id) ||
        !Number.isInteger(amount) ||
        amount <= 0 ||
        !Number.isInteger(credits) ||
        credits <= 0
      ) {
        return [];
      }
      return [{ id, amount, credits }];
    });
}

export function findSePayTopupOption(raw: string | undefined, optionId: string): SePayTopupOption | null {
  return parseSePayTopupCatalog(raw).find((option) => option.id === optionId) ?? null;
}
