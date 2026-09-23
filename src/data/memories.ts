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
	subtitle: "every path we've walked together",
	stops: [
		{
			id: "where-we-met",
			place: "Where We Met",
			nickname: "the beginning",
			date: "2025-09-20",
			caption: "This bridge is where it all started. Soon after, I made you a little website just to tell you you're a beautiful soul.",
			photos: [6, 7].map(photo),
		},
		{
			id: "kitten-memes",
			place: "Kitten Memes",
			nickname: "our love language",
			date: "2025-10-25",
			caption: "Batman & Hello Kitty, the kitten with the knife, the tiny paws… honestly, this is how we talk.",
			photos: [3, 5, 4, 2, 1].map(photo),
		},
		{
			id: "first-date",
			place: "Our First Date",
			nickname: "blue lemonade",
			date: "2025-11-07",
			caption: "A blue lemonade, two tiny octopuses — one pink, one blue, just like us — and purple flowers for you.",
			photos: [9, 8].map(photo),
		},
		{
			id: "whole-days",
			place: "Whole Days Together",
			nickname: "me after a day with you",
			date: "2025-12-17",
			caption: "Spending the whole day with you, then dancing up the stairs like that meme. That's exactly how it feels.",
			photos: [11, 10].map(photo),
		},
		{
			id: "busy-bee",
			place: "Busy Bee",
			nickname: "proud of you",
			date: "2025-12-20",
			caption: "Busy days, uniforms and lanyards — I'm proud of you, always.",
			photos: [12, 18].map(photo),
		},
		{
			id: "cake-and-roses",
			place: "Cake & Roses",
			nickname: "that smile",
			date: "2025-12-27",
			caption: "A cake, a little 3D website I built for you, and red roses that got me that smile.",
			photos: [13, 15, 14].map(photo),
		},
		{
			id: "valentines",
			place: "Valentine's",
			nickname: "cooking for two",
			date: "2026-02-14",
			caption: "Dinner out, then cooking together with you hugging me from behind. Best Valentine's.",
			photos: [16, 17].map(photo),
		},
		{
			id: "night-walks",
			place: "Night Walks",
			nickname: "masks on, hearts full",
			date: "2026-03-30",
			caption: "Cold nights, silly selfies under the streetlights — and you sending me kittens that look exactly like you when you want something.",
			photos: [20, 21, 19].map(photo),
		},
		{
			id: "moon-and-back",
			place: "To the Moon and Back",
			nickname: "you & me",
			date: "2026-04-11",
			caption: "Your roses post, our hands together, and every *mwah* in between.",
			photos: [24, 25, 22, 23].map(photo),
		},
		{
			id: "weekend-away",
			place: "Weekend Away",
			nickname: "just us",
			date: "2026-04-27",
			caption: "Matching robes, one mirror, and a kiss on the forehead.",
			photos: [27].map(photo),
		},
		{
			id: "home",
			place: "Home",
			nickname: "matching reds",
			date: "2026-07-13",
			caption: "Matching red outfits, mirror selfies, lazy days in. Wherever you are feels like home.",
			photos: [31, 32, 28, 29].map(photo),
		},
		{
			id: "little-you",
			place: "Little You",
			nickname: "before I knew you",
			date: "2026-07-18",
			caption: "Tiny you in pink at Gandan, sleepy little you, all the moments before we met — I love every version of you.",
			photos: [34, 33, 30, 26, 35].map(photo),
		},
		{
			id: "summer",
			place: "Summer Day",
			nickname: "sunny and sleepy",
			date: "2026-07-31",
			caption: "A sunny day out with your head on my shoulder.",
			photos: [36].map(photo),
		},
		{
			id: "one-year",
			place: "One Year",
			nickname: "happy anniversary",
			date: "2026-09-19",
			caption: "Candles on the cake, swings under the lights, and kisses in the dark. One year with you — I'd do it all again.",
			photos: [38, 39, 40, 41, 37].map(photo),
		},
	],
	finaleTitle: "One Year Down",
	finaleMessage: "Write your own note to her here — this is the most important part.",
};
