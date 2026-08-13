import { redirect } from "next/navigation";

export default function SongStudioPage() {
  redirect("/production-studio?tab=song");
}
