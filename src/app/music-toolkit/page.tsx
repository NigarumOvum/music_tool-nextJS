import { redirect } from "next/navigation";

type MusicToolkitPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

// The toolkit lives at `/` now — keep the legacy route as a redirect alias.
export default async function MusicToolkitPage({ searchParams }: MusicToolkitPageProps) {
  const { tab } = await searchParams;
  redirect(tab ? `/?tab=${encodeURIComponent(tab)}` : "/");
}
