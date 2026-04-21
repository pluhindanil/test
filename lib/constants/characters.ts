/** Visual config per character slug — kept in sync with DB seeds */
export const CHAR_RING_GRAD: Record<string, string> = {
  masha:  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  alisa:  "linear-gradient(135deg, #ec4899, #f59e0b)",
  lena:   "linear-gradient(135deg, #22d3ee, #8b5cf6)",
  sakura: "linear-gradient(135deg, #f472b6, #a78bfa)",
};

export const CHAR_COLORS: Record<string, [string, string]> = {
  masha:  ["#8b5cf6", "#ec4899"],
  alisa:  ["#ec4899", "#f59e0b"],
  lena:   ["#22d3ee", "#8b5cf6"],
  sakura: ["#f472b6", "#a78bfa"],
};

export const CHAR_INITIALS: Record<string, string> = {
  masha:  "М",
  alisa:  "А",
  lena:   "Л",
  sakura: "S",
};

export const CARD_COLOR: Record<string, "card-violet" | "card-pink" | "card-cyan"> = {
  masha:  "card-violet",
  alisa:  "card-pink",
  lena:   "card-cyan",
  sakura: "card-pink",
};
