export default function Navbar() {
  return (
    <nav className="font-poppins absolute top-0 z-10 w-full border-b-2 border-[rgb(194,199,189)] bg-translucent">
      <div
        id="nav-layout"
        className="flex h-16 w-full items-center justify-between px-8 py-2"
      >
        <h1 className="text-xl">Legallink</h1>
        <div className="flex basis-2/3 items-center justify-around">
          <a className="hover:underline" href="/">
            Analyze
          </a>
          <a className="hover:underline" href="/">
            Chatbot
          </a>
          <a className="hover:underline" href="/">
            Legal Compliance
          </a>
        </div>
        <button className="h-full rounded-lg bg-black px-5 text-white">
          Login
        </button>
      </div>
    </nav>
  );
}
