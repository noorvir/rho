import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const databaseUrl = process.env.DATABASE_URL ?? new URL("../dev.db", import.meta.url).href;
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });

const orgs = [
	{ name: "Neighborhood Climbing Club", url: "https://example.com/climbing" },
	{ name: "Sunday Family Chat", url: "https://example.com/family" },
	{ name: "Community Garden", url: "https://example.com/garden" },
	{ name: "Morning Run Group", url: "https://example.com/running" },
	{ name: "Book Circle", url: "https://example.com/books" },
	{ name: "Building Neighbors", url: "https://example.com/neighbors" },
	{ name: "Ceramics Studio", url: "https://example.com/ceramics" },
];

const people = [
	{
		name: "Maya Patel",
		relationship: "Friend",
		email: "maya.patel@example.com",
		phone: "+1 415 555 0183",
		city: "San Francisco",
		region: "CA",
		country: "US",
		birthday: new Date("1992-04-18T00:00:00.000Z"),
		favorite: true,
		lastContactedAt: new Date("2026-05-30T19:20:00.000Z"),
		notes: "Met through the neighborhood climbing group.",
		orgNames: ["Neighborhood Climbing Club"],
	},
	{
		name: "Jon Bell",
		relationship: "Family",
		email: "jon.bell@example.com",
		phone: "+1 212 555 0148",
		city: "Brooklyn",
		region: "NY",
		country: "US",
		birthday: new Date("1988-11-07T00:00:00.000Z"),
		favorite: true,
		lastContactedAt: new Date("2026-06-01T15:10:00.000Z"),
		notes: "Prefers texts over calls.",
		orgNames: ["Sunday Family Chat"],
	},
	{
		name: "Elena Rossi",
		relationship: "Friend",
		email: "elena.rossi@example.com",
		phone: "+39 06 5550 1420",
		city: "Rome",
		country: "IT",
		birthday: new Date("1990-08-22T00:00:00.000Z"),
		favorite: false,
		lastContactedAt: new Date("2026-05-12T09:30:00.000Z"),
		notes: "Send photos from the garden project.",
		orgNames: ["Community Garden"],
	},
	{
		name: "Noah Kim",
		relationship: "Neighbor",
		email: "noah.kim@example.com",
		phone: "+1 206 555 0199",
		city: "Seattle",
		region: "WA",
		country: "US",
		favorite: false,
		lastContactedAt: new Date("2026-05-21T02:45:00.000Z"),
		notes: "Has spare keys for emergencies.",
		orgNames: ["Building Neighbors"],
	},
	{
		name: "Priya Shah",
		relationship: "Friend",
		email: "priya.shah@example.com",
		phone: "+44 20 5555 0164",
		city: "London",
		country: "UK",
		birthday: new Date("1994-02-09T00:00:00.000Z"),
		favorite: true,
		lastContactedAt: new Date("2026-06-03T20:00:00.000Z"),
		notes: "Plan dinner when she visits next month.",
		orgNames: ["Book Circle"],
	},
	{
		name: "Sam Rivera",
		relationship: "Gym",
		phone: "+1 310 555 0112",
		city: "Los Angeles",
		region: "CA",
		country: "US",
		favorite: false,
		lastContactedAt: new Date("2026-04-28T13:00:00.000Z"),
		notes: "Morning workout partner.",
		orgNames: ["Morning Run Group"],
	},
	{
		name: "Amina Yusuf",
		relationship: "Family",
		email: "amina.yusuf@example.com",
		phone: "+1 312 555 0137",
		city: "Chicago",
		region: "IL",
		country: "US",
		birthday: new Date("1985-12-14T00:00:00.000Z"),
		favorite: true,
		lastContactedAt: new Date("2026-06-02T18:40:00.000Z"),
		notes: "Call on Sundays.",
		orgNames: ["Sunday Family Chat"],
	},
	{
		name: "Theo Martin",
		relationship: "BookClub",
		email: "theo.martin@example.com",
		city: "Portland",
		region: "OR",
		country: "US",
		favorite: false,
		lastContactedAt: new Date("2026-05-08T01:15:00.000Z"),
		notes: "Recommended the next novel.",
		orgNames: ["Book Circle"],
	},
	{
		name: "Lina Chen",
		relationship: "Friend",
		email: "lina.chen@example.com",
		phone: "+1 650 555 0168",
		city: "Palo Alto",
		region: "CA",
		country: "US",
		birthday: new Date("1996-07-03T00:00:00.000Z"),
		favorite: false,
		lastContactedAt: new Date("2026-03-18T22:05:00.000Z"),
		notes: "Ask about the ceramics class.",
		orgNames: ["Ceramics Studio"],
	},
	{
		name: "Owen Brooks",
		relationship: "Neighbor",
		phone: "+1 720 555 0174",
		city: "Denver",
		region: "CO",
		country: "US",
		favorite: false,
		lastContactedAt: new Date("2026-05-26T17:25:00.000Z"),
		notes: "Dog-sitting swap.",
		orgNames: ["Building Neighbors"],
	},
	{
		name: "Nadia Flores",
		relationship: "Friend",
		email: "nadia.flores@example.com",
		phone: "+52 55 5555 0182",
		city: "Mexico City",
		country: "MX",
		birthday: new Date("1991-09-29T00:00:00.000Z"),
		favorite: true,
		lastContactedAt: new Date("2026-06-04T00:10:00.000Z"),
		notes: "Send playlist from last trip.",
		orgNames: ["Community Garden"],
	},
	{
		name: "Marcus Lee",
		relationship: "RunningGroup",
		email: "marcus.lee@example.com",
		city: "Austin",
		region: "TX",
		country: "US",
		favorite: false,
		lastContactedAt: new Date("2026-05-15T12:00:00.000Z"),
		notes: "Half marathon training plan.",
		orgNames: ["Morning Run Group"],
	},
];

await prisma.contact.deleteMany();
await prisma.org.deleteMany();

for (const org of orgs) {
	await prisma.org.create({ data: org });
}

for (const person of people) {
	const { orgNames, ...data } = person;
	await prisma.contact.create({
		data: {
			...data,
			orgs: {
				connect: orgNames.map((name) => ({ name })),
			},
		},
	});
}

console.log(`Seeded ${people.length} contacts and ${orgs.length} orgs`);
await prisma.$disconnect();
