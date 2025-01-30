import { useActionState, useState } from "react";

import { AnalysisResult } from "./sections";
import { FileUpload } from "./sections/FileUpload";
import Navbar from "../../components/Navbar";

export function AnalysisPage() {
  const [isEmpty, setStatus] = useState<boolean>(true);

  return (
    <main className="flex h-screen w-screen flex-col">
      <Navbar />
      {isEmpty ? <FileUpload setStatus={setStatus} /> : <AnalysisResult />}
    </main>
  );
}
