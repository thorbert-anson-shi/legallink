import chatSvg from "../../../assets/chat.svg";
import lineGraphSvg from "../../../assets/line-graph.svg";

export function About() {
  return (
    <div className="flex h-1/2 items-center justify-center gap-x-6 px-16 py-24 text-left">
      <h1 className="basis-1/4 font-poppins text-5xl font-medium">Overview</h1>
      <div className="flex h-full basis-1/3 flex-col justify-end gap-y-5">
        <img src={lineGraphSvg} className="w-16" alt="" />
        <p className="text-left font-open-sans text-lg leading-loose">
          Legallink accepts legal documents and searches its contents for issues
          or improvements to make. Our analyze tool will then provide you with
          points of error and improvement in a digestible format.
        </p>
      </div>
      <div className="flex h-full basis-1/3 flex-col items-end justify-start gap-y-5">
        <img src={chatSvg} alt="" className="w-16" />
        <p className="text-right font-open-sans text-lg leading-loose">
          For any further questions, bring over these results to our
          knowledgeable virtual assistant. We will help with any clarification
          or tweaking needs.
        </p>
      </div>
    </div>
  );
}
