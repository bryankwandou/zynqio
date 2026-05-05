export const AVATARS = [
  { id: "fox",      emoji: "🦊", bg: "from-orange-400 to-red-500" },
  { id: "cat",      emoji: "🐱", bg: "from-purple-400 to-pink-500" },
  { id: "dog",      emoji: "🐶", bg: "from-yellow-400 to-orange-500" },
  { id: "panda",    emoji: "🐼", bg: "from-gray-500 to-gray-700" },
  { id: "lion",     emoji: "🦁", bg: "from-yellow-500 to-amber-600" },
  { id: "tiger",    emoji: "🐯", bg: "from-orange-500 to-amber-600" },
  { id: "penguin",  emoji: "🐧", bg: "from-blue-500 to-indigo-700" },
  { id: "owl",      emoji: "🦉", bg: "from-amber-600 to-yellow-700" },
  { id: "unicorn",  emoji: "🦄", bg: "from-pink-400 to-purple-500" },
  { id: "dragon",   emoji: "🐲", bg: "from-green-500 to-emerald-700" },
  { id: "frog",     emoji: "🐸", bg: "from-green-400 to-teal-600" },
  { id: "bunny",    emoji: "🐰", bg: "from-pink-300 to-rose-500" },
  { id: "hamster",  emoji: "🐹", bg: "from-amber-300 to-orange-400" },
  { id: "koala",    emoji: "🐨", bg: "from-gray-300 to-slate-500" },
  { id: "chick",    emoji: "🐥", bg: "from-yellow-300 to-amber-400" },
  { id: "wolf",     emoji: "🐺", bg: "from-slate-500 to-gray-700" },
  { id: "monkey",   emoji: "🐵", bg: "from-amber-500 to-yellow-600" },
  { id: "bear",     emoji: "🐻", bg: "from-amber-700 to-orange-900" },
  { id: "alien",    emoji: "👾", bg: "from-violet-500 to-purple-700" },
  { id: "robot",    emoji: "🤖", bg: "from-cyan-500 to-blue-700" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function getAvatar(id?: string | null) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
