import { DragEventHandler, useEffect, useRef, useState } from "react";
import "./style.css";
import { useFormStatus } from "react-dom";

const useStateWithDefaultValue = () => useState<boolean>(true);

interface FileUploadProps {
  setStatus: ReturnType<typeof useStateWithDefaultValue>[1];
}

export function FileUpload({ setStatus }: FileUploadProps) {
  async function uploadDocument(formData: FormData) {
    const endpoint = new URL("/test", import.meta.env.VITE_SERVER_URL);
    const response = await fetch(endpoint);
    console.log(await response.text());
    setStatus(false);
    return;
  }

  let dropZone = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    if (!dropZone.current) return;

    dropZone.current!.addEventListener("dragenter", (ev: DragEvent) => {
      ev.preventDefault();
      dropZone.current!.classList.add("bg-neutral-500");
    });

    dropZone.current!.addEventListener("dragleave", (ev: DragEvent) => {
      ev.preventDefault();
      dropZone.current!.classList.remove("bg-neutral-500");
    });
  });

  return (
    <>
      <div className="h-full w-full p-10">
        <form
          className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-black"
          action={uploadDocument}
        >
          <label
            ref={dropZone}
            htmlFor="sourceFile"
            className="border-2 border-dashed border-neutral-500 p-20"
          >
            <input
              type="file"
              id="sourceFile"
              name="sourceFile"
              accept=".pdf"
            />
          </label>
          <button type="submit">Submit</button>
        </form>
      </div>
    </>
  );
}
