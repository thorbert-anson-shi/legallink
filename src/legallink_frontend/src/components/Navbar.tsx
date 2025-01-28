import { HTMLAttributes } from "react";
import { Link } from "react-router";

export default function Navbar({ className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <nav
      className={
        className +
        " w-full border-b-2 border-[rgb(194,199,189)] bg-translucent font-poppins"
      }
    >
      <div
        id="nav-layout"
        className="flex h-16 w-full items-center justify-between px-8 py-2"
      >
        <h1 className="text-xl">
          <Link to="/">Legallink</Link>
        </h1>
        <div className="flex basis-2/3 items-center justify-around">
          <a className="hover:underline" href="/analyze">
            Analyze
          </a>
          <a className="hover:underline" href="/chat">
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
