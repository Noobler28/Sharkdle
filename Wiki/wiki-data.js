/* Manually authored wiki. Add your own articles to entries when ready. */
window.SHARKDLE_WIKI = {
  categories: [
    'Getting started', 'Game modes', 'Species', 'Story', 'SharkRNG',
    'Mutations', 'Minigames', 'Rescue Command', 'Events', 'Lost Treasures',
    'Progression', 'Quests', 'Achievements', 'Cosmetics', 'Codes',
    'Community', 'Updates'
  ],
  entries: [
    {
      id: 'how-guessing-works',
      category: 'Getting started',
      title: 'How does guessing work?',
      summary: 'Every guess gives you clues about the mystery species. Learn what those clues describe and how to use them to choose your next guess.',
      guide: true,
      sections: [
        {
          title: 'Making a guess',
          text: [
            'Enter a species name, select a valid suggestion, and submit your guess. The game compares your chosen species with the mystery species across six characteristics.',
            'You are trying to identify the species itself. A guess can be the wrong answer and still reveal useful matches, so read the feedback before choosing another species.'
          ]
        },
        {
          title: 'What do the clues mean?',
          bullets: [
            'Order: the broad classification group the species belongs to.',
            'Family: a more specific group within its order.',
            'Genus: a smaller group of closely related species.',
            'Size: the size category assigned to the species.',
            'Depth: the ocean depth category listed for the species.',
            'Year of Discovery: the discovery year recorded in the game.'
          ]
        },
        {
          title: 'Using your guesses',
          text: [
            'Treat each result as information to carry into your next guess. For example, matching the family gives you a reason to investigate other species in that family. Look at the other clues to narrow that group down further.',
            'Try to choose a species that fits what you have already confirmed. You do not need to recognise every possible answer immediately: comparing species in the Sharchive can help you understand their characteristics as you learn.'
          ]
        },
        {
          title: 'How many attempts do you get?',
          text: [
            'Daily and Infinite rounds allow 12 attempts. Finding the answer in fewer guesses is a goal to work towards, but an unfamiliar answer is also a chance to learn a species you might recognise next time.',
            'If you want to get comfortable with the clue system first, try Practice Mode. It lets you learn without earning XP or changing your game statistics.'
          ]
        }
      ]
    }
  ]
};
