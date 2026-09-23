export interface MemoryStop {
	id: string;
	place: string;
	nickname?: string;
	date: string;
	caption: string;
	photos?: string[];
}

export interface JourneyData {
	toName: string;
	fromName: string;
	anniversaryDate: string;
	title: string;
	subtitle: string;
	stops: MemoryStop[];
	finaleTitle: string;
	finaleMessage: string;
}

// ---- YOUR STORY ----
// Photos live in /public/photos/web/ (web-sized copies of /public/photos,
// numbered oldest → newest). List as many as you like per stop — they show
// up as a swipeable gallery. Add, remove or reorder stops freely.
const photo = (n: number) => `/photos/web/${String(n).padStart(2, "0")}.jpg`;

export const journey: JourneyData = {
	toName: "Babe",
	fromName: "Me",
	anniversaryDate: "2026-09-20",
	title: "Our First Year",
	subtitle: "It has been a wonderful year to spend with you, my love <3",
	stops: [
		{
			id: "First shmool surprise",
			place: "First shmool surprise",
			nickname: "the beginning",
			date: "2025-09-24",
			caption: "I love to make you laugh",
			photos: [6, 7].map(photo),
		},
		{
			id: "first-date",
			place: "Our Date At Wedding Palace",
			nickname: "blue lemonade",
			date: "2025-11-08",
			caption: "A blue lemonade and two tiny octopuses — one pink, one blue, just like us.",
			photos: [9].map(photo),
		},
		{
			id: "flowers",
			place: "Flowers for You",
			nickname: "every bouquet",
			date: "2025-12-27",
			caption: "Purple daisies, red roses, and that smile every single time.",
			photos: [8, 15, 14, 24].map(photo),
		},
		{
			id: "gifts",
			place: "Gifts for each other",
			nickname: "made with love",
			date: "2026-01-23",
			caption: "A cake, a 3D website, a painting we made, a birthday card for my princess, and the bows you loved.",
			photos: [13, 44, 45, 46, 52].map(photo),
		},
		{
			id: "kitten-memes",
			place: "Kitten Memes",
			nickname: "our love language",
			date: "2025-10-25",
			caption: "Batman & Hello Kitty, the kitten with the knife, every *mwah*… honestly, this is how we talk.",
			photos: [3, 5, 2, 4, 22, 23, 53].map(photo),
		},
		{
			id: "kittens-like-you",
			place: "Kittens Like My juljaga",
			nickname: "literally you",
			date: "2026-03-30",
			caption: "Every kitten that looks exactly like you when you want something. So shmoooooooool",
			photos: [19, 62, 83, 84, 54, 55, 68, 37].map(photo),
		},
		{
			id: "memes",
			place: "Just for Laughs",
			nickname: "our humor",
			date: "2026-02-09",
			caption: "The panda, the meerkat, Vanellope dancing up the stairs — and us as minions.",
			photos: [1, 11, 42, 50].map(photo),
		},
		{
			id: "little-you",
			place: "Shmool Moloe",
			nickname: "didken muuja",
			date: "2026-07-18",
			caption: "Tiny you in pink dress, sleepy little you, you with your teddy bear — I love every version of you.",
			photos: [34, 33, 30, 26, 60, 61, 78, 35].map(photo),
		},
		{
			id: "busy-bee",
			place: "Javgui muuja",
			nickname: "proud of you",
			date: "2026-06-11",
			caption: "Uniforms and long days at work — I'm so proud of you.",
			photos: [12, 18, 69, 73].map(photo),
		},
		{
			id: "mirror-mirror",
			place: "Mirror, Mirror",
			nickname: "who's the prettiest",
			date: "2026-05-15",
			caption: "Mirror selfies, and every one of them is my favorite.",
			photos: [43, 48, 56, 65, 70, 75].map(photo),
		},
		{
			id: "favorite-view",
			place: "My Favorite View",
			nickname: "you",
			date: "2026-07-20",
			caption: "In every outfit, every mood — still the best thing I've ever seen.",
			photos: [10, 76, 77, 79, 85, 86].map(photo),
		},
		{
			id: "always-glowing",
			place: "Always Glowing",
			nickname: "that cute face",
			date: "2026-07-01",
			caption: "The little smiles, the pouts, the sunny days out. You glow.",
			photos: [47, 49, 59, 63, 72, 74, 80, 81].map(photo),
		},
		{
			id: "night-walks",
			place: "Night Walks",
			nickname: "masks on, hearts full",
			date: "2026-03-30",
			caption: "Cold nights, streetlights and stolen kisses on the way home.",
			photos: [20, 21, 51, 82].map(photo),
		},
		{
			id: "days-out",
			place: "Days Out",
			nickname: "just us two",
			date: "2026-05-28",
			caption: "Dinners, cafés, sunny days — and I love my princess.",
			photos: [64, 58, 71, 36, 57].map(photo),
		},
		{
			id: "cooking",
			place: "Cooking Together",
			nickname: "chef & sous-chef",
			date: "2026-06-04",
			caption: "You hugging me from behind while I cook, then breakfast for two.",
			photos: [17, 66, 67].map(photo),
		},
		{
			id: "home",
			place: "Home",
			nickname: "matching reds",
			date: "2026-07-13",
			caption: "Matching red outfits, mirror selfies, lazy days in. Wherever you are feels like home.",
			photos: [31, 32, 28, 29, 27, 25].map(photo),
		},
		{
			id: "birthdays",
			place: "Birthdays",
			nickname: "Birthdays",
			date: "2026-09-19",
			caption: "Candles on the cake, swings under the lights, and kisses in the dark. One year with you — I'd do it all again.",
			photos: [38, 87, 16, 39, 40, 41].map(photo),
		},
	],
	finaleTitle: "One Year Down",
	finaleMessage: "Would love to spend many autumns as listening Guuren Deer",
};
