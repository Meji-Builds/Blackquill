// Choice points added to a few demo chapters, to show the feature. chapter is 1-based; after is the paragraph
// (0-based) the choice follows.
const choices = [
  {
    book: "the-cartographer-of-ash",
    chapter: 26,
    after: 1,
    prompt: "Taddeus offers Ilse his ink. Guild or Ashwright: who does she trust tonight?",
    options: [
      ["Take Taddeus's ink", "The ink was warm in the bottle, the way the well was warm. Ilse uncorked it and the smell of smoke filled the room.\n\n'You'll draw better with this,' Taddeus said. 'And you'll owe me.' She was already drawing."],
      ["Go to Mother Agathe", "The Guild Tower's doors were open at midnight, which they never were. Mother Agathe was waiting at the top of the stairs with two cups of tea.\n\n'Sit,' she said. 'Let's both be honest for once.'"],
      ["Trust neither", "Ilse locked the door, put the unfinished map on the table and drew a single line: the edge of the Unmarked, closed, owned by no one.\n\nThe city held its breath, and then accepted it."],
    ],
  },
  {
    book: "signal-drift",
    chapter: 22,
    after: 2,
    prompt: "Reyes gives Ama forty-eight hours. What does she do first?",
    options: [
      ["Talk to the crystals", "Ama sat in front of Bay Six's sealed door with a headset and a notebook and simply started counting, one to ten, again and again.\n\nAt seven, the crystals began counting with her."],
      ["Back up the evidence", "Ama copied every message into a dozen colony relay queues, hidden inside weather reports and supply orders.\n\nWhatever happened on Kestrel, the record would survive it."],
    ],
  },
  {
    book: "the-paper-witch",
    chapter: 25,
    after: 1,
    prompt: "The River Lord invites Aiko to follow her great-aunt. What does she fold?",
    options: [
      ["A crane to say goodbye", "Aiko folded a crane from the last sheet of her grandmother's paper and set it on the water. It turned once, as if bowing, and drifted toward the door in the river.\n\nShe did not follow it."],
      ["A boat to visit", "Aiko folded a small boat, just large enough for one, and promised herself she would come back before the cicadas sang.\n\nThe river carried her gently, and brought her home by dusk."],
      ["Nothing at all", "Aiko held the paper in her hands until it grew warm and did not fold it.\n\n'Some doors,' her grandmother said beside her, 'are better left as paper.'"],
    ],
  },
];

export default choices;
