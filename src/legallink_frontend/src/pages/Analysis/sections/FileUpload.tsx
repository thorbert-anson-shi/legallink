import { useActionState, useState } from "react";

const useStateWithDefaultValue = () => useState<boolean>(true);

interface FileUploadProps {
  setStatus: ReturnType<typeof useStateWithDefaultValue>[1];
}

export function FileUpload({ setStatus }: FileUploadProps) {
  async function uploadDocument(_prevState: string | null, formData: FormData) {
    setStatus(false);
    const response = await fetch("/api", { method: "post", body: formData });
    return "hello";
  }

  const [reply, formAction, isPending] = useActionState(uploadDocument, null);

  return (
    <>
      <div className="h-full w-full p-10">
        <form
          className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-black"
          action={formAction}
        >
          <input type="file" name="sourceFile" accept=".pdf" />
          <button type="submit">Submit</button>
        </form>
      </div>
    </>
  );
}
