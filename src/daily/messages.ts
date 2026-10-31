// Intercepts for the daily puzzle. Original prose, each 120 to 200 letters once spaces and
// punctuation are dropped. The subject line is shown to the player as a hint, like a crib.
// Appending is safe for the current 30-day cycle only; see `messageFor` in puzzle.ts.

export const MESSAGES = [
  {
    subject: "Weather",
    text: "Weather for the eastern coast. Low cloud and drizzle until noon, then clearing from the west. Light winds from the south. Visibility good after dark, with frost likely inland before dawn.",
  },
  {
    subject: "Canteen notice",
    text: "The canteen will close early on Friday because the cook has gone to her sister's wedding. Sandwiches will be left on the long table by the door. Please take only two each.",
  },
  {
    subject: "Lost property",
    text: "Found in hut six this morning: one blue scarf, one pair of reading glasses and a library book about bees that is three weeks overdue. Please collect them from the front desk.",
  },
  {
    subject: "Bicycle",
    text: "Will whoever borrowed the green bicycle from the shed please return it. The front brake is loose and the bell does not work, so it is not safe on the hill.",
  },
  {
    subject: "Convoy",
    text: "Convoy sailing tonight at eleven from the northern harbour. Twelve merchant ships with four escorts. Keep radio silence until clear of the minefield, then report position every four hours.",
  },
  {
    subject: "Chess club",
    text: "The chess club meets on Thursday evening in the old library. Bring your own board if you have one. Last week the champion lost to a new girl from the typing pool in nineteen moves.",
  },
  {
    subject: "Allotment",
    text: "The vegetable patch behind the lake needs volunteers this weekend. The potatoes are ready to lift and the runner beans are climbing over the fence. Spades are in the brick shed.",
  },
  {
    subject: "Night watch",
    text: "All quiet on the night watch. Two foxes crossed the lawn at three and an owl sat on the aerial for most of an hour. The stove went out at four. Please order more coal.",
  },
  {
    subject: "Fuel",
    text: "Fuel at the forward airfield is running low. Request two lorries of petrol and one of oil before Tuesday. Without them the squadron can fly only short patrols along the coast.",
  },
  {
    subject: "Machine fault",
    text: "The left rotor on machine four is sticking. Do not force it. Lift the cover gently, check the spring and clean away any dust. If it still sticks, put a note on it and use another.",
  },
  {
    subject: "Birthday",
    text: "Tomorrow is the birthday of our section head. A card is hidden in the bottom drawer of the filing cabinet for everyone to sign. There will be cake at four, so please look surprised.",
  },
  {
    subject: "Choir",
    text: "Choir practice moves to the chapel this week because the hall roof is leaking again. We are learning a new carol for the winter concert. Tenors are urgently needed.",
  },
  {
    subject: "Frequency change",
    text: "From midnight all stations move to the new evening frequency. Call signs remain the same. Operators who hear the old signal after midnight should log it and report it at once.",
  },
  {
    subject: "Reading room",
    text: "The reading room now has three new dictionaries and a large atlas of the northern coast. Please do not take them back to your huts. The librarian knows most of the words anyway.",
  },
  {
    subject: "Harbour fog",
    text: "Heavy fog in the harbour since dawn. All small boats remain at their moorings. The pilot will not take ships through the channel until the lighthouse can be seen from the outer buoy.",
  },
  {
    subject: "Crossword",
    text: "The crossword in this morning's paper was finished in eleven minutes by the team in hut eight. They would like a harder one tomorrow. The editor is said to be sharpening his pencil.",
  },
  {
    subject: "Rations",
    text: "Butter ration for the week is two ounces each. Sugar stays at eight ounces. Jam will be shared out on Saturday. Anyone who keeps hens and has spare eggs should speak to the kitchen.",
  },
  {
    subject: "Stray cat",
    text: "A small grey cat has moved into the coding room and sleeps on the warm valve set every afternoon. Nobody knows where she came from. She may stay, but please stop feeding her sardines.",
  },
  {
    subject: "Trains",
    text: "The early train to the city is cancelled tomorrow because of work on the line. A bus will leave from the station yard at seven. Staff on leave should allow an extra hour for the journey.",
  },
  {
    subject: "Patrol boat",
    text: "Patrol boat returning to base with engine trouble. Speed reduced to six knots. Expect arrival shortly after midnight. Request a tug at the harbour mouth and a mechanic on the quay.",
  },
  {
    subject: "Dance",
    text: "There will be a dance in the assembly hall on Saturday night. The band from the airfield has offered to play. Doors open at eight. Wear sensible shoes, because the floor was waxed today.",
  },
  {
    subject: "New codebook",
    text: "A new codebook comes into force at noon on the first day of next month. Burn the old one in the presence of an officer, then sign the register to show it was done and write down the time.",
  },
  {
    subject: "Snow",
    text: "Snow overnight has blocked the north road and the hill to the village. The ploughs should reach us by midday. Until then lunch will be soup, bread and whatever is in the tins.",
  },
  {
    subject: "Pigeon loft",
    text: "The pigeon loft reports that seven birds came back from the coast this morning. Two carried messages, one carried a feather, and one seems to have brought a friend home with it.",
  },
  {
    subject: "Lighthouse",
    text: "The lighthouse keeper on the island reports a ship without lights passing south at two in the morning. She was low in the water and moving slowly. No flag could be seen.",
  },
  {
    subject: "Entrance test",
    text: "Candidates for the new course will sit a short test on Monday. It includes a crossword, a page of German and a puzzle about trains. Pencils are provided. Nobody is expected to finish.",
  },
  {
    subject: "Spare radio",
    text: "The spare radio set in hut three has been repaired and tested. It now receives the long wave band clearly at night. Please do not use it for dance music while the duty officer is in.",
  },
  {
    subject: "Post",
    text: "Letters for staff will now be sorted at the gate lodge instead of the main house. Collect yours after lunch. Parcels that rattle, smell or move will be opened in front of you.",
  },
  {
    subject: "Floating mine",
    text: "A fishing boat near the point has caught a floating mine in her nets. The crew cut it loose and left the area. Warn all shipping to keep two miles off until the divers have made it safe.",
  },
  {
    subject: "The clock",
    text: "The clock in the main hall is running five minutes fast again. Please use the radio time signal when you start a shift and write the correct time at the top of every log sheet.",
  },
];
