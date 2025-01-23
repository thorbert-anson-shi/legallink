import bot from "../../../assets/bot.svg";
import Navbar from "../../../components/Navbar";

export function Hero() {
  function askBot(formData: FormData) {
    const query = formData.get("query");
    console.log(query);
  }

  return (
    <section id="hero" className="relative h-[90%] w-full">
      <Navbar />
      <div className="absolute top-0 z-50 flex h-full w-1/2 flex-col justify-center gap-y-8 pl-24 text-left">
        <h1 className="font-open-sans text-6xl font-medium leading-normal">
          AI Legalizer,
          <br />
          Under & for The Law
        </h1>
        <h3 className="font-montserrat text-lg font-normal">
          Legalize your document with help from our bot
        </h3>

        <form
          action={askBot}
          className="relative flex w-[300px] items-center md:w-[500px]"
        >
          <input
            type="text"
            name="query"
            placeholder="Ask me about your PDF..."
            className="w-full rounded-full bg-[#c2c7bd] p-5 outline-none placeholder:italic placeholder:text-black"
          />
          <input type="submit" hidden />
          <button
            type="submit"
            className="absolute right-5 rounded-full hover:opacity-50"
          >
            <img src={bot} className="h-auto w-10" alt="" />
          </button>
        </form>
      </div>

      {/* background elements */}
      <div className="absolute top-0 h-full w-full bg-[linear-gradient(80deg,var(--tw-gradient-stops))] from-white via-white via-20% to-[rgba(255,255,255,0.0)]" />
      <img src="randomroom.jpg" alt="" className="h-full w-full object-cover" />
    </section>
  );
}
