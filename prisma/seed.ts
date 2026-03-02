import { addDays, set } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function atHour(dayOffset: number, hour: number, minute = 0): Date {
  const base = addDays(new Date(), dayOffset);
  return set(base, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
}

const UNC_BUILDINGS = [
  // North Campus — coordinates from OSM
  { name: "Student Union", lat: 35.909998, lng: -79.047607, campus: "NORTH", aliases: ["Student Union", "Carolina Union", "Frank Porter Graham Student Union", "FPG", "Graham Student Union", "Union 2502", "Union 3201", "Union"] },
  { name: "Wilson Library", lat: 35.90951, lng: -79.049759, campus: "NORTH", aliases: ["Wilson Library", "Louis Round Wilson Library"] },
  { name: "South Building", lat: 35.91073, lng: -79.05016, campus: "NORTH", aliases: ["South Building", "South Bldg"] },
  { name: "Memorial Hall", lat: 35.911176, lng: -79.052054, campus: "NORTH", aliases: ["Memorial Hall", "UNC Memorial Hall"] },
  { name: "Morehead Planetarium", lat: 35.913928, lng: -79.050504, campus: "NORTH", aliases: ["Morehead Planetarium", "Morehead", "Morehead Planetarium and Science Center"] },
  { name: "Gerrard Hall", lat: 35.911515, lng: -79.051554, campus: "NORTH", aliases: ["Gerrard Hall"] },
  { name: "Hamilton Hall", lat: 35.911632, lng: -79.048788, campus: "NORTH", aliases: ["Hamilton Hall"] },
  { name: "Greenlaw Hall", lat: 35.91038, lng: -79.049264, campus: "NORTH", aliases: ["Greenlaw Hall", "Greenlaw"] },
  { name: "Hanes Art Center", lat: 35.912324, lng: -79.054424, campus: "NORTH", aliases: ["Hanes Art Center", "Hanes Art", "Art Center"] },
  { name: "Person Hall", lat: 35.91181, lng: -79.04926, campus: "NORTH", aliases: ["Person Hall"] },
  { name: "Phillips Hall", lat: 35.910634, lng: -79.052697, campus: "NORTH", aliases: ["Phillips Hall", "Phillips"] },
  { name: "Peabody Hall", lat: 35.910612, lng: -79.053577, campus: "NORTH", aliases: ["Peabody Hall", "Peabody"] },
  { name: "Carroll Hall", lat: 35.910247, lng: -79.051785, campus: "NORTH", aliases: ["Carroll Hall", "Hussman School of Journalism"] },
  { name: "Dey Hall", lat: 35.909829, lng: -79.050781, campus: "NORTH", aliases: ["Dey Hall", "Toy Lounge"] },
  { name: "Alumni Hall", lat: 35.913173, lng: -79.051019, campus: "NORTH", aliases: ["Alumni Hall", "Alumni Building"] },
  { name: "Graham Memorial", lat: 35.914089, lng: -79.051663, campus: "NORTH", aliases: ["Graham Memorial", "Graham Memorial Hall"] },
  { name: "Playmakers Theatre", lat: 35.91121, lng: -79.04971, campus: "NORTH", aliases: ["Playmakers Theatre", "PlayMakers Repertory Company", "Historic Playmakers Theatre"] },

  // South Campus / Mid Campus
  { name: "Davis Library", lat: 35.910804, lng: -79.047745, campus: "SOUTH", aliases: ["Davis Library", "Walter Royal Davis Library", "Davis"] },
  { name: "Undergraduate Library", lat: 35.90930, lng: -79.04812, campus: "SOUTH", aliases: ["Undergraduate Library", "UL", "The UL", "House Undergraduate Library"] },
  { name: "Genome Sciences Building", lat: 35.907586, lng: -79.050939, campus: "SOUTH", aliases: ["Genome Sciences Building", "GSB", "Genome Sciences"] },
  { name: "Kenan-Flagler Business School", lat: 35.90577, lng: -79.04616, campus: "SOUTH", aliases: ["Kenan-Flagler", "KFBS", "Business School", "Kenan-Flagler Business School"] },
  { name: "Fetzer Hall", lat: 35.909035, lng: -79.047063, campus: "SOUTH", aliases: ["Fetzer Hall", "Fetzer Gym", "Fetzer", "Fetzer Gymnasium"] },
  { name: "Woollen Gym", lat: 35.909631, lng: -79.04591, campus: "SOUTH", aliases: ["Woollen Gym", "Woollen Gymnasium", "Woollen"] },
  { name: "Student Recreation Center", lat: 35.909301, lng: -79.047523, campus: "SOUTH", aliases: ["Student Recreation Center", "SRC", "Campus Rec", "Student Rec Center"] },
  { name: "Carmichael Arena", lat: 35.90486, lng: -79.04492, campus: "SOUTH", aliases: ["Carmichael Arena", "Carmichael Auditorium"] },
  { name: "Dean E. Smith Center", lat: 35.90475, lng: -79.04670, campus: "SOUTH", aliases: ["Dean Smith Center", "Smith Center", "Dean Dome", "The Dean Dome"] },
  { name: "Koury Natatorium", lat: 35.90374, lng: -79.04545, campus: "SOUTH", aliases: ["Koury Natatorium", "Koury", "Natatorium"] },
  { name: "Sitterson Hall", lat: 35.909968, lng: -79.053235, campus: "SOUTH", aliases: ["Sitterson Hall", "Sitterson", "Computer Science Building", "CS Building"] },
  { name: "Brooks Hall", lat: 35.90950, lng: -79.05332, campus: "SOUTH", aliases: ["Brooks Hall", "Brooks Computer Science"] },
  { name: "Chapman Hall", lat: 35.910088, lng: -79.052605, campus: "SOUTH", aliases: ["Chapman Hall", "Chapman"] },
  { name: "Murray Hall", lat: 35.909644, lng: -79.051753, campus: "SOUTH", aliases: ["Murray Hall", "Murray"] },
  { name: "Venable Hall", lat: 35.909686, lng: -79.051419, campus: "SOUTH", aliases: ["Venable Hall", "Venable"] },
  { name: "Kenan Labs", lat: 35.908983, lng: -79.051138, campus: "SOUTH", aliases: ["Kenan Labs", "Kenan Laboratories", "William Rand Kenan Junior Laboratory"] },
  { name: "Caudill Labs", lat: 35.90808, lng: -79.05109, campus: "SOUTH", aliases: ["Caudill Labs", "Caudill Laboratories"] },
  { name: "Lenoir Dining Hall", lat: 35.910414, lng: -79.048776, campus: "SOUTH", aliases: ["Lenoir Dining Hall", "Lenoir Hall", "Lenoir"] },
  { name: "Chase Hall", lat: 35.90806, lng: -79.04707, campus: "SOUTH", aliases: ["Chase Hall", "Chase Dining Hall", "Chase"] },

  // Health / Medical Campus
  { name: "Bondurant Hall", lat: 35.906194, lng: -79.052407, campus: "SOUTH", aliases: ["Bondurant Hall", "Bondurant"] },
  { name: "UNC Hospitals", lat: 35.90390, lng: -79.05600, campus: "SOUTH", aliases: ["UNC Hospitals", "UNC Health", "UNC Medical Center"] },
  { name: "School of Public Health", lat: 35.90570, lng: -79.05510, campus: "SOUTH", aliases: ["School of Public Health", "Gillings School", "Gillings"] },

  // Other / Athletics
  { name: "Kenan Stadium", lat: 35.90550, lng: -79.04150, campus: "OTHER", aliases: ["Kenan Stadium", "Kenan Memorial Stadium"] },
  { name: "Boshamer Stadium", lat: 35.90340, lng: -79.04260, campus: "OTHER", aliases: ["Boshamer Stadium", "Boshamer"] },
  { name: "Carolina Performing Arts", lat: 35.91200, lng: -79.05100, campus: "NORTH", aliases: ["Carolina Performing Arts", "CPA"] },
  { name: "FedEx Global Education Center", lat: 35.90703, lng: -79.04920, campus: "SOUTH", aliases: ["FedEx Global Education Center", "Global Center", "GEC", "FedEx GEC", "Nelson Mandela Auditorium", "Mandela Auditorium"] },
  { name: "Friday Center", lat: 35.89640, lng: -79.01720, campus: "OTHER", aliases: ["Friday Center", "William and Ida Friday Center"] },
  { name: "Stone Center", lat: 35.907767, lng: -79.050224, campus: "SOUTH", aliases: ["Stone Center", "Sonja Haynes Stone Center", "Stone Center for Black Culture and History"] },
  { name: "Campus Y", lat: 35.911394, lng: -79.051214, campus: "NORTH", aliases: ["Campus Y", "YMCA Building"] },
  { name: "Carolina Hall", lat: 35.91173, lng: -79.04796, campus: "NORTH", aliases: ["Carolina Hall"] },
  { name: "McCorkle Place", lat: 35.91249, lng: -79.05025, campus: "NORTH", aliases: ["McCorkle Place"] },
  { name: "Polk Place", lat: 35.91024, lng: -79.04941, campus: "NORTH", aliases: ["Polk Place"] },
  { name: "The Pit", lat: 35.91010, lng: -79.04720, campus: "NORTH", aliases: ["The Pit", "Pit"] },

  // Additional buildings
  { name: "Hill Hall", lat: 35.912534, lng: -79.053155, campus: "NORTH", aliases: ["Hill Hall", "Moeser Auditorium", "Moeser Auditorium, Hill Hall"] },
  { name: "Ackland Art Museum", lat: 35.912537, lng: -79.054885, campus: "NORTH", aliases: ["Ackland Art Museum", "Ackland", "Ackland Museum"] },
  { name: "Hooker Fields", lat: 35.90397, lng: -79.03988, campus: "OTHER", aliases: ["Hooker Fields", "Hooker Field"] },
  { name: "Swain Hall", lat: 35.911452, lng: -79.053688, campus: "NORTH", aliases: ["Swain Hall", "Swain"] },
  { name: "SASB", lat: 35.90475, lng: -79.04830, campus: "SOUTH", aliases: ["SASB", "SASB North", "SASB South", "Student Academic Services Building", "Student and Academic Services Building"] },
  { name: "Murphey Hall", lat: 35.91074, lng: -79.049655, campus: "NORTH", aliases: ["Murphey Hall", "Murphey"] },
  { name: "Gardner Hall", lat: 35.90860, lng: -79.05280, campus: "SOUTH", aliases: ["Gardner Hall", "Gardner", "GSU"] },
  { name: "UNC Visitors Center", lat: 35.91220, lng: -79.04680, campus: "NORTH", aliases: ["UNC Visitors Center", "Visitors Center", "Visitor Center"] },
  { name: "Kenan Theatre", lat: 35.91140, lng: -79.04620, campus: "NORTH", aliases: ["Kenan Theatre", "Kenan Theater", "Kenan 1st Floor", "Kenan"] },
  { name: "Student Wellness", lat: 35.90480, lng: -79.04380, campus: "SOUTH", aliases: ["Student Wellness", "Campus Health"] },
  { name: "McColl Building", lat: 35.90577, lng: -79.04616, campus: "SOUTH", aliases: ["McColl", "McColl Building", "McColl 2600"] },
  { name: "Old Well", lat: 35.912063, lng: -79.051235, campus: "NORTH", aliases: ["Old Well", "The Old Well"] },
  { name: "Loudermilk Center", lat: 35.90590, lng: -79.04280, campus: "SOUTH", aliases: ["Loudermilk Center", "Loudermilk"] },
  { name: "Henry Stadium", lat: 35.90350, lng: -79.04050, campus: "OTHER", aliases: ["Henry Stadium", "Dorrance Field", "Henry Field"] },
  { name: "Eddie Smith Field House", lat: 35.90430, lng: -79.04180, campus: "OTHER", aliases: ["Eddie Smith Field House", "Eddie Smith", "Field House"] },
  { name: "Rams Head", lat: 35.90550, lng: -79.04350, campus: "SOUTH", aliases: ["Rams Head", "Rams Head Recreation Center", "Rams Head Dining", "Ram's Head"] },
  { name: "Bingham Hall", lat: 35.91056, lng: -79.04867, campus: "NORTH", aliases: ["Bingham Hall", "Bingham"] },
  { name: "Manning Hall", lat: 35.90930, lng: -79.05030, campus: "SOUTH", aliases: ["Manning Hall", "Manning"] },
  { name: "New West", lat: 35.91046, lng: -79.05170, campus: "NORTH", aliases: ["New West", "New West Building"] },
  { name: "Coker Hall", lat: 35.90950, lng: -79.05410, campus: "SOUTH", aliases: ["Coker Hall", "Coker"] },

  // Buildings added for better event matching
  { name: "Health Sciences Library", lat: 35.90020, lng: -79.05350, campus: "OTHER", aliases: ["Health Sciences Library", "HSL", "Health Science Library"] },
  { name: "Rosenau Hall", lat: 35.90060, lng: -79.05290, campus: "OTHER", aliases: ["Rosenau Hall", "Rosenau", "Gillings School"] },
  { name: "Howell Hall", lat: 35.90910, lng: -79.05510, campus: "SOUTH", aliases: ["Howell Hall", "Howell"] },
  { name: "Hanes Hall", lat: 35.90950, lng: -79.05220, campus: "SOUTH", aliases: ["Hanes Hall", "Hanes"] },
  { name: "Hyde Hall", lat: 35.91280, lng: -79.05020, campus: "NORTH", aliases: ["Hyde Hall", "Hyde", "Institute for Arts and Humanities"] },
  { name: "Bell Hall", lat: 35.91020, lng: -79.05300, campus: "SOUTH", aliases: ["Bell Hall", "Bell Tower", "The Bell Tower"] },
  { name: "Kerr Hall", lat: 35.90040, lng: -79.05180, campus: "OTHER", aliases: ["Kerr Hall", "Eshelman School of Pharmacy", "Pharmacy"] },
  { name: "George Watts Hill Alumni Center", lat: 35.90600, lng: -79.04470, campus: "SOUTH", aliases: ["Alumni Center", "George Watts Hill Alumni Center", "Watts Hill"] },
  { name: "Carolina Club", lat: 35.90580, lng: -79.04420, campus: "SOUTH", aliases: ["Carolina Club", "The Carolina Club"] },
  { name: "Friday Conference Center", lat: 35.89640, lng: -79.01720, campus: "OTHER", aliases: ["Friday Conference Center", "Friday Center Conference"] },
  { name: "Genome Sciences Building", lat: 35.90360, lng: -79.05370, campus: "OTHER", aliases: ["Genome Sciences Building", "Genome", "GSB"] },
  { name: "Tate-Turner-Kuralt Building", lat: 35.90780, lng: -79.05290, campus: "SOUTH", aliases: ["Tate-Turner-Kuralt", "TTK", "School of Social Work"] },
  { name: "North Carolina Botanical Garden", lat: 35.89890, lng: -79.03400, campus: "OTHER", aliases: ["NC Botanical Garden", "Botanical Garden", "North Carolina Botanical Garden"] },
  { name: "Craige Residence Hall", lat: 35.90610, lng: -79.05070, campus: "SOUTH", aliases: ["Craige Residence Hall", "Craige"] },
  { name: "Varsity Theatre", lat: 35.91340, lng: -79.05590, campus: "NORTH", aliases: ["Varsity Theatre", "Varsity Theater"] },
  { name: "Mitchell Hall", lat: 35.91035, lng: -79.05440, campus: "SOUTH", aliases: ["Mitchell Hall", "Mitchell"] },
];

async function main() {
  await prisma.ingestLog.deleteMany();
  await prisma.event.deleteMany();
  await prisma.eventSource.deleteMany();
  await prisma.building.deleteMany();

  const buildings = [];
  for (const b of UNC_BUILDINGS) {
    const created = await prisma.building.create({
      data: {
        name: b.name,
        lat: b.lat,
        lng: b.lng,
        campus: b.campus,
        aliases: JSON.stringify(b.aliases),
      },
    });
    buildings.push(created);
  }

  const officialSource = await prisma.eventSource.create({
    data: {
      name: "UNC Heel Life",
      url: "https://heellife.unc.edu/events",
      parserType: "HEELLIFE",
      lastSuccessAt: new Date(),
    },
  });

  // Additional event sources — parsers auto-dispatch based on parserType
  await prisma.eventSource.createMany({
    data: [
      {
        name: "UNC Events Calendar",
        url: "https://calendar.unc.edu",
        parserType: "LOCALIST",
      },
      {
        name: "Carolina Performing Arts",
        url: "https://carolinaperformingarts.org",
        parserType: "WP_EVENTS",
      },
      {
        name: "UNC Libraries",
        url: "https://calendar.lib.unc.edu/ical_subscribe.php?src=p&cid=2998",
        parserType: "ICAL_LIBRARIES",
      },
      {
        name: "UNC Athletics",
        url: "https://move.unc.edu/calendar/category/athletics/?ical=1",
        parserType: "ICAL_ATHLETICS",
      },
    ],
  });

  const findBuilding = (name: string) =>
    buildings.find((b) => b.name === name)!;

  await prisma.event.createMany({
    data: [
      {
        sourceId: "seed-001",
        title: "Carolina Night: Movie Screening",
        description: "Student org weekly film screening event in the Union auditorium.",
        startTime: atHour(0, 19, 0),
        endTime: atHour(0, 21, 0),
        buildingId: findBuilding("Student Union").id,
        locationText: "Student Union Auditorium",
        organizer: "Carolina Union Activities Board",
        category: "Social",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-002",
        title: "AI Talk: Multimodal Systems",
        description: "Open lecture hosted by the CS department on recent advances in multimodal AI.",
        startTime: atHour(1, 14, 0),
        endTime: atHour(1, 16, 0),
        buildingId: findBuilding("Sitterson Hall").id,
        locationText: "Sitterson Hall, Room 014",
        organizer: "UNC Computer Science",
        category: "Academic",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-003",
        title: "Late Night Study Session",
        description: "Extended study hours with free snacks and peer tutoring available.",
        startTime: atHour(0, 18, 0),
        endTime: atHour(0, 23, 59),
        buildingId: findBuilding("Davis Library").id,
        locationText: "Davis Library, Floor 3",
        organizer: "University Libraries",
        category: "Academic",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-004",
        title: "Basketball Game Watch Party",
        description: "Come watch the Tar Heels play on the big screen!",
        startTime: atHour(1, 19, 0),
        endTime: atHour(1, 22, 0),
        buildingId: findBuilding("Student Union").id,
        locationText: "Student Union, Great Hall",
        organizer: "Carolina Union",
        category: "Social",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-005",
        title: "Yoga on the Quad",
        description: "Free outdoor yoga session. Bring your own mat!",
        startTime: atHour(2, 8, 0),
        endTime: atHour(2, 9, 0),
        buildingId: findBuilding("Polk Place").id,
        locationText: "Polk Place Quad",
        organizer: "Campus Recreation",
        category: "Fitness",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-006",
        title: "Career Fair: Tech & Engineering",
        description: "Meet recruiters from top tech companies. Bring your resume!",
        startTime: atHour(2, 10, 0),
        endTime: atHour(2, 16, 0),
        buildingId: findBuilding("FedEx Global Education Center").id,
        locationText: "FedEx Global Education Center, Nelson Mandela Auditorium",
        organizer: "UNC Career Services",
        category: "Career",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-007",
        title: "Open Mic Night",
        description: "Perform poetry, comedy, music, or anything else at the Stone Center.",
        startTime: atHour(1, 20, 0),
        endTime: atHour(1, 22, 30),
        buildingId: findBuilding("Stone Center").id,
        locationText: "Stone Center, Hitchcock Multipurpose Room",
        organizer: "Stone Center Programming",
        category: "Arts",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
    ],
  });

  await prisma.ingestLog.create({
    data: {
      sourceId: officialSource.id,
      runAt: new Date(),
      newCount: 7,
      updatedCount: 0,
      errorCount: 0,
    },
  });

  console.log(`Seeded ${buildings.length} buildings and 7 events.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
