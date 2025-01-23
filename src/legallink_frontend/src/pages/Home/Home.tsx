import { Hero, NavSection, About } from "./sections";

function Home() {
  return (
    <main className="h-screen w-screen overflow-scroll">
      <Hero />
      <NavSection />
      <About />
    </main>
  );
}

export default Home;
