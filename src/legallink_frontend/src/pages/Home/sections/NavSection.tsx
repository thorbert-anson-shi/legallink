import { Link } from "react-router";

export function NavSection() {
  return (
    <section className="flex h-1/2 w-full divide-x-2 divide-[#c2c7bd] border-t-2 border-t-[#c2c7bd]">
      <NavPanel
        heading="Efficient Document Creation"
        description="Quickly and accurately write up a legal document based on your needs"
        btnText="Document writer"
        target="/writer"
      />
      <NavPanel
        heading="Meaningful Insights"
        description="Get a quick, AI-powered scan of your PDF to uncover key data, detect potential issues, and save time on initial reviews."
        btnText="Document analyzer"
        target="/analyze"
      />
      <NavPanel
        heading="Interactivity"
        description="Have a chat with our AI assistant for any inquiries regarding your document"
        btnText="AI Assistant"
        target="/chat"
      />
    </section>
  );
}

interface NavPanelProps {
  heading: string;
  description: string;
  btnText: string;
  target: string;
}

function NavPanel({ heading, description, btnText, target }: NavPanelProps) {
  return (
    <div className="duration-short basis-1/3 bg-[#ebf0ed] hover:drop-shadow-[0_4px_4px_#6a6d67]">
      <div className="mx-auto flex h-full w-4/5 flex-col items-center justify-center gap-y-4 text-left">
        <h1 className="font-poppins w-full text-3xl">{heading}</h1>
        <p className="font-open-sans w-full text-lg">{description}</p>
        <Link to={target} className="mx-auto w-1/2">
          <button className="duration-short mt-5 h-12 w-full rounded-full bg-black text-[#ebf0ed]">
            {btnText}
          </button>
        </Link>
      </div>
    </div>
  );
}
