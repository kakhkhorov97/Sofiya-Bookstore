// The fixed evaluation set for Ask Sofiya's retrieval. Each question lists
// every catalogue book that counts as a correct answer (slugs). Keep it
// stable: results are only comparable between runs on the same set.
//
// direct     - names a title, author or character (keyword search territory)
// paraphrase - describes one book without the words its description uses
// theme      - a mood or topic where several books are right
// none       - nothing in the catalogue fits; the right answer is no books

export type EvalKind = 'direct' | 'paraphrase' | 'theme' | 'none';

export interface EvalQuestion {
  q: string;
  kind: EvalKind;
  relevant: string[];
}

export const EVAL_QUESTIONS: EvalQuestion[] = [
  // ---- direct ----------------------------------------------------------
  {
    kind: 'direct',
    q: 'the hound of the baskervilles',
    relevant: ['the-hound-of-the-baskervilles-doyle'],
  },
  {
    kind: 'direct',
    q: 'Jane Austen',
    relevant: [
      'pride-and-prejudice-austen',
      'emma-austen',
      'persuasion-austen',
      'sense-and-sensibility-austen',
      'mansfield-park-austen',
      'northanger-abbey-austen',
    ],
  },
  {
    kind: 'direct',
    q: 'Hercule Poirot',
    relevant: [
      'the-mysterious-affair-at-styles-christie',
      'the-murder-on-the-links-christie',
    ],
  },
  {
    kind: 'direct',
    q: 'Captain Nemo submarine',
    relevant: ['twenty-thousand-leagues-under-the-seas-verne'],
  },
  { kind: 'direct', q: 'Dracula', relevant: ['dracula-stoker'] },
  {
    kind: 'direct',
    q: 'learn Rust',
    relevant: ['the-rust-programming-language-klabnik'],
  },
  { kind: 'direct', q: 'Marcus Aurelius', relevant: ['meditations-aurelius'] },
  { kind: 'direct', q: 'Frankenst', relevant: ['frankenstein-shelley'] },
  {
    kind: 'direct',
    q: 'git branching and rebasing',
    relevant: ['pro-git-chacon'],
  },
  {
    kind: 'direct',
    q: 'Father Brown',
    relevant: [
      'the-innocence-of-father-brown-chesterton',
      'the-wisdom-of-father-brown-chesterton',
    ],
  },

  // ---- paraphrase ------------------------------------------------------
  {
    kind: 'paraphrase',
    q: 'a salesman who wakes up as a bug',
    relevant: ['the-metamorphosis-kafka'],
  },
  {
    kind: 'paraphrase',
    q: 'obsessed sea captain chasing a huge pale animal',
    relevant: ['moby-dick-melville'],
  },
  {
    kind: 'paraphrase',
    q: 'man stranded alone on an island for decades',
    relevant: ['robinson-crusoe-defoe'],
  },
  {
    kind: 'paraphrase',
    q: 'wrongly jailed sailor escapes and takes revenge on those who betrayed him',
    relevant: ['the-count-of-monte-cristo-dumas'],
  },
  {
    kind: 'paraphrase',
    q: 'a painting that grows old instead of its owner',
    relevant: ['the-picture-of-dorian-gray-wilde'],
  },
  {
    kind: 'paraphrase',
    q: 'scientist who turns himself see-through',
    relevant: ['the-invisible-man-wells'],
  },
  {
    kind: 'paraphrase',
    q: 'aliens invade England with giant walking machines',
    relevant: ['the-war-of-the-worlds-wells'],
  },
  {
    kind: 'paraphrase',
    q: 'girl falls down a rabbit hole into a nonsense world',
    relevant: ['alices-adventures-in-wonderland-carroll'],
  },
  {
    kind: 'paraphrase',
    q: 'boy who never wants to grow up flies children to an island',
    relevant: ['peter-and-wendy-barrie'],
  },
  {
    kind: 'paraphrase',
    q: 'rich man bets he can travel around the planet quickly',
    relevant: ['around-the-world-in-eighty-days-verne'],
  },
  {
    kind: 'paraphrase',
    q: 'arrested for a crime nobody will explain to him',
    relevant: ['the-trial-kafka'],
  },
  {
    kind: 'paraphrase',
    q: 'dinosaurs surviving on a remote plateau',
    relevant: ['the-lost-world-doyle'],
  },
  {
    kind: 'paraphrase',
    q: 'a pampered pet dog forced to pull sleds in the frozen north',
    relevant: ['the-call-of-the-wild-london'],
  },
  {
    kind: 'paraphrase',
    q: 'the origin of the word robot',
    relevant: ['r-u-r-capek'],
  },
  {
    kind: 'paraphrase',
    q: 'automating spreadsheets and boring office tasks with code',
    relevant: ['automate-the-boring-stuff-with-python-sweigart'],
  },

  // ---- theme -----------------------------------------------------------
  {
    kind: 'theme',
    q: 'stoic philosophy to stay calm under stress',
    relevant: [
      'meditations-aurelius',
      'enchiridion-epictetus',
      'letters-from-a-stoic-seneca',
      'on-the-shortness-of-life-seneca',
    ],
  },
  {
    kind: 'theme',
    q: 'creepy ghost stories for a dark night',
    relevant: [
      'ghost-stories-of-an-antiquary-james',
      'the-turn-of-the-screw-james',
      'the-willows-and-other-stories-blackwood',
      'the-legend-of-sleepy-hollow-and-other-stories-irving',
      'the-fall-of-the-house-of-usher-and-other-tales-poe',
      'the-monkeys-paw-and-other-tales-jacobs',
    ],
  },
  {
    kind: 'theme',
    q: 'vampires',
    relevant: ['dracula-stoker', 'carmilla-fanu'],
  },
  {
    kind: 'theme',
    q: 'a cosy country-house murder mystery',
    relevant: [
      'the-mysterious-affair-at-styles-christie',
      'the-red-house-mystery-milne',
      'the-moonstone-collins',
      'the-valley-of-fear-doyle',
      'the-leavenworth-case-green',
    ],
  },
  {
    kind: 'theme',
    q: 'beginner programming for someone who has never coded',
    relevant: [
      'think-python-downey',
      'automate-the-boring-stuff-with-python-sweigart',
      'eloquent-javascript-haverbeke',
      'how-to-design-programs-felleisen',
    ],
  },
  {
    kind: 'theme',
    q: 'functional programming',
    relevant: [
      'learn-you-a-haskell-for-great-good-lipovaca',
      'professor-frisbys-mostly-adequate-guide-to-functional-programming-lonsdorf',
      'structure-and-interpretation-of-computer-programs-abelson',
    ],
  },
  {
    kind: 'theme',
    q: 'ancient Rome and its emperors',
    relevant: [
      'the-twelve-caesars-suetonius',
      'the-annals-tacitus',
      'the-history-of-the-decline-and-fall-of-the-roman-empire-gibbon',
      'the-gallic-war-caesar',
      'parallel-lives-plutarch',
      'meditations-aurelius',
    ],
  },
  {
    kind: 'theme',
    q: 'memoirs by people who escaped slavery',
    relevant: [
      'narrative-of-the-life-of-frederick-douglass-douglass',
      'up-from-slavery-washington',
    ],
  },
  {
    kind: 'theme',
    q: 'dystopian future societies',
    relevant: [
      'we-zamyatin',
      'the-machine-stops-forster',
      'metropolis-harbou',
      'the-time-machine-wells',
    ],
  },
  {
    kind: 'theme',
    q: 'fairy tales to read aloud to kids',
    relevant: [
      'grimms-fairy-tales-jacob',
      'andersens-fairy-tales-andersen',
      'five-children-and-it-nesbit',
      'the-jungle-book-kipling',
      'the-wonderful-wizard-of-oz-baum',
    ],
  },
  {
    kind: 'theme',
    q: 'pirates and buried treasure',
    relevant: [
      'treasure-island-stevenson',
      'the-adventures-of-tom-sawyer-twain',
    ],
  },
  {
    kind: 'theme',
    q: 'leadership and strategy for winning conflicts',
    relevant: ['the-art-of-war-tzu', 'the-prince-machiavelli'],
  },
  {
    kind: 'theme',
    q: 'a love story with a strong-willed heroine and a proud hero',
    relevant: [
      'pride-and-prejudice-austen',
      'jane-eyre-bronte',
      'north-and-south-gaskell',
      'far-from-the-madding-crowd-hardy',
    ],
  },
  {
    kind: 'theme',
    q: 'the Russian revolution',
    relevant: ['ten-days-that-shook-the-world-reed'],
  },
  {
    kind: 'theme',
    q: 'simple living close to nature',
    relevant: ['walden-thoreau', 'self-reliance-and-other-essays-emerson'],
  },

  // ---- none ------------------------------------------------------------
  { kind: 'none', q: 'vegan dessert recipes', relevant: [] },
  { kind: 'none', q: 'how to fix a leaking car radiator', relevant: [] },
  { kind: 'none', q: 'kubernetes cluster autoscaling', relevant: [] },
  { kind: 'none', q: 'asdfgh qwerty zxcv', relevant: [] },
  { kind: 'none', q: 'tax rules for freelancers in 2026', relevant: [] },
];
