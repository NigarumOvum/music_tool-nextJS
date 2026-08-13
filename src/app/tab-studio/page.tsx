import { redirect } from "next/navigation";

export default function TabStudioPage() {
  redirect("/production-studio?tab=notation");
}
