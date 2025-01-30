import { Hero, NavSection, About } from "./sections";

export function Home() {
  return (
    <main className="h-screen w-screen overflow-scroll">
      <Hero />
      <NavSection />
      <About />
    </main>
  );
}
