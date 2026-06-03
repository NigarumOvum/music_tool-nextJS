import { AppShell } from "@/components/app-shell";

const promptCards = [
  {
    title: "Hook Tightener",
    description: "Sharpen a chorus while preserving meter and emotional continuity.",
    prompt: "Rewrite the chorus so the hook lands in eight words or fewer, keeps the existing rhyme logic, and raises the melodic lift in the last line.",
  },
  {
    title: "Dual Guitar Arrangement",
    description: "Separate responsibilities between rhythm and lead guitars.",
    prompt: "Take the current arrangement and split the guitar writing into two complementary parts: one for harmonic drive and one for melodic response, with clear register separation.",
  },
  {
    title: "Production Cleanup",
    description: "Convert loose production notes into a cleaner JSON-oriented arrangement brief.",
    prompt: "Turn the production notes into structured sections for drums, bass, guitars, vocals, FX, transitions, and automation cues.",
  },
  {
    title: "Language Adaptation",
    description: "Rework a lyric into another language while keeping phrasing singable.",
    prompt: "Adapt the lyric into the target language while preserving phrasing, emotional stance, and a performable syllable count.",
  },
];

export default function PromptLibraryPage() {
  return (
    <AppShell
      title="Prompt Library"
      eyebrow="Creative Recipes"
      description="A starter library of music-focused prompts for songwriting, arrangement design, bilingual adaptation, and production cleanup."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {promptCards.map((card) => (
          <article key={card.title} className="panel rounded-[1.75rem] p-5">
            <div className="eyebrow">Prompt</div>
            <h2 className="mt-2 text-2xl font-black">{card.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-sand-2)]">{card.description}</p>
            <pre className="mt-4 whitespace-pre-wrap rounded-[1.25rem] border border-white/8 bg-black/25 p-4 text-sm text-[var(--color-sand-2)]">{card.prompt}</pre>
          </article>
        ))}
      </section>
    </AppShell>
  );
}