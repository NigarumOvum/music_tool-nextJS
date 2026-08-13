import { redirect } from "next/navigation";

export default function DawPage() {
  redirect("/production-studio?tab=audio");
}
