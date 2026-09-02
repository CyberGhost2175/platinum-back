export enum GoldTone {
  RED = 'red',
  YELLOW = 'yellow',
  WHITE = 'white',
}

/** Подписи для селекта «цвет золота». Yellow — жёлтое, не «золотое». */
export const GOLD_TONE_LABELS: Record<GoldTone, string> = {
  [GoldTone.RED]: 'Красное',
  [GoldTone.YELLOW]: 'Жёлтое',
  [GoldTone.WHITE]: 'Белое',
};

export function goldToneOptions(): Array<{ value: GoldTone; label: string }> {
  return Object.values(GoldTone).map((value) => ({
    value,
    label: GOLD_TONE_LABELS[value],
  }));
}
