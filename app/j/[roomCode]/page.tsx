import { redirect } from "next/navigation";

export default function ShortLink({ params }: { params: { roomCode: string } }) {
  redirect(`/join/${params.roomCode.toUpperCase()}`);
}
